"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import styles from "../../owner/login/OwnerLogin.module.css";
import { CAMERA_CYCLE_MS, createCameraKeyframes } from "../../owner/login/camera-motion";

export default function AdminLoginPage() {
  const router       = useRouter();

  const [key, setKey]           = useState("");
  const [showKey, setShowKey]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const backgroundRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const background = backgroundRef.current;
    if (!video || !background) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let cameraAnimation: Animation | null = null;
    const syncPlayback = () => {
      if (reducedMotion.matches) {
        video.pause();
        cameraAnimation?.cancel();
        cameraAnimation = null;
      } else if (document.hidden) {
        video.pause();
        cameraAnimation?.pause();
      } else {
        if (!cameraAnimation && typeof background.animate === "function") {
          cameraAnimation = background.animate(createCameraKeyframes(), {
            duration: CAMERA_CYCLE_MS,
            iterations: Infinity,
            easing: "linear",
          });
        }
        cameraAnimation?.play();
        void video.play().catch(() => {});
      }
    };

    syncPlayback();
    reducedMotion.addEventListener("change", syncPlayback);
    document.addEventListener("visibilitychange", syncPlayback);
    return () => {
      video.pause();
      cameraAnimation?.cancel();
      reducedMotion.removeEventListener("change", syncPlayback);
      document.removeEventListener("visibilitychange", syncPlayback);
    };
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("expired") === "1") {
      setError("Sesi temp key kamu sudah expired.");
    }
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!key.trim()) {
      setError("Masukkan key terlebih dahulu.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/login", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ key: key.trim() }),
        });

        const data = await res.json().catch(() => null);

        if (res.ok && data?.success) {
          router.push("/admin");
          router.refresh();
        } else {
          setError(res.status === 429 ? "Terlalu banyak percobaan. Coba lagi dalam beberapa menit." : res.status >= 500 ? "Layanan login sedang bermasalah." : data?.error ?? "Key tidak valid.");
          setKey("");
          window.setTimeout(() => inputRef.current?.focus(), 0);
        }
      } catch {
        setError("Terjadi kesalahan. Coba lagi.");
      }
    });
  }

  return (
    <div className="relative isolate min-h-[100svh] bg-neutral-950 flex items-center justify-center p-4">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div ref={backgroundRef} className={`absolute ${styles.drift}`}>
          <video
            ref={videoRef}
            src="/videos/admin-black-cat-sakura.mp4"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            tabIndex={-1}
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
        </div>
        <div className="absolute inset-0 bg-neutral-950/25" />
      </div>

      <div className="w-full max-w-xs">
        <div className="text-center mb-8">
          <div className="h-[104px] w-[104px] overflow-hidden rounded-[20px] border border-white/25 bg-white/10 mx-auto mb-4">
            <Image
              src="/images/admin-sleepy-cat.gif"
              alt="Admin"
              width={104}
              height={104}
              priority
              unoptimized
              className="block h-full w-full object-cover object-center"
            />
          </div>
          <h1 className="font-display font-bold text-xl text-white drop-shadow-sm">Admin Access</h1>
        </div>

        <form onSubmit={handleLogin} className={`${styles.loginCard} flex flex-col gap-4`}>
          <div className="relative">
            <input
              ref={inputRef}
              type={showKey ? "text" : "password"}
              data-custom-password-toggle
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Admin key"
              aria-label="Admin key"
              className="w-full rounded-xl border border-white/20 bg-neutral-950/25 px-4 py-3 pr-10 font-mono text-white placeholder:text-white/60 transition-colors duration-200 focus:outline-none focus:border-white/60 focus:ring-2 focus:ring-white/35 disabled:opacity-60"
              autoComplete="off"
              maxLength={256}
              spellCheck={false}
              disabled={isPending}
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              aria-label={showKey ? "Sembunyikan key" : "Tampilkan key"}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded text-white/70 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && (
            <p className="text-rose-200 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            className="flex items-center justify-center gap-2 rounded-xl border border-white/70 bg-white px-5 py-2.5 font-semibold text-neutral-900 transition-colors duration-200 hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending || !key.trim()}
          >
            {isPending ? (
              <><Loader2 size={16} className="animate-spin" /> Memverifikasi...</>
            ) : (
              "Masuk"
            )}
          </button>
        </form>

        <p className="text-center mt-4">
          <a href="/" className="text-xs text-white/70 transition-colors hover:text-white">
            Kembali ke beranda
          </a>
        </p>
      </div>
    </div>
  );
}
