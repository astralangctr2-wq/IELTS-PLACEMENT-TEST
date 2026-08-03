"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteButton({ id, studentName, redirectAfter }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const onDelete = async () => {
    if (!confirm(`Xoá bài làm của "${studentName}"? Không thể hoàn tác.`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/submissions/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không xoá được.");
      if (redirectAfter) {
        router.push(redirectAfter);
      }
      router.refresh();
    } catch (err) {
      alert(err.message);
      setLoading(false);
    }
  };

  return (
    <button
      className="btn-ghost btn-sm"
      style={{ color: "var(--accent)", borderColor: "var(--accent)" }}
      onClick={onDelete}
      disabled={loading}
    >
      {loading ? "Đang xoá…" : "Xoá"}
    </button>
  );
}
