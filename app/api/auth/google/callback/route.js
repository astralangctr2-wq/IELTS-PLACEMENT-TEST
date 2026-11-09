import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readToken, teacherCookie, appOrigin, GOOGLE_TOKEN_URL, getTeacherByEmail, touchTeacherLogin } from "@/lib/staff";

export const dynamic = "force-dynamic";

// Google sends the teacher back here with ?code&state. The ID token comes
// straight from Google's token endpoint over TLS, which OpenID Connect
// accepts in place of checking its signature (Core §3.1.3.7). Only Gmail
// accounts the admin added (and did not switch off) get in.
export async function GET(req) {
  const url = new URL(req.url);
  const origin = appOrigin(req);
  const stateParam = url.searchParams.get("state") || "";
  const state = readToken(stateParam);
  const cookieState = cookies().get("oauth_state")?.value;
  const fail = (code) => {
    const r = NextResponse.redirect(`${origin}/teacher/login?error=${code}`);
    r.cookies.set("oauth_state", "", { path: "/", maxAge: 0 });
    return r;
  };
  if (!state || !cookieState || cookieState !== stateParam) return fail("state");
  if (url.searchParams.get("error")) return fail("cancelled");
  const code = url.searchParams.get("code");
  if (!code) return fail("cancelled");

  let claims;
  try {
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${origin}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });
    const tok = await tokenRes.json();
    if (!tokenRes.ok || !tok.id_token) throw new Error("token");
    claims = JSON.parse(Buffer.from(tok.id_token.split(".")[1], "base64url").toString());
  } catch {
    return fail("google");
  }
  const okIss = ["accounts.google.com", "https://accounts.google.com"].includes(claims.iss);
  if (!okIss || claims.aud !== process.env.GOOGLE_CLIENT_ID || !claims.email || claims.email_verified === false || (claims.exp && claims.exp * 1000 < Date.now())) {
    return fail("google");
  }
  const t = await getTeacherByEmail(claims.email);
  if (!t || !t.active) return fail("not_teacher");
  await touchTeacherLogin(t.id, claims.sub, claims.name);
  const res = NextResponse.redirect(`${origin}${state.next || "/teacher"}`);
  const c = teacherCookie(t.id);
  res.cookies.set(c.name, c.value, c.options);
  res.cookies.set("oauth_state", "", { path: "/", maxAge: 0 });
  return res;
}
