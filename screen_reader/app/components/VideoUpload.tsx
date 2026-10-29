"use client";

import { useRef, useState } from "react";
import { FileVideo, Upload, X, ArrowRight, LoaderCircle } from "lucide-react";

const styles = {
  card: "mx-auto w-full max-w-xl rounded-3xl border border-pastel-pink/60 bg-white p-6 shadow-xl shadow-petal-rouge/10 sm:p-9",
  dropzone:
    "cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition sm:p-10",
  dropzoneActive: "border-petal-rouge bg-blush",
  dropzoneIdle:
    "border-pastel-pink bg-[#fffafb] hover:border-petal-rouge hover:bg-blush/40",
  fileCard:
    "mt-5 flex items-center gap-3 rounded-xl border border-pastel-pink/60 bg-blush/30 p-4",
  button:
    "mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-petal-rouge px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-petal-rouge/20 transition hover:bg-rose-dark focus:outline-none focus:ring-4 focus:ring-pastel-pink disabled:cursor-not-allowed disabled:bg-pastel-pink disabled:shadow-none",
};

type Status = { type: "success" | "error"; text: string };

export default function VideoUpload() {
  const [video, setVideo] = useState<File | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function selectVideo(file?: File) {
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      setStatus({ type: "error", text: "Please select a valid video file." });
      return;
    }

    setVideo(file);
    setStatus(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!video) {
      setStatus({ type: "error", text: "Please select a video first." });
      return;
    }

    const formData = new FormData();
    formData.append("file", video);

    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch("http://localhost:8000/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || "Upload failed.");
      }

      setStatus({
        type: "success",
        text: result.message || "Video uploaded successfully!",
      });
    } catch (error) {
      setStatus({
        type: "error",
        text: error instanceof Error ? error.message : "Upload failed.",
      });
    } finally {
      setLoading(false);
    }
  }

  function openFilePicker() {
    inputRef.current?.click();
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openFilePicker();
    }
  }

  function handleDragOver(event: React.DragEvent) {
    event.preventDefault();
    setDragging(true);
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    selectVideo(event.dataTransfer.files[0]);
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    selectVideo(event.target.files?.[0]);
    // Reset so picking the same file again still fires onChange.
    event.currentTarget.value = "";
  }

  function clearVideo() {
    setVideo(null);
    setStatus(null);
  }

  return (
    <form onSubmit={handleSubmit} className={styles.card}>
      <Header />

      <div
        role="button"
        tabIndex={0}
        onClick={openFilePicker}
        onKeyDown={handleKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          styles.dropzone,
          dragging ? styles.dropzoneActive : styles.dropzoneIdle
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white text-petal-rouge shadow-sm">
          <Upload size={24} />
        </div>

        <p className="text-sm font-semibold text-gray-800">
          Drop your video here or{" "}
          <span className="text-rose-dark underline underline-offset-4">
            browse files
          </span>
        </p>

        <p className="mt-2 text-xs text-gray-500">MP4, MOV, AVI, MKV or WebM</p>
      </div>

      {video && (
        <SelectedFile video={video} disabled={loading} onRemove={clearVideo} />
      )}

      <SubmitButton loading={loading} disabled={!video || loading} />

      {status && <StatusMessage status={status} />}

      <p className="mt-5 text-center text-xs leading-5 text-gray-400">
        Your video will be sent to the server for processing.
      </p>
    </form>
  );
}

function Header() {
  return (
    <header className="mb-8 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blush text-rose-dark">
        <FileVideo size={28} />
      </div>

      <h2 className="text-2xl font-bold tracking-tight text-gray-900">
        Upload your video
      </h2>

      <p className="mt-2 text-sm leading-6 text-gray-500">
        Turn video content into searchable text and AI summaries.
      </p>
    </header>
  );
}

function SelectedFile({
  video,
  disabled,
  onRemove,
}: {
  video: File;
  disabled: boolean;
  onRemove: () => void;
}) {
  return (
    <div className={styles.fileCard}>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blush text-rose-dark">
        <FileVideo size={22} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-800">
          {video.name}
        </p>
        <p className="mt-1 text-xs text-gray-500">{formatSize(video.size)}</p>
      </div>

      <button
        type="button"
        disabled={disabled}
        aria-label="Remove selected video"
        onClick={onRemove}
        className="rounded-lg p-2 text-gray-400 transition hover:bg-blush hover:text-rose-dark disabled:opacity-40"
      >
        <X size={20} />
      </button>
    </div>
  );
}

function SubmitButton({
  loading,
  disabled,
}: {
  loading: boolean;
  disabled: boolean;
}) {
  return (
    <button type="submit" disabled={disabled} className={styles.button}>
      {loading ? (
        <>
          <LoaderCircle className="animate-spin" size={18} />
          Uploading video...
        </>
      ) : (
        <>
          Upload video
          <ArrowRight size={18} />
        </>
      )}
    </button>
  );
}

function StatusMessage({ status }: { status: Status }) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        "mt-4 rounded-xl px-4 py-3 text-sm",
        status.type === "success"
          ? "bg-green-50 text-green-700"
          : "bg-blush text-rose-deep"
      )}
    >
      {status.text}
    </p>
  );
}

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
