import OwnerMomentsManager from "@/components/owner/OwnerMomentsManager";
import { listMoments, ownerMomentSummary } from "@/lib/moments-server";

export const dynamic = "force-dynamic";

export default async function OwnerMomentsPage() {
  try {
    return <OwnerMomentsManager initialItems={(await listMoments(true)).map(ownerMomentSummary)} unavailable={false} />;
  } catch {
    return <OwnerMomentsManager initialItems={[]} unavailable />;
  }
}
