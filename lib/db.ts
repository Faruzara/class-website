import "server-only";
import { supabase, supabaseAdmin } from "./supabase";
import type {
  Pengumuman, JadwalItem, Anggota, GaleriFoto, AdminSlot, TempKey, ActivityLog, SiteSettings,
  AccessSession, AdminSession, TempPermission, FeedbackSubmission, FeedbackStatus
} from "@/types";
import { canonicalMemberRole, type MemberRoleSlot } from "./member-roles";
import { isAdminSlotActive } from "./admin-slot-state";
import { isMissingSupabaseColumn, isMissingSupabaseRelation } from "./supabase-compat";
import { normalizeTempPermissions } from "./access-control";
import { isAnnouncementVisible } from "./announcement-expiry";

// ============================================
// PENGUMUMAN
// ============================================
function normalizePengumuman(row: Record<string, unknown>): Pengumuman {
  return {
    ...row,
    announcement_type: row.announcement_type === "system" ? "system" : "admin",
    pinned_until: typeof row.pinned_until === "string" ? row.pinned_until : null,
  } as Pengumuman;
}

export async function getPengumuman(type?: Pengumuman["announcement_type"], options: { includeExpired?: boolean } = {}): Promise<Pengumuman[]> {
  const { data, error } = await supabase
    .from("pengumuman")
    .select("*")
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;

  let rows = (data ?? []).map((row) => normalizePengumuman(row));
  if (type) rows = rows.filter((row) => row.announcement_type === type);
  return options.includeExpired ? rows : rows.filter((row) => isAnnouncementVisible(row));
}

export async function getPengumumanById(id: string): Promise<Pengumuman | null> {
  const { data, error } = await supabaseAdmin.from("pengumuman").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? normalizePengumuman(data) : null;
}

export async function createPengumuman(
  payload: Omit<Pengumuman, "id" | "created_at" | "updated_at">
): Promise<Pengumuman> {
  const insertPayload = { ...payload, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  const { data, error } = await supabaseAdmin
    .from("pengumuman")
    .insert(insertPayload)
    .select()
    .single();

  if (!error) return normalizePengumuman(data);

  if (isMissingSupabaseColumn(error, "pinned_until")) {
    const { pinned_until: _pinnedUntil, ...compatiblePayload } = insertPayload;
    const compatible = await supabaseAdmin.from("pengumuman").insert(compatiblePayload).select().single();
    if (!compatible.error) return normalizePengumuman(compatible.data);
    if (!isMissingSupabaseColumn(compatible.error, "announcement_type") || payload.announcement_type === "system") throw compatible.error;
    const { announcement_type: _type, ...legacyPayload } = compatiblePayload;
    const legacy = await supabaseAdmin.from("pengumuman").insert(legacyPayload).select().single();
    if (legacy.error) throw legacy.error;
    return normalizePengumuman(legacy.data);
  }

  if (!isMissingSupabaseColumn(error, "announcement_type") || payload.announcement_type === "system") throw error;

  const { announcement_type: _ignored, ...legacyPayload } = insertPayload;
  const { data: legacyData, error: legacyError } = await supabaseAdmin.from("pengumuman").insert(legacyPayload).select().single();
  if (legacyError) throw legacyError;
  return normalizePengumuman(legacyData);
}

export async function updatePengumuman(
  id: string,
  payload: Partial<Pengumuman>
): Promise<void> {
  const updatePayload = { ...payload, updated_at: new Date().toISOString() };
  const { error } = await supabaseAdmin
    .from("pengumuman")
    .update(updatePayload)
    .eq("id", id);

  if (error && isMissingSupabaseColumn(error, "pinned_until")) {
    const { pinned_until: _ignored, ...compatiblePayload } = updatePayload;
    const { error: compatibleError } = await supabaseAdmin.from("pengumuman").update(compatiblePayload).eq("id", id);
    if (compatibleError) throw compatibleError;
    return;
  }
  if (error) throw error;
}

export async function deletePengumuman(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("pengumuman")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// ============================================
// FEEDBACK PUBLIK
// ============================================
export async function getFeedbackSubmissions(): Promise<FeedbackSubmission[]> {
  const { data, error } = await supabaseAdmin
    .from("feedback_submissions")
    .select("id,type,message,page_path,status,created_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as FeedbackSubmission[];
}

export async function createFeedbackSubmission(payload: Pick<FeedbackSubmission, "type" | "message" | "page_path">): Promise<FeedbackSubmission> {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("feedback_submissions")
    .insert({ ...payload, status: "open", created_at: now, updated_at: now })
    .select("id,type,message,page_path,status,created_at,updated_at")
    .single();
  if (error) throw error;
  return data as FeedbackSubmission;
}

export async function updateFeedbackStatus(id: string, status: FeedbackStatus): Promise<void> {
  const { error } = await supabaseAdmin
    .from("feedback_submissions")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// ============================================
// JADWAL
// ============================================
const URUTAN_HARI = ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];

export async function getJadwal(): Promise<JadwalItem[]> {
  const withColor = await supabase
    .from("jadwal")
    .select("id, subject, day, week, room, start_period, end_period, color_override")
    .not("subject", "is", null)
    .order("week", { ascending: true })
    .order("start_period", { ascending: true });

  if (!withColor.error) return (withColor.data ?? []) as JadwalItem[];
  if (!isMissingSupabaseColumn(withColor.error, "color_override")) throw withColor.error;

  const legacy = await supabase
    .from("jadwal")
    .select("id, subject, day, week, room, start_period, end_period")
    .not("subject", "is", null)
    .order("week", { ascending: true })
    .order("start_period", { ascending: true });
  if (legacy.error) throw legacy.error;
  return (legacy.data ?? []).map((item) => ({ ...item, color_override: null })) as JadwalItem[];
}

export async function createJadwalItem(item: Omit<JadwalItem, "id">): Promise<void> {
  const { error } = await supabaseAdmin
    .from("jadwal")
    .insert(item);

  if (!error) return;
  if (!isMissingSupabaseColumn(error, "color_override") || item.color_override) throw error;
  const { color_override: _color, ...legacyItem } = item;
  const { error: legacyError } = await supabaseAdmin.from("jadwal").insert(legacyItem);
  if (legacyError) throw legacyError;
}

export async function updateJadwalItem(id: string, item: Omit<JadwalItem, "id">): Promise<boolean> {
  const result = await supabaseAdmin
    .from("jadwal")
    .update(item)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (!result.error) return Boolean(result.data);
  if (!isMissingSupabaseColumn(result.error, "color_override") || item.color_override) throw result.error;
  const { color_override: _color, ...legacyItem } = item;
  const legacy = await supabaseAdmin.from("jadwal").update(legacyItem).eq("id", id).select("id").maybeSingle();
  if (legacy.error) throw legacy.error;
  return Boolean(legacy.data);
}

export async function deleteJadwalItem(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("jadwal").delete().eq("id", id);

  if (error) throw error;
}

// ============================================
// ANGGOTA
// ============================================
export async function getAnggota(includeHidden = false): Promise<Anggota[]> {
  let query = supabase
    .from("anggota")
    .select("*")
    .order("nomor_absen", { ascending: true });

  if (!includeHidden) {
    query = query.eq("is_visible", true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function upsertAnggota(
  payload: Omit<Anggota, "id">
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("anggota")
    .upsert(payload, { onConflict: "nomor_absen" });

  if (error) throw error;
}

export async function createAnggota(
  payload: Omit<Anggota, "id" | "nomor_absen"> & { nomor_absen?: number }
): Promise<void> {
  let nomorAbsen = payload.nomor_absen;
  if (!nomorAbsen) {
    const { data } = await supabaseAdmin
      .from("anggota")
      .select("nomor_absen")
      .order("nomor_absen", { ascending: false })
      .limit(1)
      .maybeSingle();
    nomorAbsen = (data?.nomor_absen ?? 0) + 1;
  }

  const { error } = await supabaseAdmin.from("anggota").insert({ ...payload, nomor_absen: nomorAbsen });
  if (error) throw error;
}

export async function updateAnggota(id: string, payload: Partial<Anggota>): Promise<void> {
  const { error } = await supabaseAdmin.from("anggota").update(payload).eq("id", id);
  if (error) throw error;
}

export async function deleteAnggota(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("anggota").delete().eq("id", id);
  if (error) throw error;
}

export async function isAnggotaRoleAvailable(role: MemberRoleSlot, excludeId?: string): Promise<boolean> {
  let query = supabaseAdmin.from("anggota").select("id, jabatan").not("jabatan", "is", null);
  if (excludeId) query = query.neq("id", excludeId);
  const { data, error } = await query;
  if (error) throw error;
  return !(data ?? []).some((member) => canonicalMemberRole(member.jabatan) === role);
}

// ============================================
// GALERI
// ============================================
export async function getGaleri(): Promise<GaleriFoto[]> {
  const { data, error } = await supabase
    .from("galeri")
    .select("*")
    .order("urutan", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getGaleriPage(offset: number, limit: number): Promise<{ items: GaleriFoto[]; total: number }> {
  const from = Math.max(0, Math.floor(offset));
  const pageSize = Math.max(1, Math.floor(limit));
  const { data, error, count } = await supabase
    .from("galeri")
    .select("*", { count: "exact" })
    .order("urutan", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .range(from, from + pageSize - 1);

  if (error) throw error;
  return { items: data ?? [], total: count ?? 0 };
}

export async function getGaleriCount(): Promise<number> {
  const { error, count } = await supabase
    .from("galeri")
    .select("id", { count: "exact", head: true });

  if (error) throw error;
  return count ?? 0;
}

export async function getNextGaleriUrutan(): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("galeri")
    .select("urutan")
    .order("urutan", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data?.urutan ?? -1) + 1;
}

export async function addGaleriFoto(
  payload: Omit<GaleriFoto, "id" | "created_at">
): Promise<GaleriFoto> {
  const { data, error } = await supabaseAdmin
    .from("galeri")
    .insert({ ...payload, created_at: new Date().toISOString() })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteGaleriFoto(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("galeri")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// ============================================
// SITE SETTINGS
// ============================================
export async function getSiteSettings(): Promise<SiteSettings | null> {
  const { data, error } = await supabase.from("site_settings").select("*").eq("id", 1).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateSiteSettings(payload: Partial<SiteSettings>): Promise<void> {
  const { error } = await supabaseAdmin
    .from("site_settings")
    .upsert({ id: 1, ...payload, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// ============================================
// ADMIN SLOTS — khusus owner
// ============================================
export async function getAdminSlots(): Promise<AdminSlot[]> {
  const { data, error } = await supabaseAdmin
    .from("admin_slots")
    .select("*")
    .order("id");

  if (error) throw error;

  // A slot is occupied when it has a key hash. This is the durable source of
  // truth; older rows can have a stale `is_active` flag after a migration.
  return (data ?? []).map((slot) => ({
    ...slot,
    is_active: isAdminSlotActive(slot),
    expires_at: slot.key_hash ? null : slot.expires_at,
    activation_expires_at: slot.key_hash ? null : slot.activation_expires_at,
  }));
}

export async function setAdminKey(slotId: number, keyHash: string, keyCiphertext: string, expiresAt: string | null = null, activationExpiresAt: string | null = null): Promise<void> {
  const payload = {
    key_hash: keyHash,
    key_ciphertext: keyCiphertext,
    is_active: true,
    assigned_at: new Date().toISOString(),
    expires_at: expiresAt,
    activation_expires_at: activationExpiresAt,
    last_login: null,
  };
  const { error } = await supabaseAdmin
    .from("admin_slots")
    .update(payload)
    .eq("id", slotId);

  if (!error) {
    await revokeSessionsForActor("admin", slotId);
    return;
  }
  if (!isMissingSupabaseColumn(error, "activation_expires_at")) throw error;

  const { activation_expires_at: _ignored, ...legacyPayload } = payload;
  const { error: legacyError } = await supabaseAdmin
    .from("admin_slots")
    .update({ ...legacyPayload, expires_at: activationExpiresAt ?? expiresAt })
    .eq("id", slotId);
  if (legacyError) throw legacyError;
  await revokeSessionsForActor("admin", slotId);
}

export async function revokeAdminKey(slotId: number): Promise<void> {
  const { error } = await supabaseAdmin
    .from("admin_slots")
    .update({ key_hash: null, key_ciphertext: null, is_active: false, assigned_at: null, expires_at: null, activation_expires_at: null })
    .eq("id", slotId);

  if (!error) {
    await revokeSessionsForActor("admin", slotId);
    return;
  }
  if (!isMissingSupabaseColumn(error, "activation_expires_at")) throw error;

  const { error: legacyError } = await supabaseAdmin
    .from("admin_slots")
    .update({ key_hash: null, key_ciphertext: null, is_active: false, assigned_at: null, expires_at: null })
    .eq("id", slotId);
  if (legacyError) throw legacyError;
  await revokeSessionsForActor("admin", slotId);
}

// ============================================
// TEMP KEYS
// ============================================
export async function getActiveTempKeys(): Promise<TempKey[]> {
  const { data, error } = await supabaseAdmin
    .from("temp_keys")
    .select("*")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? [])
    .filter((key) => !key.revoked_at)
    .filter((key) => key.is_used || !key.activation_expires_at || new Date(key.activation_expires_at).getTime() > Date.now())
    .map(toSafeTempKey);
}

export async function getTempAccessHistory(limit = 40): Promise<TempKey[]> {
  const { data, error } = await supabaseAdmin
    .from("temp_keys")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(toSafeTempKey);
}

function toSafeTempKey(key: Record<string, unknown>): TempKey {
  return {
    id: String(key.id),
    label: String(key.label ?? "Temporary Admin"),
    created_by_slot: typeof key.created_by_slot === "number" ? key.created_by_slot : null,
    created_by_role: key.created_by_role === "owner" ? "owner" : "admin",
    permissions: normalizeTempPermissions(key.permissions),
    expires_at: String(key.expires_at),
    activation_expires_at: typeof key.activation_expires_at === "string" ? key.activation_expires_at : null,
    is_used: Boolean(key.is_used),
    created_at: String(key.created_at),
    revoked_at: typeof key.revoked_at === "string" ? key.revoked_at : null,
    revoked_by: typeof key.revoked_by === "string" ? key.revoked_by : null,
    revoked_reason: typeof key.revoked_reason === "string" ? key.revoked_reason : null,
  };
}

export async function createTempKey(payload: {
  key_hash: string;
  key_ciphertext: string;
  activation_expires_at: string;
  label: string;
  created_by_slot: number | null;
  created_by_role: "owner" | "admin";
  permissions: TempPermission[];
  expires_at: string;
}): Promise<void> {
  const { error } = await supabaseAdmin
    .from("temp_keys")
    .insert({ ...payload, is_used: false, session_token: null });

  if (!error) return;
  if (isMissingSupabaseColumn(error, "activation_expires_at")) {
    const { activation_expires_at: _activation, ...compatiblePayload } = payload;
    const { error: compatibleError } = await supabaseAdmin
      .from("temp_keys")
      .insert({ ...compatiblePayload, is_used: false, session_token: null });
    if (compatibleError) throw compatibleError;
    return;
  }
  const missingNewColumn = ["created_by_role", "permissions"].some((column) => isMissingSupabaseColumn(error, column));
  if (!missingNewColumn || payload.created_by_slot === null) throw error;
  const { created_by_role: _role, permissions: _permissions, ...legacyPayload } = payload;
  const { error: legacyError } = await supabaseAdmin
    .from("temp_keys")
    .insert({ ...legacyPayload, is_used: false, session_token: null });
  if (legacyError) throw legacyError;
}

export async function revokeTempKey(id: string, revokedBy?: string, reason = "Manual revoke"): Promise<void> {
  // Invalidasi key yang belum dipakai maupun sesi temp yang sedang aktif.
  const revokedAt = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("temp_keys")
    .update({ is_used: true, key_ciphertext: null, session_token: null, activation_expires_at: null, expires_at: revokedAt, revoked_at: revokedAt, revoked_by: revokedBy ?? null, revoked_reason: reason })
    .eq("id", id);

  if (error && isMissingSupabaseColumn(error, "activation_expires_at")) {
    const { error: compatibleError } = await supabaseAdmin
      .from("temp_keys")
      .update({ is_used: true, key_ciphertext: null, session_token: null, expires_at: revokedAt, revoked_at: revokedAt, revoked_by: revokedBy ?? null, revoked_reason: reason })
      .eq("id", id);
    if (compatibleError) {
      const missingRevocationColumn = ["revoked_at", "revoked_by", "revoked_reason"].some((column) => isMissingSupabaseColumn(compatibleError, column));
      if (!missingRevocationColumn) throw compatibleError;
      const { error: legacyError } = await supabaseAdmin.from("temp_keys").update({ is_used: true, key_ciphertext: null, session_token: null, expires_at: revokedAt }).eq("id", id);
      if (legacyError) throw legacyError;
    }
  } else if (error && (isMissingSupabaseColumn(error, "revoked_at") || isMissingSupabaseColumn(error, "revoked_by") || isMissingSupabaseColumn(error, "revoked_reason"))) {
    const { error: legacyError } = await supabaseAdmin.from("temp_keys").update({ is_used: true, key_ciphertext: null, session_token: null, expires_at: revokedAt }).eq("id", id);
    if (legacyError) throw legacyError;
  } else if (error) throw error;
  await revokeSessionsForActor("temp_admin", id);
}

// ============================================
// ACCESS SESSIONS
// ============================================
export async function registerAccessSession(session: AdminSession, deviceLabel: string): Promise<void> {
  if (!session.session_id) return;
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("access_sessions").insert({
    id: session.session_id,
    role: session.role,
    slot_id: session.slot_id,
    temp_key_id: session.temp_key_id,
    label: session.label,
    permissions: session.permissions ?? [],
    device_label: deviceLabel,
    created_at: now,
    last_seen_at: now,
    expires_at: session.expires_at,
    revoked_at: null,
  });
  if (error && !isMissingSupabaseRelation(error, "access_sessions")) throw error;
}

export async function isAccessSessionActive(id: string): Promise<boolean | null> {
  const { data, error } = await supabaseAdmin
    .from("access_sessions")
    .select("id,last_seen_at,expires_at,revoked_at")
    .eq("id", id)
    .maybeSingle();
  if (error && isMissingSupabaseRelation(error, "access_sessions")) return null;
  if (error || !data || data.revoked_at || (data.expires_at && new Date(data.expires_at).getTime() <= Date.now())) return false;
  if (Date.now() - new Date(data.last_seen_at).getTime() > 5 * 60 * 1000) {
    await supabaseAdmin.from("access_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", id);
  }
  return true;
}

export async function getAccessSessions(currentSessionId?: string | null): Promise<AccessSession[]> {
  const { data, error } = await supabaseAdmin
    .from("access_sessions")
    .select("id,role,slot_id,temp_key_id,label,permissions,device_label,created_at,last_seen_at,expires_at,revoked_at")
    .is("revoked_at", null)
    .order("last_seen_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  const now = Date.now();
  return (data ?? [])
    .filter((row) => !row.expires_at || new Date(row.expires_at).getTime() > now)
    .map((row) => ({
      ...row,
      permissions: normalizeTempPermissions(row.permissions),
      is_current: row.id === currentSessionId,
    })) as AccessSession[];
}

export async function revokeAccessSession(id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("access_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function revokeSessionsForActor(role: "admin" | "temp_admin", actorId: number | string): Promise<void> {
  const query = supabaseAdmin
    .from("access_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("role", role)
    .is("revoked_at", null);
  const { error } = role === "admin" ? await query.eq("slot_id", actorId) : await query.eq("temp_key_id", actorId);
  if (error && !isMissingSupabaseRelation(error, "access_sessions")) throw error;
}

// ============================================
// ACTIVITY LOGS — khusus owner
// ============================================
export async function getActivityLogs(limit = 50): Promise<ActivityLog[]> {
  const { data, error } = await supabaseAdmin
    .from("activity_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function getActivityLogsBefore(limit = 30, before?: string | null): Promise<ActivityLog[]> {
  let query = supabaseAdmin
    .from("activity_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50));
  if (before) query = query.lt("created_at", before);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function countRecentLoginFailures(action: string, ipAddress: string, since: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("activity_logs")
    .select("id", { count: "exact", head: true })
    .eq("action", action)
    .eq("ip_address", ipAddress)
    .gte("created_at", since);
  if (error) return 0;
  return count ?? 0;
}
