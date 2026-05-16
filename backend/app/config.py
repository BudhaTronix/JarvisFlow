from functools import lru_cache
import os

from pydantic import BaseModel, Field


class Settings(BaseModel):
    frontend_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    raw_origins = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
    origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    return Settings(frontend_origins=origins or ["http://localhost:5173"])
