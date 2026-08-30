/**
 * Minimal structured logger. Emits single-line JSON so logs are greppable in
 * Vercel/observability tooling. Never logs secrets — callers are responsible
 * for not passing keys, and we additionally redact anything that looks like a
 * token in string values.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const SECRET_PATTERN =
  /(bearer\s+[a-z0-9._-]+|sk-[a-z0-9]{16,}|eyJ[a-z0-9._-]{20,})/gi;

function redact(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(SECRET_PATTERN, "[redacted]");
  }
  if (value instanceof Error) {
    return { name: value.name, message: redact(value.message) };
  }
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (/token|secret|key|authorization|password/i.test(k)) {
        out[k] = "[redacted]";
      } else {
        out[k] = redact(v);
      }
    }
    return out;
  }
  return value;
}

function emit(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const line = {
    level,
    time: new Date().toISOString(),
    msg: message,
    ...(meta ? (redact(meta) as Record<string, unknown>) : {}),
  };
  const serialized = JSON.stringify(line);
  if (level === "error") console.error(serialized);
  else if (level === "warn") console.warn(serialized);
  else console.log(serialized);
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => emit("debug", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => emit("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => emit("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => emit("error", msg, meta),
};
