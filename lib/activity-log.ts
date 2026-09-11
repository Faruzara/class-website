import type { Role } from "@/types";

export type ActivityCategory = "access" | "content" | "moments" | "feedback" | "system";

const ACTION_LABELS: Record<string, string> = {
  login: "Masuk ke control panel",
  logout: "Keluar dari control panel",
  owner_login_success: "Owner berhasil masuk",
  owner_login_failed: "Percobaan login Owner gagal",
  admin_login_success: "Admin berhasil masuk",
  admin_login_failed: "Percobaan login Admin gagal",
  activate_temp_key: "Mengaktifkan temporary access",
  revoke_admin_key: "Mencabut akses Admin",
  generate_admin_key: "Membuat akses Admin",
  generate_temp_key: "Membuat temporary access",
  revoke_temp_key: "Mencabut temporary access",
  revoke_temp_access: "Mencabut temporary access",
  revoke_access_session: "Mencabut sesi perangkat",
  upload_media: "Mengunggah media",
  hero_or_homepage_changed: "Memperbarui Homepage",
  hero_image_lock_changed: "Mengubah kunci foto utama",
  gallery_image_lock_changed: "Mengubah kunci foto Gallery",
  member_image_lock_changed: "Mengubah kunci foto anggota",
  social_image_lock_changed: "Mengubah kunci foto sosial",
  social_link_changed: "Memperbarui tautan publik",
  creator_profile_changed: "Memperbarui profil creator",
  post_pengumuman: "Menerbitkan pengumuman",
  edit_pengumuman: "Mengubah pengumuman",
  hapus_pengumuman: "Menghapus pengumuman",
  system_announcement_created: "Menerbitkan pengumuman sistem",
  system_announcement_updated: "Mengubah pengumuman sistem",
  system_announcement_deleted: "Menghapus pengumuman sistem",
  gallery_upload: "Menambahkan foto Gallery",
  gallery_delete: "Menghapus foto Gallery",
  member_added: "Menambahkan anggota",
  member_edited: "Memperbarui anggota",
  member_deleted: "Menghapus anggota",
  schedule_changed: "Memperbarui Schedule",
  moment_published: "Menerbitkan Moment",
  moment_deleted: "Menghapus Moment",
  feedback_status_changed: "Memperbarui status feedback",
};

export const ACTIVITY_CATEGORY_LABELS: Record<ActivityCategory, string> = {
  access: "Access",
  content: "Content",
  moments: "Moments",
  feedback: "Feedback",
  system: "System",
};

export const ACTIVITY_ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  temp_admin: "Temporary",
};

export function activityActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replaceAll("_", " ");
}

export function activityCategory(action: string): ActivityCategory {
  if (/login|logout|key|access|session/.test(action)) return "access";
  if (/moment/.test(action)) return "moments";
  if (/feedback/.test(action)) return "feedback";
  if (/system|creator/.test(action)) return "system";
  return "content";
}
