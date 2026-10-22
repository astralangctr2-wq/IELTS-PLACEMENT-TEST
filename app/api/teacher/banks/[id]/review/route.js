import { NextResponse } from "next/server";
import { staffSignedIn } from "@/lib/sheetAuth";
import { getContentBank } from "@/lib/contentBanks";
import { getBankReview, saveBankReview, reviewCoverage } from "@/lib/bankReview";

export const dynamic = "force-dynamic";

const view = (bank, r) => ({
  slug: r?.slug || null,
  published: Boolean(r?.published),
  publishedAt: r?.published_at || null,
  updatedAt: r?.updated_at || null,
  coverage: reviewCoverage(bank.content, r?.data || {}),
  data: r?.data || {},
});

async function load(id) {
  if (!(await staffSignedIn())) return { error: NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 }) };
  const bank = await getContentBank(id);
  if (!bank) return { error: NextResponse.json({ error: "Không tìm thấy bộ đề." }, { status: 404 }) };
  return { bank };
}

// Detailed answer review of a bank: status, explanations, publish switch.
export async function GET(_req, { params }) {
  const { bank, error } = await load(params.id);
  if (error) return error;
  return NextResponse.json(view(bank, await getBankReview(params.id)));
}

// { data } — the explanations (JSON file "chữa bài"); { published } — on/off.
export async function POST(req, { params }) {
  const { bank, error } = await load(params.id);
  if (error) return error;
  const body = await req.json().catch(() => ({}));
  const r = await saveBankReview(params.id, {
    ...(body.data !== undefined ? { data: body.data } : {}),
    ...(body.published !== undefined ? { published: Boolean(body.published) } : {}),
  });
  return NextResponse.json(view(bank, r));
}
