import { NextResponse } from "next/server";
import { clearSession, getSession, logActivity } from "@/lib/auth";

export async function POST() {
  const session = await getSession();

  if (session) {
    // Catat logout di log
    await logActivity({
      actor_role:  session.role,
      actor_label: session.label,
      action:      "logout",
      detail:      null,
    });
  }

  await clearSession();

  return NextResponse.json({ success: true });
}
