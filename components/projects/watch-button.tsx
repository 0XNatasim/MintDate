"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export function WatchButton({
  projectId,
  initialWatching,
}: {
  projectId: string;
  initialWatching: boolean;
}) {
  const router = useRouter();
  const [watching, setWatching] = useState(initialWatching);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function toggle() {
    if (loading) return;
    setLoading(true);
    setError(false);
    const next = !watching;
    try {
      const res = await fetch(`/api/projects/${projectId}/watch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ watching: next }),
      });
      if (!res.ok) throw new Error();
      setWatching(next);
      router.refresh();
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      onClick={toggle}
      variant={watching ? "secondary" : "default"}
      disabled={loading}
      aria-pressed={watching}
      title={error ? "Failed — try again" : undefined}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : watching ? (
        <Check className="size-4" />
      ) : (
        <Eye className="size-4" />
      )}
      {watching ? "Watching" : "Watch"}
    </Button>
  );
}
