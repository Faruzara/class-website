"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Loader2, Lock, LockOpen, Plus, Save, Trash2, User } from "lucide-react";
import MediaUpload from "./MediaUpload";
import type { Anggota } from "@/types";
import { canonicalMemberRole, MEMBER_ROLE_SLOTS } from "@/lib/member-roles";

const ROLES = ["", ...MEMBER_ROLE_SLOTS];

export default function MembersEditor({ initialMembers, ownerMode = false }: { initialMembers: Anggota[]; ownerMode?: boolean }) {
  const [members, setMembers] = useState(initialMembers);
  const [savedMembers, setSavedMembers] = useState(initialMembers);
  const [form, setForm] = useState({ nama: "", jabatan: "", foto_url: "", is_visible: true });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function refresh() {
    const response = await fetch("/api/admin/anggota");
    const result = await response.json();
    if (result.success) {
      setMembers(result.data);
      setSavedMembers(result.data);
    }
  }

  function add(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/admin/anggota", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const result = await response.json();
      if (!result.success) return setError(result.error ?? "Gagal menambah anggota");
      setForm({ nama: "", jabatan: "", foto_url: "", is_visible: true });
      await refresh();
    });
  }

  function updateLocal(id: string, patch: Partial<Anggota>) {
    setMembers((current) => current.map((member) => member.id === id ? { ...member, ...patch } : member));
  }

  function roleIsOccupied(role: string, exceptId?: string) {
    const canonicalRole = canonicalMemberRole(role);
    if (!canonicalRole) return false;
    return members.some((member) => member.id !== exceptId && canonicalMemberRole(member.jabatan) === canonicalRole);
  }

  async function replaceMemberImage(member: Anggota, url: string) {
    const updatedMember: Anggota = {
      ...member,
      foto_url: url,
      object_fit: "cover",
      object_position_x: 50,
      object_position_y: 50,
    };
    updateLocal(member.id, updatedMember);
    try {
      const response = await fetch(`/api/admin/anggota/${member.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updatedMember) });
      const result = await response.json();
      if (!result.success) setError(result.error ?? "Gagal menyimpan foto anggota");
      else setSavedMembers((current) => current.map((item) => item.id === member.id ? updatedMember : item));
    } catch {
      setError("Gagal menyimpan foto anggota");
    }
  }

  function save(member: Anggota) {
    if (savingId) return;
    setSavingId(member.id);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/anggota/${member.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(member) });
        const result = await response.json();
        if (!result.success) setError(result.error ?? "Gagal menyimpan anggota");
        else setSavedMembers((current) => current.map((item) => item.id === member.id ? member : item));
      } catch {
        setError("Gagal terhubung ke server");
      } finally {
        setSavingId(null);
      }
    });
  }

  function remove(id: string) {
    if (!window.confirm("Hapus anggota ini?")) return;
    startTransition(async () => {
      const response = await fetch(`/api/admin/anggota/${id}`, { method: "DELETE" });
      const result = await response.json();
      if (result.success) setMembers((current) => current.filter((member) => member.id !== id));
    });
  }

  function togglePhotoLock(member: Anggota) {
    if (!ownerMode || savingId) return;
    const updatedMember = { ...member, foto_locked: !member.foto_locked };
    setSavingId(member.id);
    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/anggota/${member.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updatedMember) });
        const result = await response.json();
        if (!result.success) return setError(result.error ?? "Gagal mengubah kunci foto");
        updateLocal(member.id, { foto_locked: updatedMember.foto_locked });
        setSavedMembers((current) => current.map((item) => item.id === member.id ? updatedMember : item));
      } catch {
        setError("Gagal terhubung ke server");
      } finally {
        setSavingId(null);
      }
    });
  }

  return (
    <div className="space-y-6">
      <form className="card grid gap-4 sm:grid-cols-2" onSubmit={add}>
        <div>
          <label className="mb-1.5 block text-sm text-gray-600">Nama</label>
          <input className="input" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} required />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-gray-600">Jabatan opsional</label>
          <select className="input" value={form.jabatan} onChange={(e) => setForm({ ...form, jabatan: e.target.value })}>
            {ROLES.map((role) => <option key={role} value={role} disabled={Boolean(role && roleIsOccupied(role))}>{role || "Siswa"}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-4">
          <MediaUpload
            folder="anggota"
            onUploaded={(url) => setForm({ ...form, foto_url: url })}
            replaceUrl={form.foto_url}
            label={form.foto_url ? "Ganti foto" : "Upload foto"}
            cropAspect={form.jabatan ? 4 / 5 : 1}
            cropTitle={form.jabatan ? "Atur foto Struktur Kelas" : "Atur foto Anggota"}
          />
          {form.foto_url && <span className="text-xs text-emerald-700">Foto siap digunakan</span>}
        </div>
        {error && <p className="text-sm text-rose-600 sm:col-span-2">{error}</p>}
        <button className="btn-primary inline-flex items-center justify-center gap-2 sm:col-span-2 sm:justify-self-start" disabled={pending}>
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Tambah Anggota
        </button>
      </form>

      <section className="space-y-3">
        <div className="flex items-center justify-between"><h2 className="font-semibold text-gray-900">Daftar anggota</h2><span className="text-sm text-gray-500">{members.length} orang</span></div>
        {members.map((member) => (
          <article key={member.id} className="card grid gap-4 p-4 sm:grid-cols-[64px_1fr_auto] sm:items-center">
            <div className="relative h-16 w-16 overflow-hidden rounded-full bg-surface-muted">
              {member.foto_url ? <Image src={member.foto_url} alt={member.nama} fill sizes="64px" className="object-cover" /> : <div className="flex h-full items-center justify-center text-gray-400"><User size={24} /></div>}
              {member.foto_locked && <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-white" title="Dikunci Owner"><Lock size={17} /></span>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input className="input py-2 text-sm" value={member.nama} onChange={(e) => updateLocal(member.id, { nama: e.target.value })} />
              <select className="input py-2 text-sm" value={canonicalMemberRole(member.jabatan) ?? ""} onChange={(e) => updateLocal(member.id, { jabatan: e.target.value || null })}>
                {ROLES.map((role) => <option key={role} value={role} disabled={Boolean(role && roleIsOccupied(role, member.id))}>{role || "Siswa"}</option>)}
              </select>
              <label className="flex items-center gap-2 text-xs text-gray-600 sm:col-span-2"><input type="checkbox" checked={member.is_visible} onChange={(e) => updateLocal(member.id, { is_visible: e.target.checked })} /> Tampilkan di publik</label>
              <div className="sm:col-span-2">
                <MediaUpload
                  folder="anggota"
                  onUploaded={(url) => replaceMemberImage(member, url)}
                  replaceUrl={member.foto_url}
                  label="Ganti foto"
                  disabled={!ownerMode && member.foto_locked}
                  protectedAsset={{ kind: "member", id: member.id }}
                  cropAspect={member.jabatan ? 4 / 5 : 1}
                  cropTitle={member.jabatan ? "Atur foto Struktur Kelas" : "Atur foto Anggota"}
                />
                {!ownerMode && member.foto_locked && <p className="mt-1 text-xs text-gray-500">Foto dikunci Owner. Data teks tetap dapat diedit.</p>}
              </div>
            </div>
            <div className="flex gap-1 sm:flex-col">
              {ownerMode && <button type="button" onClick={() => togglePhotoLock(member)} disabled={pending || savingId === member.id} className={`p-2 ${member.foto_locked ? "text-brand-700" : "text-gray-500 hover:text-brand-700"} disabled:opacity-40`} aria-label={`${member.foto_locked ? "Buka kunci" : "Kunci"} foto ${member.nama}`}>{member.foto_locked ? <LockOpen size={17} /> : <Lock size={17} />}</button>}
              <button type="button" onClick={() => save(member)} disabled={pending || savingId === member.id || JSON.stringify(member) === JSON.stringify(savedMembers.find((item) => item.id === member.id))} className="p-2 text-gray-500 hover:text-brand-700 disabled:opacity-40" aria-label={`Simpan ${member.nama}`}><Save size={17} /></button>
              <button type="button" onClick={() => remove(member.id)} disabled={!ownerMode && member.foto_locked} className="p-2 text-gray-500 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40" aria-label={`Hapus ${member.nama}`} title={!ownerMode && member.foto_locked ? "Dikunci Owner" : undefined}><Trash2 size={17} /></button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
