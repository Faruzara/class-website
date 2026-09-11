import { NextRequest, NextResponse } from "next/server";
import type { ApiResponse } from "@/types";
import { establishAccessSession, logActivity, validateOwnerKey } from "@/lib/auth";
import { getLoginRequestContext, isLoginRateLimited, isTrustedLoginRequest, loginRetryAfterSeconds, readLoginKey } from "@/lib/login-security";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function POST(req: NextRequest) {
  const context = getLoginRequestContext(req);
  if (!isTrustedLoginRequest(req)) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Permintaan tidak valid." }, { status: 403, headers: NO_STORE });
  }
  if (await isLoginRateLimited("owner_login_failed", context.ipAddress)) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Terlalu banyak percobaan. Coba lagi nanti." },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(loginRetryAfterSeconds()) } }
    );
  }

  const key = await readLoginKey(req);
  if (!key) {
    return NextResponse.json<ApiResponse>({ success: false, error: "Key tidak boleh kosong." }, { status: 400, headers: NO_STORE });
  }

  if (!(await validateOwnerKey(key))) {
    await logActivity({
      actor_role: "owner",
      actor_label: "Owner login attempt",
      action: "owner_login_failed",
      detail: `Device: ${context.deviceLabel}`,
      ip_address: context.ipAddress ?? undefined,
      device_label: context.deviceLabel,
      user_agent: context.userAgent,
      event_status: "failure",
    });
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Key tidak valid." },
      { status: 401, headers: NO_STORE }
    );
  }

  try {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const established = await establishAccessSession({
      slot_id: null,
      temp_key_id: null,
      role: "owner",
      label: "Owner",
      expires_at: expiresAt,
    }, context.deviceLabel);

    await logActivity({
      actor_role: "owner",
      actor_label: "Owner",
      action: "owner_login_success",
      detail: `Device: ${context.deviceLabel}`,
      ip_address: context.ipAddress ?? undefined,
      device_label: context.deviceLabel,
      user_agent: context.userAgent,
      event_status: "success",
      session_id: established.session.session_id,
    });

    const response = NextResponse.json<ApiResponse>({ success: true }, { headers: NO_STORE });
    response.cookies.set("owner_session", established.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(expiresAt),
    });
    return response;
  } catch (error) {
    console.error("[POST /api/owner/login]", error);
    return NextResponse.json<ApiResponse>({ success: false, error: "Login sedang tidak tersedia." }, { status: 500, headers: NO_STORE });
  }
}
