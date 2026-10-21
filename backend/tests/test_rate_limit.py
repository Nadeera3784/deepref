from collections.abc import AsyncIterator

import httpx
import pytest
from fastapi import Depends, FastAPI

from app.api.routes import auth
from app.core import rate_limit
from app.core.rate_limit import RateLimit, reset_rate_limits

limit = RateLimit("test", per_ip="2/minute", global_limit="3/minute", message="Slow down.")
app = FastAPI()


@app.post("/limited", dependencies=[Depends(limit)])
async def limited() -> dict[str, bool]:
    return {"ok": True}


@pytest.fixture(autouse=True)
async def _fresh_counters() -> AsyncIterator[None]:
    await reset_rate_limits()
    yield
    await reset_rate_limits()


def client_from(ip: str) -> httpx.AsyncClient:
    transport = httpx.ASGITransport(app=app, client=(ip, 12345))
    return httpx.AsyncClient(transport=transport, base_url="http://test")


async def statuses(ip: str, count: int) -> list[int]:
    async with client_from(ip) as client:
        return [(await client.post("/limited")).status_code for _ in range(count)]


async def test_blocks_a_client_after_its_limit() -> None:
    assert await statuses("10.0.0.1", 3) == [200, 200, 429]


async def test_rejection_explains_when_to_retry() -> None:
    await statuses("10.0.0.1", 2)
    async with client_from("10.0.0.1") as client:
        response = await client.post("/limited")
    assert response.status_code == 429
    assert 0 < int(response.headers["Retry-After"]) <= 60
    assert response.json()["detail"].startswith("Slow down. Please try again in ")


async def test_clients_are_limited_separately() -> None:
    assert await statuses("10.0.0.1", 2) == [200, 200]
    assert await statuses("10.0.0.2", 1) == [200]


async def test_global_limit_applies_across_clients() -> None:
    # Rotating (or spoofed) IPs can't get past the global ceiling of 3 per minute.
    results = [
        s for ip in ("10.0.0.1", "10.0.0.2", "10.0.0.3", "10.0.0.4") for s in await statuses(ip, 1)
    ]
    assert results == [200, 200, 200, 429]


async def test_rejected_requests_do_not_use_up_quota() -> None:
    await statuses("10.0.0.1", 2)
    assert await statuses("10.0.0.1", 5) == [429] * 5
    # Only 2 of the 3 global slots were used: the five rejections didn't count.
    assert await statuses("10.0.0.2", 1) == [200]


async def test_can_be_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(rate_limit.settings, "RATE_LIMIT_ENABLED", False)
    assert await statuses("10.0.0.1", 4) == [200] * 4


def test_register_route_is_rate_limited() -> None:
    route = next(r for r in auth.router.routes if getattr(r, "path", None) == "/auth/register")
    assert any(d.call is auth.register_rate_limit for d in route.dependant.dependencies)  # type: ignore[attr-defined]
