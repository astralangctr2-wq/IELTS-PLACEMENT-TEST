import { NextResponse } from "next/server";
import { adminSignedIn } from "@/lib/staff";
import { listEvents, unseenCount, markSeen } from "@/lib/notify";

export const dynamic = "force-dynamic";

// The bell (admin): latest events + how many are unseen.
export async function GET() {
  if (!(await adminSignedIn())) return NextResponse.json({ error: "Chỉ admin." }, { status: 401 });
  const [events, unseen] = await Promise.all([listEvents(30), unseenCount()]);
  return NextResponse.json({ events, unseen });
}

export async function POST() {
  if (!(await adminSignedIn())) return NextResponse.json({ error: "Chỉ admin." }, { status: 401 });
  await markSeen();
  return NextResponse.json({ ok: true });
}
