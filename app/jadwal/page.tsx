import PublicLayout from "@/components/layout/PublicLayout";
import PublicSchedule from "@/components/schedule/PublicSchedule";
import { getJadwal, getSiteSettings } from "@/lib/db";
import { getActiveScheduleWeek } from "@/lib/schedule-week";

export const dynamic = "force-dynamic";

export default async function JadwalPage() {
  const [items, settings] = await Promise.all([
    getJadwal().catch(() => []),
    getSiteSettings().catch(() => null),
  ]);
  const activeWeek = getActiveScheduleWeek(settings?.schedule_week_offset);

  return (
    <PublicLayout>
      <main className="mx-auto max-w-7xl px-5 py-14 md:py-20 lg:px-8">
        <header className="mb-10 max-w-2xl">
          <p className="section-kicker mb-3">XI TP2</p>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-gray-900 md:text-5xl">Jadwal Pelajaran</h1>
          <p className="mt-4 text-gray-600">Jadwal bergantian antara Week 1 dan Week 2.</p>
        </header>
        <PublicSchedule initialItems={items} initialActiveWeek={activeWeek} />
      </main>
    </PublicLayout>
  );
}
