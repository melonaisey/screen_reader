"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Clock3, Heart, Plus, Search } from "lucide-react";
import { setFavourite, thumbnailUrl, type RecipeSummary } from "@/app/lib/api";
import { refreshRecipes, useRecipes } from "@/app/lib/useRecipes";
import { cn } from "@/app/lib/format";

const filters = [
  { label: "All recipes", matches: () => true },
  { label: "Favourites", matches: (r: RecipeSummary) => r.favourite },
  { label: "Under 30 minutes", matches: (r: RecipeSummary) => r.total_minutes !== null && r.total_minutes < 30 },
  { label: "Vegetarian", matches: (r: RecipeSummary) => r.vegetarian },
  { label: "One-pan meals", matches: (r: RecipeSummary) => r.one_pan },
];

export default function RecipeLibrary() {
  const { recipes, error } = useRecipes();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(filters[0]);
  // Favourites change here right away, before the server confirms.
  const [favouriteOverrides, setFavouriteOverrides] = useState<Record<string, boolean>>({});

  const all = (recipes ?? []).map((recipe) =>
    recipe.id in favouriteOverrides ? { ...recipe, favourite: favouriteOverrides[recipe.id] } : recipe,
  );

  const search = query.trim().toLowerCase();
  const visible = all.filter(
    (recipe) =>
      filter.matches(recipe) &&
      [recipe.title, recipe.cuisine, recipe.protein, recipe.meal, ...recipe.ingredients]
        .join(" ")
        .toLowerCase()
        .includes(search),
  );

  // Feature the newest favourite, or the newest recipe if there are none.
  const featured = all.find((recipe) => recipe.favourite) ?? all[0];

  async function toggleFavourite(recipe: RecipeSummary) {
    const next = !recipe.favourite;
    setFavouriteOverrides((current) => ({ ...current, [recipe.id]: next }));
    try {
      await setFavourite(recipe.id, next);
      refreshRecipes();
    } catch {
      setFavouriteOverrides((current) => ({ ...current, [recipe.id]: !next }));
    }
  }

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-semibold tracking-[1.8px] text-rose uppercase">
            Your personal cookbook
          </p>
          <h1 className="font-display text-[34px] leading-tight sm:text-[40px]">
            Your kitchen, collected.
          </h1>
          <p className="text-[13px] text-muted">
            All the dishes you’ve watched. Ready to make your own.
          </p>
        </div>
        {recipes && (
          <p className="flex items-baseline gap-[7px] pb-1">
            <span className="font-display text-[31px] leading-none text-rose">{recipes.length}</span>
            <span className="text-xs text-muted">
              {recipes.length === 1 ? "recipe" : "recipes"} &amp; counting
            </span>
          </p>
        )}
      </header>

      {error ? (
        <Notice>{error}</Notice>
      ) : !recipes ? (
        <Notice>Loading your recipes…</Notice>
      ) : recipes.length === 0 ? (
        <EmptyLibrary />
      ) : (
        <>
          {featured && <FeaturedRecipe recipe={featured} />}

          <section className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-[18px]">
              <h2 className="flex-1 font-display text-[27px] whitespace-nowrap">
                All recipes <span className="text-muted">{all.length}</span>
              </h2>
              <label className="flex h-[38px] w-full items-center gap-2 rounded-md border border-line bg-white px-3 focus-within:ring-4 focus-within:ring-blush sm:w-[250px]">
                <Search size={16} strokeWidth={1.7} className="shrink-0 text-muted" aria-hidden />
                <span className="sr-only">Search recipes</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Find a recipe or ingredient"
                  className="w-full bg-transparent text-xs outline-none placeholder:text-muted"
                />
              </label>
              <span className="text-xs">Recently added</span>
            </div>

            <div className="flex flex-wrap gap-[9px]" role="group" aria-label="Filter recipes">
              {filters.map((option) => {
                const active = option === filter;
                return (
                  <button
                    key={option.label}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFilter(option)}
                    className={cn(
                      "rounded-full border px-[13px] py-2 text-[11px] leading-none transition",
                      active
                        ? "border-rose bg-rose text-white"
                        : "border-line bg-paper text-muted hover:border-pastel-pink hover:text-rose",
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            {visible.length === 0 ? (
              <Notice>No recipes match that yet. Try another search or filter.</Notice>
            ) : (
              <ul className="grid gap-[22px] sm:grid-cols-2 xl:grid-cols-3">
                {visible.map((recipe) => (
                  <li key={recipe.id}>
                    <RecipeCard recipe={recipe} onToggleFavourite={() => toggleFavourite(recipe)} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}

function FeaturedRecipe({ recipe }: { recipe: RecipeSummary }) {
  return (
    <section className="grid overflow-hidden rounded-xl bg-blush md:grid-cols-[650fr_470fr]">
      <div className="flex flex-col gap-3 p-7">
        <p className="text-[10px] font-semibold tracking-[1.8px] text-rose uppercase">
          Tonight’s little inspiration
        </p>
        <h2 className="font-display text-[28px] leading-[1.1] sm:text-[32px]">{recipe.title}</h2>
        <p className="max-w-[400px] text-xs leading-[1.6] text-muted">{recipe.summary}</p>
        <Link
          href={`/videos/${recipe.id}`}
          className="flex w-fit items-center gap-[9px] text-xs font-semibold text-rose hover:text-rose-hover"
        >
          Cook {recipe.title.toLowerCase()}
          <ArrowUpRight size={16} strokeWidth={1.7} aria-hidden />
        </Link>
      </div>
      <div className="relative min-h-[244px] bg-cocoa">
        <Image
          src={thumbnailUrl(recipe.id)}
          alt=""
          fill
          unoptimized
          loading="eager"
          className="object-cover"
        />
      </div>
    </section>
  );
}

function RecipeCard({
  recipe,
  onToggleFavourite,
}: {
  recipe: RecipeSummary;
  onToggleFavourite: () => void;
}) {
  const category = [recipe.vegetarian ? "Vegetarian" : recipe.protein, recipe.cuisine]
    .filter(Boolean)
    .join(" · ");
  const added = new Date(recipe.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short" });

  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-xl border border-line bg-white transition hover:shadow-lg hover:shadow-blush">
      <div className="relative h-44 bg-cocoa">
        <Image src={thumbnailUrl(recipe.id)} alt="" fill unoptimized className="object-cover" />
        <span className="absolute top-3 left-3 rounded bg-paper px-[9px] py-[5px] text-[10px] font-semibold text-rose">
          {recipe.meal}
        </span>
        <button
          type="button"
          onClick={onToggleFavourite}
          aria-pressed={recipe.favourite}
          aria-label={
            recipe.favourite ? `Remove ${recipe.title} from favourites` : `Add ${recipe.title} to favourites`
          }
          className="absolute top-3 right-3 z-10 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white text-rose transition hover:scale-105"
        >
          <Heart size={15} strokeWidth={1.7} fill={recipe.favourite ? "currentColor" : "none"} aria-hidden />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-[9px] p-[18px]">
        <Link href={`/videos/${recipe.id}`} className="after:absolute after:inset-0">
          <h3 className="font-display text-[21px] leading-tight text-ink">{recipe.title}</h3>
        </Link>
        <p className="text-[11px] text-muted">{category}</p>
        <div className="mt-auto flex items-center justify-between pt-[7px] text-[11px] text-muted">
          <span className="flex items-center gap-[5px]">
            <Clock3 size={13} strokeWidth={1.7} aria-hidden />
            {recipe.total_minutes ? `${recipe.total_minutes} min` : "Time not stated"}
          </span>
          <span className="text-[10px]">Added {added}</span>
        </div>
      </div>
    </article>
  );
}

function EmptyLibrary() {
  return (
    <section className="flex flex-col items-start gap-4 rounded-xl bg-blush p-7">
      <h2 className="font-display text-[28px] leading-tight">No recipes yet.</h2>
      <p className="max-w-md text-xs leading-[1.6] text-muted">
        Upload a cooking video and its recipe will be saved here automatically, ready to cook
        again whenever you like.
      </p>
      <Link
        href="/"
        className="flex h-11 items-center gap-2 rounded-md bg-rose px-[18px] text-[13px] font-semibold text-white hover:bg-rose-hover"
      >
        <Plus size={17} strokeWidth={1.7} aria-hidden />
        Add your first cooking video
      </Link>
    </section>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-line px-6 py-12 text-center text-sm text-muted">
      {children}
    </p>
  );
}
