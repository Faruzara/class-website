"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
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
  return <div className="flex min-w-0 flex-1 items-center gap-2 pr-1">
    <iframe ref={iframeRef} title="SoundCloud player" className="absolute size-px opacity-0" tabIndex={-1} allow="autoplay" src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(current.soundcloud_url)}&auto_play=false&show_artwork=false`} />
    <div className="relative size-11 shrink-0 overflow-hidden rounded-full bg-gray-900 shadow-inner">
      {artwork ? <img src={artwork} alt="" className={`size-full object-cover ${playing ? "animate-[spin_9s_linear_infinite]" : ""}`} /> : <span className="grid size-full place-items-center text-[9px] text-white/70">SC</span>}
      <span className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 bg-gray-900" />
    </div>
    <div className="min-w-0 flex-1">
      <a href={current.soundcloud_url} target="_blank" rel="noopener noreferrer" className="block truncate text-[11px] font-semibold text-gray-900">{current.title}</a>
      <p className="truncate text-[9px] text-gray-500">{current.artist} · SoundCloud</p>
      <div className="mt-1 flex items-center gap-1.5">
        <button onClick={() => setIndex((index - 1 + tracks.length) % tracks.length)} aria-label="Lagu sebelumnya" className="p-0.5 text-gray-500"><SkipBack size={12} /></button>
        <button onClick={() => playing ? widgetRef.current?.pause() : widgetRef.current?.play()} aria-label={playing ? "Jeda" : "Putar"} className="grid size-6 place-items-center rounded-full bg-gray-900 text-white">{playing ? <Pause size={11} fill="currentColor" /> : <Play size={11} fill="currentColor" />}</button>
        <button onClick={() => setIndex((index + 1) % tracks.length)} aria-label="Lagu berikutnya" className="p-0.5 text-gray-500"><SkipForward size={12} /></button>
        <span className="ml-0.5 text-[8px] tabular-nums text-gray-400">{clock(position)}</span>
        <input aria-label="Posisi lagu" type="range" min={0} max={Math.max(duration, 1)} value={Math.min(position, Math.max(duration, 1))} onChange={(e) => { const value = Number(e.target.value); setPosition(value); widgetRef.current?.seekTo(value); }} className="h-1 min-w-0 flex-1 accent-gray-900" />
        <span className="text-[8px] tabular-nums text-gray-400">{clock(duration)}</span>
      </div>
    </div>
  </div>;
}
