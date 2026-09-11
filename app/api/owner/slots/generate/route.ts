import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { generateKey, hashKey, logActivity } from "@/lib/auth";
import { encryptGeneratedKey } from "@/lib/key-storage";
import { setAdminKey } from "@/lib/db";
import { isAdminSlotActive } from "@/lib/admin-slot-state";
import { isMissingSupabaseColumn } from "@/lib/supabase-compat";
import type { ApiResponse } from "@/types";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

async function isOwner(): Promise<boolean> {
  try {
    const token = (await cookies()).get("owner_session")?.value;
    if (!token) return false;
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload.role === "owner";
  } catch { return false; }
}

export async function POST(req: NextRequest) {
  if (!(await isOwner())) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { slot_id, label } = await req.json();

  const slotId = Number(slot_id);
  const safeLabel = typeof label === "string" ? label.trim() : "";
  if (![1, 2, 3].includes(slotId) || safeLabel.length < 2 || safeLabel.length > 60) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "slot_id dan label wajib diisi" },
      { status: 400 }
    );
  }

  const { supabaseAdmin } = await import("@/lib/supabase");
  const primaryResult = await supabaseAdmin
    .from("admin_slots")
    .select("key_hash, expires_at, activation_expires_at, assigned_at, last_login")
    .eq("id", slotId)
    .maybeSingle();

  let slot: {
    key_hash: string | null;
    expires_at?: string | null;
    activation_expires_at?: string | null;
    assigned_at?: string | null;
    last_login: string | null;
  } | null = primaryResult.data;
  let slotError: unknown = primaryResult.error;

  // Database lama belum memiliki activation_expires_at. Tetap gunakan
  // assigned_at + 5 menit agar generate/revoke tidak terkunci oleh schema lama.
  if (isMissingSupabaseColumn(slotError, "activation_expires_at")) {
    const legacyResult = await supabaseAdmin
      .from("admin_slots")
      .select("key_hash, expires_at, assigned_at, last_login")
      .eq("id", slotId)
      .maybeSingle();
    slot = legacyResult.data;
    slotError = legacyResult.error;
  }

  if (slotError) {
    console.error("[owner/admin-slot/generate] gagal memeriksa slot", slotError);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Gagal memeriksa status slot di database" },
      { status: 500 }
    );
  }
  if (!slot) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: `Record Slot ${slotId} tidak ditemukan di database` },
      { status: 404 }
    );
  }
  if (isAdminSlotActive(slot)) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Slot tidak tersedia; revoke key lama terlebih dahulu" },
      { status: 409 }
    );
  }

  const key  = generateKey("ADM");
  const hash = await hashKey(key);

  // Permanent slots have neither an access expiry nor an activation deadline.
  // They remain valid until Owner explicitly revokes the slot.
  await setAdminKey(slotId, hash, encryptGeneratedKey(key), null, null);
  // Update label slot juga
  await supabaseAdmin.from("admin_slots").update({ label: safeLabel }).eq("id", slotId);

  await logActivity({
    actor_role:  "owner",
    actor_label: "Owner",
    action:      "generate_admin_key",
    detail:      `Slot ${slotId} - ${safeLabel}`,
  });

  return NextResponse.json<ApiResponse<{ key: string }>>({
    success: true,
    data: { key },
  });
}
