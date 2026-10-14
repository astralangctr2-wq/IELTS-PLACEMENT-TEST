import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isValidSessionValue } from "@/lib/auth";
import { setSessionTimes, setSessionSurvey, setSessionActive, setSessionClass, setSessionSchedule, deleteSession } from "@/lib/testSessions";

function requireTeacher() {
  const value = cookies().get("teacher_session")?.value;
  return isValidSessionValue(value);
}

export async function PATCH(req, { params }) {
  if (!requireTeacher()) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  const body = await req.json();
  if ("opensAt" in body || "closesAt" in body) {
    await setSessionSchedule(params.id, body.opensAt || null, body.closesAt || null);
    return NextResponse.json({ ok: true });
  }
  if ("timeLimits" in body || "listeningPlays" in body) {
    try {
      const timeLimits = await setSessionTimes(params.id, body.timeLimits, body.listeningPlays);
      return NextResponse.json({ ok: true, timeLimits });
    } catch (e) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
  }
  if ("survey" in body) {
    await setSessionSurvey(params.id, body.survey);
    return NextResponse.json({ ok: true });
  }
  if ("className" in body) {
    await setSessionClass(params.id, body.className);
    return NextResponse.json({ ok: true });
  }
  await setSessionActive(params.id, Boolean(body.active));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req, { params }) {
  if (!requireTeacher()) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  await deleteSession(params.id);
  return NextResponse.json({ ok: true });
}
