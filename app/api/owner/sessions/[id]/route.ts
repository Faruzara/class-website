import { NextRequest, NextResponse } from "next/server";
import { getOwnerSession, logActivity } from "@/lib/auth";
import { revokeAccessSession } from "@/lib/db";
import type { ApiResponse } from "@/types";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await getOwnerSession();
  const origin = request.headers.get("origin");
  if (!owner || (origin && origin !== request.nextUrl.origin)) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Forbidden" }, { status: 403 });
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json<ApiResponse>({ success: false, error: "ID session tidak valid." }, { status: 400 });
  }
  await revokeAccessSession(id);
  await logActivity({ actor_role: "owner", actor_label: "Owner", action: "revoke_access_session", detail: id });
  return NextResponse.json<ApiResponse>({ success: true });
}
