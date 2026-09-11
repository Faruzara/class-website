import "server-only";
import bcrypt from "bcryptjs";
import { randomInt, randomUUID, timingSafeEqual } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { supabaseAdmin } from "./supabase";
import { encryptGeneratedKey } from "./key-storage";
import { isAccessSessionActive, registerAccessSession, revokeAccessSession } from "./db";
import { canUseEditorFeature, normalizeTempPermissions } from "./access-control";
import { isMissingSupabaseColumn } from "./supabase-compat";
import type { AdminSession, Role, TempPermission } from "@/types";

// -- Nama cookie session --
const SESSION_COOKIE = "admin_session";
const JWT_SECRET     = new TextEncoder().encode(process.env.JWT_SECRET!);

// ============================================
// GENERATE KEY
// Format: ADM-xxxx-xxxx-xxxx (mudah dikirim via WA)
// ============================================
export function generateKey(prefix: "ADM" | "TMP" = "ADM"): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const segment = () =>
    Array.from({ length: 4 }, () => alphabet[randomInt(0, alphabet.length)]).join("");
  return `${prefix}-${segment()}-${segment()}-${segment()}`;
}

// ============================================
// HASH & VERIFIKASI KEY
// ============================================
export async function hashKey(key: string): Promise<string> {
  return bcrypt.hash(key, 12);
}

export async function verifyKey(key: string, hash: string): Promise<boolean> {
  return bcrypt.compare(key, hash);
}

// ============================================
// GENERATE SESSION TOKEN (JWT)
// ============================================
export async function createSessionToken(session: AdminSession): Promise<string> {
  const expiresIn = session.expires_at
    ? new Date(session.expires_at)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 hari default

  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(JWT_SECRET);
}

export async function establishAccessSession(session: AdminSession, deviceLabel: string): Promise<{
  session: AdminSession;
  token: string;
}> {
  const registeredSession: AdminSession = { ...session, session_id: randomUUID() };
  const token = await createSessionToken(registeredSession);
  await registerAccessSession(registeredSession, deviceLabel);
  return { session: registeredSession, token };
}

// ============================================
// VERIFIKASI SESSION DARI COOKIE
// ============================================
export async function getSession(): Promise<AdminSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, JWT_SECRET);
    const session = payload as unknown as AdminSession;

    if (session.session_id) {
      const active = await isAccessSessionActive(session.session_id);
      if (active === false) return null;
    }

    if (session.role === "admin" && session.slot_id) {
      const { data } = await supabaseAdmin
        .from("admin_slots")
        .select("key_hash")
        .eq("id", session.slot_id)
        .maybeSingle();
      if (!data?.key_hash) return null;
    }

    if (session.role === "temp_admin" && session.temp_key_id) {
      const { data } = await supabaseAdmin
        .from("temp_keys")
        .select("expires_at, is_used, session_token")
        .eq("id", session.temp_key_id)
        .eq("is_used", true)
        .maybeSingle();

      if (
        !data ||
        data.session_token !== token ||
        new Date(data.expires_at).getTime() <= Date.now()
      ) {
        return null;
      }
    }

    return session;
  } catch {
    // Token invalid atau expired
    return null;
  }
}

export async function getOwnerSession(): Promise<AdminSession | null> {
  try {
    const token = (await cookies()).get("owner_session")?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "owner") return null;

    const sessionId = typeof payload.session_id === "string" ? payload.session_id : null;
    if (sessionId) {
      const active = await isAccessSessionActive(sessionId);
      if (active === false) return null;
    }

    return {
      session_id: sessionId,
      slot_id: null,
      temp_key_id: null,
      role: "owner",
      label: "Owner",
      expires_at: null,
    };
  } catch {
    return null;
  }
}

export async function getEditorSession(permission?: TempPermission): Promise<AdminSession | null> {
  const session = (await getSession()) ?? await getOwnerSession();
  return permission && !canUseEditorFeature(session, permission) ? null : session;
}

// ============================================
// SET SESSION KE COOKIE (httpOnly, secure)
// ============================================
export async function setSessionCookie(session: AdminSession, tokenOverride?: string): Promise<void> {
  // Temp key activation already creates and stores the session token. Reuse it
  // so the cookie and database record always refer to the same session.
  const token = tokenOverride ?? await createSessionToken(session);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,       // tidak bisa diakses JS browser
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // Kalau temp admin, cookie ikut waktu temp key
    expires: session.expires_at ? new Date(session.expires_at) : undefined,
  });
}

// ============================================
// HAPUS SESSION (logout)
// ============================================
export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  const session = await getSession();
  if (session?.session_id) await revokeAccessSession(session.session_id).catch(() => undefined);
  cookieStore.delete(SESSION_COOKIE);
}

export async function clearOwnerSession(): Promise<void> {
  const session = await getOwnerSession();
  if (session?.session_id) await revokeAccessSession(session.session_id).catch(() => undefined);
  (await cookies()).delete("owner_session");
}

// ============================================
// VALIDASI LOGIN — cocokkan key dengan semua slot admin
// ============================================
export async function validateAdminKey(inputKey: string): Promise<{
  success: boolean;
  session?: AdminSession;
  token?: string;
  error?: string;
}> {
  // Ambil semua slot yang aktif
  const { data: slots, error } = await supabaseAdmin
    .from("admin_slots")
    .select("*")
    .not("key_hash", "is", null);

  if (error || !slots) {
    return { success: false, error: "Gagal mengambil data slot" };
  }

  // Cek satu per satu (tidak bisa shortcut karena bcrypt)
  for (const slot of slots) {
    // A permanent key remains reusable until Owner revokes its slot.
    const match = await verifyKey(inputKey, slot.key_hash);
    if (match) {
      const claimPayload: Record<string, string | null> = {
        last_login: new Date().toISOString(),
        key_ciphertext: null,
        expires_at: null,
      };
      if ("activation_expires_at" in slot) claimPayload.activation_expires_at = null;
      const { error: updateError } = await supabaseAdmin
        .from("admin_slots")
        .update(claimPayload)
        .eq("id", slot.id);
      if (updateError) continue;

      return {
        success: true,
        session: {
          slot_id: slot.id,
          temp_key_id: null,
          role: "admin",
          label: slot.label,
          expires_at: null, // permanen sampai logout
        },
      };
    }
  }

  return { success: false, error: "Key tidak valid" };
}

// ============================================
// VALIDASI TEMP KEY
// ============================================
export async function validateTempKey(inputKey: string, deviceLabel = "Unknown device"): Promise<{
  success: boolean;
  session?: AdminSession;
  token?: string;
  error?: string;
}> {
  // Ambil temp key yang belum dipakai dan belum expired
  const primaryResult = await supabaseAdmin
    .from("temp_keys")
    .select("*")
    .eq("is_used", false)
    .gt("activation_expires_at", new Date().toISOString());

  let tempKeys = primaryResult.data;
  let error = primaryResult.error;
  if (isMissingSupabaseColumn(error, "activation_expires_at")) {
    const compatibleResult = await supabaseAdmin
      .from("temp_keys")
      .select("*")
      .eq("is_used", false)
      .gt("expires_at", new Date().toISOString());
    tempKeys = compatibleResult.data;
    error = compatibleResult.error;
  }

  if (error || !tempKeys) {
    return { success: false, error: "Gagal mengambil temp key" };
  }

  for (const tk of tempKeys) {
    const match = await verifyKey(inputKey, tk.key_hash);
    if (match) {
      const established = await establishAccessSession({
        slot_id: null,
        temp_key_id: tk.id,
        role: "temp_admin",
        label: tk.label,
        expires_at: tk.expires_at,
        permissions: normalizeTempPermissions(tk.permissions),
      }, deviceLabel);

      // Tandai sudah dipakai + simpan session token
      const primaryActivation = await supabaseAdmin
        .from("temp_keys")
        .update({ is_used: true, key_ciphertext: null, activation_expires_at: null, session_token: established.token })
        .eq("id", tk.id)
        .eq("is_used", false)
        .gt("expires_at", new Date().toISOString())
        .select("id")
        .maybeSingle();

      let activated = primaryActivation.data;
      if (isMissingSupabaseColumn(primaryActivation.error, "activation_expires_at")) {
        const compatibleActivation = await supabaseAdmin
          .from("temp_keys")
          .update({ is_used: true, key_ciphertext: null, session_token: established.token })
          .eq("id", tk.id)
          .eq("is_used", false)
          .gt("expires_at", new Date().toISOString())
          .select("id")
          .maybeSingle();
        activated = compatibleActivation.data;
      }

      if (!activated) {
        if (established.session.session_id) await revokeAccessSession(established.session.session_id).catch(() => undefined);
        continue;
      }

      await logActivity({
        actor_role: "temp_admin",
        actor_label: `Temp: ${tk.label}`,
        action: "activate_temp_key",
        detail: `Dibuat oleh Slot ${tk.created_by_slot}`,
      });

      return {
        success: true,
        token: established.token,
        session: established.session,
      };
    }
  }

  return { success: false, error: "Key tidak valid atau sudah dipakai/expired" };
}

// ============================================
// OWNER AUTH — pakai master key dari env
// ============================================
export async function validateOwnerKey(inputKey: string): Promise<boolean> {
  const expected = process.env.OWNER_MASTER_KEY;
  if (!expected) return false;
  const input = Buffer.from(inputKey);
  const target = Buffer.from(expected);
  return input.length === target.length && timingSafeEqual(input, target);
}

// ============================================
// CATAT ACTIVITY LOG
// ============================================
export async function logActivity(params: {
  actor_role: Role;
  actor_label: string;
  action: string;
  detail: string | null;
  ip_address?: string;
  device_label?: string | null;
  user_agent?: string | null;
  event_status?: "success" | "failure" | "info";
  session_id?: string | null;
}): Promise<void> {
  const extendedPayload = {
    actor_role:  params.actor_role,
    actor_label: params.actor_label,
    action:      params.action,
    detail:      params.detail,
    ip_address:  params.ip_address ?? null,
    device_label: params.device_label ?? null,
    user_agent: params.user_agent ?? null,
    event_status: params.event_status ?? "info",
    session_id: params.session_id ?? null,
    created_at:  new Date().toISOString(),
  };
  const { error } = await supabaseAdmin.from("activity_logs").insert(extendedPayload);
  const securityColumns = ["device_label", "user_agent", "event_status", "session_id"];
  if (error && securityColumns.some((column) => isMissingSupabaseColumn(error, column))) {
    await supabaseAdmin.from("activity_logs").insert({
      actor_role: extendedPayload.actor_role,
      actor_label: extendedPayload.actor_label,
      action: extendedPayload.action,
      detail: extendedPayload.detail,
      ip_address: extendedPayload.ip_address,
      created_at: extendedPayload.created_at,
    });
  }
}
