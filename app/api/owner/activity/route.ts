import { NextRequest, NextResponse } from "next/server";
import { getOwnerSession } from "@/lib/auth";
import { getActivityLogsBefore } from "@/lib/db";
import type { ApiResponse, ActivityLog } from "@/types";

export async function GET(request: NextRequest) {
  const owner = await getOwnerSession();
  if (!owner) return NextResponse.json<ApiResponse>({ success: false, error: "Unauthorized" }, { status: 401 });

  const before = request.nextUrl.searchParams.get("before");
  if (before && Number.isNaN(Date.parse(before))) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Cursor tidak valid." }, { status: 400 });
  }

  try {
    const rows = await getActivityLogsBefore(31, before);
    return NextResponse.json<ApiResponse<{ items: ActivityLog[]; hasMore: boolean }>>({
      success: true,
      data: { items: rows.slice(0, 30), hasMore: rows.length > 30 },
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("[GET /api/owner/activity]", error);
    return NextResponse.json<ApiResponse>({ success: false, error: "Activity gagal dimuat." }, { status: 500 });
  }
}
