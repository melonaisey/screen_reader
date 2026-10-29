"use client";

import { useState } from "react";
import VideoUpload from "./components/VideoUpload";

export default function Home() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function callBackend() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("http://127.0.0.1:8000/api/hello");

      if (!response.ok) {
        throw new Error("Backend request failed");
      }

      const data = await response.json();
      setMessage(data.message);
    } catch {
      setError("Could not connect to the Python backend.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: "40px", fontFamily: "sans-serif" }}>
      <h1>YouTube Frame Text Summarizer</h1>

      <p>Next.js frontend + Python backend</p>

      <button onClick={callBackend} disabled={loading}>
        {loading ? "Connecting..." : "Test Python Backend"}
      </button>
      <VideoUpload />

      {message && <p>{message}</p>}
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
