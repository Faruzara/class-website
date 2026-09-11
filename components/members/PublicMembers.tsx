"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { createClient } from "@supabase/supabase-js";
import { User } from "lucide-react";
import type { Anggota } from "@/types";

export default function PublicMembers() {
  const [members, setMembers] = useState<Anggota[]>([]);
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    const controller = new AbortController(); const timer = window.setTimeout(() => controller.abort(), 5000);
    Promise.resolve(createClient(url, key).from("anggota").select("*").eq("is_visible", true).order("nomor_absen").abortSignal(controller.signal))
      .then(({ data }) => setMembers((data ?? []) as Anggota[])).catch(() => undefined).finally(() => window.clearTimeout(timer));
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, []);

  const pengurus = members.filter((member) => member.jabatan);
  const siswa = members.filter((member) => !member.jabatan);
  if (members.length === 0) return <p className="border-l-2 border-brand-500 py-1 pl-4 text-sm text-gray-500">Data anggota belum tersedia.</p>;

  return <div className="space-y-20">{pengurus.length > 0 && <MemberSection title="Pengurus kelas" members={pengurus} />}<MemberSection title="Daftar siswa" members={siswa} /></div>;
}

function MemberSection({ title, members }: { title: string; members: Anggota[] }) {
  if (members.length === 0) return null;
  return <section><h2 className="mb-7 border-b border-surface-border pb-4 font-display text-xl font-semibold text-gray-900">{title}</h2><div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{members.map((member) => <article key={member.id}><div className="relative mb-4 aspect-[4/5] overflow-hidden rounded-md bg-surface-muted">{member.foto_url ? <Image src={member.foto_url} alt={member.nama} fill sizes="(max-width:640px) 50vw, 20vw" className="object-cover object-center" /> : <div className="flex h-full items-center justify-center text-gray-400"><User size={32} strokeWidth={1.4} /></div>}{member.jabatan && <><div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/60 to-transparent" /><p className="absolute inset-x-3 bottom-3 flex items-center gap-2.5 font-serif text-sm text-white sm:inset-x-4 sm:bottom-4"><span aria-hidden="true" className="h-6 w-[3px] shrink-0 rounded-full bg-brand-500 shadow-[0_0_12px_rgba(225,111,97,0.32)]" /><span className="line-clamp-2 leading-snug">{member.jabatan}</span></p></>}</div><h3 className="text-sm font-semibold text-gray-900">{member.nama}</h3></article>)}</div></section>;
}
