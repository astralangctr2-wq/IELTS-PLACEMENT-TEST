import { redirect } from "next/navigation";
import { getSessionByCode, cleanCode } from "@/lib/testSessions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vào thi bằng mã — Astra", robots: { index: false } };

// Home page "Vào thi bằng mã": /ma?c=K7Q2 → the exam link of that code.
export default async function CodePage({ searchParams }) {
  const raw = (searchParams?.c || "").toString();
  const code = cleanCode(raw);
  const hit = code ? await getSessionByCode(code) : null;
  if (hit) redirect(`/test/s/${hit.id}`);
  return (
    <div className="wrap">
      <div className="card card-strong">
        <p className="serif" style={{ fontSize: 20, margin: "0 0 8px" }}>{code ? `Không có bài thi nào mang mã “${code}”` : "Nhập mã thi"}</p>
        <p className="muted" style={{ margin: "0 0 14px" }}>Mã gồm 4 ký tự, giáo viên ghi trên bảng hoặc màn chiếu (không có chữ O, I, L và số 0, 1).</p>
        <form action="/ma" method="get" className="code-box" style={{ margin: 0 }}>
          <div className="code-row">
            <input name="c" defaultValue={code} maxLength={8} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="VD: K7Q2" required autoFocus />
            <button className="btn" type="submit">Vào thi →</button>
          </div>
        </form>
        <p style={{ marginTop: 14 }}><a href="/">← Trang chủ</a></p>
      </div>
    </div>
  );
}
