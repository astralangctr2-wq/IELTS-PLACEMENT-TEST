"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Waiting room: look again every few seconds until an exam is open.
export default function RoomRefresh({ seconds = 15 }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
