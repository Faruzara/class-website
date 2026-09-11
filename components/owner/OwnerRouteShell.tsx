"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import DashboardAmbientBackground from "@/components/layout/DashboardAmbientBackground";
import irisStyles from "@/components/layout/IrisFocus.module.css";
import PixelAvatarButton from "@/components/ui/PixelAvatarButton";
import OwnerSidebar from "@/components/owner/OwnerSidebar";

type IrisAnchor = {
  left: number;
  top: number;
  width: number;
  height: number;
  x: number;
  y: number;
};

const IRIS_DURATION_MS = 720;
const IRIS_OPEN_DURATION_MS = 1050;

export default function OwnerRouteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [focusMode, setFocusMode] = useState(false);
  const [interfaceCovered, setInterfaceCovered] = useState(false);
  const [floatingAvatar, setFloatingAvatar] = useState<IrisAnchor | null>(null);
  const interfaceRef = useRef<HTMLDivElement>(null);
  const floatingAvatarRef = useRef<HTMLButtonElement>(null);
  const sourceAvatarRef = useRef<HTMLButtonElement | null>(null);
  const focusTimerRef = useRef<number | null>(null);
  const focusFrameRef = useRef<number | null>(null);
  const coverTimerRef = useRef<number | null>(null);

  const closeFocusMode = useCallback(() => {
    setInterfaceCovered(false);
    setFocusMode(false);
    if (focusTimerRef.current !== null) window.clearTimeout(focusTimerRef.current);
    focusTimerRef.current = window.setTimeout(() => {
      setFloatingAvatar(null);
      window.requestAnimationFrame(() => sourceAvatarRef.current?.focus());
      focusTimerRef.current = null;
    }, IRIS_DURATION_MS);
  }, []);

  const openFocusMode = useCallback((rect: DOMRect, source: HTMLButtonElement) => {
    sourceAvatarRef.current = source;
    if (focusTimerRef.current !== null) window.clearTimeout(focusTimerRef.current);
    if (focusFrameRef.current !== null) window.cancelAnimationFrame(focusFrameRef.current);
    if (coverTimerRef.current !== null) window.clearTimeout(coverTimerRef.current);
    setInterfaceCovered(false);
    setFloatingAvatar({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
    setFocusMode(false);
    focusFrameRef.current = window.requestAnimationFrame(() => {
      setFocusMode(true);
      coverTimerRef.current = window.setTimeout(() => {
        setInterfaceCovered(true);
        coverTimerRef.current = null;
      }, IRIS_OPEN_DURATION_MS);
      focusFrameRef.current = null;
    });
  }, []);

  useEffect(() => () => {
    if (focusTimerRef.current !== null) window.clearTimeout(focusTimerRef.current);
    if (focusFrameRef.current !== null) window.cancelAnimationFrame(focusFrameRef.current);
    if (coverTimerRef.current !== null) window.clearTimeout(coverTimerRef.current);
  }, []);

  useEffect(() => {
    if (!floatingAvatar) return;
    const interfaceElement = interfaceRef.current;
    if (!interfaceElement) return;
    const previousInert = interfaceElement.inert;
    const previousAriaHidden = interfaceElement.getAttribute("aria-hidden");
    const previousOverflow = document.body.style.overflow;
    interfaceElement.inert = true;
    interfaceElement.setAttribute("inert", "");
    interfaceElement.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "hidden";
    floatingAvatarRef.current?.focus();

    const onFocusKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        event.preventDefault();
        floatingAvatarRef.current?.focus();
      } else if (event.key === "Escape" && focusMode) {
        event.preventDefault();
        closeFocusMode();
      }
    };
    document.addEventListener("keydown", onFocusKeyDown);
    return () => {
      interfaceElement.inert = previousInert;
      if (!previousInert) interfaceElement.removeAttribute("inert");
      if (previousAriaHidden === null) interfaceElement.removeAttribute("aria-hidden");
      else interfaceElement.setAttribute("aria-hidden", previousAriaHidden);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onFocusKeyDown);
    };
  }, [floatingAvatar, focusMode, closeFocusMode]);

  if (pathname === "/owner/login") return children;

  return (
    <div
      className="relative isolate min-h-screen"
      style={{
        "--iris-x": `${floatingAvatar?.x ?? 0}px`,
        "--iris-y": `${floatingAvatar?.y ?? 0}px`,
        "--iris-duration": `${focusMode ? IRIS_OPEN_DURATION_MS : IRIS_DURATION_MS}ms`,
      } as CSSProperties}
    >
      <DashboardAmbientBackground
        src="/videos/owner-nazuna-loop.mp4"
        poster="/images/owner-nazuna-background.png"
        prominent={pathname === "/owner"}
        objectPosition="68% center"
        clear={focusMode}
        irisCenter={floatingAvatar}
      />

      <div ref={interfaceRef} className={irisStyles.interface} data-focus={focusMode} data-covered={interfaceCovered}>
        <OwnerSidebar onAvatarTransition={openFocusMode} />
        <div id="owner-main-content" className="relative z-10 mx-auto min-w-0 max-w-6xl flex-1 px-4 pb-12 pt-20 md:ml-[15rem] md:px-8 md:pt-10 lg:px-10">
          {children}
        </div>
      </div>

      {floatingAvatar && (
        <PixelAvatarButton
          ref={floatingAvatarRef}
          src="/images/owner-nazuna.gif"
          className={irisStyles.focusAvatar}
          aria-label={focusMode ? "Tampilkan kembali dashboard" : "Tampilkan background penuh"}
          title={focusMode ? "Tampilkan kembali dashboard" : "Tampilkan background penuh"}
          onTransition={() => {
            if (focusMode) closeFocusMode();
            else {
              if (focusTimerRef.current !== null) window.clearTimeout(focusTimerRef.current);
              setFocusMode(true);
            }
          }}
          style={{
            left: floatingAvatar.left,
            top: floatingAvatar.top,
            width: floatingAvatar.width,
            height: floatingAvatar.height,
          }}
        />
      )}
    </div>
  );
}
