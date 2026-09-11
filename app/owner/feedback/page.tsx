import OwnerFeedbackInbox from "@/components/owner/OwnerFeedbackInbox";
import { getFeedbackSubmissions } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function OwnerFeedbackPage() {
  return <OwnerFeedbackInbox initialFeedback={await getFeedbackSubmissions().catch(() => [])} />;
}
