from functools import lru_cache
from typing import Annotated, Literal

from pydantic import AnyHttpUrl, BeforeValidator, EmailStr, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


def _parse_csv(value: object) -> object:
    if isinstance(value, str) and not value.startswith("["):
        return [item.strip() for item in value.split(",") if item.strip()]
    return value


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_ignore_empty=True, extra="ignore")

    PROJECT_NAME: str = "DeepRef"
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: Literal["local", "production"] = "local"
    LOG_LEVEL: str = "INFO"

    SECRET_KEY: SecretStr
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    ALLOW_REGISTRATION: bool = True
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_STORAGE_URI: str = "async+memory://"
    REGISTER_RATE_LIMIT_PER_IP: str = "3/minute;10/hour"
    REGISTER_RATE_LIMIT_GLOBAL: str = "60/hour"
    CORS_ORIGINS: Annotated[list[AnyHttpUrl], BeforeValidator(_parse_csv)] = []

    FIRST_ADMIN_EMAIL: EmailStr
    FIRST_ADMIN_PASSWORD: SecretStr

    POSTGRES_HOST: str = "db"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "deepref"
    POSTGRES_PASSWORD: SecretStr
    POSTGRES_DB: str = "deepref"

    @property
    def database_url(self) -> str:
        password = self.POSTGRES_PASSWORD.get_secret_value()
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{password}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    LLM_BASE_URL: str = "http://llm:8080/v1"
    LLM_MODEL: str = "smollm2-1.7b-instruct"
    LLM_MAX_TOKENS: int = 512
    LLM_TEMPERATURE: float = 0.2
    LLM_TIMEOUT_SECONDS: float = 300.0

    EMBEDDING_BASE_URL: str = "http://embeddings:8080/v1"
    EMBEDDING_MODEL: str = "bge-small-en-v1.5"
    EMBEDDING_DIM: int = 384
    EMBEDDING_BATCH_SIZE: int = 16
    EMBEDDING_QUERY_PREFIX: str = "Represent this sentence for searching relevant passages: "

    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 150
    RETRIEVAL_TOP_K: int = 4
    RETRIEVAL_MIN_SCORE: float = 0.62
    HISTORY_MESSAGES: int = 6

    S3_ENDPOINT_URL: str = "http://rustfs:9000"
    S3_ACCESS_KEY: str
    S3_SECRET_KEY: SecretStr
    S3_BUCKET: str = "deepref"
    S3_REGION: str = "us-east-1"

    MAX_UPLOAD_MB: int = 25

    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_MB * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
