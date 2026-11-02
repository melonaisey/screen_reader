// Talking to the Python backend in backend/main.py.

export const API_URL = "http://localhost:8000";

export type Segment = {
  time: number;
  text: string;
  confidence?: number;
  translation?: string; // English, once translated
};

export type Ingredient = { amount: number | null; unit: string; name: string };

export type RecipeStep = { time: number; title: string; instruction: string };

// The recipe Claude writes from the transcript (backend/recipe.py).
export type Recipe = {
  title: string;
  meal: string;
  protein: string;
  cuisine: string;
  vegetarian: boolean;
  one_pan: boolean;
  total_minutes: number | null;
  servings: number | null;
  summary: { heading: string; text: string };
  facts: { prep: string; cook: string; total: string; level: string };
  ingredients: Ingredient[];
  steps: RecipeStep[];
  note: string;
};

// What the library needs for each saved recipe (db.list_recipes).
export type RecipeSummary = {
  id: string;
  title: string;
  meal: string;
  protein: string;
  cuisine: string;
  vegetarian: boolean;
  one_pan: boolean;
  total_minutes: number | null;
  favourite: boolean;
  created_at: string;
  summary: string;
  ingredients: string[];
};

export type Job = {
  status: "processing" | "done" | "error";
  stage: "reading" | "translating" | "recipe";
  video_name: string | null;
  created_at?: string; // only once saved
  processed: number;
  total: number;
  translated: number; // batches translated so far
  translate_total: number;
  segments: Segment[];
  transcript: string | null;
  recipe: Recipe | null;
  favourite: boolean;
  error: string | null;
  translation_error: string | null;
  recipe_error: string | null;
};

export async function uploadVideo(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_URL}/upload`, {
    method: "POST",
    body: formData,
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.detail || "Upload failed.");
  }

  return result.job_id;
}

export async function getJob(jobId: string): Promise<Job> {
  const response = await fetch(`${API_URL}/api/jobs/${jobId}`);
  const job = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(job.detail || "Could not check processing progress.");
  }

  return job;
}

export async function listRecipes(): Promise<RecipeSummary[]> {
  const response = await fetch(`${API_URL}/api/recipes`);

  if (!response.ok) {
    throw new Error("Could not load your recipes.");
  }

  return response.json();
}

export async function setFavourite(videoId: string, favourite: boolean) {
  const response = await fetch(`${API_URL}/api/recipes/${videoId}/favourite`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ favourite }),
  });

  if (!response.ok) {
    throw new Error("Could not update favourites.");
  }
}

export function thumbnailUrl(videoId: string) {
  return `${API_URL}/api/videos/${videoId}/thumbnail`;
}

export function videoFileUrl(videoId: string) {
  return `${API_URL}/api/videos/${videoId}/file`;
}
