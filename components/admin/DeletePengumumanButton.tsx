"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export default function DeletePengumumanButton({ id, judul }: { id: string; judul: string }) {
  const router = useRouter();

  async function handleDelete() {
    if (!confirm(`Hapus pengumuman "${judul}"?`)) return;

    const res  = await fetch(`/api/admin/pengumuman/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      router.refresh();
    }
  }

  return (
    <button
      onClick={handleDelete}
      className="p-2 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
    >
      <Trash2 size={15} />
    </button>
  );
}
