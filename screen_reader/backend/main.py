import tempfile
from pathlib import Path
from uuid import uuid4

import anthropic
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel

import db
from fetch import FetchError, download_video
from ocr import extract_segments, save_thumbnail
from recipe import RecipeError, generate_recipe
from translate import TranslationError, translate_segments

# Secrets like ANTHROPIC_API_KEY live in backend/.env (ignored by git).
load_dotenv(Path(__file__).resolve().parent / ".env")

app = FastAPI()

# Allow your local Next.js frontend to call this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BACKEND_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BACKEND_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
THUMBNAIL_DIR = BACKEND_DIR / "thumbnails"
THUMBNAIL_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm"}
MAX_SIZE = 500 * 1024 * 1024  # 500 MB

db.init_db()

# Progress of each video while it's being processed, keyed by job ID. Once
# it's finished, the result is saved to the database (db.py), so it survives
# server restarts. Videos themselves are never kept: links are downloaded to
# a temporary folder and uploads are deleted once they've been processed.
jobs: dict[str, dict] = {}


def new_job(video_name: str, stage: str, file_name: str = "") -> str:
    job_id = uuid4().hex
    jobs[job_id] = {
        "status": "processing",
        "stage": stage,  # "downloading" -> "reading" -> "translating" -> "recipe"
        "video_name": video_name,
        "file_name": file_name,
        "downloaded": 0,
        "download_total": 0,
        "processed": 0,
        "total": 0,
        "translated": 0,
        "translate_total": 0,
        "segments": [],
        "transcript": None,
        "recipe": None,
        "favourite": False,
        "error": None,
        "translation_error": None,
        "recipe_error": None,
        **{column: None for column in db.SOURCE_COLUMNS},
    }
    return job_id


def describe_api_error(error: anthropic.APIError) -> str:
    """A short, user-friendly message for an Anthropic API error."""
    if isinstance(error, anthropic.AuthenticationError):
        return "The Anthropic API key in backend/.env was rejected."
    if isinstance(error, anthropic.RateLimitError):
        return "The Anthropic API is busy. Try again in a minute."
    if isinstance(error, anthropic.APIStatusError):
        return f"Anthropic API error {error.status_code}."
    if isinstance(error, anthropic.APIConnectionError):
        return "Couldn't reach the Anthropic API. Check your internet connection."
    return "Something went wrong talking to the Anthropic API."


def process_video(job_id: str, video_path: Path, source: dict | None = None):
    """Read, translate and make a recipe from a video, then save the results.

    source holds the details of a linked video; it's None for uploads.
    """
    job = jobs[job_id]
    job["stage"] = "reading"

    def update_progress(processed: int, total: int):
        job["processed"] = processed
        job["total"] = total

    def update_translation_progress(done: int, total: int):
        job["translated"] = done
        job["translate_total"] = total

    try:
        segments = extract_segments(video_path, on_progress=update_progress)
    except Exception as error:
        job["error"] = str(error)
        job["status"] = "error"
        return

    # Publish the Chinese lines now, so they show while translation runs.
    job["segments"] = segments
    job["transcript"] = "\n".join(segment["text"] for segment in segments)

    # A failed translation or recipe shouldn't lose the transcript, so those
    # errors are reported separately and the job still finishes.
    if segments:
        job["stage"] = "translating"
        try:
            translations = translate_segments(segments, on_progress=update_translation_progress)
            for segment, english in zip(segments, translations):
                segment["translation"] = english
        except TranslationError as error:
            job["translation_error"] = str(error)
        except anthropic.APIError as error:
            job["translation_error"] = describe_api_error(error)

        job["stage"] = "recipe"
        try:
            job["recipe"] = generate_recipe(segments)
            if job["recipe"] is None:
                job["recipe_error"] = "This doesn’t look like a cooking video, so no recipe was made."
        except RecipeError as error:
            job["recipe_error"] = str(error)
        except anthropic.APIError as error:
            job["recipe_error"] = describe_api_error(error)
    else:
        job["recipe_error"] = "No subtitles were found, so there was nothing to make a recipe from."

    # Linked videos use the platform's own thumbnail; uploads keep one frame.
    if source is None:
        save_thumbnail(video_path, THUMBNAIL_DIR / f"{job_id}.jpg")

    db.save_video(
        job_id,
        video_name=job["video_name"],
        file_name="",  # the video itself isn't kept
        segments=segments,
        recipe=job["recipe"],
        translation_error=job["translation_error"],
        recipe_error=job["recipe_error"],
        source=source,
    )
    job["status"] = "done"


def run_upload_job(job_id: str, video_path: Path):
    try:
        process_video(job_id, video_path)
    finally:
        # Only the recipe is kept, never the video.
        video_path.unlink(missing_ok=True)


def run_link_job(job_id: str, url: str):
    job = jobs[job_id]

    def update_download_progress(downloaded: int, total: int):
        job["downloaded"] = downloaded
        job["download_total"] = total

    # The temporary folder, and the video in it, is deleted as soon as this
    # block ends, whether processing worked or not.
    with tempfile.TemporaryDirectory(prefix="simmer-") as folder:
        try:
            video_path, source = download_video(url, Path(folder), on_progress=update_download_progress)
        except FetchError as error:
            job["error"] = str(error)
            job["status"] = "error"
            return

        job["video_name"] = source["title"]
        job.update({column: source[column] for column in db.SOURCE_COLUMNS})
        process_video(job_id, video_path, source)


@app.get("/")
def home():
    return {"message": "Python backend is working!"}


@app.get("/api/hello")
def hello():
    return {
        "message": "Hello from Python!",
        "status": "success"
    }


class LinkRequest(BaseModel):
    url: str


@app.post("/api/links")
def submit_link(request: LinkRequest, background_tasks: BackgroundTasks):
    """Make a recipe from a video link (YouTube, Bilibili, ...)."""
    url = request.url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Please paste a full video link starting with https://.")

    job_id = new_job(video_name="Video from link", stage="downloading")
    background_tasks.add_task(run_link_job, job_id, url)
    return {"job_id": job_id}


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

    # Processing can take minutes, so start it in the background and reply
    # right away. The frontend then checks GET /api/jobs/{job_id} for progress.
    job_id = new_job(video_name=file.filename or "Uploaded video", stage="reading", file_name=saved_path.name)
    background_tasks.add_task(run_upload_job, job_id, saved_path)

    return {
        "job_id": job_id,
        "filename": saved_path.name,
        "size_bytes": size
    }


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str):
    """A video in progress, or a finished one from the database."""
    if job_id in jobs and jobs[job_id]["status"] != "done":
        return jobs[job_id]

    video = db.get_video(job_id)
    if video is None:
        # A job that failed before being saved is still in memory.
        if job_id in jobs:
            return jobs[job_id]
        raise HTTPException(status_code=404, detail="Video not found.")

    segments = video["segments"]
    return {
        **video,
        "status": "done",
        "stage": "recipe",
        "downloaded": 0,
        "download_total": 0,
        "processed": 0,
        "total": 0,
        "translated": 0,
        "translate_total": 0,
        "transcript": "\n".join(segment["text"] for segment in segments),
        "error": None,
    }


@app.get("/api/recipes")
def get_recipes():
    """Every saved recipe, newest first."""
    return db.list_recipes()


class FavouriteUpdate(BaseModel):
    favourite: bool


@app.put("/api/recipes/{video_id}/favourite")
def update_favourite(video_id: str, update: FavouriteUpdate):
    if not db.set_favourite(video_id, update.favourite):
        raise HTTPException(status_code=404, detail="Recipe not found.")
    return {"favourite": update.favourite}


@app.get("/api/videos/{video_id}/thumbnail")
def get_thumbnail(video_id: str):
    path = THUMBNAIL_DIR / f"{video_id}.jpg"
    if path.is_file():
        return FileResponse(path, media_type="image/jpeg")

    # Linked videos use the platform's own thumbnail.
    video = db.get_video(video_id)
    thumbnail_url = (video or jobs.get(video_id) or {}).get("thumbnail_url")
    if thumbnail_url:
        return RedirectResponse(thumbnail_url)

    raise HTTPException(status_code=404, detail="Thumbnail not found.")


@app.get("/api/videos/{video_id}/file")
def get_video_file(video_id: str):
    """An uploaded video, while it's being processed. Videos uploaded before
    they stopped being kept can still be played too."""
    video = db.get_video(video_id)
    file_name = video["file_name"] if video else jobs.get(video_id, {}).get("file_name")
    path = UPLOAD_DIR / (file_name or "")
    if not file_name or not path.is_file():
        raise HTTPException(status_code=404, detail="Video file not found.")
    return FileResponse(path)
