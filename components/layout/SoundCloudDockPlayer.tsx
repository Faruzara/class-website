"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Pause, Play, SkipBack, SkipForward, Volume2 } from "lucide-react";
import type { MusicTrack } from "@/types";

type Widget = { bind: (event: string, callback: (value?: { currentPosition?: number }) => void) => void; load: (url: string, options: Record<string, unknown>) => void; play: () => void; pause: () => void; seekTo: (ms: number) => void; getDuration: (callback: (ms: number) => void) => void };
declare global { interface Window { SC?: { Widget: ((iframe: HTMLIFrameElement) => Widget) & { Events: Record<string, string> } } } }

function clock(ms: number) { const seconds = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }

export default function SoundCloudDockPlayer({ tracks }: { tracks: MusicTrack[] }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const widgetRef = useRef<Widget | null>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(tracks[0]?.duration_ms ?? 0);
  const [brokenArtworkId, setBrokenArtworkId] = useState<string | null>(null);
  const current = tracks[index];

  useEffect(() => {
    if (!current || !iframeRef.current) return;
    let cancelled = false;
    const initialize = () => {
      if (cancelled || !window.SC || !iframeRef.current) return;
      const widget = window.SC.Widget(iframeRef.current); widgetRef.current = widget;
      const events = window.SC.Widget.Events;
      widget.bind(events.READY, () => widget.getDuration(setDuration));
      widget.bind(events.PLAY, () => setPlaying(true));
      widget.bind(events.PAUSE, () => setPlaying(false));
      widget.bind(events.FINISH, () => setIndex((value) => (value + 1) % tracks.length));
      widget.bind(events.PLAY_PROGRESS, (event) => setPosition(event?.currentPosition ?? 0));
    };
    if (window.SC) initialize();
    else {
      const existing = document.querySelector<HTMLScriptElement>('script[src="https://w.soundcloud.com/player/api.js"]');
      const script = existing ?? Object.assign(document.createElement("script"), { src: "https://w.soundcloud.com/player/api.js", async: true });
      script.addEventListener("load", initialize, { once: true }); if (!existing) document.head.appendChild(script);
    }
    return () => { cancelled = true; };
  }, [current?.id, tracks.length]);

  useEffect(() => {
    if (!current || !widgetRef.current) return;
    setPosition(0); setDuration(current.duration_ms ?? 0); setPlaying(false);
    widgetRef.current.load(current.soundcloud_url, { auto_play: false, hide_related: true, show_comments: false, show_user: false, show_reposts: false, visual: false });
  }, [current?.id]);

  if (!current) return <div className="flex h-11 min-w-0 flex-1 items-center px-2 text-xs text-gray-500">Playlist belum tersedia.</div>;
  const artwork = current.artwork_url?.replace("-large.", "-t500x500.");
  return <div className="relative flex h-[112px] min-w-0 flex-1 items-center overflow-hidden px-3">
    <iframe ref={iframeRef} title="SoundCloud player" className="absolute size-px opacity-0" tabIndex={-1} allow="autoplay" src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(current.soundcloud_url)}&auto_play=false&show_artwork=false`} />
    {artwork && brokenArtworkId !== current.id ? <img src={artwork} alt="" referrerPolicy="no-referrer" aria-hidden="true" className="absolute inset-0 size-full scale-110 object-cover opacity-[0.16] blur-[5px] grayscale" /> : null}
    <div aria-hidden="true" className="absolute inset-0 bg-white/75" />
    <div aria-hidden="true" className="absolute inset-0 opacity-30 [background-image:linear-gradient(115deg,transparent_12%,rgba(17,24,39,0.08)_12.5%,transparent_13%),linear-gradient(20deg,transparent_72%,rgba(17,24,39,0.06)_72.5%,transparent_73%)]" />

    <div className="relative z-10 grid size-[94px] shrink-0 place-items-center" aria-hidden="true">
      {Array.from({ length: 36 }, (_, bar) => (
        <span
          key={bar}
          className="absolute left-1/2 top-1/2 h-[47px] w-[2px] origin-bottom"
          style={{ transform: `translate(-50%, -100%) rotate(${bar * 10}deg)` }}
        >
          <span
            className="absolute left-0 top-0 w-[2px] rounded-full bg-gray-950/90 transition-[height] duration-300"
            style={{ height: `${playing ? 7 + ((bar * 7) % 13) : 5 + ((bar * 3) % 7)}px` }}
          />
        </span>
      ))}
      <div className="relative size-[62px] overflow-hidden rounded-full bg-gray-900 shadow-[0_4px_16px_rgba(17,24,39,0.22)]">
        {artwork && brokenArtworkId !== current.id ? <img src={artwork} alt="" referrerPolicy="no-referrer" onError={() => setBrokenArtworkId(current.id)} className={`size-full object-cover ${playing ? "animate-[spin_9s_linear_infinite]" : ""}`} /> : <span className="grid size-full place-items-center bg-[radial-gradient(circle_at_35%_30%,#596579,#111827_68%)] text-[9px] font-semibold text-white/80">SC</span>}
        <span className="absolute left-1/2 top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/80 bg-gray-900" />
      </div>
    </div>

    <div className="relative z-10 min-w-0 flex-1 pr-5 text-center">
      <a href={current.soundcloud_url} target="_blank" rel="noopener noreferrer" className="block truncate font-serif text-[9px] font-semibold text-gray-900">{current.title}</a>
      <p className="mt-0.5 truncate font-serif text-[7px] text-gray-500">{current.artist}</p>
      <div className="mt-2 flex items-center justify-center gap-2.5">
        <button onClick={() => setIndex((index - 1 + tracks.length) % tracks.length)} aria-label="Lagu sebelumnya" className="p-0.5 text-gray-700 transition-transform hover:scale-110"><SkipBack size={13} fill="currentColor" /></button>
        <button onClick={() => playing ? widgetRef.current?.pause() : widgetRef.current?.play()} aria-label={playing ? "Jeda" : "Putar"} className="grid size-7 place-items-center rounded-[2px] bg-gray-900 text-white shadow-sm transition-transform hover:scale-105">{playing ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}</button>
        <button onClick={() => setIndex((index + 1) % tracks.length)} aria-label="Lagu berikutnya" className="p-0.5 text-gray-700 transition-transform hover:scale-110"><SkipForward size={13} fill="currentColor" /></button>
      </div>
      <div className="mt-2 flex items-center gap-1.5 px-1">
        <span className="text-[7px] tabular-nums text-gray-500">{clock(position)}</span>
        <input aria-label="Posisi lagu" type="range" min={0} max={Math.max(duration, 1)} value={Math.min(position, Math.max(duration, 1))} onChange={(e) => { const value = Number(e.target.value); setPosition(value); widgetRef.current?.seekTo(value); }} className="h-[2px] min-w-0 flex-1 cursor-pointer accent-gray-900" />
        <span className="text-[7px] tabular-nums text-gray-500">{clock(duration)}</span>
      </div>
      <div className="mt-1.5 flex items-center justify-center gap-1">
        <Volume2 size={9} className="text-gray-500" aria-hidden="true" />
        <a href={current.soundcloud_url} target="_blank" rel="noopener noreferrer" className="inline-flex h-4 items-center gap-1 rounded-[2px] bg-gray-900 px-1.5 text-[7px] font-semibold text-white" aria-label="Buka lagu di SoundCloud">SoundCloud <ChevronDown size={8} /></a>
        <span title="Sumber audio: SoundCloud" aria-label="Sumber audio SoundCloud" className="grid size-3 place-items-center rounded-[2px] bg-rose-600 text-[5px] font-bold text-white">SC</span>
      </div>
    </div>
  </div>;
}
