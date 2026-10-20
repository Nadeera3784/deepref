from fastapi import APIRouter, HTTPException, status

from app.services.health import check_database

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    """Liveness/readiness probe used by Docker: the API is up and can reach the database."""
    if not await check_database():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Database unavailable")
    return {"status": "ok"}
