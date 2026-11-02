import json

import anthropic

from translate import MODEL, has_credentials

SYSTEM_PROMPT = """You turn the transcript of a cooking video into a clear, accurate recipe.

The transcript was read from the video's burned-in subtitles with OCR and then machine-translated, so each line has the original Chinese and an English translation. Treat the Chinese as the source of truth when the two disagree, and expect an occasional OCR error.

Rules:
- Use only what the video says or clearly shows in its subtitles. Don't invent ingredients, amounts, temperatures or times. If an amount isn't mentioned, set it to null rather than guessing.
- Combine an ingredient mentioned in several places into one line (for example "1 tsp salt, divided").
- Convert spoken quantities to numbers and short units ("两勺" -> 2 tbsp, "半茶匙" -> 0.5 tsp). Use metric units where the video uses them.
- Write steps in the order they happen, as short imperative instructions. Each step's "time" must be the time in seconds of the transcript line where that step begins, copied exactly from the transcript.
- Estimate prep and cook times only from what the video describes; use "Not stated" when there's nothing to go on.
- Write the summary and note in warm, plain English.
- If the video isn't a cooking video, set "is_recipe" to false and fill the other fields with empty values."""

class RecipeError(Exception):
    """A recipe couldn't be created. The message is safe to show users."""


NULLABLE_NUMBER = {"anyOf": [{"type": "number"}, {"type": "null"}]}
NULLABLE_INTEGER = {"anyOf": [{"type": "integer"}, {"type": "null"}]}


def _object(properties: dict) -> dict:
    """A JSON schema object where every property is required."""
    return {
        "type": "object",
        "properties": properties,
        "required": list(properties),
        "additionalProperties": False,
    }


RESPONSE_SCHEMA = _object({
    "is_recipe": {"type": "boolean"},
    "title": {"type": "string"},
    "meal": {"type": "string", "enum": ["Breakfast", "Lunch", "Dinner", "Snack", "Dessert", "Drink"]},
    "protein": {
        "type": "string",
        "enum": ["Chicken", "Beef", "Pork", "Lamb", "Fish & seafood", "Tofu & eggs", "Vegetables", "Other"],
    },
    "cuisine": {"type": "string"},
    "vegetarian": {"type": "boolean"},
    "one_pan": {"type": "boolean"},
    "total_minutes": NULLABLE_INTEGER,
    "servings": NULLABLE_INTEGER,
    "summary": _object({"heading": {"type": "string"}, "text": {"type": "string"}}),
    "facts": _object({
        "prep": {"type": "string"},
        "cook": {"type": "string"},
        "total": {"type": "string"},
        "level": {"type": "string", "enum": ["Easy", "Medium", "Hard"]},
    }),
    "ingredients": {
        "type": "array",
        "items": _object({"amount": NULLABLE_NUMBER, "unit": {"type": "string"}, "name": {"type": "string"}}),
    },
    "steps": {
        "type": "array",
        "items": _object({"time": {"type": "number"}, "title": {"type": "string"}, "instruction": {"type": "string"}}),
    },
    "note": {"type": "string"},
})


def generate_recipe(segments: list[dict]) -> dict | None:
    """Ask Claude to write a recipe from the timestamped transcript.

    Returns the recipe as a dict matching RESPONSE_SCHEMA, or None if the
    video isn't a cooking video.
    """
    if not has_credentials():
        raise RecipeError(
            "Add your ANTHROPIC_API_KEY to backend/.env to create recipes."
        )

    transcript = "\n".join(
        f"[{segment['time']}s] {segment['text']}"
        + (f" | {segment['translation']}" if segment.get("translation") else "")
        for segment in segments
    )

    client = anthropic.Anthropic()
    response = client.beta.messages.create(
        model=MODEL,
        max_tokens=16000,
        # If a safety check declines the request, retry it on Anthropic's
        # recommended fallback model instead of failing.
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        output_config={
            # Combining scattered quantities and steps takes some reasoning,
            # so this uses more effort than translation does.
            "effort": "medium",
            "format": {"type": "json_schema", "schema": RESPONSE_SCHEMA},
        },
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": f"Transcript (time in seconds | Chinese | English):\n{transcript}"}],
    )

    if response.stop_reason == "refusal":
        raise RecipeError("Claude declined to write a recipe for this video.")
    if response.stop_reason == "max_tokens":
        raise RecipeError("This transcript was too long to turn into a recipe in one go.")

    recipe = json.loads(next(block.text for block in response.content if block.type == "text"))
    return recipe if recipe["is_recipe"] else None
