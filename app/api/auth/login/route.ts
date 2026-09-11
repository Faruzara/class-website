import { NextRequest, NextResponse } from "next/server";
import {
  validateAdminKey,
  validateTempKey,
  establishAccessSession,
  setSessionCookie,
  logActivity,
} from "@/lib/auth";
import { getLoginRequestContext, isLoginRateLimited, isTrustedLoginRequest, loginRetryAfterSeconds, readLoginKey } from "@/lib/login-security";
import type { ApiResponse } from "@/types";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function POST(req: NextRequest) {
  const context = getLoginRequestContext(req);
  try {
    if (!isTrustedLoginRequest(req)) {
      return NextResponse.json<ApiResponse>({ success: false, error: "Permintaan tidak valid." }, { status: 403, headers: NO_STORE });
    }
    if (await isLoginRateLimited("admin_login_failed", context.ipAddress)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Terlalu banyak percobaan. Coba lagi nanti." },
        { status: 429, headers: { ...NO_STORE, "Retry-After": String(loginRetryAfterSeconds()) } }
      );
    }

    const key = await readLoginKey(req);

    if (!key) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Key tidak boleh kosong." },
        { status: 400, headers: NO_STORE }
      );
    }

    // Coba validasi sebagai admin key dulu
    let result = await validateAdminKey(key);

    // Kalau gagal, coba sebagai temp key
    if (!result.success) {
      result = await validateTempKey(key, context.deviceLabel);
    }

    if (!result.success || !result.session) {
      await logActivity({
        actor_role: "admin",
        actor_label: "Admin login attempt",
        action: "admin_login_failed",
        detail: `Device: ${context.deviceLabel}`,
        ip_address: context.ipAddress ?? undefined,
        device_label: context.deviceLabel,
        user_agent: context.userAgent,
        event_status: "failure",
      });
      return NextResponse.json<ApiResponse>(
        { success: false, error: "Key tidak valid atau tidak aktif." },
        { status: 401, headers: NO_STORE }
      );
    }

    const established = result.token
      ? { session: result.session, token: result.token }
      : await establishAccessSession(result.session, context.deviceLabel);

    await setSessionCookie(established.session, established.token);
    await logActivity({
      actor_role: established.session.role,
      actor_label: established.session.label,
      action: "admin_login_success",
      detail: `Device: ${context.deviceLabel}`,
      ip_address: context.ipAddress ?? undefined,
      device_label: context.deviceLabel,
      user_agent: context.userAgent,
      event_status: "success",
      session_id: established.session.session_id,
    });

    return NextResponse.json<ApiResponse<{ role: string; label: string }>>({
      success: true,
      data: {
        role: established.session.role,
        label: established.session.label,
      },
    }, { headers: NO_STORE });
  } catch (err) {
    console.error("[POST /api/auth/login]", err);
    return NextResponse.json<ApiResponse>(
      { success: false, error: "Terjadi kesalahan server" },
      { status: 500, headers: NO_STORE }
    );
  }
}
