import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { adminSignedIn } from "@/lib/staff";
import { getContentBank } from "@/lib/contentBanks";
import { getBankReview, saveBankReview, reviewCoverage } from "@/lib/bankReview";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const view = (bank, r) => ({
  slug: r?.slug || null,
  published: Boolean(r?.published),
  publishedAt: r?.published_at || null,
  updatedAt: r?.updated_at || null,
  coverage: reviewCoverage(bank.content, r?.data || {}),
  data: r?.data || {},
});

async function load(id) {
  if (!(await adminSignedIn())) return { error: NextResponse.json({ error: "Chỉ admin được làm việc này." }, { status: 401 }) };
  const bank = await getContentBank(id);
  if (!bank) return { error: NextResponse.json({ error: "Không tìm thấy bộ đề." }, { status: 404 }) };
  return { bank };
}

// Detailed answer review of a bank: status, explanations, publish switch.
export async function GET(_req, { params }) {
  const { bank, error } = await load(params.id);
  if (error) return error;
  return NextResponse.json(view(bank, await getBankReview(params.id)), { headers: { "Cache-Control": "no-store" } });
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
  // Drop any cached copy of the public link so the change shows at once.
  if (r?.slug) { try { revalidatePath(`/chua-bai/${r.slug}`); } catch {} }
  return NextResponse.json(view(bank, r), { headers: { "Cache-Control": "no-store" } });
}
