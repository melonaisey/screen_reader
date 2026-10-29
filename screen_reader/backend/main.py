from pathlib import Path
from uuid import uuid4

from fastapi import BackgroundTasks, FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from ocr import extract_text

app = FastAPI()

# Allow your local Next.js frontend to call this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm"}
MAX_SIZE = 500 * 1024 * 1024  # 500 MB

# Progress of each OCR job, keyed by job ID. This lives in memory, so jobs
# are lost when the server restarts (including auto-reloads in dev mode).
jobs: dict[str, dict] = {}


def run_ocr_job(job_id: str, video_path: Path):
    job = jobs[job_id]

    def update_progress(processed: int, total: int):
        job["processed"] = processed
        job["total"] = total

    try:
        job["transcript"] = extract_text(video_path, on_progress=update_progress)
        job["status"] = "done"
    except Exception as error:
        job["error"] = str(error)
        job["status"] = "error"


@app.get("/")
def home():
    return {"message": "Python backend is working!"}


@app.get("/api/hello")
def hello():
    return {
        "message": "Hello from Python!",
        "status": "success"
    }


@app.post("/upload")
async def upload_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    extension = Path(file.filename or "").suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Unsupported video format."
        )

    saved_path = UPLOAD_DIR / f"{uuid4().hex}{extension}"
    size = 0

    try:
        with saved_path.open("wb") as destination:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)

                if size > MAX_SIZE:
                    raise HTTPException(
                        status_code=413,
                        detail="Video exceeds the 500 MB limit."
                    )

                destination.write(chunk)

    except Exception:
        saved_path.unlink(missing_ok=True)
        raise

    finally:
        await file.close()

    # OCR can take minutes, so start it in the background and reply right
    # away. The frontend then checks GET /api/jobs/{job_id} for progress.
    job_id = uuid4().hex
    jobs[job_id] = {
        "status": "processing",
        "processed": 0,
        "total": 0,
        "transcript": None,
        "error": None,
    }
    background_tasks.add_task(run_ocr_job, job_id, saved_path)

    return {
        "job_id": job_id,
        "filename": saved_path.name,
        "size_bytes": size
    }


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str):
    job = jobs.get(job_id)

    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")

    return job
