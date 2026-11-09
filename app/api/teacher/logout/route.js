import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { STAFF_COOKIE } from "@/lib/staff";

// Signs out both kinds of staff session (admin password / teacher Gmail).
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE.name, "", { path: "/", maxAge: 0 });
  res.cookies.set(STAFF_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
