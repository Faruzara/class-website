import { NextRequest, NextResponse } from "next/server";
import type { ApiResponse } from "@/types";

type LrcLibResult = {
  trackName?: string;
  artistName?: string;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
};

function normalized(value: string) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function cleanTrackName(track: string, artist: string) {
  let cleaned = track.trim().replace(/\.(wav|mp3|flac|m4a|ogg)$/i, "");
  const prefix = `${artist.trim()} -`;
  if (cleaned.toLocaleLowerCase().startsWith(prefix.toLocaleLowerCase())) cleaned = cleaned.slice(prefix.length).trim();
  return cleaned.slice(0, 160);
}

export async function GET(req: NextRequest) {
  const artist = req.nextUrl.searchParams.get("artist")?.trim().slice(0, 120) ?? "";
  const rawTrack = req.nextUrl.searchParams.get("track")?.trim().slice(0, 200) ?? "";
  if (!artist || !rawTrack) return NextResponse.json<ApiResponse>({ success: false, error: "Judul dan artis wajib diisi." }, { status: 400 });
  const track = cleanTrackName(rawTrack, artist);

  try {
    const url = new URL("https://lrclib.net/api/search");
    url.searchParams.set("track_name", track);
    url.searchParams.set("artist_name", artist);
    const response = await fetch(url, {
      headers: { Accept: "application/json", "Lrclib-Client": "XI-TP2-Class-Site/1.0" },
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`LRCLIB ${response.status}`);
    const rows = await response.json() as LrcLibResult[];
    const targetTrack = normalized(track);
    const targetArtist = normalized(artist);
    const best = rows
      .filter((row) => row && (row.syncedLyrics || row.plainLyrics || row.instrumental))
      .sort((a, b) => {
        const score = (row: LrcLibResult) => (normalized(row.trackName ?? "") === targetTrack ? 4 : 0) + (normalized(row.artistName ?? "") === targetArtist ? 3 : 0) + (row.syncedLyrics ? 2 : 0);
        return score(b) - score(a);
      })[0];
    return NextResponse.json({ success: true, data: best ? { syncedLyrics: best.syncedLyrics ?? null, plainLyrics: best.plainLyrics ?? null, instrumental: Boolean(best.instrumental) } : null });
  } catch (error) {
    console.error("[GET /api/public/lyrics]", error);
    return NextResponse.json<ApiResponse>({ success: false, error: "Lirik belum dapat dimuat." }, { status: 502 });
  }
}
