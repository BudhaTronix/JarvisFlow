from fastapi import FastAPI

app = FastAPI(title="JARVIS Flow API")


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
