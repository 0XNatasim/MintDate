import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStore } from "@/lib/store";
import { errorResponse } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({ watching: z.boolean() });

/** POST /api/projects/[id]/watch — toggle watch mode. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body.", code: "invalid_body" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "watching must be a boolean.", code: "invalid_input" }, { status: 400 });
  }
  try {
    const store = getStore();
    const existing = await store.getProjectById(params.id);
    if (!existing) {
      return NextResponse.json({ error: "Project not found.", code: "not_found" }, { status: 404 });
    }
    const project = await store.setWatching(params.id, parsed.data.watching);
    return NextResponse.json({ project });
  } catch (err) {
    return errorResponse(err);
  }
}
