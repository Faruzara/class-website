type SlotState = {
  key_hash?: string | null;
  last_login?: string | null;
  assigned_at?: string | null;
  expires_at?: string | null;
  activation_expires_at?: string | null;
};

export function isAdminSlotActive(slot: SlotState | null | undefined): boolean {
  return Boolean(slot?.key_hash);
}
