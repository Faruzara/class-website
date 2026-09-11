import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { revokeAdminKey } from "@/lib/db";
import { logActivity } from "@/lib/auth";
import type { ApiResponse } from "@/types";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

async function isOwner(): Promise<boolean> {
  try {
    const token = (await cookies()).get("owner_session")?.value;
    if (!token) return false;
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload.role === "owner";
  } catch { return false; }
}

export async function POST(req: NextRequest) {
  if (!(await isOwner())) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Forbidden" }, { status: 403 });
  }
  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Forbidden" }, { status: 403 });
  }

  const { slot_id } = await req.json();
  const slotId = Number(slot_id);
  if (![1, 2, 3].includes(slotId)) {
    return NextResponse.json<ApiResponse>({ success: false, error: "slot_id wajib diisi" }, { status: 400 });
  }

  await revokeAdminKey(slotId);

  await logActivity({
    actor_role:  "owner",
    actor_label: "Owner",
    action:      "revoke_admin_key",
    detail:      `Slot ${slotId}`,
  });

  return NextResponse.json<ApiResponse>({ success: true });
}
