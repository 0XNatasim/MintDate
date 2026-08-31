"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClipboardPaste, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Free, no-API path: the user pastes a post's text (and optionally the @handle
 * it's from). Runs the same extraction + OpenSea verification pipeline.
 */
export function PasteForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [handle, setHandle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value || loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value, username: handle.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't process that. Please try again.");
        setLoading(false);
        return;
      }
      router.push(`/project/${data.project.id}`);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <textarea
        aria-label="Paste post text"
        placeholder="Paste a post's text here — e.g. “Public mint Sept 4 at 1PM ET, 0.08 ETH, 3333 supply. opensea.io/collection/…”"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        disabled={loading}
        className="w-full resize-y rounded-md border border-border bg-background/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          aria-label="Account handle (optional)"
          placeholder="@handle (optional)"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          disabled={loading}
          className="sm:max-w-[220px]"
        />
        <Button type="submit" disabled={loading || !text.trim()} className="sm:w-40">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <ClipboardPaste className="size-4" />}
          {loading ? "Reading" : "Extract mint"}
        </Button>
      </div>
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </form>
  );
}
