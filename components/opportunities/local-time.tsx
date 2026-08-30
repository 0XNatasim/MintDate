"use client";

import { useEffect, useState } from "react";

/**
 * Shows the mint time in the VIEWER's local timezone. Rendered client-side
 * only (after mount) to avoid SSR/client hydration mismatches, since the
 * server has no knowledge of the viewer's zone.
 */
export function LocalTime({ utcIso }: { utcIso: string }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const d = new Date(utcIso);
    if (Number.isNaN(d.getTime())) return;
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const formatted = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(d);
    setLabel(`${formatted} (${zone.split("/").pop()?.replace("_", " ") ?? zone})`);
  }, [utcIso]);

  if (!label) return null;
  return <span className="tabular">Your time: {label}</span>;
}
