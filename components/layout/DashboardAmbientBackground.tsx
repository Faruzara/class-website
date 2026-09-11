"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import clsx from "clsx";
import { CAMERA_CYCLE_MS, createCameraKeyframes } from "@/app/owner/login/camera-motion";
import styles from "./DashboardAmbientBackground.module.css";

type Props = {
  src: string;
  poster?: string;
  prominent?: boolean;
  objectPosition?: string;
  clear?: boolean;
  irisCenter?: { x: number; y: number } | null;
};

export default function DashboardAmbientBackground({ src, poster, prominent = false, objectPosition = "center", clear = false, irisCenter }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const revealVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let cameraAnimations: Animation[] = [];

    const ensureCameraAnimations = () => {
      if (cameraAnimations.length) return;
      const sharedStartTime = document.timeline.currentTime;
      cameraAnimations = [videoRef.current, revealVideoRef.current].flatMap((video) => {
        if (!video || typeof video.animate !== "function") return [];
        const animation = video.animate(createCameraKeyframes(), {
          duration: CAMERA_CYCLE_MS,
          iterations: Infinity,
          easing: "linear",
        });
        if (sharedStartTime !== null) animation.startTime = sharedStartTime;
        return [animation];
      });
    };

    const syncPlayback = () => {
      const videos = [videoRef.current, revealVideoRef.current];
      if (reducedMotion.matches) {
        videos.forEach((video) => video?.pause());
        cameraAnimations.forEach((animation) => animation.cancel());
        cameraAnimations = [];
        return;
      }

      ensureCameraAnimations();
      if (document.hidden) {
        videos.forEach((video) => video?.pause());
        cameraAnimations.forEach((animation) => animation.pause());
        return;
      }

      cameraAnimations.forEach((animation) => animation.play());
      videos.forEach((video) => {
        if (!video) return;
        void video.play().catch(() => {});
      });
    };

    syncPlayback();
    reducedMotion.addEventListener("change", syncPlayback);
    document.addEventListener("visibilitychange", syncPlayback);
    return () => {
      videoRef.current?.pause();
      revealVideoRef.current?.pause();
      cameraAnimations.forEach((animation) => animation.cancel());
      reducedMotion.removeEventListener("change", syncPlayback);
      document.removeEventListener("visibilitychange", syncPlayback);
    };
  }, []);

  return (
    <>
      <div
        aria-hidden="true"
        className={clsx(styles.background, prominent && styles.prominent)}
        data-clear={clear}
        style={{
          "--iris-x": `${irisCenter?.x ?? 0}px`,
          "--iris-y": `${irisCenter?.y ?? 0}px`,
        } as CSSProperties}
      >
        <video ref={videoRef} src={src} poster={poster} autoPlay muted loop playsInline preload="metadata" tabIndex={-1} className={styles.video} style={{ objectPosition }} />
        <div className={styles.wash} />
      </div>
      <div
        aria-hidden="true"
        className={styles.reveal}
        data-clear={clear}
        style={{
          "--iris-x": `${irisCenter?.x ?? 0}px`,
          "--iris-y": `${irisCenter?.y ?? 0}px`,
        } as CSSProperties}
      >
        <video ref={revealVideoRef} src={src} poster={poster} autoPlay muted loop playsInline preload="metadata" tabIndex={-1} className={styles.video} style={{ objectPosition }} />
      </div>
    </>
  );
}
