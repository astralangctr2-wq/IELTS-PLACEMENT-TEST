import { NextResponse } from "next/server";
import { saveDraft, findDraft, deleteDraft } from "@/lib/drafts";

export const dynamic = "force-dynamic";

// Autosave of a test in progress (no login: the student is identified by
// test link + name + class, exactly as on the start screen).
//   GET  ?key=&name=&cls=          → { draft } or { draft: null }
//   POST { key, name, cls, data }  → save
//   POST { key, name, cls, remove: true } → delete (after submitting)
export async function GET(req) {
  const u = new URL(req.url).searchParams;
  try {
    const draft = await findDraft({ key: u.get("key"), name: u.get("name"), cls: u.get("cls") });
    return NextResponse.json({ draft });
  } catch {
    return NextResponse.json({ draft: null });
  }
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  if (body.remove) {
    await deleteDraft(body).catch(() => {});
    return NextResponse.json({ ok: true });
  }
  const out = await saveDraft(body);
  return NextResponse.json(out, { status: out.error ? 400 : 200 });
}
