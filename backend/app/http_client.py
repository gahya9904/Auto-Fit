"""Borrow the lifespan client without closing it; standalone callers own a client."""
from contextlib import asynccontextmanager

import httpx


@asynccontextmanager
async def client_scope(client: httpx.AsyncClient | None = None):
    if client is not None:
        yield client
    else:
        async with httpx.AsyncClient(timeout=10, trust_env=False) as owned:
            yield owned
