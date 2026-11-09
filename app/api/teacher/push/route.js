import { NextResponse } from "next/server";
import { adminSignedIn } from "@/lib/staff";
import { saveSubscription, removeSubscription, pushConfigured, pushToAdmins } from "@/lib/notify";

export const dynamic = "force-dynamic";

// Push notifications for the admin's browsers.
// GET → { publicKey } (null when the VAPID keys are not set on the server).
export async function GET() {
  if (!(await adminSignedIn())) return NextResponse.json({ error: "Chỉ admin." }, { status: 401 });
  return NextResponse.json({ publicKey: pushConfigured() ? process.env.VAPID_PUBLIC_KEY : null });
}

// { subscription } → remember this browser. { test: true } → send a test.
export async function POST(req) {
  if (!(await adminSignedIn())) return NextResponse.json({ error: "Chỉ admin." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  try {
    if (body.subscription) await saveSubscription(body.subscription, "admin");
    if (body.test) {
      const { sent } = await pushToAdmins({ title: "Thông báo đã bật", body: "Máy này sẽ nhận thông báo khi giáo viên nộp phiếu.", url: "/teacher" });
      return NextResponse.json({ ok: true, sent });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function DELETE(req) {
  if (!(await adminSignedIn())) return NextResponse.json({ error: "Chỉ admin." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  await removeSubscription(body.endpoint);
  return NextResponse.json({ ok: true });
}
