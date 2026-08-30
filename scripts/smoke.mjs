#!/usr/bin/env node
/**
 * Minimal end-to-end smoke test against a running MintDate server.
 * Usage:  BASE=http://localhost:3000 node scripts/smoke.mjs
 * Run the server first (e.g. `MINTDATE_MOCK_MODE=true npm run start`).
 */

const BASE = process.env.BASE ?? "http://localhost:3000";

async function j(path, init) {
  const res = await fetch(`${BASE}${path}`, init);
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function main() {
  let failures = 0;
  const check = (name, ok, extra = "") => {
    console.log(`${ok ? "✓" : "✗"} ${name}${extra ? ` — ${extra}` : ""}`);
    if (!ok) failures++;
  };

  const health = await j("/api/health");
  check("health ok", health.status === 200 && health.body.app === "mintdate");

  const scan = await j("/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: "@ExampleNFT" }),
  });
  check("scan returns opportunities", scan.status === 200 && scan.body.opportunities?.length > 0);

  const bad = await j("/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: "https://evil.com/x" }),
  });
  check("rejects non-x url (SSRF guard)", bad.status === 400);

  if (scan.body.project?.id) {
    const watch = await j(`/api/projects/${scan.body.project.id}/watch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ watching: true }),
    });
    check("watch toggle", watch.status === 200 && watch.body.project?.watching === true);
  }

  const cronNoSecret = await j("/api/cron/monitor");
  check(
    "cron rejects unauthenticated (or dev-open)",
    cronNoSecret.status === 401 || cronNoSecret.status === 200,
    `status ${cronNoSecret.status}`,
  );

  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("smoke test error:", e.message);
  process.exit(1);
});
