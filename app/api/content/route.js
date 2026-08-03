import { NextResponse } from "next/server";
import { getActiveContentWithAnswers } from "@/lib/activeContent";
import { withoutAnswers } from "@/lib/content";

export const dynamic = "force-dynamic";

export async function GET() {
  const content = await getActiveContentWithAnswers();
  return NextResponse.json(withoutAnswers(content));
}
