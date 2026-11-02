import math
import sys
from collections.abc import Callable
from difflib import SequenceMatcher
from functools import cache
from pathlib import Path

import cv2
from paddleocr import PaddleOCR

FRAME_INTERVAL_SECONDS = 0.5  # OCR one frame per second
MIN_CONFIDENCE = 0.6  # ignore text PaddleOCR is unsure about
SUBTITLE_AREA = 0.3  # only read text in the bottom 30% of the frame
SIMILARITY_THRESHOLD = 0.8  # lines this similar count as the same subtitle


@cache
def get_ocr() -> PaddleOCR:
    # Loading the model takes a few seconds, so do it once on first use
    # and reuse it for every request after that.
    return PaddleOCR(
        lang="ch",
        # Video frames are already upright and flat, so skip the
        # document-scanning steps.
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
    )

def crop_to_subtitles(frame):
    """Keep only the bottom part of the frame, where subtitles appear."""
    height = frame.shape[0]
    top = int(height * (1 - SUBTITLE_AREA))
    return frame[top:, :]

def is_similar(a: str, b: str) -> bool:
    """True if two lines are at least SIMILARITY_THRESHOLD alike (0 to 1)."""
    return SequenceMatcher(None, a, b).ratio() >= SIMILARITY_THRESHOLD

def read_frame_text(frame) -> list[tuple[str, float]]:
    """Run OCR on one frame and return (line, confidence) for each line found."""
    result = get_ocr().predict(crop_to_subtitles(frame))[0]

    return [
        (text.strip(), float(score))
        for text, score in zip(result["rec_texts"], result["rec_scores"])
        if score >= MIN_CONFIDENCE and text.strip()
    ]

def extract_segments(
    video_path: Path,
    on_progress: Callable[[int, int], None] | None = None,
) -> list[dict]:
    """Sample frames from the video, OCR them, and return each new subtitle.

    Each segment is {"time": seconds into the video, "text": the line,
    "confidence": 0 to 1}.

    If on_progress is given, it's called after each sampled frame with
    (frames processed so far, total frames to process).
    """
    video = cv2.VideoCapture(str(video_path))

    if not video.isOpened():
        raise ValueError(f"Could not open video: {video_path}")

    fps = video.get(cv2.CAP_PROP_FPS) or 30
    step = max(1, round(fps * FRAME_INTERVAL_SECONDS))
    frame_count = int(video.get(cv2.CAP_PROP_FRAME_COUNT))
    total_samples = math.ceil(frame_count / step)

    segments: list[dict] = []
    previous_frame_lines: set[str] = set()
    frame_index = 0
    processed = 0

    try:
        while True:
            ok, frame = video.read()
            if not ok:
                break

            if frame_index % step == 0:
                frame_lines = read_frame_text(frame)

                # Subtitles stay on screen for several frames, and OCR can
                # read the same subtitle slightly differently each time. So
                # skip lines that are similar to one in the previous sample,
                # or to the last line we kept.
                recent_lines = previous_frame_lines | {
                    segment["text"] for segment in segments[-1:]
                }

                for line, confidence in frame_lines:
                    if not any(is_similar(line, recent) for recent in recent_lines):
                        segments.append({
                            "time": round(frame_index / fps, 1),
                            "text": line,
                            "confidence": round(confidence, 3),
                        })

                previous_frame_lines = {line for line, _ in frame_lines}

                processed += 1
                if on_progress:
                    # The frame count in the file is sometimes slightly off,
                    # so never report more than 100%.
                    on_progress(processed, max(total_samples, processed))

            frame_index += 1
    finally:
        video.release()

    return segments


def save_thumbnail(video_path: Path, image_path: Path, position: float = 0.4) -> bool:
    """Save one frame from the video as a JPEG, for the recipe card photo.

    position is how far into the video to take it (0.4 = 40% of the way in,
    usually past the intro and into the cooking). Returns False on failure.
    """
    video = cv2.VideoCapture(str(video_path))
    try:
        frame_count = int(video.get(cv2.CAP_PROP_FRAME_COUNT))
        video.set(cv2.CAP_PROP_POS_FRAMES, max(0, int(frame_count * position)))
        ok, frame = video.read()
        return ok and cv2.imwrite(str(image_path), frame)
    finally:
        video.release()


def extract_text(
    video_path: Path,
    on_progress: Callable[[int, int], None] | None = None,
) -> str:
    """Like extract_segments, but returns just the text, one line each."""
    segments = extract_segments(video_path, on_progress)
    return "\n".join(segment["text"] for segment in segments)


if __name__ == "__main__":
    # Run OCR on a video directly: python ocr.py uploads/some_video.mp4
    print(extract_text(Path(sys.argv[1])))
