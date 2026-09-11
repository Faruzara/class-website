"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { acknowledgeMomentView, pendingMomentViews } from "@/lib/moment-viewer-client";
import { formatMomentTimestamp } from "@/lib/moment-time";
import type { MomentListing } from "@/lib/moments";
import MomentMeltTransition from "./MomentMeltTransition";

type Props = { viewerId: string; snapshot: MomentListing; onClose: () => void };
type PhotoState = { id: string; src: string; status: "loading" | "ready" | "displayed" | "error" };
type DepartingPhoto = { src: string; expiresAt: string };

export default function MomentViewer({ viewerId, snapshot, onClose }: Props) {
  const [queue] = useState(() => [...snapshot.items]);
  const [index, setIndex] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [photo, setPhoto] = useState<PhotoState>({ id: "", src: "", status: "loading" });
  const [departing, setDeparting] = useState<DepartingPhoto | null>(null);
  const retainedUrl = useRef("");
  const transitioning = useRef(false);
  const advancing = useRef(false);
  const position = useRef(0);
  const displayed = useRef(new Set<string>());
  const paintFrames = useRef<number[]>([]);
  const dialog = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const clock = useRef({ time: Date.parse(snapshot.serverNow), received: performance.now() });
  const current = queue[index];
  const estimatedNow = useCallback(() => clock.current.time + performance.now() - clock.current.received, []);

  const releaseDeparting = useCallback(() => {
    if (retainedUrl.current) URL.revokeObjectURL(retainedUrl.current);
    retainedUrl.current = "";
    transitioning.current = false;
    setDeparting(null);
  }, []);

  const advance = useCallback((expectedId: string) => {
    if (advancing.current || queue[position.current]?.id !== expectedId) return;
    advancing.current = true;
    position.current += 1;
    if (position.current >= queue.length) onClose();
    else setIndex(position.current);
  }, [onClose, queue]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab") return;
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [role="button"][tabindex="0"]') ?? []);
      const first = controls[0], last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || !dialog.current?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const keepFocus = (event: FocusEvent) => { if (!dialog.current?.contains(event.target as Node)) closeButton.current?.focus(); };
    document.addEventListener("keydown", handleKey);
    document.addEventListener("focusin", keepFocus);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("focusin", keepFocus);
      paintFrames.current.forEach(cancelAnimationFrame);
      if (retainedUrl.current) URL.revokeObjectURL(retainedUrl.current);
      retainedUrl.current = "";
      previousFocus?.focus();
    };
  }, [onClose]);

  useEffect(() => {
    if (!current) return;
    const id = current.id;
    advancing.current = false;
    let disposed = false;
    let objectUrl = "";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    const expiry = setTimeout(() => { if (!disposed) advance(id); }, Math.max(0, Date.parse(current.expiresAt) - estimatedNow()));
    setPhoto({ id, src: "", status: "loading" });

    async function load() {
      try {
        if (pendingMomentViews(viewerId).includes(id) || Date.parse(current.expiresAt) <= estimatedNow()) { advance(id); return; }
        const response = await fetch(`/api/moments/${id}/original`, { cache: "no-store", headers: { "x-moment-viewer-id": viewerId }, signal: controller.signal });
        if (disposed) return;
        if (response.status === 404 || response.status === 410) { advance(id); return; }
        if (!response.ok || !response.headers.get("content-type")?.startsWith("image/jpeg")) throw new Error("Original unavailable");
        const blob = await response.blob();
        if (disposed) return;
        objectUrl = URL.createObjectURL(blob);
        const decoded = new Image(); decoded.src = objectUrl; await decoded.decode();
        if (disposed) return;
        if (Date.parse(current.expiresAt) <= estimatedNow()) { advance(id); return; }
        setPhoto({ id, src: objectUrl, status: "ready" });
      } catch { if (!disposed) setPhoto({ id, src: "", status: "error" }); }
      finally { clearTimeout(timeout); }
    }
    void load();
    return () => {
      disposed = true; controller.abort(); clearTimeout(timeout); clearTimeout(expiry);
      if (objectUrl && retainedUrl.current !== objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [current, viewerId, attempt, advance, estimatedNow]);

  const recordDisplayed = useCallback(() => {
    if (!current || photo.id !== current.id || !photo.src || photo.status === "error" || transitioning.current) return;
    const id = current.id;
    paintFrames.current.forEach(cancelAnimationFrame);
    paintFrames.current = [requestAnimationFrame(() => {
      paintFrames.current = [requestAnimationFrame(() => {
        if (document.hidden || queue[position.current]?.id !== id || displayed.current.has(id)) return;
        if (Date.parse(current.expiresAt) <= estimatedNow()) { advance(id); return; }
        displayed.current.add(id);
        void acknowledgeMomentView(viewerId, id);
        setPhoto((value) => value.id === id ? { ...value, status: "displayed" } : value);
      })];
    })];
  }, [advance, current, estimatedNow, photo, queue, viewerId]);

  useEffect(() => { if (photo.status === "error") releaseDeparting(); }, [photo.status, releaseDeparting]);

  useEffect(() => {
    if (!departing) return;
    const expiry = setTimeout(releaseDeparting, Math.max(0, Date.parse(departing.expiresAt) - estimatedNow()));
    return () => clearTimeout(expiry);
  }, [departing, estimatedNow, releaseDeparting]);

  useEffect(() => {
    const visible = () => { if (!document.hidden && photo.status === "ready") recordDisplayed(); };
    document.addEventListener("visibilitychange", visible);
    return () => document.removeEventListener("visibilitychange", visible);
  }, [photo.status, recordDisplayed]);

  if (!current) return null;
  const ready = photo.id === current.id && photo.status === "displayed";
  const incomingReady = photo.id === current.id && photo.status === "ready";
  const failed = photo.id === current.id && photo.status === "error";

  const next = () => {
    if ((!ready && !failed) || advancing.current || transitioning.current) return;
    if (ready && index < queue.length - 1) {
      retainedUrl.current = photo.src;
      transitioning.current = true;
      setDeparting({ src: photo.src, expiresAt: current.expiresAt });
    }
    advance(current.id);
  };

  const finishTransition = () => {
    releaseDeparting();
    recordDisplayed();
  };

  return createPortal(
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="moment-viewer-title" className="fixed inset-0 z-[100] flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#05060a] text-white">
      <header className="mx-auto flex w-full max-w-6xl flex-none items-center justify-between px-5 py-4 sm:px-8 sm:py-6">
        <div className="min-w-0"><h2 id="moment-viewer-title" className="font-mono text-[10px] font-normal uppercase text-white/55">Moments</h2><p aria-live="polite" className="mt-1 text-xs text-white/35">{index + 1} / {queue.length}</p></div>
        <button ref={closeButton} type="button" onClick={onClose} aria-label="Tutup Moments" className="grid size-11 flex-none place-items-center text-white/60 hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-brand-400"><X size={20} /></button>
      </header>

      <main className="flex min-h-0 flex-1 items-center justify-center px-3 pb-3 sm:px-8 sm:pb-6">
        <div role="button" tabIndex={ready || failed ? 0 : -1} aria-label={index === queue.length - 1 ? "Selesaikan Moments" : "Lanjut ke Moment berikutnya"} onClick={next} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); next(); } }} className="relative h-full max-h-[min(76dvh,760px)] w-full max-w-5xl cursor-pointer overflow-hidden rounded-2xl bg-neutral-900 outline-none ring-brand-400 focus-visible:ring-1">
          {departing && incomingReady && photo.src ? <MomentMeltTransition currentSrc={departing.src} nextSrc={photo.src} onComplete={finishTransition} /> : null}
          {departing && !(incomingReady && photo.src) ? <img src={departing.src} alt="Momen kelas" draggable={false} className="absolute inset-0 h-full w-full select-none object-cover" /> : null}
          {!departing && photo.id === current.id && photo.src ? <img src={photo.src} alt="Momen kelas" draggable={false} onLoad={recordDisplayed} onError={() => setPhoto((value) => ({ ...value, src: "", status: "error" }))} className="absolute inset-0 h-full w-full select-none object-cover" /> : null}
          {!departing && (!photo.src || photo.id !== current.id) ? <div role="status" className="absolute inset-0 grid place-items-center px-6 text-center text-sm font-light text-white/50"><div>{failed ? <><p>Foto belum dapat dimuat.</p><button type="button" onClick={(event) => { event.stopPropagation(); setAttempt((value) => value + 1); }} className="mt-4 min-h-11 px-4 text-xs text-brand-400 focus-visible:outline focus-visible:outline-1 focus-visible:outline-brand-400">Coba lagi</button></> : "Memuat Moment..."}</div></div> : null}
          {departing && !incomingReady ? <div role="status" className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-black/55 px-3 py-2 text-xs text-white/60 backdrop-blur-sm">Memuat berikutnya...</div> : null}
          <div className="pointer-events-none absolute inset-x-0 bottom-[18px] z-10 flex items-center justify-center gap-2" aria-label={`Moment ${index + 1} dari ${queue.length}`}>
            {queue.map((item, step) => <span key={item.id} aria-hidden="true" className={`h-2 rounded-full transition-[width,background-color] duration-300 ease-out ${step === index ? "w-[22px] bg-white/95" : "w-2 bg-white/35"}`} />)}
          </div>
          <time className="pointer-events-none absolute bottom-4 left-4 z-10 bg-black/35 px-3 py-2 font-mono text-[10px] text-white/65 backdrop-blur-sm" dateTime={current.capturedAt ?? current.createdAt}>{formatMomentTimestamp(current.capturedAt ?? current.createdAt)}</time>
        </div>
      </main>
    </div>,
    document.body,
  );
}
