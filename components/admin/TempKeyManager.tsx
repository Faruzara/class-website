"use client";

import { useRef, useState } from "react";
import { Key, Copy, Check, Trash2, Plus, Loader2, AlertCircle } from "lucide-react";
import type { TempKey, TempPermission } from "@/types";
import { TEMP_PERMISSION_OPTIONS } from "@/lib/access-control";

interface Props {
  slotId: number;
  slotLabel: string;
  activeTempKeys: TempKey[];
}

export default function TempKeyManager({ slotId, slotLabel, activeTempKeys: initialKeys }: Props) {
  const [tempKeys, setTempKeys]   = useState(initialKeys);
  const [label, setLabel]         = useState("");
  const [durationPreset, setDurationPreset] = useState("60");
  const [customValue, setCustomValue] = useState(60);
  const [customUnit, setCustomUnit] = useState<"minutes" | "hours" | "days">("minutes");
  const [newKey, setNewKey]       = useState<string | null>(null);
  const [copied, setCopied]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<TempPermission[]>(TEMP_PERMISSION_OPTIONS.map((item) => item.value));
  const generatingRef = useRef(false);

  // Hitung sisa waktu
  function sisaWaktu(expiresAt: string) {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return "Expired";
    const menit = Math.floor(diff / 60000);
    return `${menit} menit lagi`;
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (generatingRef.current) return;
    setError(null);
    setNewKey(null);

    if (!label.trim()) {
      setError("Isi dulu nama/tujuan temp key ini.");
      return;
    }

    generatingRef.current = true;
    setIsPending(true);
    try {
      const res = await fetch("/api/admin/temp-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim(), duration_minutes: durationPreset === "custom" ? customValue * (customUnit === "days" ? 1440 : customUnit === "hours" ? 60 : 1) : Number(durationPreset), permissions }),
      });
      const data = await res.json();

      if (data.success) {
        setNewKey(data.data.key);
        setLabel("");
        // Refresh list
        const listRes = await fetch("/api/admin/temp-key");
        const listData = await listRes.json();
        if (listData.success) setTempKeys(listData.data);
      } else {
        setError(data.error ?? "Gagal generate key.");
      }
    } catch {
      setError("Gagal terhubung ke server.");
    } finally {
      generatingRef.current = false;
      setIsPending(false);
    }
  }

  async function handleRevoke(id: string) {
    if (revokingId) return;
    setError(null);
    setRevokingId(id);
    try {
      const res = await fetch(`/api/admin/temp-key/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setTempKeys((prev) => prev.filter((k) => k.id !== id));
      } else {
        setError(data.error ?? "Gagal revoke temp key.");
      }
    } catch {
      setError("Gagal terhubung ke server.");
    } finally {
      setRevokingId(null);
    }
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Form generate */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Plus size={16} /> Generate Temp Key Baru
        </h2>

        <form onSubmit={handleGenerate} className="flex flex-col gap-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1.5">
              Untuk siapa / tujuan? <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Misal: Raka - gantiin posting jadwal"
              className="input"
              maxLength={60}
              disabled={isPending}
            />
            <p className="text-xs text-gray-600 mt-1">
              Label ini akan muncul di activity log. Tanggung jawab kamu ya!
            </p>
          </div>

          <fieldset>
            <legend className="mb-2 block text-sm text-gray-600">Permission</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {TEMP_PERMISSION_OPTIONS.map((item) => <label key={item.value} className="flex items-start gap-2 border border-surface-border bg-white p-3 text-sm"><input type="checkbox" className="mt-0.5 accent-brand-500" checked={permissions.includes(item.value)} onChange={() => setPermissions((current) => current.includes(item.value) ? current.filter((permission) => permission !== item.value) : [...current, item.value])} /><span><span className="block font-medium text-gray-800">{item.label}</span><span className="mt-0.5 block text-xs text-gray-500">{item.description}</span></span></label>)}
            </div>
          </fieldset>

          <div>
            <label className="block text-sm text-gray-600 mb-1.5">Durasi akses</label>
            <select className="input" value={durationPreset} onChange={(e) => setDurationPreset(e.target.value)} disabled={isPending}>
              <option value="15">15 menit</option><option value="30">30 menit</option><option value="60">1 jam</option><option value="120">2 jam</option><option value="180">3 jam</option><option value="360">6 jam</option><option value="720">12 jam</option><option value="1440">1 hari</option><option value="custom">Custom</option>
            </select>
            {durationPreset === "custom" && <div className="grid grid-cols-2 gap-2 mt-2"><input type="number" min="1" className="input" value={customValue} onChange={(e) => setCustomValue(Number(e.target.value))} disabled={isPending} /><select className="input" value={customUnit} onChange={(e) => setCustomUnit(e.target.value as typeof customUnit)} disabled={isPending}><option value="minutes">Minutes</option><option value="hours">Hours</option><option value="days">Days</option></select></div>}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-rose-400 text-sm bg-rose-500/10 border border-rose-500/30 px-3 py-2.5 rounded-xl">
              <AlertCircle size={15} /> {error}
            </div>
          )}

          <button type="submit" className="btn-primary flex items-center gap-2 self-start" disabled={isPending}>
            {isPending ? <Loader2 size={16} className="animate-spin" /> : <Key size={16} />}
            Generate Temp Key
          </button>
        </form>

        {/* Tampilkan key yang baru digenerate */}
        {newKey && (
          <div className="mt-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
            <p className="text-sm text-emerald-400 font-medium mb-2">
              ✅ Key berhasil dibuat! Kirim ke orangnya via WA:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-lg text-gray-900 bg-surface-base px-4 py-2 rounded-lg tracking-wider">
                {newKey}
              </code>
              <button
                onClick={() => copyKey(newKey)}
                className="p-2 rounded-lg bg-surface-muted hover:bg-surface-border transition-colors"
              >
                {copied ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} className="text-gray-600" />}
              </button>
            </div>
            <p className="text-xs text-emerald-600 mt-2">
              ⚠️ Key ini hanya ditampilkan sekali. Langsung kirim ke orangnya!
            </p>
          </div>
        )}
      </div>

      {/* Daftar temp key aktif */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Key size={16} /> Temp Key Aktif ({tempKeys.length})
        </h2>

        {tempKeys.length === 0 ? (
          <p className="text-gray-500 text-sm">Belum ada temp key aktif.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {tempKeys.map((tk) => (
              <div
                key={tk.id}
                className="flex items-center justify-between gap-3 px-4 py-3 bg-surface-muted rounded-xl"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{tk.label}</p>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">
                    Dibuat oleh Slot {tk.created_by_slot} · {tk.is_used ? "Sedang aktif" : "Belum dipakai"} · {sisaWaktu(tk.expires_at)}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">{(tk.permissions ?? []).join(" / ")}</p>
                </div>
                <button
                  onClick={() => handleRevoke(tk.id)}
                  disabled={Boolean(revokingId)}
                  className="p-2 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  title="Revoke key ini"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
