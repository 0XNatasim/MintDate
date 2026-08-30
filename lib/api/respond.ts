import { NextResponse } from "next/server";
import { XApiError } from "@/lib/x/client";
import { InvalidXInputError } from "@/lib/x/normalize";
import { logger } from "@/lib/logger";

export interface ApiError {
  error: string;
  code: string;
}

/**
 * Maps internal errors to safe, user-facing HTTP responses. Never leaks stack
 * traces or provider keys to the client — technical detail is logged instead.
 */
export function errorResponse(err: unknown): NextResponse<ApiError> {
  if (err instanceof InvalidXInputError) {
    return NextResponse.json({ error: err.message, code: "invalid_input" }, { status: 400 });
  }
  if (err instanceof XApiError) {
    const status =
      err.kind === "not_found"
        ? 404
        : err.kind === "protected"
          ? 403
          : err.kind === "rate_limited"
            ? 429
            : err.kind === "unauthorized"
              ? 502
              : 503;
    const message =
      err.kind === "unauthorized"
        ? "The X API is misconfigured on the server."
        : err.message;
    return NextResponse.json({ error: message, code: `x_${err.kind}` }, { status });
  }
  logger.error("api_unhandled_error", { err });
  return NextResponse.json(
    { error: "Something went wrong. Please try again.", code: "internal_error" },
    { status: 500 },
  );
}
