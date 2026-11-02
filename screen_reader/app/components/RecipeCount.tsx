"use client";

import { useRecipes } from "@/app/lib/useRecipes";

export default function RecipeCount() {
  const { recipes } = useRecipes();

  if (!recipes) return <>Endless possibilities</>;
  return (
    <>
      {recipes.length} {recipes.length === 1 ? "recipe" : "recipes"}, endless possibilities
    </>
  );
}
