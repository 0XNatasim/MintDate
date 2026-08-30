/**
 * URL safety helpers. NFT users are prime phishing targets, so we treat every
 * externally-sourced URL as untrusted:
 *   - Only http(s) URLs are ever accepted.
 *   - OpenSea URLs are validated against a known allowlist of OpenSea hosts.
 *   - "External mint links" are surfaced with their real hostname so the user
 *     sees where a click goes; we NEVER label an arbitrary URL "verified".
 */

const OPENSEA_HOSTS = new Set([
  "opensea.io",
  "www.opensea.io",
  "pro.opensea.io",
  "testnets.opensea.io",
]);

export function safeParseUrl(raw: string | null | undefined): URL | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  return url;
}

/** Returns a sanitized https(-preferred) URL string, or null if unsafe. */
export function sanitizeExternalUrl(raw: string | null | undefined): string | null {
  const url = safeParseUrl(raw);
  if (!url) return null;
  return url.toString();
}

export function isOpenSeaUrl(raw: string | null | undefined): boolean {
  const url = safeParseUrl(raw);
  if (!url) return false;
  return OPENSEA_HOSTS.has(url.hostname.toLowerCase());
}

/** Extracts the collection slug from an OpenSea collection URL, if present. */
export function openSeaSlugFromUrl(raw: string | null | undefined): string | null {
  const url = safeParseUrl(raw);
  if (!url || !isOpenSeaUrl(raw)) return null;
  const segments = url.pathname.split("/").filter(Boolean);
  const idx = segments.findIndex((s) => s === "collection");
  if (idx !== -1 && segments[idx + 1]) return segments[idx + 1];
  return null;
}

/** Display hostname for a link, e.g. "mint.example.xyz". */
export function displayHostname(raw: string | null | undefined): string | null {
  const url = safeParseUrl(raw);
  if (!url) return null;
  return url.hostname.replace(/^www\./, "");
}
