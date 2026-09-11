import { NextRequest, NextResponse } from "next/server";
import { getOwnerSession, logActivity } from "@/lib/auth";
import { updateFeedbackStatus } from "@/lib/db";
import type { ApiResponse, FeedbackStatus } from "@/types";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await getOwnerSession();
  const origin = request.headers.get("origin");
  if (!owner || (origin && origin !== request.nextUrl.origin)) return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const status = String(body?.status ?? "") as FeedbackStatus;
  if (!["open", "reviewed", "resolved"].includes(status)) return NextResponse.json<ApiResponse>({ success: false, error: "Status tidak valid" }, { status: 400 });
  await updateFeedbackStatus(id, status);
  await logActivity({ actor_role: "owner", actor_label: owner.label, action: "feedback_status_changed", detail: `${id}: ${status}` });
  return NextResponse.json<ApiResponse>({ success: true });
}
