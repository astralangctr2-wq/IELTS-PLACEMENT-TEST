import { NextResponse } from "next/server";
import { adminSignedIn } from "@/lib/staff";
import { setSessionTimes, setSessionSurvey, setSessionActive, setSessionClass, setSessionSchedule, deleteSession, setSessionTeacher, setSessionLevel, setSessionSpeaking, setRoomFor } from "@/lib/testSessions";
import { getTeacher } from "@/lib/staff";

// Admin only: teachers receive links and grade, they do not manage them.
const requireTeacher = adminSignedIn;

export async function PATCH(req, { params }) {
  if (!(await requireTeacher())) return NextResponse.json({ error: "Chỉ admin được làm việc này (hoặc chưa đăng nhập)." }, { status: 401 });
  const body = await req.json();
  if ("teacherId" in body) {
    if (body.teacherId) {
      const t = await getTeacher(String(body.teacherId));
      if (!t || !t.active) return NextResponse.json({ error: "Không tìm thấy giáo viên." }, { status: 400 });
    }
    try {
      await setSessionTeacher(params.id, body.teacherId ? String(body.teacherId) : null);
    } catch (e) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }
  if ("level" in body) {
    await setSessionLevel(params.id, body.level);
    return NextResponse.json({ ok: true });
  }
  if ("withSpeaking" in body) {
    await setSessionSpeaking(params.id, body.withSpeaking);
    return NextResponse.json({ ok: true });
  }
  if ("roomHours" in body) {
    await setRoomFor(params.id, body.roomHours);
    return NextResponse.json({ ok: true });
  }
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
  if (!(await requireTeacher())) return NextResponse.json({ error: "Chỉ admin được làm việc này (hoặc chưa đăng nhập)." }, { status: 401 });
  await deleteSession(params.id);
  return NextResponse.json({ ok: true });
}
