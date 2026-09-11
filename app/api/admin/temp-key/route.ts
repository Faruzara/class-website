import { NextRequest, NextResponse } from "next/server";
import { getSession, generateKey, hashKey, logActivity } from "@/lib/auth";
import { createTempKey, getActiveTempKeys } from "@/lib/db";
import type { ApiResponse } from "@/types";
import { encryptGeneratedKey } from "@/lib/key-storage";
import { ALL_TEMP_PERMISSIONS, normalizeTempPermissions } from "@/lib/access-control";

// GET — list temp key aktif
export async function GET() {
  const session = await getSession();
  if (session?.role !== "admin") {
    return NextResponse.json<ApiResponse>({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const keys = await getActiveTempKeys();
  return NextResponse.json<ApiResponse<typeof keys>>({ success: true, data: keys });
}

// POST — generate temp key baru
export async function POST(req: NextRequest) {
  const session = await getSession();

  // Hanya admin biasa (bukan temp) yang boleh generate
  if (session?.role !== "admin" || !session.slot_id) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Hanya admin yang bisa generate temp key" },
      { status: 403 }
    );
  }
  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { label, duration_minutes, permissions: requestedPermissions } = await req.json();

  if (!label || typeof label !== "string" || label.trim().length < 3) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Label wajib diisi (min. 3 karakter)" },
      { status: 400 }
    );
  }

  // Generate key dengan prefix TMP
  const key  = generateKey("TMP");
  const hash = await hashKey(key);

  const duration = Number(duration_minutes ?? 60);
  if (!Number.isInteger(duration) || duration < 1 || duration > 43200) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Durasi temp key tidak valid" },
      { status: 400 }
    );
  }

  const expiresAt = new Date(Date.now() + duration * 60 * 1000).toISOString();
  const activationExpiresAt = new Date(Math.min(Date.now() + 5 * 60 * 1000, new Date(expiresAt).getTime())).toISOString();
  const permissions = requestedPermissions === undefined
    ? [...ALL_TEMP_PERMISSIONS]
    : normalizeTempPermissions(requestedPermissions);
  if (permissions.length === 0) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Pilih minimal satu permission" }, { status: 400 });
  }

  await createTempKey({
    key_hash:        hash,
    key_ciphertext:  encryptGeneratedKey(key),
    activation_expires_at: activationExpiresAt,
    label:           label.trim(),
    created_by_slot: session.slot_id,
    created_by_role: "admin",
    permissions,
    expires_at:      expiresAt,
  });

  // Catat di log
  await logActivity({
    actor_role:  "admin",
    actor_label: `Slot ${session.slot_id} - ${session.label}`,
    action:      "generate_temp_key",
    detail:      `Untuk: ${label.trim()} · Expired: ${new Date(expiresAt).toLocaleTimeString("id-ID")}`,
  });

  // Return key asli (hanya sekali, tidak disimpan di DB)
  return NextResponse.json<ApiResponse<{ key: string }>>({
    success: true,
    data: { key },
  });
}
