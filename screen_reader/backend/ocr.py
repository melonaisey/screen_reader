import math
import sys
from collections.abc import Callable
from functools import cache
from pathlib import Path

import cv2
from paddleocr import PaddleOCR

FRAME_INTERVAL_SECONDS = 0.2  # OCR one frame per second
MIN_CONFIDENCE = 0.6  # ignore text PaddleOCR is unsure about
SUBTITLE_AREA = 0.3  # only read text in the bottom 30% of the frame


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

def read_frame_text(frame) -> list[str]:
    """Run OCR on one frame and return the lines of text found."""
    result = get_ocr().predict(crop_to_subtitles(frame))[0]

    return [
        text.strip()
        for text, score in zip(result["rec_texts"], result["rec_scores"])
        if score >= MIN_CONFIDENCE and text.strip()
    ]

def extract_text(
    video_path: Path,
    on_progress: Callable[[int, int], None] | None = None,
) -> str:
    """Sample frames from the video, OCR them, and return the combined text.

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

    lines: list[str] = []
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

                # Subtitles stay on screen for several frames, so only keep
                # lines that weren't already showing in the previous sample.
                for line in frame_lines:
                    if line not in previous_frame_lines:
                        lines.append(line)

                previous_frame_lines = set(frame_lines)

                processed += 1
                if on_progress:
                    # The frame count in the file is sometimes slightly off,
                    # so never report more than 100%.
                    on_progress(processed, max(total_samples, processed))

            frame_index += 1
    finally:
        video.release()

    return "\n".join(lines)


if __name__ == "__main__":
    # Run OCR on a video directly: python ocr.py uploads/some_video.mp4
    print(extract_text(Path(sys.argv[1])))
