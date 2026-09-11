import { NextRequest, NextResponse } from "next/server";
import { getSession, logActivity } from "@/lib/auth";
import { revokeTempKey } from "@/lib/db";
import type { ApiResponse } from "@/types";

// DELETE — revoke temp key
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();

  if (session?.role !== "admin") {
    return NextResponse.json<ApiResponse>({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Forbidden" }, { status: 403 });
  }

  await revokeTempKey(id, `Slot ${session.slot_id} - ${session.label}`);

  await logActivity({
    actor_role:  "admin",
    actor_label: `Slot ${session.slot_id} - ${session.label}`,
    action:      "revoke_temp_key",
    detail:      `ID: ${id}`,
  });

  return NextResponse.json<ApiResponse>({ success: true });
}
