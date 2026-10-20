"""Object storage for user assets (uploaded PDFs today), backed by MinIO / any S3 API.

The bucket is private: the browser never talks to MinIO directly. Downloads are streamed
through the API so every access is authorized against the database.

Key layout groups everything a user owns under one prefix, so deleting a user's assets is a
single prefix delete:  users/{user_id}/documents/{document_id}.pdf
"""

import asyncio
import logging
import uuid
from collections.abc import Iterator
from dataclasses import dataclass
from typing import BinaryIO

from minio import Minio
from minio.deleteobjects import DeleteObject
from minio.error import S3Error
from urllib3.response import BaseHTTPResponse

from app.core.config import settings

logger = logging.getLogger(__name__)

_STREAM_CHUNK = 64 * 1024
_MISSING_CODES = {"NoSuchKey", "NoSuchObject", "NoSuchBucket"}


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


class ObjectStorage:
    """Async facade over the synchronous MinIO SDK; blocking calls run in worker threads."""

    def __init__(self, client: Minio, bucket: str) -> None:
        self._client = client
        self._bucket = bucket

    @classmethod
    def from_settings(cls) -> "ObjectStorage":
        client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY.get_secret_value(),
            secure=settings.MINIO_SECURE,
            region=settings.MINIO_REGION,
        )
        return cls(client, settings.MINIO_BUCKET)

    async def ensure_bucket(self) -> None:
        """Create the bucket if needed. In Docker Compose, minio-init normally does this."""
        if not await asyncio.to_thread(self._client.bucket_exists, self._bucket):
            await asyncio.to_thread(self._client.make_bucket, self._bucket)
            logger.info("Created storage bucket %s", self._bucket)

    async def ping(self) -> bool:
        try:
            return await asyncio.to_thread(self._client.bucket_exists, self._bucket)
        except Exception:
            logger.warning("Object storage health check failed", exc_info=True)
            return False

    async def put(self, key: str, data: BinaryIO, length: int, content_type: str) -> None:
        try:
            await asyncio.to_thread(
                self._client.put_object,
                self._bucket,
                key,
                data,
                length,
                content_type=content_type,
            )
        except S3Error as exc:
            raise StorageError(f"Could not store {key}: {exc.code}") from exc

    async def get_bytes(self, key: str) -> bytes:
        def read() -> bytes:
            response = self._client.get_object(self._bucket, key)
            try:
                return response.read()
            finally:
                response.close()
                response.release_conn()

        try:
            return await asyncio.to_thread(read)
        except S3Error as exc:
            raise self._translate(exc, key) from exc

    async def open_stream(self, key: str) -> StoredObject:
        """Open an object for streaming. Iterate `chunks` from a worker thread (Starlette does)."""
        try:
            stat = await asyncio.to_thread(self._client.stat_object, self._bucket, key)
            response = await asyncio.to_thread(self._client.get_object, self._bucket, key)
        except S3Error as exc:
            raise self._translate(exc, key) from exc
        return StoredObject(
            size=stat.size or 0,
            content_type=stat.content_type or "application/octet-stream",
            chunks=_iter_response(response),
        )

    async def delete(self, key: str) -> None:
        try:
            await asyncio.to_thread(self._client.remove_object, self._bucket, key)
        except S3Error:
            # The database row is already gone; an orphaned object is harmless but worth noting.
            logger.exception("Failed to delete object %s", key)

    async def delete_prefix(self, prefix: str) -> None:
        def remove_all() -> None:
            objects = self._client.list_objects(self._bucket, prefix=prefix, recursive=True)
            to_delete = (DeleteObject(obj.object_name) for obj in objects if obj.object_name)
            for error in self._client.remove_objects(self._bucket, to_delete):
                logger.error("Failed to delete object %s: %s", error.name, error.message)

        try:
            await asyncio.to_thread(remove_all)
        except S3Error:
            logger.exception("Failed to delete objects under %s", prefix)

    @staticmethod
    def _translate(exc: S3Error, key: str) -> Exception:
        if exc.code in _MISSING_CODES:
            return ObjectNotFoundError(key)
        return StorageError(f"Storage error for {key}: {exc.code}")


def _iter_response(response: BaseHTTPResponse) -> Iterator[bytes]:
    try:
        yield from response.stream(_STREAM_CHUNK)
    finally:
        response.close()
        response.release_conn()
