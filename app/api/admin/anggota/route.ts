import { NextRequest, NextResponse } from "next/server";
import { getEditorSession, logActivity } from "@/lib/auth";
import { createAnggota, getAnggota, isAnggotaRoleAvailable } from "@/lib/db";
import type { ApiResponse, Anggota } from "@/types";
import { isManagedMediaUrl } from "@/lib/validation";
import { canonicalMemberRole } from "@/lib/member-roles";

export async function GET() {
  const session = await getEditorSession("members");
  if (!session) return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });
  return NextResponse.json<ApiResponse<Anggota[]>>({ success: true, data: await getAnggota(true) });
}

export async function POST(req: NextRequest) {
  const session = await getEditorSession("members");
  if (!session) return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const nama = String(body.nama ?? "").trim();
  const fotoUrl = String(body.foto_url ?? "").trim();
  const requestedRole = String(body.jabatan ?? "").trim();
  const jabatan = requestedRole ? canonicalMemberRole(requestedRole) : null;
  if (!nama) return NextResponse.json<ApiResponse>({ success: false, error: "Nama wajib diisi" }, { status: 400 });
  if (requestedRole && !jabatan) return NextResponse.json<ApiResponse>({ success: false, error: "Jabatan tidak valid" }, { status: 400 });
  if (jabatan && !(await isAnggotaRoleAvailable(jabatan))) {
    return NextResponse.json<ApiResponse>({ success: false, error: `Slot ${jabatan} sudah terisi` }, { status: 409 });
  }

  if (fotoUrl && !isManagedMediaUrl(fotoUrl)) return NextResponse.json<ApiResponse>({ success: false, error: "URL foto tidak valid" }, { status: 400 });
  await createAnggota({
    nama,
    jabatan,
    foto_url: fotoUrl || null,
    is_visible: body.is_visible !== false,
    object_fit: body.object_fit === "contain" ? "contain" : "cover",
    object_position_x: Math.max(0, Math.min(100, Number(body.object_position_x ?? 50))),
    object_position_y: Math.max(0, Math.min(100, Number(body.object_position_y ?? 50))),
  });
  await logActivity({ actor_role: session.role, actor_label: session.label, action: "member_added", detail: nama });
  return NextResponse.json<ApiResponse>({ success: true });
}
