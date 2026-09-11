import "server-only";

import { isIP } from "net";
import type { NextRequest } from "next/server";
import { describeDevice } from "@/lib/access-control";
import { countRecentLoginFailures } from "@/lib/db";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_FAILURE_LIMIT = 5;

function normalizeIpCandidate(value: string): string | null {
  let candidate = value.trim();
  if (!candidate) return null;
  if (candidate.startsWith("[") && candidate.includes("]")) candidate = candidate.slice(1, candidate.indexOf("]"));
  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(candidate)) candidate = candidate.slice(0, candidate.lastIndexOf(":"));
  return isIP(candidate) ? candidate : null;
}

export function getLoginRequestContext(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
  const ipAddress = [
    request.headers.get("cf-connecting-ip") ?? "",
    request.headers.get("x-real-ip") ?? "",
    forwarded,
  ].map(normalizeIpCandidate).find(Boolean) ?? null;
  const userAgent = request.headers.get("user-agent")?.slice(0, 512) || null;

  return {
    ipAddress,
    userAgent,
    deviceLabel: describeDevice(userAgent),
  };
}

export function isTrustedLoginRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return false;
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) return false;
  return request.headers.get("content-type")?.toLowerCase().startsWith("application/json") ?? false;
}

export async function readLoginKey(request: NextRequest): Promise<string | null> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > 4096) return null;
  try {
    const body = await request.json() as { key?: unknown };
    return typeof body.key === "string" && body.key.length > 0 && body.key.length <= 256 ? body.key : null;
  } catch {
    return null;
  }
}

export async function isLoginRateLimited(action: string, ipAddress: string | null): Promise<boolean> {
  if (!ipAddress) return false;
  const since = new Date(Date.now() - LOGIN_WINDOW_MS).toISOString();
  return (await countRecentLoginFailures(action, ipAddress, since)) >= LOGIN_FAILURE_LIMIT;
}

export function loginRetryAfterSeconds(): number {
  return Math.ceil(LOGIN_WINDOW_MS / 1000);
}
