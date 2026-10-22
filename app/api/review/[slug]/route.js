import { NextResponse } from "next/server";
import { getReviewBySlug, studentAnswersFor } from "@/lib/bankReview";

export const dynamic = "force-dynamic";

// A student's own answers on a published review link: ?name=&cls=
// (the name and class typed when taking the test).
export async function GET(req, { params }) {
  const r = await getReviewBySlug(params.slug);
  if (!r || !r.published) return NextResponse.json({ error: "Giáo viên chưa công bố đáp án." }, { status: 404 });
  const u = new URL(req.url).searchParams;
  const mine = await studentAnswersFor(r.bank_id, u.get("name"), u.get("cls")).catch(() => null);
  if (!mine) return NextResponse.json({ error: "Không tìm thấy bài làm với tên và lớp này. Kiểm tra lại cách viết (giống lúc vào thi)." }, { status: 404 });
  return NextResponse.json(mine);
}
