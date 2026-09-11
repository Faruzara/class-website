import OwnerActivityLog from "@/components/owner/OwnerActivityLog";
import { getActivityLogs } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function OwnerActivityPage() {
  try {
    return <OwnerActivityLog initialLogs={await getActivityLogs(30)} unavailable={false} />;
  } catch {
    return <OwnerActivityLog initialLogs={[]} unavailable />;
  }
}
