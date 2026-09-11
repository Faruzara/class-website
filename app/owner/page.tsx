import OwnerOverview from "@/components/owner/OwnerOverview";
import { loadOwnerDashboardData } from "@/lib/owner-dashboard-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OwnerPage() {
  const { logs, overview } = await loadOwnerDashboardData();

  return (
    <main className="min-w-0 [&_[id]]:scroll-mt-20 lg:[&_[id]]:scroll-mt-8">
      <OwnerOverview snapshot={overview} logs={logs} />
    </main>
  );
}
