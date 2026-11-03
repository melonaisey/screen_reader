from collections.abc import Callable
from pathlib import Path

import yt_dlp

MAX_DURATION_SECONDS = 30 * 60  # longer videos take too long to read

# OCR only needs the picture, so download a video-only stream of 720p or
# less. A single stream needs no FFmpeg to merge, and is smaller to fetch.
VIDEO_FORMAT = (
    "bv*[height<=720][vcodec^=avc1]/bv*[height<=720][ext=mp4]/bv*[height<=720]"
    "/b[height<=720]/b"
)


class FetchError(Exception):
    """The video couldn't be fetched. The message is safe to show users."""


def video_details(info: dict) -> dict:
    """The details about a linked video that are worth keeping."""
    return {
        "source_url": info.get("webpage_url") or info.get("original_url"),
        "source_id": info.get("id"),
        "platform": info.get("extractor_key") or info.get("extractor"),
        "title": info.get("title") or "Untitled video",
        "creator": info.get("uploader") or info.get("channel") or "",
        "thumbnail_url": info.get("thumbnail"),
        "duration": info.get("duration"),
    }


def download_video(
    url: str,
    folder: Path,
    on_progress: Callable[[int, int], None] | None = None,
) -> tuple[Path, dict]:
    """Download the video at url into folder, for processing only.

    The caller is responsible for deleting folder afterwards; nothing here
    is meant to be kept. Returns (path to the video file, video_details).

    If on_progress is given, it's called with (bytes downloaded, total bytes).
    """

    def report(status: dict):
        if on_progress and status.get("status") == "downloading":
            total = status.get("total_bytes") or status.get("total_bytes_estimate") or 0
            on_progress(status.get("downloaded_bytes", 0), int(total))

    options = {
        "format": VIDEO_FORMAT,
        "outtmpl": str(folder / "video.%(ext)s"),
        "noplaylist": True,  # a playlist link means just that one video
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,  # we report progress ourselves

        "progress_hooks": [report],
    }

    try:
        with yt_dlp.YoutubeDL(options) as downloader:
            # Check the details first, so a very long video isn't downloaded.
            info = downloader.extract_info(url, download=False)
            if info.get("_type") == "playlist":
                raise FetchError("That link is a playlist. Please paste a link to a single video.")

            duration = info.get("duration") or 0
            if duration > MAX_DURATION_SECONDS:
                raise FetchError(
                    f"That video is {round(duration / 60)} minutes long. "
                    f"Videos up to {MAX_DURATION_SECONDS // 60} minutes are supported."
                )

            info = downloader.process_ie_result(info, download=True)
    except yt_dlp.utils.DownloadError as error:
        message = str(error).removeprefix("ERROR: ").split("\n")[0]
        raise FetchError(f"Couldn’t get that video: {message}") from error

    files = [path for path in folder.iterdir() if path.name.startswith("video.")]
    if not files:
        raise FetchError("Couldn’t get that video: the download didn’t produce a file.")

    return files[0], video_details(info)
