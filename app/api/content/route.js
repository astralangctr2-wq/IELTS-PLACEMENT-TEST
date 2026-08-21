import { NextResponse } from "next/server";
import { getActiveContentWithAnswers } from "@/lib/activeContent";
import { withoutAnswers } from "@/lib/content";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req) {
  const bankId = new URL(req.url).searchParams.get("bank") || undefined;
  try {
    const content = await getActiveContentWithAnswers(bankId);
    return NextResponse.json(withoutAnswers(content), {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || "Không tải được đề thi." }, { status: 404 });
  }
}
