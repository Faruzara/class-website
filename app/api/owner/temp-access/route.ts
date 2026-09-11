import { NextRequest, NextResponse } from "next/server";
import { getOwnerSession, generateKey, hashKey, logActivity } from "@/lib/auth";
import { createTempKey } from "@/lib/db";
import { encryptGeneratedKey } from "@/lib/key-storage";
import { normalizeTempPermissions } from "@/lib/access-control";
import type { ApiResponse, TempPermission } from "@/types";

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  const owner = await getOwnerSession();
  if (!owner || !sameOrigin(request)) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const label = typeof body.label === "string" ? body.label.trim() : "";
    const duration = Number(body.duration_minutes);
    const permissions = normalizeTempPermissions(body.permissions) as TempPermission[];
    if (label.length < 3 || label.length > 60) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Nama akses harus 3 sampai 60 karakter." }, { status: 400 });
    }
    if (!Number.isInteger(duration) || duration < 1 || duration > 43_200) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Durasi harus antara 1 menit dan 30 hari." }, { status: 400 });
    }
    if (!Array.isArray(body.permissions) || permissions.length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Pilih minimal satu permission." }, { status: 400 });
    }

    const key = generateKey("TMP");
    const now = Date.now();
    const expiresAt = new Date(now + duration * 60_000).toISOString();
    const activationExpiresAt = new Date(Math.min(now + 5 * 60_000, new Date(expiresAt).getTime())).toISOString();
    await createTempKey({
      key_hash: await hashKey(key),
      key_ciphertext: encryptGeneratedKey(key),
      activation_expires_at: activationExpiresAt,
      label,
      created_by_slot: null,
      created_by_role: "owner",
      permissions,
      expires_at: expiresAt,
    });
    await logActivity({
      actor_role: "owner",
      actor_label: "Owner",
      action: "generate_temp_access",
      detail: `${label} / ${duration} menit / ${permissions.join(", ")}`,
    });
    return NextResponse.json<ApiResponse<{ key: string }>>({ success: true, data: { key } });
  } catch (error) {
    console.error("[owner/temp-access]", error);
    const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
    const migrationMissing = /created_by_role|permissions|created_by_slot|null value/i.test(message);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: migrationMissing
        ? "Jalankan supabase-migration-access-control.sql terlebih dahulu."
        : "Temporary access gagal dibuat.",
    }, { status: migrationMissing ? 503 : 500 });
  }
}
