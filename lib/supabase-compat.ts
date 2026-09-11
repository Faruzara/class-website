export function isMissingSupabaseColumn(error: unknown, column: string): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: unknown; message?: unknown };
  const code = String(record.code ?? "");
  const message = String(record.message ?? "");
  return (code === "PGRST204" || code === "42703") && message.includes(column);
}

export function isMissingSupabaseRelation(error: unknown, relation: string): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: unknown; message?: unknown };
  const code = String(record.code ?? "");
  const message = String(record.message ?? "");
  return ["42P01", "PGRST200", "PGRST205"].includes(code) && message.includes(relation);
}
