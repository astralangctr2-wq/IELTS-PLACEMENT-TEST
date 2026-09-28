// Formats a timestamp in Vietnam time (UTC+7), always — regardless of
// whether it runs on the server (Vercel runs in UTC) or in the browser.
//
// Why this matters: formatting with plain toLocaleString("vi-VN") uses
// the machine's own timezone, so the server rendered "02:30" while the
// browser (UTC+7) rendered "09:30" for the same submission. In a client
// component that difference is a React hydration mismatch, which makes
// React throw away the server HTML and re-render the whole page — and
// that wipes the <html data-theme> attribute, flipping the page back to
// dark mode. Pinning the timezone makes server and browser agree.
export function formatVN(value) {
  return new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}
