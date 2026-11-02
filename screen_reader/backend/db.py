import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "simmer.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY,               -- the job ID from the upload
    video_name TEXT NOT NULL,          -- original file name, e.g. "红烧肉.mp4"
    file_name TEXT NOT NULL,           -- saved file name in uploads/
    created_at TEXT NOT NULL,          -- ISO timestamp (UTC)
    segments TEXT NOT NULL,            -- JSON: [{time, text, confidence, translation}]
    translation_error TEXT,
    recipe_error TEXT
);

CREATE TABLE IF NOT EXISTS recipes (
    video_id TEXT PRIMARY KEY REFERENCES videos(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    meal TEXT NOT NULL,
    protein TEXT NOT NULL,
    cuisine TEXT NOT NULL,
    vegetarian INTEGER NOT NULL,       -- 0 or 1
    one_pan INTEGER NOT NULL,
    total_minutes INTEGER,
    favourite INTEGER NOT NULL DEFAULT 0,
    data TEXT NOT NULL                 -- JSON: the full recipe from recipe.py
);
"""


def connect() -> sqlite3.Connection:
    # A new connection per call keeps this safe to use from FastAPI's
    # request threads and the background OCR job at the same time.
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_db():
    with connect() as connection:
        connection.executescript(SCHEMA)


def save_video(
    video_id: str,
    video_name: str,
    file_name: str,
    segments: list[dict],
    recipe: dict | None,
    translation_error: str | None,
    recipe_error: str | None,
):
    """Save a processed video, and its recipe if it has one."""
    with connect() as connection:
        connection.execute(
            "INSERT OR REPLACE INTO videos VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                video_id,
                video_name,
                file_name,
                datetime.now(timezone.utc).isoformat(),
                json.dumps(segments, ensure_ascii=False),
                translation_error,
                recipe_error,
            ),
        )
        if recipe:
            connection.execute(
                """INSERT OR REPLACE INTO recipes
                   (video_id, title, meal, protein, cuisine, vegetarian, one_pan, total_minutes, data)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    video_id,
                    recipe["title"],
                    recipe["meal"],
                    recipe["protein"],
                    recipe["cuisine"],
                    int(recipe["vegetarian"]),
                    int(recipe["one_pan"]),
                    recipe["total_minutes"],
                    json.dumps(recipe, ensure_ascii=False),
                ),
            )


def list_recipes() -> list[dict]:
    """Every saved recipe, newest first, with just what the library cards need."""
    with connect() as connection:
        rows = connection.execute(
            """SELECT r.video_id AS id, r.title, r.meal, r.protein, r.cuisine,
                      r.vegetarian, r.one_pan, r.total_minutes, r.favourite,
                      v.created_at, r.data
               FROM recipes r JOIN videos v ON v.id = r.video_id
               ORDER BY v.created_at DESC"""
        ).fetchall()

    recipes = []
    for row in rows:
        recipe = dict(row)
        data = json.loads(recipe.pop("data"))
        recipe["vegetarian"] = bool(recipe["vegetarian"])
        recipe["one_pan"] = bool(recipe["one_pan"])
        recipe["favourite"] = bool(recipe["favourite"])
        recipe["summary"] = data["summary"]["text"]
        # Ingredient names make the library search work for "chicken" etc.
        recipe["ingredients"] = [item["name"] for item in data["ingredients"]]
        recipes.append(recipe)
    return recipes


def get_video(video_id: str) -> dict | None:
    """A saved video with its transcript and recipe, or None if not found."""
    with connect() as connection:
        video = connection.execute("SELECT * FROM videos WHERE id = ?", (video_id,)).fetchone()
        recipe = connection.execute(
            "SELECT data, favourite FROM recipes WHERE video_id = ?", (video_id,)
        ).fetchone()

    if video is None:
        return None

    return {
        "id": video["id"],
        "video_name": video["video_name"],
        "file_name": video["file_name"],
        "created_at": video["created_at"],
        "segments": json.loads(video["segments"]),
        "translation_error": video["translation_error"],
        "recipe_error": video["recipe_error"],
        "recipe": json.loads(recipe["data"]) if recipe else None,
        "favourite": bool(recipe["favourite"]) if recipe else False,
    }


def set_favourite(video_id: str, favourite: bool) -> bool:
    """Mark a recipe as a favourite (or not). Returns False if it doesn't exist."""
    with connect() as connection:
        cursor = connection.execute(
            "UPDATE recipes SET favourite = ? WHERE video_id = ?", (int(favourite), video_id)
        )
    return cursor.rowcount > 0
