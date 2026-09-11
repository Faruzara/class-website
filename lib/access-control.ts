import type { AdminSession, TempPermission } from "@/types";

export const TEMP_PERMISSION_OPTIONS: ReadonlyArray<{
  value: TempPermission;
  label: string;
  description: string;
}> = [
  { value: "homepage", label: "Homepage", description: "Foto utama, informasi utama, dan pengumuman." },
  { value: "schedule", label: "Schedule", description: "Jadwal dan pembagian periode." },
  { value: "members", label: "Members", description: "Data, foto, dan visibilitas anggota." },
  { value: "gallery", label: "Gallery", description: "Unggah, atur fokus, dan hapus galeri." },
  { value: "moments", label: "Moments", description: "Mengambil dan menerbitkan Moment." },
];

export const ALL_TEMP_PERMISSIONS = TEMP_PERMISSION_OPTIONS.map((item) => item.value);

export function normalizeTempPermissions(value: unknown): TempPermission[] {
  if (!Array.isArray(value)) return [...ALL_TEMP_PERMISSIONS];
  const allowed = new Set<TempPermission>(ALL_TEMP_PERMISSIONS);
  return Array.from(new Set(value.filter((item): item is TempPermission => typeof item === "string" && allowed.has(item as TempPermission))));
}

export function canUseEditorFeature(session: AdminSession | null, permission: TempPermission): boolean {
  if (!session) return false;
  if (session.role === "owner" || session.role === "admin") return true;
  // Legacy temp sessions did not carry permissions. Keep them usable until
  // expiry; all newly issued temp sessions include an explicit permission set.
  if (!session.permissions) return true;
  return session.permissions.includes(permission);
}

export function canUploadToFolder(session: AdminSession | null, folder: string): boolean {
  const permissionByFolder: Record<string, TempPermission> = {
    hero: "homepage",
    social: "homepage",
    anggota: "members",
    galeri: "gallery",
  };
  return canUseEditorFeature(session, permissionByFolder[folder] ?? "gallery");
}

export function describeDevice(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";
  const formFactor = /ipad|tablet/i.test(userAgent)
    ? "Tablet"
    : /android|iphone|ipod|mobile/i.test(userAgent)
      ? "Mobile"
      : "Desktop";
  const os = /android/i.test(userAgent)
    ? "Android"
    : /iphone|ipad|ipod/i.test(userAgent)
      ? "iOS"
      : /windows/i.test(userAgent)
        ? "Windows"
        : /mac os|macintosh/i.test(userAgent)
          ? "macOS"
          : /linux/i.test(userAgent)
            ? "Linux"
            : "Other";
  const browser = /edg\//i.test(userAgent)
    ? "Edge"
    : /firefox\//i.test(userAgent)
      ? "Firefox"
      : /chrome\//i.test(userAgent)
        ? "Chrome"
        : /safari\//i.test(userAgent)
          ? "Safari"
          : "Browser";
  return `${formFactor} · ${os} / ${browser}`;
}
