import "server-only";
import type { SoundCloudTrackResult } from "@/types";

const API_ROOT = "https://api.soundcloud.com";
const OEMBED_URL = "https://soundcloud.com/oembed";
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Origin: "https://soundcloud.com",
  Referer: "https://soundcloud.com/",
};

function safeSoundCloudUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || !["soundcloud.com", "www.soundcloud.com", "on.soundcloud.com"].includes(url.hostname)) return null;
    return url.toString();
  } catch { return null; }
}

function fromApiTrack(row: Record<string, unknown>): SoundCloudTrackResult | null {
  const url = safeSoundCloudUrl(row.permalink_url);
  if (!url || typeof row.title !== "string") return null;
  const user = row.user && typeof row.user === "object" ? row.user as Record<string, unknown> : {};
  return {
    soundcloud_url: url,
    title: row.title.slice(0, 200),
    artist: (typeof user.username === "string" ? user.username : "SoundCloud").slice(0, 160),
    artwork_url: typeof row.artwork_url === "string" ? row.artwork_url.replace("-large.", "-t500x500.") : null,
    duration_ms: typeof row.duration === "number" ? Math.max(0, Math.round(row.duration)) : null,
  };
}

async function getJson(url: string) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
    headers: BROWSER_HEADERS,
  });
  if (!response.ok) {
    const error = new Error(`SoundCloud ${response.status}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return response.json() as Promise<unknown>;
}

export function isSoundCloudAuthError(error: unknown) {
  return error instanceof Error && "status" in error && (error as Error & { status?: number }).status !== undefined
    && (error as Error & { status: number }).status === 401;
}

export function isSoundCloudOAuthRequired(error: unknown) {
  return error instanceof Error && "status" in error
    && (error as Error & { status?: number }).status === 403;
}

export async function testSoundCloudClientId(clientId: string): Promise<void> {
  await getJson(`${API_ROOT}/tracks?limit=1&client_id=${encodeURIComponent(clientId)}`);
}

export async function searchSoundCloud(query: string, clientId: string): Promise<SoundCloudTrackResult[]> {
  const json = await getJson(`${API_ROOT}/tracks?q=${encodeURIComponent(query)}&limit=12&client_id=${encodeURIComponent(clientId)}`);
  const rows = Array.isArray(json) ? json : json && typeof json === "object" && Array.isArray((json as { collection?: unknown }).collection) ? (json as { collection: unknown[] }).collection : [];
  return rows.map((row) => row && typeof row === "object" ? fromApiTrack(row as Record<string, unknown>) : null).filter((row): row is SoundCloudTrackResult => Boolean(row));
}

export async function resolveSoundCloudTrack(value: unknown): Promise<SoundCloudTrackResult> {
  const soundcloudUrl = safeSoundCloudUrl(value);
  if (!soundcloudUrl) throw new Error("URL SoundCloud tidak valid.");
  const json = await getJson(`${OEMBED_URL}?format=json&url=${encodeURIComponent(soundcloudUrl)}`);
  const row = json && typeof json === "object" ? json as Record<string, unknown> : {};
  const fullTitle = typeof row.title === "string" ? row.title.trim() : "SoundCloud track";
  const separator = fullTitle.lastIndexOf(" by ");
  return {
    soundcloud_url: soundcloudUrl,
    title: (separator > 0 ? fullTitle.slice(0, separator) : fullTitle).slice(0, 200),
    artist: (typeof row.author_name === "string" ? row.author_name : separator > 0 ? fullTitle.slice(separator + 4) : "SoundCloud").slice(0, 160),
    artwork_url: typeof row.thumbnail_url === "string" ? row.thumbnail_url : null,
    duration_ms: null,
  };
}
