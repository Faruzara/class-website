"use client";

import { useEffect, useMemo, useState } from "react";
import { AudioLines } from "lucide-react";
import type { ApiResponse } from "@/types";

type PlayerState = { id: string; title: string; artist: string; position: number; duration: number; playing: boolean };
type LyricsResponse = { syncedLyrics: string | null; plainLyrics: string | null; instrumental: boolean };
type TimedLine = { at: number; text: string };

function parseSyncedLyrics(value: string | null): TimedLine[] {
  if (!value) return [];
  return value.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)$/);
    if (!match || !match[4].trim()) return [];
    const fraction = (match[3] ?? "0").padEnd(3, "0").slice(0, 3);
    return [{ at: (Number(match[1]) * 60 + Number(match[2])) * 1000 + Number(fraction), text: match[4].trim() }];
  });
}

export default function SoundCloudLyricsColumn() {
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [lyrics, setLyrics] = useState<LyricsResponse | null | undefined>(undefined);

  useEffect(() => {
    const update = (event: Event) => setPlayer((event as CustomEvent<PlayerState>).detail);
    window.addEventListener("soundcloud-player-state", update);
    return () => window.removeEventListener("soundcloud-player-state", update);
  }, []);

  useEffect(() => {
    if (!player?.id) return;
    const controller = new AbortController();
    setLyrics(undefined);
    fetch(`/api/public/lyrics?track=${encodeURIComponent(player.title)}&artist=${encodeURIComponent(player.artist)}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json() as ApiResponse<LyricsResponse | null>;
        if (!response.ok || !result.success) throw new Error(result.error);
        setLyrics(result.data ?? null);
      })
      .catch((error) => { if (!(error instanceof DOMException && error.name === "AbortError")) setLyrics(null); });
    return () => controller.abort();
  }, [player?.id, player?.title, player?.artist]);

  const timed = useMemo(() => parseSyncedLyrics(lyrics?.syncedLyrics ?? null), [lyrics?.syncedLyrics]);
  const plain = useMemo(() => (lyrics?.plainLyrics ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean), [lyrics?.plainLyrics]);
  const activeIndex = timed.length ? Math.max(0, timed.findLastIndex((line) => line.at <= (player?.position ?? 0))) : plain.length ? Math.min(plain.length - 1, Math.floor((player?.position ?? 0) / 5000)) : -1;
  const currentLine = timed.length ? timed[activeIndex]?.text : plain[activeIndex];
  const nextLine = timed.length ? timed[activeIndex + 1]?.text : plain[activeIndex + 1];

  return <div aria-live="polite" aria-label="Lirik lagu" className="flex h-11 min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-xl px-1 text-left text-gray-700">
    <AudioLines size={14} strokeWidth={1.6} className={`shrink-0 ${player?.playing ? "text-gray-900" : "text-gray-400"}`} aria-hidden="true" />
    <div className="min-w-0 flex-1">
      {!player ? <p className="truncate text-[9px] text-gray-400">Buka pemutar untuk lirik</p> : lyrics === undefined ? <p className="truncate text-[9px] text-gray-400">Mencari lirik…</p> : lyrics?.instrumental ? <p className="truncate text-[9px] text-gray-500">Instrumental</p> : currentLine ? <><p key={`${player.id}-${activeIndex}`} className="truncate text-[9px] font-semibold leading-4 text-gray-900 animate-in fade-in slide-in-from-bottom-1">{currentLine}</p>{nextLine ? <p className="truncate text-[8px] leading-3 text-gray-400">{nextLine}</p> : null}</> : <p className="truncate text-[9px] text-gray-400">Lirik tidak ditemukan</p>}
    </div>
  </div>;
}
