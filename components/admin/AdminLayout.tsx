"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, Settings, X } from "lucide-react";
import clsx from "clsx";
import type { Role, TempPermission } from "@/types";
import DashboardAmbientBackground from "@/components/layout/DashboardAmbientBackground";
import irisStyles from "@/components/layout/IrisFocus.module.css";
import PixelAvatarButton from "@/components/ui/PixelAvatarButton";
import styles from "./AdminSidebar.module.css";

type NavItem = {
  href: string;
  label: string;
  permission?: TempPermission;
  adminOnly?: boolean;
};

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

const OVERVIEW_ITEM: NavItem = { href: "/admin", label: "Overview" };
const CONTENT_ITEMS: NavItem[] = [
  { href: "/admin/homepage", label: "Homepage", permission: "homepage" },
  { href: "/admin/jadwal", label: "Schedule", permission: "schedule" },
  { href: "/admin/anggota", label: "Members", permission: "members" },
  { href: "/admin/galeri", label: "Gallery", permission: "gallery" },
  { href: "/admin/moments", label: "Moments", permission: "moments" },
  { href: "/admin/pengumuman", label: "Announcements", permission: "homepage" },
];
const ACCESS_ITEMS: NavItem[] = [
  { href: "/admin/temp-key", label: "Temporary Access", adminOnly: true },
];
const SETTINGS_ITEM: NavItem = { href: "/admin/settings", label: "Settings", permission: "homepage" };

function canSeeNavItem(item: NavItem, role?: Role, permissions?: TempPermission[]) {
  if (item.adminOnly && role !== "admin") return false;
  if (role !== "temp_admin" || !item.permission) return true;
  return Boolean(permissions?.includes(item.permission));
}

function isItemActive(pathname: string, href: string) {
  return pathname === href || (href !== "/admin" && pathname.startsWith(href));
}

export default function AdminLayout({ children, role, permissions }: { children: React.ReactNode; role?: Role; permissions?: TempPermission[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [hoverRect, setHoverRect] = useState({ top: 0, height: 0 });
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [focusMode, setFocusMode] = useState(false);
  const [interfaceCovered, setInterfaceCovered] = useState(false);
  const [floatingAvatar, setFloatingAvatar] = useState<IrisAnchor | null>(null);
  const interfaceRef = useRef<HTMLDivElement>(null);
  const floatingAvatarRef = useRef<HTMLButtonElement>(null);
  const sourceAvatarRef = useRef<HTMLButtonElement | null>(null);
  const focusTimerRef = useRef<number | null>(null);
  const focusFrameRef = useRef<number | null>(null);
  const coverTimerRef = useRef<number | null>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(240);

  const visibleContent = CONTENT_ITEMS.filter((item) => canSeeNavItem(item, role, permissions));
  const visibleAccess = ACCESS_ITEMS.filter((item) => canSeeNavItem(item, role, permissions));
  const settingsVisible = canSeeNavItem(SETTINGS_ITEM, role, permissions);
  const numberedItems = [OVERVIEW_ITEM, ...visibleContent, ...visibleAccess];

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

  useEffect(() => {
    if (!sidebarOpen) return;
    const content = document.getElementById("admin-main-content");
    const previousInert = content?.inert ?? false;
    const previousAriaHidden = content?.getAttribute("aria-hidden") ?? null;
    const previousOverflow = document.body.style.overflow;
    if (content) {
      content.inert = true;
      content.setAttribute("inert", "");
      content.setAttribute("aria-hidden", "true");
    }
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSidebarOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const controls = drawerRef.current?.querySelectorAll<HTMLElement>("a[href], button:not(:disabled)");
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      if (content) {
        content.inert = previousInert;
        if (!previousInert) content.removeAttribute("inert");
        if (previousAriaHidden === null) content.removeAttribute("aria-hidden");
        else content.setAttribute("aria-hidden", previousAriaHidden);
      }
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [sidebarOpen]);

  const updateHover = useCallback((href: string, element: HTMLElement) => {
    const nav = element.closest("nav");
    if (!nav) return;
    const itemRect = element.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();
    setHovered(href);
    setHoverRect({ top: itemRect.top - navRect.top + nav.scrollTop, height: itemRect.height });
  }, []);

  const onResizeStart = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragging.current = true;
    dragStartX.current = event.clientX;
    dragStartWidth.current = sidebarWidth;
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [sidebarWidth]);

  const onResizeMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    setSidebarWidth(Math.min(320, Math.max(208, dragStartWidth.current + event.clientX - dragStartX.current)));
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    setLogoutError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Logout failed");
      router.push("/admin/login");
      router.refresh();
    } catch {
      setLogoutError("Gagal keluar. Coba lagi.");
      setLoggingOut(false);
    }
  }

  const renderItem = (item: NavItem, mobile = false) => {
    const active = isItemActive(pathname, item.href);
    const number = String(numberedItems.findIndex((candidate) => candidate.href === item.href) + 1).padStart(2, "0");
    return (
      <Link
        key={`${mobile ? "mobile" : "desktop"}-${item.href}`}
        href={item.href}
        aria-current={active ? "page" : undefined}
        data-active={active}
        data-hovered={hovered === item.href}
        data-dimmed={Boolean(hovered && hovered !== item.href)}
        className={styles.navItem}
        onMouseEnter={(event) => updateHover(item.href, event.currentTarget)}
        onMouseLeave={() => setHovered(null)}
        onFocus={(event) => updateHover(item.href, event.currentTarget)}
        onBlur={() => setHovered(null)}
        onClick={() => { if (mobile) setSidebarOpen(false); }}
      >
        <span aria-hidden="true" className={styles.marker} />
        <span aria-hidden="true" className={styles.number}>{number}</span>
        <span className={styles.itemLabel}>{item.label}</span>
      </Link>
    );
  };

  const renderNavigation = (mobile = false) => (
    <nav className={styles.navigation} aria-label={mobile ? "Navigasi Admin mobile" : "Navigasi Admin"} onMouseLeave={() => setHovered(null)}>
      <span
        aria-hidden="true"
        className={styles.hoverHighlight}
        data-visible={Boolean(hovered)}
        style={{ height: Math.max(0, hoverRect.height - 4), transform: `translateY(${hoverRect.top + 2}px)` }}
      />

      {renderItem(OVERVIEW_ITEM, mobile)}

      {visibleContent.length > 0 && (
        <section className={styles.group}>
          <p className={styles.groupLabel}>Content</p>
          <div className={styles.groupInner}>{visibleContent.map((item) => renderItem(item, mobile))}</div>
        </section>
      )}

      {visibleAccess.length > 0 && (
        <section className={styles.group}>
          <p className={styles.groupLabel}>Access</p>
          <div className={styles.groupInner}>{visibleAccess.map((item) => renderItem(item, mobile))}</div>
        </section>
      )}
    </nav>
  );

  const renderFooter = (mobile = false) => (
    <div className={styles.footer}>
      {settingsVisible && (
        <Link href={SETTINGS_ITEM.href} onClick={() => { if (mobile) setSidebarOpen(false); }} className={styles.footerButton} aria-current={isItemActive(pathname, SETTINGS_ITEM.href) ? "page" : undefined}>
          <Settings size={14} aria-hidden="true" />
          Settings
        </Link>
      )}
      <button type="button" onClick={handleLogout} disabled={loggingOut} className={styles.footerButton}>
        <LogOut size={14} aria-hidden="true" />
        {loggingOut ? "Logging out..." : "Log Out"}
      </button>
      {logoutError ? <p role="alert" className="px-2 pt-1 text-xs text-rose-700">{logoutError}</p> : null}
    </div>
  );

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
        src="/videos/admin-black-cat-sakura.mp4"
        prominent={pathname === "/admin"}
        clear={focusMode}
        irisCenter={floatingAvatar}
      />

      <div ref={interfaceRef} className={irisStyles.interface} data-focus={focusMode} data-covered={interfaceCovered}>
      <aside className={clsx(styles.desktopSidebar, "hidden md:flex")} style={{ width: sidebarWidth } as CSSProperties}>
        <div className={styles.header}>
          <div className={styles.profile}>
            <PixelAvatarButton src="/images/admin-sleepy-cat.gif" alt="Admin" className={styles.profileImage} onTransition={openFocusMode} aria-label="Tampilkan background penuh" title="Tampilkan background penuh" />
            <span>
              <span className={styles.eyebrow}>{role === "temp_admin" ? "Temporary Admin" : "Permanent Admin"}</span>
              <span className={styles.title}>Admin Control</span>
            </span>
          </div>
        </div>
        {renderNavigation()}
        {renderFooter()}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Ubah lebar sidebar"
          aria-valuemin={208}
          aria-valuemax={320}
          aria-valuenow={sidebarWidth}
          tabIndex={0}
          title="Ubah lebar sidebar"
          className={styles.resizeHandle}
          onPointerDown={onResizeStart}
          onPointerMove={onResizeMove}
          onPointerUp={() => { dragging.current = false; }}
          onPointerCancel={() => { dragging.current = false; }}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") setSidebarWidth((width) => Math.max(208, width - 8));
            if (event.key === "ArrowRight") setSidebarWidth((width) => Math.min(320, width + 8));
          }}
        />
      </aside>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-surface-border bg-white/90 px-4 backdrop-blur-md md:hidden">
          <button type="button" onClick={() => setSidebarOpen(true)} className="grid size-10 place-items-center text-gray-700" aria-label="Buka navigasi Admin" aria-expanded={sidebarOpen}>
            <Menu size={20} aria-hidden="true" />
          </button>
          <span className="relative size-8 shrink-0 overflow-hidden rounded-md border border-gray-900/10" aria-hidden="true">
            <Image src="/images/admin-sleepy-cat.gif" alt="" fill sizes="32px" priority unoptimized className="object-cover" />
          </span>
          <div>
            <p className="font-mono text-[9px] uppercase text-brand-700">{role === "temp_admin" ? "Temporary Admin" : "Permanent Admin"}</p>
            <p className="text-sm font-semibold text-gray-900">Admin Control</p>
          </div>
        </header>

        {sidebarOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <button type="button" className="absolute inset-0 bg-black/45" onClick={() => setSidebarOpen(false)} aria-label="Tutup navigasi Admin" />
            <aside ref={drawerRef} className={styles.drawer} role="dialog" aria-modal="true" aria-label="Navigasi Admin">
              <div className={`${styles.header} flex items-start justify-between gap-3`}>
                <div className={styles.profile}>
                  <PixelAvatarButton src="/images/admin-sleepy-cat.gif" alt="Admin" className={styles.profileImage} onTransition={openFocusMode} aria-label="Tampilkan background penuh" title="Tampilkan background penuh" />
                  <span>
                    <span className={styles.eyebrow}>{role === "temp_admin" ? "Temporary Admin" : "Permanent Admin"}</span>
                    <span className={styles.title}>Admin Control</span>
                  </span>
                </div>
                <button ref={closeRef} type="button" onClick={() => setSidebarOpen(false)} className="grid size-10 place-items-center text-gray-600" aria-label="Tutup navigasi Admin">
                  <X size={19} aria-hidden="true" />
                </button>
              </div>
              {renderNavigation(true)}
              {renderFooter(true)}
            </aside>
          </div>
        )}

        <main id="admin-main-content" className="flex-1 overflow-auto p-4 sm:p-6">
          <div className="mx-auto max-w-4xl">{children}</div>
        </main>
      </div>
      </div>

      {floatingAvatar && (
        <PixelAvatarButton
          ref={floatingAvatarRef}
          src="/images/admin-sleepy-cat.gif"
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
