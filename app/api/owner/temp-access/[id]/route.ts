import { NextRequest, NextResponse } from "next/server";
import { getOwnerSession, logActivity } from "@/lib/auth";
import { revokeTempKey } from "@/lib/db";
import type { ApiResponse } from "@/types";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await getOwnerSession();
  const origin = request.headers.get("origin");
  if (!owner || (origin && origin !== request.nextUrl.origin)) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Forbidden" }, { status: 403 });
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json<ApiResponse>({ success: false, error: "ID temporary access tidak valid." }, { status: 400 });
  }
  await revokeTempKey(id, "Owner");
  await logActivity({ actor_role: "owner", actor_label: "Owner", action: "revoke_temp_access", detail: id });
  return NextResponse.json<ApiResponse>({ success: true });
}
