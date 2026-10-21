"""Request rate limiting as a FastAPI dependency, backed by the `limits` library."""

import math
import time

from fastapi import HTTPException, Request, status
from limits import RateLimitItem, parse_many
from limits.aio.strategies import MovingWindowRateLimiter
from limits.storage import storage_from_string

from app.core.config import settings

_limiter = MovingWindowRateLimiter(storage_from_string(settings.RATE_LIMIT_STORAGE_URI))


def _wait_message(seconds: int) -> str:
    if seconds < 60:
        return f"{seconds} second{'s' if seconds != 1 else ''}"
    minutes = math.ceil(seconds / 60)
    return f"{minutes} minute{'s' if minutes != 1 else ''}"


class RateLimit:
    """Allow a request only if it is within every limit, per client IP and globally.

    The client IP is `request.client.host`, which uvicorn's --proxy-headers sets from the
    X-Forwarded-For header that the Next.js frontend adds to every proxied request.
    Rejected requests don't use up quota, so a blocked client recovers on schedule.
    """

    def __init__(
        self, scope: str, *, per_ip: str, global_limit: str | None = None, message: str
    ) -> None:
        self.scope = scope
        self.per_ip: list[RateLimitItem] = parse_many(per_ip)
        self.global_limit: list[RateLimitItem] = parse_many(global_limit) if global_limit else []
        self.message = message

    async def __call__(self, request: Request) -> None:
        if not settings.RATE_LIMIT_ENABLED:
            return
        client_ip = request.client.host if request.client else "unknown"
        checks = [(item, (self.scope, "ip", client_ip)) for item in self.per_ip] + [
            (item, (self.scope, "global")) for item in self.global_limit
        ]

        for item, key in checks:
            if not await _limiter.test(item, *key):
                stats = await _limiter.get_window_stats(item, *key)
                retry_after = max(1, math.ceil(stats.reset_time - time.time()))
                raise HTTPException(
                    status.HTTP_429_TOO_MANY_REQUESTS,
                    f"{self.message} Please try again in {_wait_message(retry_after)}.",
                    headers={"Retry-After": str(retry_after)},
                )
        for item, key in checks:
            await _limiter.hit(item, *key)


async def reset_rate_limits() -> None:
    """Clear all counters (used by tests)."""
    await _limiter.storage.reset()
