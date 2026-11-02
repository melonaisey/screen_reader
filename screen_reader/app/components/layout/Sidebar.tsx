"use client";

import Link from "next/link";
import { Beef, Globe, Heart, Library, Sprout, Utensils } from "lucide-react";
import type { RecipeSummary } from "@/app/lib/api";
import { useRecipes } from "@/app/lib/useRecipes";

// "Fish & seafood · 2" style lines, most common first.
function countBy(recipes: RecipeSummary[], key: (recipe: RecipeSummary) => string) {
  const counts = new Map<string, number>();
  for (const recipe of recipes) {
    const value = key(recipe);
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `${name} · ${count}`);
}

export default function Sidebar() {
  const { recipes } = useRecipes();
  const all = recipes ?? [];
  const favourites = all.filter((recipe) => recipe.favourite).length;

  const groups = [
    {
      name: "Favourites",
      Icon: Heart,
      items: favourites ? [`${favourites} go-to ${favourites === 1 ? "dish" : "dishes"}`] : [],
    },
    { name: "Recipes by main ingredient", Icon: Beef, items: countBy(all, (r) => r.protein) },
    { name: "Recipes by meal", Icon: Utensils, items: countBy(all, (r) => r.meal) },
    { name: "Recipes by cuisine", Icon: Globe, items: countBy(all, (r) => r.cuisine) },
  ];

  return (
    <aside className="hidden w-60 shrink-0 flex-col gap-[27px] border-r border-line px-5 pt-8 pb-7 lg:flex">
      <Link
        href="/library"
        className="flex items-center gap-2.5 rounded-md bg-blush p-3 text-[13px] font-semibold text-rose"
      >
        <Library size={18} strokeWidth={1.7} aria-hidden />
        <span className="flex-1">All recipes</span>
        <span className="text-xs font-normal">{recipes ? recipes.length : "–"}</span>
      </Link>

      <section className="flex flex-col gap-[22px]">
        <SectionLabel>Your groups</SectionLabel>
        {groups.map(({ name, Icon, items }) => (
          <div key={name} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Icon size={16} strokeWidth={1.7} className="text-rose" aria-hidden />
              <span className="flex-1 text-xs font-semibold text-ink">{name}</span>
            </div>
            {(items.length ? items : ["No recipes yet"]).map((item) => (
              <span key={item} className="pl-6 text-xs text-muted">
                {item}
              </span>
            ))}
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2 rounded-lg bg-shell p-3.5">
        <Sprout size={21} strokeWidth={1.7} className="text-rose" aria-hidden />
        <p className="font-display text-lg leading-tight text-rose">
          Good food, kept close.
        </p>
        <p className="text-[11px] leading-[1.6] text-muted">
          A little inspiration for your next home-cooked meal.
        </p>
      </section>
    </aside>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold tracking-[1.8px] text-muted uppercase">
      {children}
    </p>
  );
}
