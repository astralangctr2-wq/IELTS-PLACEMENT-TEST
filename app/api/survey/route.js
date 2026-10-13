import { NextResponse } from "next/server";
import { saveSurvey } from "@/lib/survey";

export const dynamic = "force-dynamic";

// Public: a student sends the feedback survey right after submitting.
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  try {
    await saveSurvey({ submissionId: String(body.submissionId || "").slice(0, 60), answers: body.answers, anonymous: body.anonymous });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Không gửi được." }, { status: 400 });
  }
}
