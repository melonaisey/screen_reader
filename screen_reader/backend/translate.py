import json
import os
from collections.abc import Callable

import anthropic

MODEL = "claude-opus-5-5"
BATCH_SIZE = 40  # subtitle lines per request
CONTEXT_LINES = 5  # earlier lines sent along so each batch is read in context

SYSTEM_PROMPT = """You translate Chinese subtitles from cooking videos into natural, everyday English.

The subtitles were read from the video frames with OCR, so a character is occasionally wrong. When a line looks garbled, translate what the speaker most likely meant, using the surrounding lines to decide. Keep ingredients, quantities, units, temperatures and times accurate.

You receive JSON with two lists:
- "translate": the lines to translate. Translate each one separately and return it with its id. Never merge, split or skip lines.
- "context": the lines just before them, only there to help you understand. Do not translate these.

If a line is already English, or is only a number or a name, return it unchanged."""

# Structured output: Claude must reply with exactly this JSON shape.
RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "translations": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "integer"},
                    "english": {"type": "string"},
                },
                "required": ["id", "english"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["translations"],
    "additionalProperties": False,
}


class TranslationError(Exception):
    """Translation couldn't be completed. The message is safe to show users."""


def has_credentials() -> bool:
    """True if an Anthropic API key (or auth token) is configured."""
    return bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"))


def translate_segments(
    segments: list[dict],
    on_progress: Callable[[int, int], None] | None = None,
) -> list[str]:
    """Translate each segment's Chinese "text" to English.

    Returns one English line per segment, in the same order, so the caller
    can attach each translation to its segment (and timestamp). Lines are
    sent in batches of BATCH_SIZE so Claude sees the conversation around each
    line instead of translating it in isolation.

    If on_progress is given, it's called after each batch with
    (batches done so far, total batches).
    """
    if not has_credentials():
        raise TranslationError(
            "Add your ANTHROPIC_API_KEY to backend/.env to translate the subtitles."
        )

    client = anthropic.Anthropic()
    translations = [""] * len(segments)
    batch_starts = range(0, len(segments), BATCH_SIZE)

    for batch_number, start in enumerate(batch_starts, 1):
        batch = segments[start:start + BATCH_SIZE]
        context = segments[max(0, start - CONTEXT_LINES):start]
        request = {
            "context": [segment["text"] for segment in context],
            "translate": [
                {"id": start + offset, "text": segment["text"]}
                for offset, segment in enumerate(batch)
            ],
        }

        response = client.beta.messages.create(
            model=MODEL,
            max_tokens=16000,
            # If a safety check declines the request, retry it on Anthropic's
            # recommended fallback model instead of failing.
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_config={
                # Translating subtitles is straightforward, so low effort keeps
                # it fast and cheap.
                "effort": "low",
                "format": {"type": "json_schema", "schema": RESPONSE_SCHEMA},
            },
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": json.dumps(request, ensure_ascii=False)}],
        )

        if response.stop_reason == "refusal":
            raise TranslationError("Claude declined to translate part of this transcript.")
        if response.stop_reason == "max_tokens":
            raise TranslationError("A batch of subtitles was too long to translate in one go.")

        reply = next(block.text for block in response.content if block.type == "text")
        for item in json.loads(reply)["translations"]:
            # Ignore any id outside this batch, so a mistake can't overwrite
            # another line's translation.
            if start <= item["id"] < start + len(batch):
                translations[item["id"]] = item["english"].strip()

        if on_progress:
            on_progress(batch_number, len(batch_starts))

    return translations
