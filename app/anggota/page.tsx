import PublicLayout from "@/components/layout/PublicLayout";
import PublicMembers from "@/components/members/PublicMembers";

export default function AnggotaPage() {
  return <PublicLayout><main className="mx-auto max-w-7xl px-5 py-14 md:py-20 lg:px-8"><header className="mb-14 max-w-2xl"><p className="section-kicker mb-3">XI TP2</p><h1 className="font-display text-4xl font-semibold tracking-tight text-gray-900 md:text-5xl">Anggota Kelas</h1></header><PublicMembers /></main></PublicLayout>;
}
