"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Loader2, RefreshCw, SwitchCamera, X } from 'lucide-react';
import { cameraErrorMessage, captureMoment, MomentCamera } from '@/lib/moment-camera';
import { readMomentResponse } from '@/lib/moments';
import { formatMomentTimestamp } from '@/lib/moment-time';

type Props = { onClose: () => void; onPublished: () => void };
type CaptureStatus = 'uploading' | 'sent' | 'error';
type CaptureJob = { id: string; capturedAt: string; image: Blob; preview: Blob; previewUrl: string; status: CaptureStatus };
type FlyingPhoto = { id: string; src: string };
const MAX_ACTIVE_UPLOADS = 5;

function FlyingCapture({ photo, source, target, onDone }: { photo: FlyingPhoto; source: DOMRect; target: DOMRect; onDone: (id: string) => void }) {
  const ref = useRef<HTMLImageElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const startX = source.left + source.width / 2 - 30;
    const startY = source.top + source.height / 2 - 40;
    const endX = target.left + target.width / 2 - 30;
    const endY = target.top + target.height / 2 - 40;
    const animation = element.animate([
      { transform: `translate3d(${startX}px, ${startY}px, 0) scale(1.35) rotate(-2deg)`, opacity: 0.94 },
      { transform: `translate3d(${startX + (endX - startX) * 0.62}px, ${startY + (endY - startY) * 0.45}px, 0) scale(.82) rotate(2deg)`, opacity: 1, offset: 0.58 },
      { transform: `translate3d(${endX}px, ${endY}px, 0) scale(.5) rotate(0deg)`, opacity: 0.18 },
    ], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
    animation.onfinish = () => onDone(photo.id);
    return () => animation.cancel();
  }, [onDone, photo.id, source, target]);
  return <img ref={ref} src={photo.src} alt="" aria-hidden="true" className="pointer-events-none fixed left-0 top-0 z-[130] h-20 w-[60px] origin-center rounded-md object-cover shadow-xl" />;
}

export default function MomentCameraDialog({ onClose, onPublished }: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraFrameRef = useRef<HTMLDivElement>(null);
  const trayTargetRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef(new MomentCamera());
  const capturingRef = useRef(false);
  const jobsRef = useRef<CaptureJob[]>([]);
  const uploadsRef = useRef(new Map<string, AbortController>());
  const mountedRef = useRef(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbacks = useRef({ onClose, onPublished });
  callbacks.current = { onClose, onPublished };
  const [deviceId, setDeviceId] = useState<string>();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [ready, setReady] = useState(false);
  const [mirrored, setMirrored] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [jobs, setJobs] = useState<CaptureJob[]>([]);
  const [flying, setFlying] = useState<Array<FlyingPhoto & { source: DOMRect; target: DOMRect }>>([]);
  const [flash, setFlash] = useState(false);
  const [error, setError] = useState('');
  const [liveTime, setLiveTime] = useState<string | null>(null);
  const [captureTime, setCaptureTime] = useState<string | null>(null);

  const syncJobs = (next: CaptureJob[]) => { jobsRef.current = next; setJobs(next); };
  const addJob = (job: CaptureJob) => {
    const next = [job, ...jobsRef.current];
    const removed = next.slice(8);
    removed.forEach((entry) => URL.revokeObjectURL(entry.previewUrl));
    syncJobs(next.slice(0, 8));
  };
  const activeUploads = jobs.filter((job) => job.status === 'uploading').length;
  const canClose = activeUploads === 0 && !capturing;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => { setLiveTime(new Date().toISOString()); timer = setTimeout(tick, 60000 - Date.now() % 60000 + 10); };
    tick();
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      const pending = uploadsRef.current.size > 0 || capturingRef.current;
      if (event.key === 'Escape' && !pending) { event.preventDefault(); callbacks.current.onClose(); }
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]') ?? []);
      const first = controls[0], last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      mountedRef.current = false;
      cameraRef.current.stop();
      uploadsRef.current.forEach((controller) => controller.abort());
      jobsRef.current.forEach((job) => URL.revokeObjectURL(job.previewUrl));
      if (flashTimer.current) clearTimeout(flashTimer.current);
      document.removeEventListener('keydown', keydown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    setReady(false); setError('');
    const camera = cameraRef.current;
    if (!navigator.mediaDevices?.getUserMedia) { setError(cameraErrorMessage(null)); return; }
    async function open() {
      try {
        const stream = await camera.open(navigator.mediaDevices, deviceId);
        if (!stream || disposed) return;
        const video = videoRef.current;
        if (!video) { camera.stop(); return; }
        video.srcObject = stream;
        const track = stream.getVideoTracks()[0];
        setMirrored(track?.getSettings().facingMode === 'user' || /front|facetime|user/i.test(track?.label ?? ''));
        track.onended = () => { if (!disposed) { setReady(false); setError('Kamera terputus. Tutup dan buka kamera kembali.'); } };
        await video.play();
        if (disposed) return;
        const available = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        if (!disposed) setDevices(available.filter((item) => item.kind === 'videoinput'));
      } catch (err) { if (!disposed) { camera.stop(); setReady(false); setError(cameraErrorMessage(err)); } }
    }
    void open();
    return () => { disposed = true; camera.stop(); if (videoRef.current) videoRef.current.srcObject = null; };
  }, [deviceId]);

  function updateJob(id: string, status: CaptureStatus) {
    if (!mountedRef.current) return;
    syncJobs(jobsRef.current.map((job) => job.id === id ? { ...job, status } : job));
  }

  async function upload(job: CaptureJob) {
    const controller = new AbortController();
    uploadsRef.current.set(job.id, controller);
    const timeout = setTimeout(() => controller.abort(), 120000);
    try {
      const form = new FormData();
      form.set('id', job.id); form.set('captured_at', job.capturedAt);
      form.set('image', job.image, 'moment.jpg'); form.set('preview', job.preview, 'preview.jpg');
      const response = await fetch('/api/admin/moments', { method: 'POST', body: form, signal: controller.signal });
      await readMomentResponse<{ id: string }>(response);
      updateJob(job.id, 'sent');
      callbacks.current.onPublished();
    } catch {
      if (mountedRef.current && !controller.signal.aborted) updateJob(job.id, 'error');
    } finally {
      clearTimeout(timeout); uploadsRef.current.delete(job.id);
      if (mountedRef.current) setJobs([...jobsRef.current]);
    }
  }

  function retry(job: CaptureJob) {
    if (uploadsRef.current.size >= MAX_ACTIVE_UPLOADS || job.status !== 'error') return;
    updateJob(job.id, 'uploading'); void upload({ ...job, status: 'uploading' });
  }

  function switchCamera() {
    if (capturingRef.current || !ready || devices.length < 2) return;
    const current = cameraRef.current.stream?.getVideoTracks()[0]?.getSettings().deviceId;
    const index = devices.findIndex((device) => device.deviceId === current);
    setReady(false); setDeviceId(devices[(index + 1) % devices.length].deviceId);
  }

  async function shutter() {
    if (capturingRef.current || !ready || !videoRef.current || uploadsRef.current.size >= MAX_ACTIVE_UPLOADS) return;
    capturingRef.current = true; setCapturing(true); setError('');
    const takenAt = new Date().toISOString(); setCaptureTime(takenAt); setFlash(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(false), 100);
    try {
      const captured = await captureMoment(videoRef.current);
      if (!mountedRef.current) return;
      const job: CaptureJob = { id: crypto.randomUUID(), capturedAt: takenAt, image: captured.image, preview: captured.preview, previewUrl: URL.createObjectURL(captured.preview), status: 'uploading' };
      addJob(job);
      const source = cameraFrameRef.current?.getBoundingClientRect();
      const target = trayTargetRef.current?.getBoundingClientRect();
      if (source && target && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) setFlying((current) => [...current, { id: job.id, src: job.previewUrl, source, target }]);
      void upload(job);
    } catch { if (mountedRef.current) setError('Foto gagal dibuat. Pastikan kamera tetap aktif lalu coba lagi.'); }
    finally { capturingRef.current = false; if (mountedRef.current) setCapturing(false); }
  }

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-neutral-950 text-white">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={activeUploads > 0} tabIndex={-1} className="relative flex h-full min-h-0 w-full flex-col overflow-hidden outline-none">
        <header className="relative z-20 flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-4 sm:h-[72px] sm:px-7">
          <div><h2 id={titleId} className="font-mono text-[10px] tracking-[0.22em] text-white/80">MOMENT CAMERA</h2><p className="mt-1 text-[11px] text-white/45">Foto langsung · tanpa galeri</p></div>
          <button type="button" onClick={onClose} disabled={!canClose} title={!canClose ? 'Tunggu unggahan selesai' : 'Tutup kamera'} aria-label="Tutup kamera" className="flex h-11 w-11 items-center justify-center text-white/70 hover:text-white disabled:cursor-wait disabled:opacity-30"><X size={20} /></button>
        </header>
        <div className="relative flex min-h-0 flex-1 items-center justify-center px-3 pb-32 pt-4 sm:px-24 sm:pb-28 sm:pt-6">
          <div ref={cameraFrameRef} className="relative aspect-[4/5] w-[min(72vw,22rem)] -translate-x-4 max-h-[calc(100dvh-13rem)] overflow-hidden rounded-2xl border border-white/10 bg-neutral-900 shadow-2xl sm:aspect-[3/4] sm:h-full sm:w-auto sm:max-w-[min(72vw,32rem)] sm:translate-x-0">
              <video ref={videoRef} autoPlay playsInline muted aria-label="Preview kamera langsung" onLoadedData={() => setReady(!!cameraRef.current.stream && !!videoRef.current?.videoWidth)} className={`absolute inset-0 h-full w-full object-cover ${mirrored ? '-scale-x-100' : ''}`} />
              {!ready && !error && <span className="absolute inset-0 flex items-center justify-center text-white/60"><Loader2 size={22} className="animate-spin motion-reduce:animate-none" aria-label="Membuka kamera" /></span>}
              <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/45 to-transparent px-4 pb-10 pt-4 font-mono text-[9px] text-white/70"><span className="flex items-center gap-2"><i className={`h-1.5 w-1.5 rounded-full ${ready ? 'bg-brand-500' : 'bg-white/30'}`} />{ready ? 'LIVE' : 'STANDBY'}</span><span>CAM 01</span></span>
              <time aria-hidden="true" className="pointer-events-none absolute bottom-4 left-4 bg-black/35 px-2.5 py-1.5 font-mono text-[9px] text-white/70 backdrop-blur-sm" dateTime={captureTime ?? liveTime ?? undefined}>{formatMomentTimestamp(captureTime ?? liveTime)}</time>
              {flash && <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-white" />}
          </div>
          <aside className="absolute right-3 top-4 z-20 w-14 sm:right-6 sm:top-6 sm:w-[72px]" aria-label="Foto terbaru">
            <div ref={trayTargetRef} className="aspect-[3/4] rounded-md border border-dashed border-white/30 bg-white/5" />
            <div className="absolute inset-x-0 top-0 flex flex-col gap-2">
              {jobs.slice(0, 3).map((job) => <div key={job.id} className="group relative aspect-[3/4] overflow-hidden rounded-md border border-white/20 bg-neutral-900 shadow-lg">
                <img src={job.previewUrl} alt="Foto Moment terbaru" className="h-full w-full object-cover" />
                <span className={`absolute inset-x-0 bottom-0 flex h-5 items-center justify-center bg-black/55 ${job.status === 'error' ? 'text-red-300' : 'text-white'}`}>
                  {job.status === 'uploading' ? <Loader2 size={11} className="animate-spin motion-reduce:animate-none" aria-label="Mengirim" /> : job.status === 'sent' ? <Check size={12} aria-label="Terkirim" /> : <button type="button" onClick={() => retry(job)} aria-label="Kirim ulang foto" className="flex h-full w-full items-center justify-center hover:bg-white/10"><RefreshCw size={11} /></button>}
                </span>
              </div>)}
            </div>
            {jobs.length > 3 && <p className="mt-2 text-center font-mono text-[9px] text-white/45">+{jobs.length - 3}</p>}
          </aside>
        </div>
        <div className="absolute inset-x-0 bottom-0 z-20 border-t border-white/10 bg-neutral-950/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mx-auto grid max-w-sm grid-cols-[1fr_80px_1fr] items-center">
            <div className="min-w-0 pr-3 text-right" aria-live="polite">{error ? <p role="alert" className="text-[11px] leading-4 text-red-300">{error}</p> : <p className="font-mono text-[9px] uppercase text-white/45">{activeUploads ? `${activeUploads} sending` : jobs.some((job) => job.status === 'sent') ? 'Ready for more' : 'Camera ready'}</p>}</div>
            <button type="button" onClick={shutter} disabled={!ready || capturing || activeUploads >= MAX_ACTIVE_UPLOADS} aria-label="Ambil dan kirim Moment" className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 border-white/75 p-1.5 disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-500"><span className={`h-full w-full rounded-full bg-white transition-transform ${capturing ? 'scale-90' : 'active:scale-90'}`} /></button>
            <div className="pl-3">{devices.length > 1 && <button type="button" onClick={switchCamera} disabled={capturing || !ready} title="Ganti kamera" aria-label="Ganti kamera" className="flex h-11 w-11 items-center justify-center text-white/60 hover:text-white disabled:opacity-30"><SwitchCamera size={19} /></button>}</div>
          </div>
          <p className="mt-1 text-center text-[10px] text-white/35">Tetap di kamera setelah memotret · maksimal {MAX_ACTIVE_UPLOADS} unggahan bersamaan</p>
        </div>
      </div>
      {flying.map((photo) => <FlyingCapture key={photo.id} photo={photo} source={photo.source} target={photo.target} onDone={(id) => setFlying((current) => current.filter((item) => item.id !== id))} />)}
    </div>, document.body,
  );
}
