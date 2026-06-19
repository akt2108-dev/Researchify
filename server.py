import asyncio
import json
import threading
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

from pipeline import run_research_pipeline_streaming


BASE_DIR = Path(__file__).resolve().parent
RUN_TTL_SECONDS = 600


class ResearchRequest(BaseModel):
    topic: str


@dataclass
class RunState:
    topic: str
    queue: asyncio.Queue
    created_at: float
    status: str = "running"


app = FastAPI(title="Multi-Agent Research Engine")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=BASE_DIR / "templates")

runs: dict[str, RunState] = {}


def sse_payload(event: dict[str, Any]) -> str:
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


def cleanup_old_runs() -> None:
    now = time.time()
    expired = [
        run_id for run_id, state in runs.items()
        if now - state.created_at > RUN_TTL_SECONDS
    ]
    for run_id in expired:
        runs.pop(run_id, None)


def run_pipeline_worker(run_id: str, topic: str, loop: asyncio.AbstractEventLoop) -> None:
    state = runs.get(run_id)
    if state is None:
        return

    emitted_error = False

    def emit(event: dict[str, Any]) -> None:
        nonlocal emitted_error
        if event.get("event") == "error":
            emitted_error = True
        loop.call_soon_threadsafe(state.queue.put_nowait, event)

    try:
        run_research_pipeline_streaming(topic, emit)
        state.status = "complete"
    except Exception as exc:
        state.status = "error"
        if not emitted_error:
            emit({"event": "error", "message": str(exc)})
    finally:
        loop.call_soon_threadsafe(state.queue.put_nowait, {"event": "stream_end"})


@app.get("/")
async def index(request: Request):
    return templates.TemplateResponse(request, "index.html")


@app.get("/health")
async def health():
    return {"status": "ok", "active_runs": len(runs)}


@app.post("/research")
async def research(payload: ResearchRequest):
    topic = payload.topic.strip()
    if not topic:
        raise HTTPException(status_code=400, detail="Topic is required.")

    cleanup_old_runs()
    run_id = str(uuid.uuid4())
    loop = asyncio.get_running_loop()
    runs[run_id] = RunState(
        topic=topic,
        queue=asyncio.Queue(),
        created_at=time.time(),
    )

    thread = threading.Thread(
        target=run_pipeline_worker,
        args=(run_id, topic, loop),
        daemon=True,
    )
    thread.start()

    return {"run_id": run_id}


@app.get("/stream/{run_id}")
async def stream(run_id: str):
    state = runs.get(run_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Run not found.")

    async def event_generator():
        try:
            while True:
                event = await state.queue.get()
                if event.get("event") == "stream_end":
                    break
                yield sse_payload(event)
        finally:
            if state.status in {"complete", "error"}:
                runs.pop(run_id, None)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
