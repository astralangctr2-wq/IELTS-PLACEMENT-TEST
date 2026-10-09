// Vietnam time (UTC+7, no DST) helpers for the schedule inputs. Teachers
// type "giờ Việt Nam" in <input type="datetime-local">; we store UTC.

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

// "2026-10-12T08:00" (VN wall clock) → ISO string (UTC) or null.
export function vnInputToIso(value) {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  const utc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - VN_OFFSET_MS;
  return new Date(utc).toISOString();
}

// ISO / Date → "2026-10-12T08:00" in VN wall clock, for datetime-local.
export function isoToVnInput(value) {
  if (!value) return "";
  const d = new Date(new Date(value).getTime() + VN_OFFSET_MS);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

// "08:00 12/10/2026"
export function formatVnShort(value) {
  if (!value) return "";
  const d = new Date(new Date(value).getTime() + VN_OFFSET_MS);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())} ${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

// "open" | "not_yet" | "closed" for a session row at time `now`.
export function scheduleState(opensAt, closesAt, now = Date.now()) {
  if (opensAt && now < new Date(opensAt).getTime()) return "not_yet";
  if (closesAt && now >= new Date(closesAt).getTime()) return "closed";
  return "open";
}
