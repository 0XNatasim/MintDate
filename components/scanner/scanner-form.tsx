"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Search, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STAGES = [
  "Resolving account…",
  "Fetching recent posts…",
  "Checking mint announcements…",
  "Checking OpenSea…",
  "Building results…",
];

export function ScannerForm({ autoFocus }: { autoFocus?: boolean }) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function advanceStages() {
    setStage(0);
    // Staged status text — NOT a fake percentage. Caps before the last stage
    // until the request actually resolves.
    timers.current = STAGES.slice(0, -1).map((_, i) =>
      setTimeout(() => setStage(i + 1), (i + 1) * 900),
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = input.trim();
    if (!value || loading) return;
    setError(null);
    setLoading(true);
    advanceStages();
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Scan failed. Please try again.");
        setLoading(false);
        timers.current.forEach(clearTimeout);
        return;
      }
      setStage(STAGES.length - 1);
      router.push(`/project/${data.project.id}`);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
      timers.current.forEach(clearTimeout);
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus={autoFocus}
            aria-label="X account, x.com URL, or post URL"
            placeholder="@username, x.com account, or X post URL"
            className="pl-9"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
        </div>
        <Button type="submit" size="lg" disabled={loading || !input.trim()} className="sm:w-32">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          {loading ? "Scanning" : "Scan"}
        </Button>
      </div>

      {loading && (
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground animate-fade-in">
          <Loader2 className="size-3.5 animate-spin text-primary" />
          <span aria-live="polite">{STAGES[stage]}</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-3 flex items-center gap-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger animate-fade-in"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </form>
  );
}
