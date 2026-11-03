"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChartNoAxesColumnIncreasing,
  Check,
  CircleCheck,
  Clock3,
  CookingPot,
  Copy,
  ExternalLink,
  Heart,
  Play,
  Printer,
  ScanText,
  Sparkles,
  Timer,
} from "lucide-react";
import type { Recipe, Segment } from "@/app/lib/api";
import { cn, formatAmount, formatTime } from "@/app/lib/format";
import SiteFooter from "../layout/SiteFooter";

export type ReaderVideo = {
  src?: string; // a video file the backend can still serve
  embedUrl?: (startSeconds: number, autoplay: boolean) => string; // the platform's own player
  poster?: string;
  link?: { url: string; label: string }; // where the original video lives
  note?: string; // shown over the poster when there's nothing to play
  title: string;
  details: string;
  initials: string;
};

type Props = {
  breadcrumb: string;
  tags: string[];
  title: string;
  subtitle: string;
  status: React.ReactNode;
  video: ReaderVideo;
  detection: { title: string; meta: string } | null;
  transcript: Segment[];
  transcriptLabel: string;
  transcriptPlaceholder: React.ReactNode;
  recipe: Recipe | null;
  recipePlaceholder: React.ReactNode;
  favourite: { value: boolean; disabled: boolean; onToggle: () => void };
};

export default function RecipeReader(props: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  // An embedded player can't be controlled directly, so jumping to a time
  // reloads it starting there. The counter makes React replace the iframe.
  const [embedStart, setEmbedStart] = useState({ seconds: 0, autoplay: false, count: 0 });

  function seek(time: number) {
    setCurrentTime(time);
    if (props.video.embedUrl) {
      setEmbedStart((current) => ({ seconds: Math.floor(time), autoplay: true, count: current.count + 1 }));
    } else if (videoRef.current) {
      videoRef.current.currentTime = time;
      void videoRef.current.play();
    }
  }

  // The segment being spoken right now is the last one that started.
  const activeIndex = props.transcript.findLastIndex((s) => s.time <= currentTime);

  return (
    <main className="flex w-full flex-1 flex-col gap-[29px] px-4 pt-7 sm:px-16">
      <ReaderHeader {...props} />

      <div className="flex flex-col gap-2 border-y border-line py-[15px] text-[11px] sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">{props.status}</div>
        <p className="text-[10px] text-muted">Created from the video · Always check before cooking</p>
      </div>

      <div className="grid gap-10 lg:grid-cols-[536fr_736fr]">
        <div className="flex min-w-0 flex-col gap-8">
          <section className="flex flex-col gap-4" aria-label="Video">
            <VideoArea
              video={props.video}
              videoRef={videoRef}
              embedStart={embedStart}
              onTimeUpdate={setCurrentTime}
              onDuration={setDuration}
            />
            <div className="flex items-center gap-2.5">
              <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-peach font-display text-[15px] text-rose-deep">
                {props.video.initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">{props.video.title}</p>
                <p className="truncate text-[10px] text-muted">{props.video.details}</p>
              </div>
              {props.video.link && (
                <a
                  href={props.video.link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-rose hover:text-rose-hover"
                >
                  {props.video.link.label}
                  <ExternalLink size={13} strokeWidth={1.7} aria-hidden />
                </a>
              )}
            </div>
            {props.detection && (
              <div className="flex items-center gap-3 rounded-lg bg-blush p-4 text-rose">
                <ScanText size={23} strokeWidth={1.7} aria-hidden />
                <div className="flex-1">
                  <p className="text-xs font-semibold">{props.detection.title}</p>
                  <p className="mt-[5px] text-[10px]">{props.detection.meta}</p>
                </div>
                <CircleCheck size={18} strokeWidth={1.7} aria-hidden />
              </div>
            )}
          </section>

          <Transcript
            segments={props.transcript}
            label={props.transcriptLabel}
            placeholder={props.transcriptPlaceholder}
            activeIndex={activeIndex}
            endTime={duration}
            onSelect={seek}
          />
        </div>

        {props.recipe ? (
          <RecipePanel recipe={props.recipe} onSelect={seek} />
        ) : (
          <div className="min-w-0">{props.recipePlaceholder}</div>
        )}
      </div>

      <SiteFooter />
    </main>
  );
}

function VideoArea({
  video,
  videoRef,
  embedStart,
  onTimeUpdate,
  onDuration,
}: {
  video: ReaderVideo;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  embedStart: { seconds: number; autoplay: boolean; count: number };
  onTimeUpdate: (time: number) => void;
  onDuration: (duration: number) => void;
}) {
  const [fileMissing, setFileMissing] = useState(false);

  if (video.embedUrl) {
    return (
      <iframe
        key={embedStart.count}
        src={video.embedUrl(embedStart.seconds, embedStart.autoplay)}
        title={video.title}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        // YouTube refuses to play embeds that don't say which site they're on.
        referrerPolicy="strict-origin-when-cross-origin"
        className="aspect-video w-full rounded-xl bg-cocoa"
      />
    );
  }

  if (video.src && !fileMissing) {
    return (
      <video
        ref={videoRef}
        src={video.src}
        poster={video.poster}
        controls
        preload="metadata"
        onError={() => setFileMissing(true)}
        onTimeUpdate={(event) => onTimeUpdate(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => onDuration(event.currentTarget.duration)}
        className="aspect-video w-full rounded-xl bg-cocoa"
      />
    );
  }

  // Nothing to play (still loading, or an upload that wasn't kept).
  return (
    <div className="relative aspect-video overflow-hidden rounded-xl bg-cocoa">
      {video.poster && (
        // eslint-disable-next-line @next/next/no-img-element -- served by the backend, not optimisable
        <img src={video.poster} alt="" className="h-full w-full object-cover opacity-60" />
      )}
      {video.note && (
        <p className="absolute inset-x-6 bottom-5 mx-auto w-fit rounded bg-cocoa/85 px-3 py-1.5 text-center text-[11px] text-white">
          {video.note}
        </p>
      )}
    </div>
  );
}

function ReaderHeader({ breadcrumb, tags, title, subtitle, favourite }: Props) {
  return (
    <>
      <nav aria-label="Breadcrumb" className="flex items-center gap-[9px] text-[11px] text-muted">
        <ArrowLeft size={14} strokeWidth={1.7} aria-hidden />
        <Link href="/library" className="hover:text-rose">
          My recipes
        </Link>
        <span aria-hidden>/</span>
        <span className="truncate text-rose" aria-current="page">
          {breadcrumb}
        </span>
      </nav>

      <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-3">
          <p className="flex flex-wrap gap-2 text-[9px] font-semibold tracking-[1.4px] text-rose uppercase">
            {tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </p>
          <h1 className="font-display text-[36px] leading-[1.1] break-words sm:text-[45px]">
            {title}
          </h1>
          <p className="text-xs text-muted">{subtitle}</p>
        </div>

        <div className="flex shrink-0 gap-2.5">
          <button
            type="button"
            aria-pressed={favourite.value}
            disabled={favourite.disabled}
            onClick={favourite.onToggle}
            className="flex h-11 items-center gap-2 rounded-md border border-line bg-white px-[18px] text-[13px] font-semibold text-rose transition hover:border-pastel-pink disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Heart size={17} strokeWidth={1.7} fill={favourite.value ? "currentColor" : "none"} aria-hidden />
            {favourite.value ? "Favourited" : "Favourite"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex h-11 items-center gap-2 rounded-md border border-line bg-white px-[18px] text-[13px] font-semibold text-rose transition hover:border-pastel-pink"
          >
            <Printer size={17} strokeWidth={1.7} aria-hidden />
            Print recipe
          </button>
        </div>
      </header>
    </>
  );
}

function Transcript({
  segments,
  label,
  placeholder,
  activeIndex,
  endTime,
  onSelect,
}: {
  segments: Segment[];
  label: string;
  placeholder: React.ReactNode;
  activeIndex: number;
  endTime: number;
  onSelect: (time: number) => void;
}) {
  const [copied, copy] = useCopy();
  const lastTime = segments.at(-1)?.time ?? 0;

  return (
    <section className="flex flex-col gap-[17px]" aria-labelledby="transcript-heading">
      <div className="flex items-center justify-between">
        <h2 id="transcript-heading" className="font-display text-[27px]">
          The transcript
        </h2>
        <div className="flex items-center gap-3 text-[10px] text-muted uppercase">
          {label}
          <button
            type="button"
            disabled={segments.length === 0}
            onClick={() =>
              copy(
                segments
                  .map((s) => `${formatTime(s.time)}  ${s.text}${s.translation ? `\n       ${s.translation}` : ""}`)
                  .join("\n"),
              )
            }
            aria-label="Copy transcript"
            className="text-rose transition hover:text-rose-hover disabled:opacity-40"
          >
            {copied ? <Check size={15} aria-hidden /> : <Copy size={15} strokeWidth={1.7} aria-hidden />}
          </button>
        </div>
      </div>
      <p className="text-[11px] text-muted">
        Read from the video’s on-screen subtitles. Select a time to jump in.
      </p>

      {segments.length === 0 ? (
        placeholder
      ) : (
        <>
          <ol className="flex flex-col gap-0.5">
            {segments.map((segment, index) => {
              const active = index === activeIndex;
              return (
                <li key={`${segment.time}-${index}`}>
                  <button
                    type="button"
                    onClick={() => onSelect(segment.time)}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "flex w-full gap-3.5 rounded-md px-3 py-[13px] text-left transition",
                      active ? "bg-blush" : "bg-paper hover:bg-shell",
                    )}
                  >
                    <span className="w-10 shrink-0 text-[11px] leading-[1.8] font-semibold text-rose">
                      {formatTime(segment.time)}
                    </span>
                    <span className="flex flex-col">
                      <span className={cn("text-[13px] leading-[1.85]", active ? "text-rose" : "text-muted")}>
                        {segment.text}
                      </span>
                      {segment.translation && (
                        <span lang="en" className={cn("text-[13px] leading-[1.7]", active ? "text-rose-deep" : "text-ink")}>
                          {segment.translation}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="flex items-center gap-2 text-[10px] text-muted">
            <Check size={14} strokeWidth={1.7} className="text-rose" aria-hidden />
            End of transcript · {formatTime(Math.max(endTime, lastTime))}
          </p>
        </>
      )}
    </section>
  );
}

function RecipePanel({ recipe, onSelect }: { recipe: Recipe; onSelect: (time: number) => void }) {
  const facts = [
    { label: "Prep", value: recipe.facts.prep, Icon: Clock3 },
    { label: "Cook", value: recipe.facts.cook, Icon: CookingPot },
    { label: "Total", value: recipe.facts.total, Icon: Timer },
    { label: "Level", value: recipe.facts.level, Icon: ChartNoAxesColumnIncreasing },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-7">
      <section className="flex flex-col gap-[13px] rounded-xl bg-shell p-[26px]">
        <p className="flex items-center gap-[7px] text-[10px] font-semibold tracking-[1.4px] text-rose uppercase">
          <Sparkles size={15} strokeWidth={1.7} aria-hidden />
          The dish, in a nutshell
        </p>
        <h2 className="font-display text-[28px] leading-tight">{recipe.summary.heading}</h2>
        <p className="text-sm leading-[1.85] text-muted">{recipe.summary.text}</p>
      </section>

      <dl className="grid grid-cols-2 gap-4 border-y border-line py-[18px] sm:flex sm:justify-between">
        {facts.map(({ label, value, Icon }) => (
          <div key={label} className="flex items-center gap-[9px]">
            <Icon size={19} strokeWidth={1.7} className="text-rose" aria-hidden />
            <div className="flex flex-col gap-[5px]">
              <dt className="text-[9px] tracking-[1px] text-muted uppercase">{label}</dt>
              <dd className="text-xs font-semibold">{value}</dd>
            </div>
          </div>
        ))}
      </dl>

      <div className="grid gap-[30px] md:grid-cols-[220px_minmax(0,1fr)]">
        <Ingredients recipe={recipe} />

        <section className="flex flex-col gap-[22px]" aria-labelledby="method-heading">
          <div className="flex items-center justify-between">
            <h2 id="method-heading" className="font-display text-[27px]">
              Let’s cook
            </h2>
            <span className="text-[10px] text-muted">{recipe.steps.length} STEPS</span>
          </div>

          <ol className="flex flex-col gap-[22px]">
            {recipe.steps.map((step, index) => (
              <li key={index} className="flex flex-col gap-2.5 border-b border-line pb-[19px]">
                <div className="flex items-center justify-between">
                  <span className="font-display text-2xl text-rose">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelect(step.time)}
                    className="flex items-center gap-[5px] text-[10px] text-rose hover:text-rose-hover"
                    aria-label={`Jump to ${formatTime(step.time)} in the video`}
                  >
                    <Play size={10} strokeWidth={1.7} aria-hidden />
                    {formatTime(step.time)}
                  </button>
                </div>
                <h3 className="text-base font-semibold">{step.title}</h3>
                <p className="text-sm leading-[1.8] text-muted">{step.instruction}</p>
              </li>
            ))}
          </ol>

          {recipe.note && (
            <aside className="flex flex-col gap-2 rounded-md bg-peach p-4">
              <h3 className="font-display text-[19px]">A little kitchen note</h3>
              <p className="text-[11px] leading-[1.8]">{recipe.note}</p>
            </aside>
          )}
        </section>
      </div>
    </div>
  );
}

function Ingredients({ recipe }: { recipe: Recipe }) {
  // The video may not say how many it serves; then amounts can't be scaled.
  const [servings, setServings] = useState(recipe.servings);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [copied, copy] = useCopy();
  const scale = servings && recipe.servings ? servings / recipe.servings : 1;

  const lines = recipe.ingredients.map((item) => {
    let amount = item.amount === null ? null : item.amount * scale;
    // "312½ g" reads oddly, so keep weights and volumes to whole numbers.
    if (amount !== null && (item.unit === "g" || item.unit === "ml")) amount = Math.round(amount);
    return {
      quantity: amount === null ? "" : `${formatAmount(amount)} ${item.unit}`.trim(),
      name: item.name,
    };
  });

  function toggle(index: number) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <section className="flex flex-col gap-[19px]" aria-labelledby="ingredients-heading">
      <h2 id="ingredients-heading" className="font-display text-[27px]">
        Ingredients
      </h2>

      {servings !== null && (
        <div className="flex h-[35px] items-center justify-between rounded-[5px] border border-line px-2.5">
          <span className="text-[11px] text-muted">Serves {servings}</span>
          <span className="flex gap-[15px] text-sm text-rose">
            <button
              type="button"
              disabled={servings <= 1}
              onClick={() => setServings((count) => (count ?? 1) - 1)}
              aria-label="Fewer servings"
              className="disabled:opacity-40"
            >
              −
            </button>
            <button type="button" onClick={() => setServings((count) => (count ?? 0) + 1)} aria-label="More servings">
              +
            </button>
          </span>
        </div>
      )}

      <ul>
        {lines.map((line, index) => (
          <li key={index} className="border-b border-line py-3">
            <label className="flex cursor-pointer gap-[9px]">
              <input
                type="checkbox"
                checked={checked.has(index)}
                onChange={() => toggle(index)}
                className="mt-0.5 h-[13px] w-[13px] shrink-0 accent-rose"
              />
              <span className={cn("flex flex-col gap-1", checked.has(index) && "line-through opacity-50")}>
                {line.quantity && <span className="text-xs font-semibold">{line.quantity}</span>}
                <span className="text-[11px] leading-[1.6] text-muted">{line.name}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => copy(lines.map((l) => `${l.quantity} ${l.name}`.trim()).join("\n"))}
        className="flex w-fit items-center gap-[7px] text-[11px] font-semibold text-rose hover:text-rose-hover"
      >
        {copied ? <Check size={13} aria-hidden /> : <Copy size={13} strokeWidth={1.7} aria-hidden />}
        {copied ? "Copied!" : "Copy ingredient list"}
      </button>
    </section>
  );
}

function useCopy() {
  const [copied, setCopied] = useState(false);

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return [copied, copy] as const;
}
