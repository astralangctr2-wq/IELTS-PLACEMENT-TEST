"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  const logout = async () => {
    await fetch("/api/teacher/logout", { method: "POST" });
    router.push("/teacher/login");
    router.refresh();
  };
  return <button className="btn-ghost btn-sm" onClick={logout}>Đăng xuất</button>;
}
