"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileVideo, Link as LinkIcon, LoaderCircle, Play, Upload, X } from "lucide-react";
import { uploadVideo } from "@/app/lib/api";
import { cn } from "@/app/lib/format";

export default function NewVideoForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState("");
  const [video, setVideo] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  function selectVideo(file?: File) {
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      setError("Please choose a video file.");
      return;
    }

    setVideo(file);
    setError("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!video) {
      // The link field is from the design, but the backend can't download
      // videos yet (that needs yt-dlp), so ask for a file instead.
      setError("Video links aren’t supported yet. Please upload the video file below.");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const jobId = await uploadVideo(video);
      // Next.js keeps this page's state when you navigate away, so clear the
      // form now. Otherwise it would still say "Uploading…" when you come
      // back to add another video.
      setVideo(null);
      setLink("");
      router.push(`/videos/${jobId}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function openFilePicker() {
    inputRef.current?.click();
  }

  // Dropping a file works on the empty drop zone and on the selected-file
  // card, so a new file can replace the current one.
  const dropHandlers = {
    onDragOver(event: React.DragEvent) {
      event.preventDefault();
      setDragging(true);
    },
    onDragLeave() {
      setDragging(false);
    },
    onDrop(event: React.DragEvent) {
      event.preventDefault();
      setDragging(false);
      if (!uploading) selectVideo(event.dataTransfer.files[0]);
    },
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex h-[46px] items-center gap-2.5 rounded-md border border-line bg-paper px-[13px] focus-within:ring-4 focus-within:ring-blush">
        <LinkIcon size={16} strokeWidth={1.7} className="shrink-0 text-muted" aria-hidden />
        <span className="sr-only">Video link</span>
        <input
          type="url"
          value={link}
          onChange={(event) => setLink(event.target.value)}
          placeholder="Paste a YouTube or cooking video link"
          className="w-full bg-transparent text-xs text-ink outline-none placeholder:text-muted"
        />
      </label>

      {/* Kept outside the two views below, so it's always available for
          picking a different file. */}
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(event) => {
          selectVideo(event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />

      {video ? (
        <div
          {...dropHandlers}
          className={cn(
            "flex items-center gap-3 rounded-md border px-[13px] py-3 transition",
            dragging ? "border-rose bg-blush" : "border-line bg-blush/40",
          )}
        >
          <FileVideo size={18} strokeWidth={1.7} className="shrink-0 text-rose" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-ink">{video.name}</p>
            <p className="text-[11px] text-muted">{formatSize(video.size)}</p>
          </div>
          <button
            type="button"
            disabled={uploading}
            onClick={openFilePicker}
            className="rounded px-2 py-1 text-[11px] font-semibold text-rose transition hover:bg-blush disabled:opacity-40"
          >
            Change
          </button>
          <button
            type="button"
            disabled={uploading}
            aria-label="Remove selected video"
            onClick={() => setVideo(null)}
            className="rounded p-1 text-muted transition hover:text-rose disabled:opacity-40"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={openFilePicker}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openFilePicker();
            }
          }}
          {...dropHandlers}
          className={cn(
            "flex cursor-pointer items-center gap-2.5 rounded-md border border-dashed px-[13px] py-3.5 text-xs transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blush",
            dragging
              ? "border-rose bg-blush text-rose"
              : "border-pastel-pink bg-paper text-muted hover:border-rose hover:bg-blush/40",
          )}
        >
          <Upload size={16} strokeWidth={1.7} className="shrink-0 text-rose" aria-hidden />
          <span>
            Or drop a video file here, or{" "}
            <span className="font-semibold text-rose underline underline-offset-4">
              browse files
            </span>
            <span className="text-muted"> · MP4, MOV, AVI, MKV or WebM</span>
          </span>
        </div>
      )}

      <button
        type="submit"
        disabled={uploading || (!video && !link)}
        className="flex h-11 w-fit items-center gap-2 rounded-md bg-rose px-[18px] text-[13px] font-semibold text-white transition hover:bg-rose-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pastel-pink disabled:cursor-not-allowed disabled:bg-pastel-pink"
      >
        {uploading ? (
          <LoaderCircle size={17} className="animate-spin" aria-hidden />
        ) : (
          <Play size={17} strokeWidth={1.7} aria-hidden />
        )}
        {uploading ? "Uploading video..." : "Watch a new cooking video"}
      </button>

      {error ? (
        <p role="alert" className="rounded-md bg-blush px-3 py-2 text-xs text-rose-deep">
          {error}
        </p>
      ) : (
        <p className="text-[11px] text-muted">No manual notes. No more pausing to write.</p>
      )}
    </form>
  );
}

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
