from __future__ import annotations

from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI

from starlette.middleware.cors import CORSMiddleware

from app_logging.logger import setup_logging
from app_logging.middleware import APILoggingMiddleware

from ApplicationLayer.api.APIRouter import router
from dependencies.dependencies import build_dependencies


BUILD_COMPLETE = False
RUN_UPDATES = False


setup_logging(force=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.deps = build_dependencies(BUILD_COMPLETE, RUN_UPDATES)
    logger = logging.getLogger(__name__)
    logger.info("Dependencies built successfully. ✅")
    yield
    # optional cleanup


app = FastAPI(title="PSE Planungstool API", lifespan=lifespan)

origins = [
    "http://localhost:3000",
    "http://193.196.36.46:3000",   # externe IP
]


app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.add_middleware(APILoggingMiddleware)
app.include_router(router)
