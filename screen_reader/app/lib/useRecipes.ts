"use client";

import { useEffect, useState } from "react";
import { listRecipes, type RecipeSummary } from "./api";

// The sidebar, home page and library all show the saved recipes. They share
// one request, and refreshRecipes() reloads it everywhere (e.g. after a
// recipe is favourited).
let request: Promise<RecipeSummary[]> | null = null;
const listeners = new Set<() => void>();

export function refreshRecipes() {
  request = null;
  listeners.forEach((reload) => reload());
}

export function useRecipes() {
  const [recipes, setRecipes] = useState<RecipeSummary[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    function load() {
      request ??= listRecipes();
      request
        .then((result) => {
          if (!cancelled) {
            setRecipes(result);
            setError("");
          }
        })
        .catch(() => {
          request = null;
          if (!cancelled) {
            setError("Couldn’t load your recipes. Is the backend running?");
          }
        });
    }

    load();
    listeners.add(load);
    return () => {
      cancelled = true;
      listeners.delete(load);
    };
  }, []);

  return { recipes, error };
}
