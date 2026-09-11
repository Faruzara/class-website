import { NextRequest, NextResponse } from "next/server";
import { getEditorSession, logActivity } from "@/lib/auth";
import { deleteJadwalItem } from "@/lib/db";
import type { ApiResponse } from "@/types";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getEditorSession("schedule");
  if (!session) return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });
  await deleteJadwalItem(id);
  await logActivity({ actor_role: session.role, actor_label: session.label, action: "schedule_changed", detail: `Hapus ID: ${id}` });
  return NextResponse.json<ApiResponse>({ success: true });
}
