from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app_logging.logger import setup_logging
from app_logging.middleware import APILoggingMiddleware

from ApplicationLayer.api.APIRouter import router
from dependencies.dependencies import build_dependencies


BUILD_COMPLETE = False
RUN_UPDATES = False

IS_PRODUCTION = os.getenv("APP_ENV", "production") == "production"

setup_logging(force=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.deps = build_dependencies(BUILD_COMPLETE, RUN_UPDATES)
    logging.getLogger(__name__).info("Dependencies built successfully. ✅")
    yield


app = FastAPI(
    title="PSE Planungstool API",
    lifespan=lifespan,
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
)


origins = ["https://www.kommma.com"]
allowed_hosts = ["www.kommma.com"]

if not IS_PRODUCTION:
    origins.append("http://localhost:3000")
    allowed_hosts += ["localhost", "127.0.0.1"]


app.add_middleware(APILoggingMiddleware)                                 # innen
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=allowed_hosts)   # außen

app.include_router(router)