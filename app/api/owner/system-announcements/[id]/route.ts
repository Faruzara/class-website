import { NextRequest, NextResponse } from "next/server";
import { getOwnerSession, logActivity } from "@/lib/auth";
import { deletePengumuman, getPengumumanById, updatePengumuman } from "@/lib/db";
import type { ApiResponse, Pengumuman } from "@/types";
import { createPinnedUntil } from "@/lib/announcement-expiry";

async function authorize(request: NextRequest, id: string) {
  const owner = await getOwnerSession();
  const origin = request.headers.get("origin");
  if (!owner || (origin && origin !== request.nextUrl.origin)) return { error: "Unauthorized", status: 401 } as const;
  const current = await getPengumumanById(id);
  if (!current || current.announcement_type !== "system") return { error: "System Update tidak ditemukan", status: 404 } as const;
  return { owner, current };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorize(request, id);
  if ("error" in auth) return NextResponse.json<ApiResponse>({ success: false, error: auth.error }, { status: auth.status });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const judul = String(body?.judul ?? "").trim();
  const konten = String(body?.konten ?? "").trim();
  const categories = new Set(["umum", "akademik", "kegiatan", "penting"]);
  if (!judul || !konten || !categories.has(String(body?.kategori))) return NextResponse.json<ApiResponse>({ success: false, error: "Data tidak valid" }, { status: 400 });
  const payload: Partial<Pengumuman> = { judul, konten, kategori: body?.kategori as Pengumuman["kategori"], is_pinned: body?.is_pinned === true, pinned_until: createPinnedUntil(body?.is_pinned === true, body?.pin_duration_hours), created_by: "System" };
  await updatePengumuman(id, payload);
  await logActivity({ actor_role: "owner", actor_label: auth.owner.label, action: "system_announcement_updated", detail: judul });
  return NextResponse.json<ApiResponse<Pengumuman>>({ success: true, data: { ...auth.current, ...payload, updated_at: new Date().toISOString() } });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorize(request, id);
  if ("error" in auth) return NextResponse.json<ApiResponse>({ success: false, error: auth.error }, { status: auth.status });
  await deletePengumuman(id);
  await logActivity({ actor_role: "owner", actor_label: auth.owner.label, action: "system_announcement_deleted", detail: auth.current.judul });
  return NextResponse.json<ApiResponse>({ success: true });
}
