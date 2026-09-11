export const MEMBER_ROLE_SLOTS = [
  "Ketua Kelas",
  "Wakil Ketua",
  "Sekretaris 1",
  "Sekretaris 2",
  "Bendahara 1",
  "Bendahara 2",
  "Keamanan",
  "Kebersihan",
] as const;

export type MemberRoleSlot = (typeof MEMBER_ROLE_SLOTS)[number];

function normalizeRole(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ");
}

export function canonicalMemberRole(value: string | null | undefined): MemberRoleSlot | null {
  const role = normalizeRole(value);
  if (!role) return null;
  if (role.includes("wakil") && role.includes("ketua")) return "Wakil Ketua";
  if (role.includes("ketua")) return "Ketua Kelas";
  if (role.includes("sekretaris")) {
    if (/\b(2|ii|dua)\b/.test(role)) return "Sekretaris 2";
    return "Sekretaris 1";
  }
  if (role.includes("bendahara")) {
    if (/\b(2|ii|dua)\b/.test(role)) return "Bendahara 2";
    return "Bendahara 1";
  }
  if (role.includes("keamanan")) return "Keamanan";
  if (role.includes("kebersihan")) return "Kebersihan";
  return null;
}

export function orderClassStructure<T extends { id: string; jabatan: string | null }>(members: T[]) {
  const used = new Set<string>();
  return MEMBER_ROLE_SLOTS.flatMap((role) => {
    const exactRole = normalizeRole(role);
    const exact = members.find((member) => !used.has(member.id) && normalizeRole(member.jabatan) === exactRole);
    const alias = exact ?? members.find((member) => {
      if (used.has(member.id)) return false;
      const current = normalizeRole(member.jabatan);
      if (current === "sekretaris" || current === "bendahara") return false;
      return canonicalMemberRole(member.jabatan) === role;
    });
    const legacy = alias ?? (
      role.startsWith("Sekretaris")
        ? members.find((member) => !used.has(member.id) && normalizeRole(member.jabatan) === "sekretaris")
        : role.startsWith("Bendahara")
          ? members.find((member) => !used.has(member.id) && normalizeRole(member.jabatan) === "bendahara")
          : undefined
    );
    if (!legacy) return [];
    used.add(legacy.id);
    return [{ role, member: legacy }];
  });
}
