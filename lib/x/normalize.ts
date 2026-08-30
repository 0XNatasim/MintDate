/**
 * X (Twitter) input normalization.
 *
 * Converts any of these into a structured { username, postId? }:
 *   @MancerXYZ
 *   MancerXYZ
 *   https://x.com/MancerXYZ
 *   https://twitter.com/MancerXYZ
 *   https://x.com/MancerXYZ/status/123
 *
 * Security: we NEVER fetch an arbitrary user-supplied URL. We only ever parse
 * the handle/status id out of a recognized X host and then talk to the X API
 * by that handle. This prevents SSRF via crafted URLs.
 */

export interface NormalizedXInput {
  username: string;
  postId?: string;
}

export class InvalidXInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidXInputError";
  }
}

// X usernames: 1-15 chars, letters/digits/underscore only.
const USERNAME_RE = /^[A-Za-z0-9_]{1,15}$/;

// Reserved X paths that are never usernames.
const RESERVED = new Set([
  "home",
  "explore",
  "notifications",
  "messages",
  "settings",
  "i",
  "intent",
  "search",
  "hashtag",
  "compose",
  "login",
  "signup",
  "tos",
  "privacy",
  "about",
]);

const ALLOWED_HOSTS = new Set([
  "x.com",
  "www.x.com",
  "twitter.com",
  "www.twitter.com",
  "mobile.twitter.com",
  "mobile.x.com",
]);

function validateUsername(raw: string): string {
  const username = raw.trim();
  if (!USERNAME_RE.test(username)) {
    throw new InvalidXInputError(
      `"${raw}" is not a valid X username. Usernames are 1–15 letters, numbers or underscores.`,
    );
  }
  if (RESERVED.has(username.toLowerCase())) {
    throw new InvalidXInputError(`"${raw}" is a reserved X path, not an account.`);
  }
  return username;
}

export function normalizeXInput(input: string): NormalizedXInput {
  if (typeof input !== "string") {
    throw new InvalidXInputError("Input must be a string.");
  }
  let value = input.trim();
  if (!value) {
    throw new InvalidXInputError("Please enter an X account.");
  }
  if (value.length > 2048) {
    throw new InvalidXInputError("Input is too long.");
  }

  // URL form.
  if (/^https?:\/\//i.test(value) || value.includes("x.com/") || value.includes("twitter.com/")) {
    const withProto = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    let url: URL;
    try {
      url = new URL(withProto);
    } catch {
      throw new InvalidXInputError("That doesn't look like a valid X URL.");
    }
    if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
      throw new InvalidXInputError(
        "Only x.com / twitter.com links are supported.",
      );
    }
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length === 0) {
      throw new InvalidXInputError("No account found in that URL.");
    }
    // /intent/user?screen_name=foo
    if (segments[0].toLowerCase() === "intent") {
      const screenName = url.searchParams.get("screen_name");
      if (screenName) return { username: validateUsername(screenName) };
      throw new InvalidXInputError("No account found in that URL.");
    }
    const username = validateUsername(segments[0].replace(/^@/, ""));
    // .../status/<id>
    const statusIdx = segments.findIndex((s) => s.toLowerCase() === "status");
    if (statusIdx !== -1 && segments[statusIdx + 1]) {
      const postId = segments[statusIdx + 1];
      if (/^\d{1,25}$/.test(postId)) {
        return { username, postId };
      }
    }
    return { username };
  }

  // @handle or bare handle.
  return { username: validateUsername(value.replace(/^@/, "")) };
}
