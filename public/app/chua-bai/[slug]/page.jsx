import { getReviewBySlug, buildReviewModel } from "@/lib/bankReview";
import { getContentBank } from "@/lib/contentBanks";
import { staffSignedIn } from "@/lib/sheetAuth";
import ReviewView from "./ReviewView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Đáp án & chữa bài — Astra", robots: { index: false } };

// Public answer review of one test bank ("link chữa bài"): the same link
// for every class that took this test. Shown only once the teacher has
// published it; a signed-in teacher can preview it before (?preview=1).
export default async function ReviewPage({ params, searchParams }) {
  const r = await getReviewBySlug(params.slug);
  const preview = Boolean(searchParams?.preview) && (await staffSignedIn());
  if (!r || (!r.published && !preview)) {
    return (
      <div className="wrap">
        <div className="card card-strong">
          <p className="serif" style={{ fontSize: 22, margin: 0 }}>Chưa có đáp án</p>
          <p className="muted" style={{ marginTop: 8 }}>Giáo viên chưa công bố phần chữa bài của bài thi này. Vui lòng quay lại sau.</p>
        </div>
      </div>
    );
  }
  const bank = await getContentBank(r.bank_id);
  if (!bank) return <div className="wrap"><div className="card"><p>Bộ đề không còn tồn tại.</p></div></div>;
  const skills = buildReviewModel(bank.content, r.data || {});
  return <ReviewView slug={r.slug} title={bank.name} skills={skills} preview={!r.published} />;
}
