import { notFound } from "next/navigation";
import OwnerAccessControl, { type OwnerAccessView } from "@/components/owner/OwnerAccessControl";
import { getOwnerSession } from "@/lib/auth";
import { getAccessSessions, getAdminSlots, getTempAccessHistory } from "@/lib/db";

export const dynamic = "force-dynamic";

const SECTION_VIEWS: Record<string, OwnerAccessView> = {
  "admin-slots": "slots",
  temporary: "temporary",
  sessions: "sessions",
};

export default async function OwnerAccessSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const view = SECTION_VIEWS[section];
  if (!view) notFound();

  const owner = await getOwnerSession();
  const [slotsResult, tempResult, sessionsResult] = await Promise.allSettled([
    getAdminSlots(),
    getTempAccessHistory(),
    getAccessSessions(owner?.session_id),
  ]);
  const slots = slotsResult.status === "fulfilled"
    ? slotsResult.value.map((slot) => ({ ...slot, key_hash: null, generated_key: null }))
    : [];

  return (
    <OwnerAccessControl
      view={view}
      slots={slots}
      tempKeys={tempResult.status === "fulfilled" ? tempResult.value : []}
      sessions={sessionsResult.status === "fulfilled" ? sessionsResult.value : []}
      sessionsAvailable={sessionsResult.status === "fulfilled"}
    />
  );
}
