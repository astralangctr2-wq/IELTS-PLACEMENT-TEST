"use client";

import { useEffect } from "react";

// Registers the app's service worker (public/sw.js) on the teacher pages,
// so Chrome / Edge offer "Cài đặt ứng dụng" and push can be switched on.
export default function SwRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
