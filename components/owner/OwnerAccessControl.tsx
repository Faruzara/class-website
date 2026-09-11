"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, KeyRound, Loader2, MoreHorizontal, Plus, ShieldCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { TEMP_PERMISSION_OPTIONS } from "@/lib/access-control";
import type { AccessSession, AdminSlot, TempKey, TempPermission } from "@/types";

interface Props {
  view: OwnerAccessView;
  slots: AdminSlot[];
  tempKeys: TempKey[];
  sessions: AccessSession[];
  sessionsAvailable: boolean;
}

export type OwnerAccessView = "slots" | "temporary" | "sessions";

type Secret = { kind: "admin" | "temporary"; label: string; value: string };
type ConfirmAction =
  | { kind: "slot"; id: number; label: string }
  | { kind: "temporary"; id: string; label: string }
  | { kind: "session"; id: string; label: string };

const DATE_FORMAT = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const ACCESS_COPY: Record<OwnerAccessView, { number: string; title: string; description: string }> = {
  slots: {
    number: "01",
    title: "Admin Slots",
    description: "Kelola tiga akses permanent Admin dan cabut slot tanpa bercampur dengan akses sementara.",
  },
  temporary: {
    number: "02",
    title: "Temporary Access",
    description: "Buat akses berdurasi dengan permission yang terpisah dari permanent Admin.",
  },
  sessions: {
    number: "03",
    title: "Sessions",
    description: "Pantau perangkat yang masih memiliki akses dan cabut sesi yang tidak dikenal.",
  },
};

function dateLabel(value?: string | null) {
  return value ? DATE_FORMAT.format(new Date(value)) : "-";
}

function relativeTime(value: string) {
  const delta = new Date(value).getTime() - Date.now();
  const absolute = Math.abs(delta);
  const amount = absolute < 3_600_000 ? Math.max(1, Math.round(absolute / 60_000)) : Math.max(1, Math.round(absolute / 3_600_000));
  const unit = absolute < 3_600_000 ? "menit" : "jam";
  return delta >= 0 ? `${amount} ${unit} lagi` : `${amount} ${unit} lalu`;
}

function slotStatus(slot: AdminSlot) {
  if (!slot.is_active) return { label: "EMPTY", tone: "text-gray-400" };
  if (!slot.last_login) return { label: "READY", tone: "text-brand-700" };
  return { label: "PERMANENT", tone: "text-emerald-700" };
}

function tempStatus(item: TempKey) {
  if (item.revoked_at) return "REVOKED";
  if (new Date(item.expires_at).getTime() <= Date.now()) return "EXPIRED";
  return item.is_used ? "ACTIVE" : "WAITING ACTIVATION";
}

export default function OwnerAccessControl({ view, slots, tempKeys, sessions, sessionsAvailable }: Props) {
  const router = useRouter();
  const [slotLabels, setSlotLabels] = useState<Record<number, string>>({});
  const [showTempForm, setShowTempForm] = useState(false);
  const [tempTab, setTempTab] = useState<"active" | "history">("active");
  const [tempLabel, setTempLabel] = useState("");
  const [duration, setDuration] = useState("60");
  const [customDuration, setCustomDuration] = useState(1);
  const [customUnit, setCustomUnit] = useState<"minutes" | "hours" | "days">("hours");
  const [permissions, setPermissions] = useState<TempPermission[]>(TEMP_PERMISSION_OPTIONS.map((item) => item.value));
  const [secret, setSecret] = useState<Secret | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [visibleSessions, setVisibleSessions] = useState(sessions);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setVisibleSessions(sessions), [sessions]);

  useEffect(() => {
    if (!confirmAction) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setConfirmAction(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
      previous?.focus();
    };
  }, [confirmAction]);

  const activeTemps = useMemo(() => tempKeys.filter((item) => ["ACTIVE", "WAITING ACTIVATION"].includes(tempStatus(item))), [tempKeys]);
  const shownTemps = tempTab === "active" ? activeTemps : tempKeys;
  const activeSlots = slots.filter((slot) => slot.is_active).length;
  const copy = ACCESS_COPY[view];

  async function request(path: string, init: RequestInit, busyId: string) {
    setBusy(busyId);
    setError("");
    try {
      const response = await fetch(path, init);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error ?? "Tindakan gagal diproses.");
      return result;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Tidak dapat terhubung ke server.");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function generateSlot(slot: AdminSlot) {
    const label = (slotLabels[slot.id] ?? "").trim();
    if (label.length < 2) return setError("Isi nama permanent Admin minimal 2 karakter.");
    const result = await request("/api/owner/slots/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slot_id: slot.id, label }),
    }, `slot-${slot.id}`);
    if (result) {
      setSecret({ kind: "admin", label: `Permanent Admin / Slot ${slot.id}`, value: result.data.key });
      router.refresh();
    }
  }

  async function generateTemporary() {
    if (tempLabel.trim().length < 3) return setError("Isi nama Temporary Access minimal 3 karakter.");
    if (!permissions.length) return setError("Pilih minimal satu permission.");
    const durationMinutes = duration === "custom"
      ? customDuration * (customUnit === "days" ? 1440 : customUnit === "hours" ? 60 : 1)
      : Number(duration);
    const result = await request("/api/owner/temp-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: tempLabel.trim(), duration_minutes: durationMinutes, permissions }),
    }, "temp-create");
    if (result) {
      setSecret({ kind: "temporary", label: tempLabel.trim(), value: result.data.key });
      setTempLabel("");
      setShowTempForm(false);
      router.refresh();
    }
  }

  async function confirmRevoke() {
    if (!confirmAction) return;
    const path = confirmAction.kind === "slot"
      ? "/api/owner/slots/revoke"
      : confirmAction.kind === "temporary"
        ? `/api/owner/temp-access/${confirmAction.id}`
        : `/api/owner/sessions/${confirmAction.id}`;
    const init: RequestInit = confirmAction.kind === "slot"
      ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slot_id: confirmAction.id }) }
      : { method: "DELETE" };
    const result = await request(path, init, `revoke-${confirmAction.kind}-${confirmAction.id}`);
    if (result) {
      if (confirmAction.kind === "slot") {
        setVisibleSessions((current) => current.filter((session) => session.role !== "admin" || session.slot_id !== confirmAction.id));
      } else if (confirmAction.kind === "temporary") {
        setVisibleSessions((current) => current.filter((session) => session.role !== "temp_admin" || session.temp_key_id !== confirmAction.id));
      } else {
        setVisibleSessions((current) => current.filter((session) => session.id !== confirmAction.id));
      }
      setConfirmAction(null);
      router.refresh();
    }
  }

  async function copySecret() {
    if (!secret) return;
    await navigator.clipboard.writeText(secret.value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function togglePermission(permission: TempPermission) {
    setPermissions((current) => current.includes(permission) ? current.filter((item) => item !== permission) : [...current, permission]);
  }

  return (
    <section aria-labelledby="access-heading" className="border-t border-surface-border pt-12">
      <header className="grid gap-6 border-b border-surface-border pb-8 md:grid-cols-[minmax(0,1fr)_minmax(18rem,32rem)] md:items-end">
        <div>
          <p className="font-mono text-[11px] uppercase text-brand-700">Access / {copy.number}</p>
          <h2 id="access-heading" className="mt-3 font-display text-3xl font-semibold text-gray-900">{copy.title}</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-gray-500">{copy.description}</p>
        </div>
        <div className="grid grid-cols-3 border-l border-surface-border">
          <Metric value={`${activeSlots}/${slots.length || 3}`} label="Permanent" />
          <Metric value={String(activeTemps.length).padStart(2, "0")} label="Temporary" />
          <Metric value={String(visibleSessions.length).padStart(2, "0")} label="Sessions" />
        </div>
      </header>

      {error ? <div role="alert" className="border-b border-brand-300 bg-brand-50 px-4 py-3 text-sm text-brand-800">{error}</div> : null}
      {secret ? (
        <div className="grid gap-4 border-b border-emerald-200 bg-emerald-50/60 px-4 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase text-emerald-700">One-time key / {secret.kind === "admin" ? "Permanent" : "Temporary"}</p>
            <p className="mt-2 text-sm font-medium text-gray-900">{secret.label}</p>
            <code className="mt-2 block break-all font-mono text-base text-gray-900">{secret.value}</code>
            <p className="mt-2 text-xs text-gray-500">Salin sekarang. Key tidak ditampilkan kembali setelah panel ini ditutup.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={copySecret} className="inline-flex min-h-11 items-center gap-2 border border-emerald-300 bg-white px-4 text-sm font-medium text-gray-800"><Copy size={15} />{copied ? "Tersalin" : "Salin"}</button>
            <button type="button" onClick={() => setSecret(null)} aria-label="Tutup key" title="Tutup key" className="flex h-11 w-11 items-center justify-center text-gray-500 hover:text-gray-900"><X size={18} /></button>
          </div>
        </div>
      ) : null}

      {view === "slots" ? <section id="owner-slots" className="py-12">
        <SectionHeading number="01" title="Admin Slots" note="Permanent sampai Owner mencabut akses" />
        <div className="mt-6 border-t border-surface-border">
          {slots.map((slot) => {
            const status = slotStatus(slot);
            const occupied = slot.is_active;
            return (
              <article key={slot.id} className="grid gap-4 border-b border-surface-border py-6 md:grid-cols-[3rem_minmax(9rem,1fr)_minmax(14rem,1.6fr)_auto] md:items-center">
                <span className="font-mono text-xs text-gray-400">{String(slot.id).padStart(2, "0")}</span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{occupied ? slot.label : "Available slot"}</p>
                  <p className={`mt-1 font-mono text-[10px] ${status.tone}`}>{status.label}</p>
                </div>
                {occupied ? (
                  <div className="text-xs leading-5 text-gray-500">
                    <p>{slot.last_login ? `Terakhir login ${dateLabel(slot.last_login)}` : "Belum pernah login"}</p>
                    <p>Role permanent / tanpa masa berlaku</p>
                  </div>
                ) : (
                  <label className="block text-[11px] text-gray-500">
                    Nama permanent Admin
                    <input value={slotLabels[slot.id] ?? ""} onChange={(event) => setSlotLabels((current) => ({ ...current, [slot.id]: event.target.value }))} maxLength={60} placeholder="Contoh: Ketua Admin" className="mt-2 min-h-11 w-full border border-surface-border bg-white px-3 text-sm outline-none focus:border-brand-500" />
                  </label>
                )}
                {occupied ? (
                  <button type="button" onClick={() => setConfirmAction({ kind: "slot", id: slot.id, label: slot.label })} aria-label={`Revoke ${slot.label}`} title="Revoke permanent Admin" className="flex h-11 w-11 items-center justify-center text-gray-400 hover:text-brand-700"><MoreHorizontal size={20} /></button>
                ) : (
                  <button type="button" disabled={Boolean(busy)} onClick={() => generateSlot(slot)} className="inline-flex min-h-11 items-center justify-center gap-2 bg-gray-900 px-4 text-sm font-medium text-white disabled:opacity-50">
                    {busy === `slot-${slot.id}` ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />} Generate permanent key
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </section> : null}

      {view === "temporary" ? <section id="owner-temp-keys" className="py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading number="02" title="Temporary Access" note="Terpisah dari permanent slots" />
          <button type="button" onClick={() => setShowTempForm((value) => !value)} className="inline-flex min-h-11 items-center gap-2 bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"><Plus size={16} />Create temporary access</button>
        </div>

        {showTempForm ? (
          <div className="mt-7 grid gap-7 border-y border-surface-border bg-white/50 py-7 lg:grid-cols-[minmax(15rem,0.8fr)_minmax(22rem,1.4fr)_auto] lg:items-end">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <label className="text-[11px] text-gray-500">Nama atau tujuan<input value={tempLabel} onChange={(event) => setTempLabel(event.target.value)} maxLength={60} placeholder="Contoh: Dokumentasi acara" className="mt-2 min-h-11 w-full border border-surface-border bg-white px-3 text-sm outline-none focus:border-brand-500" /></label>
              <div className="text-[11px] text-gray-500">Durasi<select aria-label="Durasi" value={duration} onChange={(event) => setDuration(event.target.value)} className="mt-2 min-h-11 w-full border border-surface-border bg-white px-3 text-sm outline-none focus:border-brand-500"><option value="30">30 menit</option><option value="60">1 jam</option><option value="180">3 jam</option><option value="360">6 jam</option><option value="1440">24 jam</option><option value="10080">7 hari</option><option value="43200">30 hari</option><option value="custom">Custom</option></select>{duration === "custom" ? <div className="mt-2 grid grid-cols-2 gap-2"><input aria-label="Jumlah durasi" type="number" min="1" max={customUnit === "days" ? 30 : customUnit === "hours" ? 720 : 43200} value={customDuration} onChange={(event) => setCustomDuration(Number(event.target.value))} className="min-h-11 border border-surface-border bg-white px-3 text-sm text-gray-900 outline-none focus:border-brand-500" /><select aria-label="Satuan durasi" value={customUnit} onChange={(event) => setCustomUnit(event.target.value as typeof customUnit)} className="min-h-11 border border-surface-border bg-white px-3 text-sm text-gray-900 outline-none focus:border-brand-500"><option value="minutes">Menit</option><option value="hours">Jam</option><option value="days">Hari</option></select></div> : null}</div>
            </div>
            <fieldset>
              <legend className="text-[11px] text-gray-500">Feature permissions</legend>
              <div className="mt-2 grid border-l border-t border-surface-border sm:grid-cols-2">
                {TEMP_PERMISSION_OPTIONS.map((item) => {
                  const checked = permissions.includes(item.value);
                  return <label key={item.value} className="flex min-h-14 cursor-pointer items-start gap-3 border-b border-r border-surface-border bg-white px-3 py-3 text-sm"><input type="checkbox" checked={checked} onChange={() => togglePermission(item.value)} className="mt-0.5 h-4 w-4 accent-brand-600" /><span><span className="block font-medium text-gray-800">{item.label}</span><span className="mt-0.5 block text-[10px] leading-4 text-gray-400">{item.description}</span></span></label>;
                })}
              </div>
            </fieldset>
            <button type="button" onClick={generateTemporary} disabled={Boolean(busy)} className="inline-flex min-h-11 items-center justify-center gap-2 bg-gray-900 px-4 text-sm font-medium text-white disabled:opacity-50">{busy === "temp-create" ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}Generate TMP key</button>
          </div>
        ) : null}

        <div className="mt-8 flex gap-6 border-b border-surface-border" role="tablist" aria-label="Temporary access list">
          {(["active", "history"] as const).map((tab) => <button key={tab} type="button" role="tab" aria-selected={tempTab === tab} onClick={() => setTempTab(tab)} className={`relative min-h-11 pb-3 text-sm capitalize ${tempTab === tab ? "font-semibold text-gray-900 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-brand-500" : "text-gray-500"}`}>{tab}</button>)}
        </div>
        {shownTemps.length ? <div>{shownTemps.map((item) => <TempRow key={item.id} item={item} onRevoke={() => setConfirmAction({ kind: "temporary", id: item.id, label: item.label })} />)}</div> : <EmptyLine text={tempTab === "active" ? "Belum ada Temporary Access aktif." : "Riwayat Temporary Access masih kosong."} />}
      </section> : null}

      {view === "sessions" ? <section id="owner-sessions" className="py-12">
        <SectionHeading number="03" title="Sessions" note="Perangkat yang masih mempunyai akses" />
        {!sessionsAvailable ? <EmptyLine text="Session registry belum tersedia. Jalankan migration Access Control di Supabase." accent /> : visibleSessions.length ? <div className="mt-6 border-t border-surface-border">{visibleSessions.map((session) => <SessionRow key={session.id} session={session} onRevoke={() => setConfirmAction({ kind: "session", id: session.id, label: session.label })} />)}</div> : <EmptyLine text="Belum ada sesi yang tercatat. Sesi baru akan muncul setelah login berikutnya." />}
      </section> : null}

      {confirmAction ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-4" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setConfirmAction(null); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="revoke-title" className="w-full max-w-md border border-surface-border bg-surface-base p-6 shadow-2xl">
            <p className="font-mono text-[10px] uppercase text-brand-700">Confirm revoke</p>
            <h3 id="revoke-title" className="mt-3 font-display text-2xl font-semibold text-gray-900">Cabut akses {confirmAction.label}?</h3>
            <p className="mt-3 text-sm leading-6 text-gray-500">{confirmAction.kind === "slot" ? "Permanent Admin ini dan seluruh sesinya akan langsung kehilangan akses. Slot kembali kosong." : "Sesi yang sedang digunakan akan berhenti dan tidak dapat dipulihkan."}</p>
            <div className="mt-7 flex justify-end gap-3"><button ref={cancelRef} type="button" onClick={() => setConfirmAction(null)} className="min-h-11 px-4 text-sm text-gray-600">Batal</button><button type="button" onClick={confirmRevoke} disabled={Boolean(busy)} className="inline-flex min-h-11 items-center gap-2 bg-brand-700 px-4 text-sm font-semibold text-white disabled:opacity-50">{busy?.startsWith("revoke-") ? <Loader2 size={15} className="animate-spin" /> : null}Revoke access</button></div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return <div className="border-r border-surface-border px-3 py-3 last:border-r-0"><p className="font-display text-2xl font-semibold text-gray-900 sm:text-3xl">{value}</p><p className="mt-2 font-mono text-[9px] uppercase text-gray-400">{label}</p></div>;
}

function SectionHeading({ number, title, note }: { number: string; title: string; note: string }) {
  return <div><p className="font-mono text-[10px] text-brand-700">{number}</p><h3 className="mt-2 font-display text-xl font-semibold text-gray-900">{title}</h3><p className="mt-1 text-xs text-gray-500">{note}</p></div>;
}

function EmptyLine({ text, accent = false }: { text: string; accent?: boolean }) {
  return <p className={`mt-6 border-y border-surface-border py-5 text-sm ${accent ? "border-l-2 border-l-brand-500 pl-4 text-brand-800" : "text-gray-500"}`}>{text}</p>;
}

function TempRow({ item, onRevoke }: { item: TempKey; onRevoke: () => void }) {
  const status = tempStatus(item);
  const active = status === "ACTIVE" || status === "WAITING ACTIVATION";
  return <article className="grid gap-3 border-b border-surface-border py-5 md:grid-cols-[minmax(10rem,1fr)_minmax(13rem,1.4fr)_minmax(9rem,0.8fr)_auto] md:items-center"><div><p className="text-sm font-semibold text-gray-900">{item.label}</p><p className={`mt-1 font-mono text-[10px] ${active ? "text-brand-700" : "text-gray-400"}`}>{status}</p></div><div className="flex flex-wrap gap-x-3 gap-y-1">{(item.permissions ?? []).map((permission) => <span key={permission} className="text-[10px] capitalize text-gray-500">{permission}</span>)}</div><div className="text-xs leading-5 text-gray-500"><p>{active ? relativeTime(item.expires_at) : dateLabel(item.expires_at)}</p><p>{item.created_by_role === "owner" ? "Created by Owner" : `Created by Slot ${item.created_by_slot ?? "-"}`}</p></div>{active ? <button type="button" onClick={onRevoke} aria-label={`Revoke ${item.label}`} title="Revoke temporary access" className="flex h-11 w-11 items-center justify-center text-gray-400 hover:text-brand-700"><MoreHorizontal size={20} /></button> : <span className="h-11 w-11" />}</article>;
}

function SessionRow({ session, onRevoke }: { session: AccessSession; onRevoke: () => void }) {
  return <article className="grid gap-3 border-b border-surface-border py-5 md:grid-cols-[8rem_minmax(10rem,1fr)_minmax(10rem,1fr)_minmax(8rem,0.8fr)_auto] md:items-center"><p className="font-mono text-[10px] uppercase text-brand-700">{session.role.replace("_", " ")}</p><div><p className="text-sm font-semibold text-gray-900">{session.label}</p>{session.is_current ? <p className="mt-1 text-[10px] text-emerald-700">CURRENT SESSION</p> : null}</div><p className="text-xs text-gray-500">{session.device_label}</p><div className="text-xs leading-5 text-gray-500"><p>{relativeTime(session.last_seen_at)}</p><p>{session.expires_at ? `Ends ${dateLabel(session.expires_at)}` : "No expiry"}</p></div>{session.is_current ? <ShieldCheck size={17} className="mx-3 text-emerald-600" aria-label="Current session" /> : <button type="button" onClick={onRevoke} aria-label={`Revoke session ${session.label}`} title="Revoke session" className="flex h-11 w-11 items-center justify-center text-gray-400 hover:text-brand-700"><X size={17} /></button>}</article>;
}
