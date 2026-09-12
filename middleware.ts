import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

// -- Route yang butuh proteksi --
const PROTECTED_ADMIN = /^\/admin/;
const PROTECTED_OWNER = /^\/owner/;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Proteksi route /owner ──────────────────────────
  if (PROTECTED_OWNER.test(pathname)) {
    // Kecualikan halaman login owner sendiri
    if (pathname === "/owner/login") return NextResponse.next();

    // Owner pakai cookie session tersendiri
    const ownerToken = request.cookies.get("owner_session")?.value;

    if (!ownerToken) {
      // Redirect ke halaman login owner
      return NextResponse.redirect(new URL("/owner/login", request.url));
    }

    try {
      const { payload } = await jwtVerify(ownerToken, JWT_SECRET);
      if (payload.role !== "owner") throw new Error("Bukan owner");
    } catch {
      return NextResponse.redirect(new URL("/owner/login", request.url));
    }

    return NextResponse.next();
  }

  // ── Proteksi route /admin ──────────────────────────
  if (PROTECTED_ADMIN.test(pathname)) {
    // Kecualikan halaman login admin sendiri
    if (pathname === "/admin/login") return NextResponse.next();

    const adminToken = request.cookies.get("admin_session")?.value;

    if (!adminToken) {
      const ownerToken = request.cookies.get("owner_session")?.value;
      if (ownerToken && (await isOwnerToken(ownerToken))) return NextResponse.next();
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }

    try {
      const { payload } = await jwtVerify(adminToken, JWT_SECRET);

      // Pastikan role valid
      if (!["admin", "temp_admin"].includes(payload.role as string)) {
        throw new Error("Role tidak valid");
      }

      // Kalau temp admin — cek apakah sudah expired
      if (payload.role === "temp_admin" && payload.expires_at) {
        const expiry = new Date(payload.expires_at as string);
        if (expiry < new Date()) {
          // Hapus cookie dan redirect
          const response = NextResponse.redirect(new URL("/admin/login?expired=1", request.url));
          response.cookies.delete("admin_session");
          return response;
        }
      }

      if (payload.role === "temp_admin" && Array.isArray(payload.permissions)) {
        const required = permissionForAdminPath(pathname);
        if (required && !payload.permissions.includes(required)) {
          return NextResponse.redirect(new URL("/admin?forbidden=1", request.url));
        }
      }

      if (!(await isActiveAdminSession(payload, adminToken))) {
        throw new Error("Session sudah dicabut atau tidak aktif");
      }
    } catch {
      const ownerToken = request.cookies.get("owner_session")?.value;
      if (ownerToken && (await isOwnerToken(ownerToken))) return NextResponse.next();
      const response = NextResponse.redirect(new URL("/admin/login", request.url));
      response.cookies.delete("admin_session");
      return response;
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

function permissionForAdminPath(pathname: string): string | null {
  if (/^\/admin\/(homepage|settings|pengumuman)/.test(pathname)) return "homepage";
  if (pathname.startsWith("/admin/jadwal")) return "schedule";
  if (pathname.startsWith("/admin/anggota")) return "members";
  if (pathname.startsWith("/admin/galeri")) return "gallery";
  if (pathname.startsWith("/admin/moments")) return "moments";
  return null;
}

async function isOwnerToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.role !== "owner") return false;
    const registered = await isRegisteredSessionActive(payload);
    return registered !== false;
  } catch {
    return false;
  }
}

async function isActiveAdminSession(
  payload: Record<string, unknown>,
  token: string
): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return false;

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  };

  const registered = await isRegisteredSessionActive(payload, headers);
  if (registered === false) return false;

  if (payload.role === "admin" && payload.slot_id) {
    const response = await fetch(
      `${url}/rest/v1/admin_slots?id=eq.${payload.slot_id}&select=id,key_hash`,
      { headers, cache: "no-store" }
    );
    if (!response.ok) return false;
    const [slot] = (await response.json()) as Array<{ id: number; key_hash: string | null }>;
    return Boolean(slot?.key_hash);
  }

  if (payload.role === "temp_admin" && payload.temp_key_id) {
    const response = await fetch(
      `${url}/rest/v1/temp_keys?id=eq.${payload.temp_key_id}&is_used=eq.true&select=expires_at,session_token`,
      { headers, cache: "no-store" }
    );
    if (!response.ok) return false;
    const [record] = (await response.json()) as Array<{ expires_at: string; session_token: string | null }>;
    return Boolean(
      record && record.session_token === token && new Date(record.expires_at).getTime() > Date.now()
    );
  }

  return false;
}

async function isRegisteredSessionActive(
  payload: Record<string, unknown>,
  providedHeaders?: Record<string, string>
): Promise<boolean | null> {
  if (typeof payload.session_id !== "string") return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return false;
  const headers = providedHeaders ?? { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  const response = await fetch(
    `${url}/rest/v1/access_sessions?id=eq.${payload.session_id}&select=id,expires_at,revoked_at`,
    { headers, cache: "no-store" }
  );
  if (!response.ok) {
    const message = await response.text();
    if (response.status === 404 || /PGRST205/.test(message)) return null;
    return false;
  }
  const [record] = (await response.json()) as Array<{ expires_at: string | null; revoked_at: string | null }>;
  return Boolean(record && !record.revoked_at && (!record.expires_at || new Date(record.expires_at).getTime() > Date.now()));
}

// -- Matcher: jalankan middleware hanya di route ini --
export const config = {
  matcher: ["/admin/:path*", "/owner/:path*"],
};
