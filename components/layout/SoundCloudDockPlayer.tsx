"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Loader2, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from "lucide-react";
import type { MusicTrack } from "@/types";
import styles from "./SoundCloudDockPlayer.module.css";

type Widget = { bind: (event: string, callback: (value?: { currentPosition?: number }) => void) => void; load: (url: string, options: Record<string, unknown>) => void; play: () => void; pause: () => void; seekTo: (ms: number) => void; getDuration: (callback: (ms: number) => void) => void; isPaused: (callback: (paused: boolean) => void) => void };
declare global { interface Window { SC?: { Widget: ((iframe: HTMLIFrameElement) => Widget) & { Events: Record<string, string> } } } }

function clock(ms: number) { const seconds = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; }
type RepeatMode = "none" | "all" | "one";

export default function SoundCloudDockPlayer({ tracks }: { tracks: MusicTrack[] }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const widgetRef = useRef<Widget | null>(null);
  const tracksRef = useRef(tracks);
  const currentIndexRef = useRef(0);
  const loadedTrackIdRef = useRef<string | null>(null);
  const pendingPlayRef = useRef(false);
  const loadingTrackRef = useRef(false);
  const repeatModeRef = useRef<RepeatMode>("none");
  const shuffleRef = useRef(false);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [widgetReady, setWidgetReady] = useState(false);
  const [playPending, setPlayPending] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(tracks[0]?.duration_ms ?? 0);
  const [brokenArtworkId, setBrokenArtworkId] = useState<string | null>(null);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("none");
  const [shuffle, setShuffle] = useState(false);
  const current = tracks[index];

  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { currentIndexRef.current = index; }, [index]);

  useEffect(() => {
    if (!iframeRef.current) return;
    let cancelled = false;
    const initialize = () => {
      if (cancelled || !window.SC || !iframeRef.current) return;
      const widget = window.SC.Widget(iframeRef.current); widgetRef.current = widget;
      const events = window.SC.Widget.Events;
      widget.bind(events.READY, () => {
        loadedTrackIdRef.current = tracksRef.current[currentIndexRef.current]?.id ?? null;
        loadingTrackRef.current = false;
        setWidgetReady(true);
        widget.getDuration((value) => setDuration(Math.max(0, value)));
        if (pendingPlayRef.current) widget.play();
      });
      widget.bind(events.PLAY, () => { pendingPlayRef.current = false; setPlayPending(false); setPlaying(true); widget.getDuration((value) => setDuration(Math.max(0, value))); });
      widget.bind(events.PAUSE, () => {
        if (loadingTrackRef.current) return;
        pendingPlayRef.current = false;
        setPlayPending(false);
        setPlaying(false);
      });
      widget.bind(events.FINISH, () => {
        if (repeatModeRef.current === "one") {
          widget.seekTo(0);
          widget.play();
          return;
        }
        const items = tracksRef.current;
        const value = currentIndexRef.current;
        if (shuffleRef.current && items.length > 1) {
          let next = value;
          while (next === value) next = Math.floor(Math.random() * items.length);
          pendingPlayRef.current = true;
          currentIndexRef.current = next;
          setIndex(next);
        } else if (value < items.length - 1) {
          pendingPlayRef.current = true;
          currentIndexRef.current = value + 1;
          setIndex(value + 1);
        } else if (repeatModeRef.current === "all") {
          pendingPlayRef.current = true;
          currentIndexRef.current = 0;
          setIndex(0);
        } else setPlaying(false);
      });
      widget.bind(events.PLAY_PROGRESS, (event) => {
        pendingPlayRef.current = false;
        setPlayPending(false);
        setPlaying(true);
        setPosition(event?.currentPosition ?? 0);
      });
      widget.bind(events.ERROR, () => { loadingTrackRef.current = false; pendingPlayRef.current = false; setPlayPending(false); setPlaying(false); setWidgetReady(false); });
    };
    if (window.SC) initialize();
    else {
      const existing = document.querySelector<HTMLScriptElement>('script[src="https://w.soundcloud.com/player/api.js"]');
      const script = existing ?? Object.assign(document.createElement("script"), { src: "https://w.soundcloud.com/player/api.js", async: true });
      script.addEventListener("load", initialize, { once: true }); if (!existing) document.head.appendChild(script);
    }
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!current || !widgetRef.current || !widgetReady || loadedTrackIdRef.current === current.id) return;
    setPosition(0); setDuration(current.duration_ms ?? 0); setPlaying(false);
    loadingTrackRef.current = true;
    setWidgetReady(false);
    widgetRef.current.load(current.soundcloud_url, { auto_play: pendingPlayRef.current, hide_related: true, show_comments: false, show_user: false, show_reposts: false, visual: false, callback: () => { loadingTrackRef.current = false; loadedTrackIdRef.current = current.id; setWidgetReady(true); widgetRef.current?.getDuration((value) => setDuration(Math.max(0, value))); if (pendingPlayRef.current) widgetRef.current?.play(); } });
  }, [current?.id, widgetReady]);

  useEffect(() => {
    if (!current) return;
    window.dispatchEvent(new CustomEvent("soundcloud-player-state", { detail: { id: current.id, title: current.title, artist: current.artist, position, duration, playing } }));
  }, [current, position, duration, playing]);

  function cycleRepeatMode() {
    const next: RepeatMode = repeatMode === "none" ? "all" : repeatMode === "all" ? "one" : "none";
    repeatModeRef.current = next;
    setRepeatMode(next);
  }

  function changeTrack(next: number) {
    if (!tracks.length) return;
    const normalized = (next + tracks.length) % tracks.length;
    const commit = (shouldPlay: boolean) => {
      pendingPlayRef.current = shouldPlay;
      setPlayPending(shouldPlay);
      currentIndexRef.current = normalized;
      setIndex(normalized);
    };
    if (widgetRef.current && widgetReady) widgetRef.current.isPaused((paused) => commit(!paused || pendingPlayRef.current));
    else commit(playing || pendingPlayRef.current);
  }

  function nextTrack() {
    if (!shuffle || tracks.length < 2) {
      changeTrack(index + 1);
      return;
    }
    let next = index;
    while (next === index) next = Math.floor(Math.random() * tracks.length);
    changeTrack(next);
  }

  function togglePlayback() {
    const widget = widgetRef.current;
    if (!widget || !widgetReady) {
      pendingPlayRef.current = true;
      setPlayPending(true);
      return;
    }
    widget.isPaused((paused) => {
      if (paused) { pendingPlayRef.current = true; setPlayPending(true); widget.play(); }
      else widget.pause();
    });
  }

  function toggleShuffle() {
    setShuffle((value) => { shuffleRef.current = !value; return !value; });
  }

  if (!current) return <div className="flex h-11 min-w-0 flex-1 items-center px-2 text-xs text-gray-500">Playlist belum tersedia.</div>;
  const artwork = current.artwork_url?.replace("-large.", "-t500x500.");
  return <div className="relative flex h-[112px] min-w-0 flex-1 items-center overflow-hidden px-3">
    <iframe ref={iframeRef} title="SoundCloud player" className="absolute size-px opacity-0" tabIndex={-1} allow="autoplay" src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(current.soundcloud_url)}&auto_play=false&show_artwork=false`} />
    {artwork && brokenArtworkId !== current.id ? <img src={artwork} alt="" referrerPolicy="no-referrer" aria-hidden="true" className="absolute inset-0 size-full scale-110 object-cover opacity-[0.16] blur-[5px] grayscale" /> : null}
    <div aria-hidden="true" className="absolute inset-0 bg-white/75" />
    <div aria-hidden="true" className="absolute inset-0 opacity-30 [background-image:linear-gradient(115deg,transparent_12%,rgba(17,24,39,0.08)_12.5%,transparent_13%),linear-gradient(20deg,transparent_72%,rgba(17,24,39,0.06)_72.5%,transparent_73%)]" />
    <a href={current.soundcloud_url} target="_blank" rel="noopener noreferrer" className="absolute right-9 top-2 z-20 text-[7px] font-semibold tracking-wide text-gray-500 hover:text-gray-900">SoundCloud</a>

    <div className="relative z-10 grid size-[94px] shrink-0 place-items-center" aria-hidden="true">
      <div className="relative size-[68px] overflow-hidden rounded-full bg-gray-900 shadow-[0_4px_16px_rgba(17,24,39,0.22)]">
        {artwork && brokenArtworkId !== current.id ? <img src={artwork} alt="" referrerPolicy="no-referrer" onError={() => setBrokenArtworkId(current.id)} className={`size-full object-cover ${playing ? "animate-[spin_9s_linear_infinite]" : ""}`} /> : <span className="grid size-full place-items-center bg-[radial-gradient(circle_at_35%_30%,#596579,#111827_68%)] text-[9px] font-semibold text-white/80">SC</span>}
        <span className="absolute left-1/2 top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/80 bg-gray-900" />
      </div>
    </div>

    <div className="relative z-10 min-w-0 flex-1 pr-5 text-center">
      <a href={current.soundcloud_url} target="_blank" rel="noopener noreferrer" className="block truncate font-serif text-[9px] font-semibold text-gray-900">{current.title}</a>
      <p className="mt-0.5 truncate font-serif text-[7px] text-gray-500">{current.artist}</p>
      <div className="mt-2 flex items-center justify-center gap-2">
        <button type="button" onClick={cycleRepeatMode} className="grid size-5 place-items-center text-gray-500 transition-[color,transform] hover:scale-110 hover:text-gray-900" aria-label={repeatMode === "none" ? "Pengulangan mati" : repeatMode === "all" ? "Ulangi playlist" : "Ulangi satu lagu"} title={repeatMode === "none" ? "Repeat: none" : repeatMode === "all" ? "Repeat: playlist" : "Repeat: 1 lagu"}>{repeatMode === "one" ? <Repeat1 size={11} /> : <Repeat size={11} className={repeatMode === "none" ? "opacity-35" : ""} />}</button>
        <button type="button" onClick={() => changeTrack(index - 1)} aria-label="Lagu sebelumnya" className="grid size-5 touch-manipulation place-items-center text-gray-700 transition-transform hover:scale-110"><SkipBack size={13} fill="currentColor" /></button>
        <button type="button" onClick={togglePlayback} aria-label={playing ? "Jeda" : "Putar"} className="grid size-8 touch-manipulation place-items-center rounded-[2px] bg-gray-900 text-white shadow-sm transition-transform hover:scale-105">{playPending && !playing ? <Loader2 size={12} className="animate-spin" /> : playing ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}</button>
        <button type="button" onClick={nextTrack} aria-label="Lagu berikutnya" className="grid size-5 touch-manipulation place-items-center text-gray-700 transition-transform hover:scale-110"><SkipForward size={13} fill="currentColor" /></button>
        <button type="button" onClick={toggleShuffle} aria-pressed={shuffle} aria-label={shuffle ? "Acak aktif" : "Acak mati"} title={shuffle ? "Shuffle: aktif" : "Shuffle: mati"} className={`grid size-5 place-items-center transition-[color,transform] hover:scale-110 hover:text-gray-900 ${shuffle ? "text-gray-900" : "text-gray-400 opacity-40"}`}><Shuffle size={11} /></button>
      </div>
      <div className="mt-2 flex items-center gap-1.5 px-1">
        <span className="text-[7px] tabular-nums text-gray-500">{clock(position)}</span>
        <input aria-label="Posisi lagu" type="range" min={0} max={Math.max(duration, 1)} value={Math.min(position, Math.max(duration, 1))} onChange={(e) => { const value = Number(e.target.value); setPosition(value); widgetRef.current?.seekTo(value); }} className="h-[2px] min-w-0 flex-1 cursor-pointer accent-gray-900" />
        <span className="text-[7px] tabular-nums text-gray-500">{clock(duration)}</span>
      </div>
    </div>

    <div className={styles.equalizer} aria-hidden="true" data-playing={playing ? "true" : "false"}>
      {Array.from({ length: 42 }, (_, bar) => (
        <span
          key={bar}
          style={{
            "--bar-height": `${5 + ((bar * 11) % 18)}px`,
            "--bar-duration": `${0.72 + ((bar * 7) % 9) * 0.06}s`,
            "--bar-delay": `${-((bar * 5) % 13) * 0.08}s`,
          } as CSSProperties}
        />
      ))}
    </div>
  </div>;
}
