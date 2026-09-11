import OwnerSettings from "@/components/owner/OwnerSettings";
import { loadOwnerDashboardData } from "@/lib/owner-dashboard-data";

export const dynamic = "force-dynamic";

export default async function OwnerSettingsPage() {
  const { settings, overview } = await loadOwnerDashboardData();
  return <OwnerSettings initialCreatorGithubUrl={settings?.creator_github_url ?? ""} overview={overview} />;
}
