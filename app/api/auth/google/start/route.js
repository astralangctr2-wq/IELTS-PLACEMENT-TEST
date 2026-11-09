import { NextResponse } from "next/server";
import crypto from "crypto";
import { signToken, appOrigin, GOOGLE_AUTH_URL, googleConfigured } from "@/lib/staff";

export const dynamic = "force-dynamic";

// Teacher sign-in with Google: sends the browser to Google's consent page.
// The state (signed, also kept in a short cookie) protects the return trip.
export async function GET(req) {
  const origin = appOrigin(req);
  if (!googleConfigured()) return NextResponse.redirect(`${origin}/teacher/login?error=config`);
  const next = new URL(req.url).searchParams.get("next") || "/teacher";
  const state = signToken({ n: crypto.randomBytes(8).toString("hex"), next: next.startsWith("/") && !next.startsWith("//") ? next : "/teacher" }, 600);
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", `${origin}/api/auth/google/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  const res = NextResponse.redirect(url.toString());
  res.cookies.set("oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600 });
  return res;
}
