// ============================================
// TIPE DATA UTAMA — dipakai di seluruh project
// ============================================

// -- Role hierarchy --
export type Role = "owner" | "admin" | "temp_admin";
export type TempPermission = "homepage" | "schedule" | "members" | "gallery" | "moments";

// -- Slot admin (3 slot tetap) --
export interface AdminSlot {
  id: number;           // 1, 2, atau 3
  label: string;        // nama/jabatan (misal "Ketua", "Wakil")
  key_hash: string | null; // bcrypt hash dari key; null = slot kosong
  is_active: boolean;
  assigned_at: string | null;
  expires_at?: string | null;
  activation_expires_at?: string | null;
  last_login: string | null;
  generated_key?: string | null;
}

// -- Temp key yang dibuat oleh admin --
export interface TempKey {
  id: string;
  label: string;             // wajib diisi admin: "untuk siapa"
  created_by_slot: number | null;
  created_by_role?: "owner" | "admin";
  permissions?: TempPermission[];
  expires_at: string;        // ISO string, mengikuti durasi Temporary Access
  activation_expires_at?: string | null;
  is_used: boolean;          // sudah dipakai login belum
  created_at: string;
  revoked_at?: string | null;
  revoked_by?: string | null;
  revoked_reason?: string | null;
}

// -- Session aktif (admin maupun temp) --
export interface AdminSession {
  session_id?: string | null;
  slot_id: number | null;   // null jika temp admin
  temp_key_id: string | null;
  role: Role;
  label: string;            // nama slot atau label temp key
  expires_at: string | null;
  permissions?: TempPermission[];
}

export interface AccessSession {
  id: string;
  role: Role;
  slot_id: number | null;
  temp_key_id: string | null;
  label: string;
  permissions: TempPermission[];
  device_label: string;
  created_at: string;
  last_seen_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  is_current?: boolean;
}

// -- Activity log --
export interface ActivityLog {
  id: string;
  actor_role: Role;
  actor_label: string;      // "Slot 1 - Ketua" atau "Temp: Raka"
  action: string;           // "login", "post_pengumuman", dll
  detail: string | null;    // info tambahan
  ip_address: string | null;
  device_label?: string | null;
  user_agent?: string | null;
  event_status?: "success" | "failure" | "info" | null;
  session_id?: string | null;
  created_at: string;
}

// -- Pengumuman --
export type AnnouncementType = "admin" | "system";

export interface Pengumuman {
  id: string;
  judul: string;
  konten: string;
  kategori: "umum" | "akademik" | "kegiatan" | "penting";
  is_pinned: boolean;
  pinned_until: string | null;
  announcement_type: AnnouncementType;
  created_by: string;       // label aktor yang posting
  created_at: string;
  updated_at: string;
}

export type FeedbackType = "bug" | "feature";
export type FeedbackStatus = "open" | "reviewed" | "resolved";

export interface FeedbackSubmission {
  id: string;
  type: FeedbackType;
  message: string;
  page_path: string | null;
  status: FeedbackStatus;
  created_at: string;
  updated_at: string;
}

// -- Jadwal pelajaran --
export interface JadwalItem {
  id: string;
  subject: string;
  day: "Senin" | "Selasa" | "Rabu" | "Kamis" | "Jumat" | "Sabtu";
  week: 1 | 2;
  room: string | null;
  start_period: number;
  end_period: number;
}

// -- Anggota kelas --
export interface Anggota {
  id: string;
  nomor_absen: number;
  nama: string;
  jabatan: string | null;   // "Ketua Kelas", "Bendahara", dll
  foto_url: string | null;
  is_visible: boolean;      // bisa disembunyikan dari publik
  object_fit?: "cover" | "contain";
  object_position_x?: number;
  object_position_y?: number;
  foto_locked?: boolean;
}

// -- Galeri foto --
export interface GaleriFoto {
  id: string;
  judul: string;
  deskripsi: string | null;
  foto_url: string;
  thumbnail_url: string | null;
  object_position_x?: number;
  object_position_y?: number;
  kategori: string | null;
  urutan: number;
  created_at: string;
  is_locked?: boolean;
}

export interface SiteSettings {
  id: number;
  hero_image_url: string | null;
  hero_object_fit?: "cover" | "contain";
  hero_object_position_x?: number;
  hero_object_position_y?: number;
  hero_image_locked?: boolean;
  about_text: string;
  instagram_url: string | null;
  instagram_image_url?: string | null;
  instagram_image_locked?: boolean;
  tiktok_url: string | null;
  tiktok_image_url?: string | null;
  tiktok_image_locked?: boolean;
  creator_github_url?: string | null;
  updated_at: string;
}

// -- Response API standar --
export interface ApiResponse<T = null> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
