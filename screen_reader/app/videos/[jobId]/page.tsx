import { Suspense } from "react";
import VideoReader from "@/app/components/reader/VideoReader";

export default function VideoPage({ params }: PageProps<"/videos/[jobId]">) {
  // The job ID is only known at request time, so with Cache Components it
  // has to be read inside a Suspense boundary.
  return (
    <Suspense fallback={<p className="px-4 pt-8 text-sm text-muted sm:px-16">Loading video…</p>}>
      {params.then(({ jobId }) => (
        <VideoReader jobId={jobId} />
      ))}
    </Suspense>
  );
}
