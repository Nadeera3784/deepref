"""Object storage for user assets (uploaded PDFs today), on RustFS or any S3-compatible service.

The bucket is private: the browser never talks to object storage directly. Downloads are
streamed through the API so every access is authorized against the database.

Key layout groups everything a user owns under one prefix, so deleting a user's assets is a
single prefix delete:  users/{user_id}/documents/{document_id}.pdf
"""

import asyncio
import logging
import uuid
from collections.abc import Iterator
from dataclasses import dataclass
from typing import TYPE_CHECKING, BinaryIO

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from botocore.response import StreamingBody

from app.core.config import settings

if TYPE_CHECKING:
    from types_boto3_s3 import S3Client
    from types_boto3_s3.type_defs import ObjectIdentifierTypeDef

logger = logging.getLogger(__name__)

_STREAM_CHUNK = 64 * 1024
_MISSING_CODES = {"NoSuchKey", "NoSuchBucket", "404", "NotFound"}
_DELETE_BATCH = 1000


class ObjectNotFoundError(Exception):
    pass


class StorageError(Exception):
    pass


def user_prefix(user_id: uuid.UUID) -> str:
    return f"users/{user_id}/"


def document_key(user_id: uuid.UUID, document_id: uuid.UUID) -> str:
    return f"{user_prefix(user_id)}documents/{document_id}.pdf"


@dataclass(frozen=True, slots=True)
class StoredObject:
    size: int
    content_type: str
    chunks: Iterator[bytes]


def _error_code(exc: ClientError) -> str:
    return str(exc.response.get("Error", {}).get("Code", ""))


class ObjectStorage:
    """Async facade over the synchronous boto3 client; blocking calls run in worker threads."""

    def __init__(self, client: "S3Client", bucket: str) -> None:
        self._client = client
        self._bucket = bucket

    @classmethod
    def from_settings(cls) -> "ObjectStorage":
        client = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT_URL,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY.get_secret_value(),
            region_name=settings.S3_REGION,
            config=Config(
                signature_version="s3v4",
                s3={"addressing_style": "path"},
                request_checksum_calculation="when_required",
                response_checksum_validation="when_required",
                retries={"max_attempts": 3, "mode": "standard"},
            ),
        )
        return cls(client, settings.S3_BUCKET)

    async def ensure_bucket(self) -> None:
        """Check the bucket exists, creating it if these credentials are allowed to.

        In Docker Compose the rustfs-init job creates it, and the app user can't create buckets.
        """
        try:
            await asyncio.to_thread(self._client.head_bucket, Bucket=self._bucket)
            return
        except ClientError as exc:
            if _error_code(exc) not in _MISSING_CODES:
                raise
        try:
            await asyncio.to_thread(self._client.create_bucket, Bucket=self._bucket)
            logger.info("Created storage bucket %s", self._bucket)
        except ClientError as exc:
            raise RuntimeError(
                f"Storage bucket '{self._bucket}' does not exist and could not be created "
                f"({_error_code(exc)}). Create it, or run the rustfs-init service."
            ) from exc

    async def ping(self) -> bool:
        try:
            await asyncio.to_thread(self._client.head_bucket, Bucket=self._bucket)
            return True
        except (ClientError, BotoCoreError):
            logger.warning("Object storage health check failed", exc_info=True)
            return False

    async def put(self, key: str, data: BinaryIO, length: int, content_type: str) -> None:
        try:
            await asyncio.to_thread(
                self._client.put_object,
                Bucket=self._bucket,
                Key=key,
                Body=data,
                ContentLength=length,
                ContentType=content_type,
            )
        except (ClientError, BotoCoreError) as exc:
            raise StorageError(f"Could not store {key}: {exc}") from exc

    async def get_bytes(self, key: str) -> bytes:
        def read() -> bytes:
            body = self._client.get_object(Bucket=self._bucket, Key=key)["Body"]
            try:
                return body.read()
            finally:
                body.close()

        try:
            return await asyncio.to_thread(read)
        except ClientError as exc:
            raise self._translate(exc, key) from exc
        except BotoCoreError as exc:
            raise StorageError(f"Storage error for {key}: {exc}") from exc

    async def open_stream(self, key: str) -> StoredObject:
        """Open an object for streaming. Iterate `chunks` from a worker thread (Starlette does)."""
        try:
            response = await asyncio.to_thread(
                self._client.get_object, Bucket=self._bucket, Key=key
            )
        except ClientError as exc:
            raise self._translate(exc, key) from exc
        except BotoCoreError as exc:
            raise StorageError(f"Storage error for {key}: {exc}") from exc
        return StoredObject(
            size=response.get("ContentLength", 0),
            content_type=response.get("ContentType", "application/octet-stream"),
            chunks=_iter_body(response["Body"]),
        )

    async def delete(self, key: str) -> None:
        try:
            await asyncio.to_thread(self._client.delete_object, Bucket=self._bucket, Key=key)
        except (ClientError, BotoCoreError):
            logger.exception("Failed to delete object %s", key)

    async def delete_prefix(self, prefix: str) -> None:
        def remove_all() -> None:
            paginator = self._client.get_paginator("list_objects_v2")
            for page in paginator.paginate(
                Bucket=self._bucket, Prefix=prefix, PaginationConfig={"PageSize": _DELETE_BATCH}
            ):
                keys: list[ObjectIdentifierTypeDef] = [
                    {"Key": obj["Key"]} for obj in page.get("Contents", []) if "Key" in obj
                ]
                if not keys:
                    continue
                result = self._client.delete_objects(
                    Bucket=self._bucket, Delete={"Objects": keys, "Quiet": True}
                )
                for error in result.get("Errors", []):
                    logger.error(
                        "Failed to delete object %s: %s", error.get("Key"), error.get("Message")
                    )

        try:
            await asyncio.to_thread(remove_all)
        except (ClientError, BotoCoreError):
            logger.exception("Failed to delete objects under %s", prefix)

    @staticmethod
    def _translate(exc: ClientError, key: str) -> Exception:
        if _error_code(exc) in _MISSING_CODES:
            return ObjectNotFoundError(key)
        return StorageError(f"Storage error for {key}: {_error_code(exc)}")


def _iter_body(body: StreamingBody) -> Iterator[bytes]:
    try:
        yield from body.iter_chunks(_STREAM_CHUNK)
    finally:
        body.close()
