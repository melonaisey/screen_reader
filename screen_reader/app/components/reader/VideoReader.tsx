"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CircleAlert, CircleCheck, LoaderCircle, Sparkles } from "lucide-react";
import { getJob, setFavourite, thumbnailUrl, videoFileUrl, type Job } from "@/app/lib/api";
import { refreshRecipes } from "@/app/lib/useRecipes";
import RecipeReader from "./RecipeReader";

export default function VideoReader({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");
  const [favourite, setFavouriteState] = useState(false);

  // Check the job once a second until it finishes or fails. Finished videos
  // come straight from the database.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function check() {
      try {
        const latest = await getJob(jobId);
        if (cancelled) return;
        setJob(latest);
        setFavouriteState(latest.favourite);
        if (latest.status === "processing") timer = setTimeout(check, 1000);
        // A new recipe was just saved, so the sidebar and library should update.
        if (latest.status === "done" && latest.recipe) refreshRecipes();
      } catch (error) {
        if (!cancelled) setError(error instanceof Error ? error.message : "Something went wrong.");
      }
    }

    check();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [jobId]);

  async function toggleFavourite() {
    const next = !favourite;
    setFavouriteState(next);
    try {
      await setFavourite(jobId, next);
      refreshRecipes();
    } catch {
      setFavouriteState(!next);
    }
  }

  if (error) {
    return (
      <main className="flex flex-1 flex-col items-start gap-4 px-4 pt-10 sm:px-16">
        <h1 className="font-display text-4xl">We couldn’t find this video.</h1>
        <p className="max-w-lg text-sm leading-relaxed text-muted">
          {error} If the backend restarted while this video was still being processed, it
          wasn’t saved. Please upload it again.
        </p>
        <Link
          href="/"
          className="rounded-md bg-rose px-[18px] py-3 text-[13px] font-semibold text-white hover:bg-rose-hover"
        >
          Upload a video
        </Link>
      </main>
    );
  }

  const videoName = job?.video_name ?? "Your video";
  const recipe = job?.recipe ?? null;
  const title = recipe?.title ?? videoName.replace(/\.[^.]+$/, "");
  const segments = job?.segments ?? [];
  const averageConfidence = segments.length
    ? Math.round((segments.reduce((sum, s) => sum + (s.confidence ?? 0), 0) / segments.length) * 100)
    : 0;
  const uploaded = job?.created_at
    ? `Uploaded ${new Date(job.created_at).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}`
    : "Uploaded just now";

  return (
    <RecipeReader
      breadcrumb={title}
      tags={
        recipe
          ? [recipe.meal, recipe.cuisine, recipe.one_pan ? "One pan" : ""].filter(Boolean)
          : ["Your video"]
      }
      title={title}
      subtitle={`${uploaded} · ${videoName}`}
      status={<JobStatus job={job} />}
      video={{
        src: videoFileUrl(jobId),
        poster: job?.status === "done" ? thumbnailUrl(jobId) : undefined,
        title: videoName,
        details: "Uploaded from your computer",
        initials: "me",
      }}
      detection={
        job?.status === "done" && segments.length > 0
          ? {
              title: "Burned-in subtitles detected",
              meta: `${segments.length} segments read · ${averageConfidence}% average confidence`,
            }
          : null
      }
      transcript={segments}
      transcriptLabel={segments.some((s) => s.translation) ? "Chinese → English" : "Subtitles"}
      transcriptPlaceholder={
        <Placeholder>
          {job?.status === "done"
            ? "No subtitles were found in the bottom of this video."
            : "Your transcript will appear here once the subtitles have been read."}
        </Placeholder>
      }
      recipe={recipe}
      recipePlaceholder={<RecipePlaceholder job={job} />}
      favourite={{ value: favourite, disabled: !recipe, onToggle: toggleFavourite }}
    />
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-line px-4 py-10 text-center text-xs leading-relaxed text-muted">
      {children}
    </p>
  );
}

function RecipePlaceholder({ job }: { job: Job | null }) {
  if (job?.status === "done" || job?.status === "error") {
    return (
      <Placeholder>
        {job.recipe_error ?? job.error ?? "No recipe could be made from this video."}
      </Placeholder>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl bg-shell px-6 py-16 text-center">
      <Sparkles size={22} strokeWidth={1.7} className="text-rose" aria-hidden />
      <p className="font-display text-2xl">Your recipe is on its way.</p>
      <p className="max-w-sm text-xs leading-relaxed text-muted">
        Once the subtitles are read and translated, Claude turns them into a summary, an
        ingredient list and step-by-step instructions.
      </p>
    </div>
  );
}

function JobStatus({ job }: { job: Job | null }) {
  if (!job || job.status === "processing") {
    let percent = job?.total ? Math.round((job.processed / job.total) * 100) : 0;
    let label = !job
      ? "Connecting…"
      : job.total
        ? `Reading subtitles: frame ${job.processed} of ${job.total} (${percent}%)`
        : "Loading the OCR model…";

    if (job?.stage === "translating") {
      percent = job.translate_total ? Math.round((job.translated / job.translate_total) * 100) : 0;
      label = job.translate_total > 1
        ? `Translating to English: part ${job.translated + 1} of ${job.translate_total}`
        : "Translating to English…";
    } else if (job?.stage === "recipe") {
      percent = 90;
      label = "Writing the recipe…";
    }

    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <p className="flex items-center gap-2 font-semibold text-rose">
          <LoaderCircle size={16} className="animate-spin" aria-hidden />
          {label}
        </p>
        <div
          role="progressbar"
          aria-label="Processing progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-blush"
        >
          <div className="h-full rounded-full bg-petal-rouge transition-all duration-500" style={{ width: `${percent}%` }} />
        </div>
      </div>
    );
  }

  if (job.status === "error") {
    return (
      <p className="flex items-center gap-2 font-semibold text-rose-deep">
        <CircleAlert size={16} aria-hidden />
        {job.error || "Video processing failed."}
      </p>
    );
  }

  const translated = job.segments.some((s) => s.translation);

  return (
    <div className="flex flex-col gap-1">
      <p className="flex flex-wrap items-center gap-2">
        <CircleCheck size={16} strokeWidth={1.7} className="text-rose" aria-hidden />
        <span className="font-semibold text-rose">
          {job.recipe ? "Video recipe ready" : "Transcript ready"}
        </span>
        <span className="text-muted">
          {job.recipe
            ? "· Transcript, translation, summary, ingredients & method · Saved to your recipes"
            : translated
              ? "· Read from the video’s subtitles and translated to English"
              : "· Read from the video’s burned-in subtitles"}
        </span>
      </p>
      {job.translation_error && (
        <p className="flex items-center gap-2 text-rose-deep">
          <CircleAlert size={14} aria-hidden />
          Not translated: {job.translation_error}
        </p>
      )}
    </div>
  );
}
