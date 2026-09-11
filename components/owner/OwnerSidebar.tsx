"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LogOut, Menu, Settings, X } from "lucide-react";
import PixelAvatarButton from "@/components/ui/PixelAvatarButton";
import styles from "./OwnerSidebar.module.css";

type OwnerNavItem = { label: string; target: string; href: string };
type OwnerNavGroup = { title?: string; item?: OwnerNavItem; items?: readonly OwnerNavItem[] };

const NAV_GROUPS: readonly OwnerNavGroup[] = [
  { item: { label: "Overview", target: "owner-overview", href: "/owner" } },
  { title: "Content", items: [
    { label: "Homepage", target: "owner-content-homepage", href: "/owner/content/homepage" },
    { label: "Schedule", target: "owner-content-schedule", href: "/owner/content/schedule" },
    { label: "Members", target: "owner-content-members", href: "/owner/content/members" },
    { label: "Gallery", target: "owner-content-gallery", href: "/owner/content/gallery" },
  ] },
  { title: "Access", items: [
    { label: "Admin Slots", target: "owner-slots", href: "/owner/access/admin-slots" },
    { label: "Temporary Access", target: "owner-temp-keys", href: "/owner/access/temporary" },
    { label: "Sessions", target: "owner-sessions", href: "/owner/access/sessions" },
  ] },
  { item: { label: "Moments", target: "owner-moments", href: "/owner/moments" } },
  { item: { label: "Feedback", target: "owner-feedback", href: "/owner/feedback" } },
  { item: { label: "Activity", target: "owner-activity", href: "/owner/activity" } },
];

const FOOTER_ITEM: OwnerNavItem = { label: "Settings", target: "owner-settings", href: "/owner/settings" };
const ALL_ITEMS = [...NAV_GROUPS.flatMap((group) => group.item ? [group.item] : [...(group.items ?? [])]), FOOTER_ITEM];
function activeTarget(pathname: string) {
  return ALL_ITEMS.find((item) => pathname === item.href || (item.href !== "/owner" && pathname.startsWith(`${item.href}/`)))?.target ?? "owner-overview";
}

export default function OwnerSidebar({ onAvatarTransition }: { onAvatarTransition: (rect: DOMRect, source: HTMLButtonElement) => void }) {
  const pathname = usePathname();
  const [active, setActive] = useState("owner-overview");
  const [hovered, setHovered] = useState<string | null>(null);
  const [hoverRect, setHoverRect] = useState({ top: 0, height: 0 });
  const [open, setOpen] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const panelRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const syncViewport = () => { setDesktop(media.matches); if (media.matches) setOpen(false); };
    syncViewport();
    media.addEventListener("change", syncViewport);
    return () => media.removeEventListener("change", syncViewport);
  }, []);

  useEffect(() => setActive(activeTarget(pathname)), [pathname]);

  useEffect(() => {
    if (!open || desktop) return;
    const content = document.getElementById("owner-main-content");
    const previousInert = content?.inert ?? false;
    const previousAriaHidden = content?.getAttribute("aria-hidden") ?? null;
    const previousOverflow = document.body.style.overflow;
    if (content) { content.inert = true; content.setAttribute("inert", ""); content.setAttribute("aria-hidden", "true"); }
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
      if (event.key !== "Tab") return;
      const controls = panelRef.current?.querySelectorAll<HTMLElement>("a[href], button:not(:disabled)");
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      if (content) {
        content.inert = previousInert;
        if (!previousInert) content.removeAttribute("inert");
        if (previousAriaHidden === null) content.removeAttribute("aria-hidden"); else content.setAttribute("aria-hidden", previousAriaHidden);
      }
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
      if (!window.matchMedia("(min-width: 768px)").matches) toggleRef.current?.focus();
    };
  }, [open, desktop]);

  const updateHover = useCallback((target: string, element: HTMLElement) => {
    const navigation = element.closest("nav");
    if (!navigation) return;
    const itemRect = element.getBoundingClientRect();
    const navigationRect = navigation.getBoundingClientRect();
    setHovered(target);
    setHoverRect({ top: itemRect.top - navigationRect.top + navigation.scrollTop, height: itemRect.height });
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    setLogoutError("");
    try {
      const response = await fetch("/api/owner/logout", { method: "POST" });
      if (!response.ok) throw new Error("Logout failed");
      window.location.href = "/owner/login";
    } catch {
      setLogoutError("Gagal keluar. Coba lagi.");
      setLoggingOut(false);
    }
  }

  let itemIndex = 0;
  const renderItem = (item: OwnerNavItem) => {
    const index = itemIndex++;
    const isActive = active === item.target;
    return (
      <a
        key={item.target}
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        data-active={isActive}
        data-hovered={hovered === item.target}
        data-dimmed={Boolean(hovered && hovered !== item.target)}
        tabIndex={desktop || open ? 0 : -1}
        onMouseEnter={(event) => updateHover(item.target, event.currentTarget)}
        onMouseLeave={() => setHovered(null)}
        onFocus={(event) => updateHover(item.target, event.currentTarget)}
        onBlur={() => setHovered(null)}
        onClick={() => { setActive(item.target); setOpen(false); setHovered(null); }}
        className={styles.item}
      >
        <span aria-hidden="true" className={styles.line} />
        <span aria-hidden="true" className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
        <span className={styles.itemLabel}>{item.label}</span>
      </a>
    );
  };

  return (
    <>
      <header className={styles.mobileBar} data-iris-chrome>
        <button ref={toggleRef} type="button" className={styles.toggle} aria-label="Buka navigasi Owner" title="Buka navigasi Owner" aria-expanded={open} aria-controls="owner-navigation" onClick={() => setOpen(true)} tabIndex={open ? -1 : 0}><Menu size={20} aria-hidden="true" /></button>
        <span className={styles.mobileAvatar} aria-hidden="true">
          <Image src="/images/owner-nazuna.gif" alt="" fill sizes="32px" priority unoptimized />
        </span>
        <span className={styles.profileText}><span className={styles.eyebrow}>Owner</span><span className={styles.title}>Owner Control</span></span>
      </header>
      {open && !desktop ? <div className={styles.backdrop} data-iris-chrome aria-hidden="true" onClick={() => setOpen(false)} /> : null}
      <aside id="owner-navigation" ref={panelRef} className={styles.panel} data-iris-chrome data-open={open} aria-label="Menu Owner" aria-hidden={!desktop && !open} role={open && !desktop ? "dialog" : undefined} aria-modal={open && !desktop ? true : undefined}>
        <div className={styles.header}>
          <div className={styles.profile}>
            <PixelAvatarButton src="/images/owner-nazuna.gif" alt="Owner" className={styles.profileImage} onTransition={onAvatarTransition} aria-label="Tampilkan background penuh" title="Tampilkan background penuh" />
            <span className={styles.profileText}><span className={styles.eyebrow}>Owner</span><span className={styles.title}>Owner Control</span></span>
          </div>
          <button ref={closeRef} type="button" className={styles.close} aria-label="Tutup navigasi Owner" title="Tutup navigasi Owner" onClick={() => setOpen(false)} tabIndex={open ? 0 : -1}><X size={19} aria-hidden="true" /></button>
        </div>
        <nav className={styles.navigation} aria-label="Navigasi Owner" onMouseLeave={() => setHovered(null)}>
          <span aria-hidden="true" className={styles.hoverHighlight} data-visible={Boolean(hovered)} style={{ height: Math.max(0, hoverRect.height - 4), transform: `translateY(${hoverRect.top + 2}px)` }} />
          <ul className={styles.groups}>
            {NAV_GROUPS.map((group) => <li key={group.title ?? group.item?.target} className={group.title ? styles.group : undefined}>{group.item ? renderItem(group.item) : null}{group.items ? <><p className={styles.groupTitle}>{group.title}</p><div>{group.items.map(renderItem)}</div></> : null}</li>)}
          </ul>
        </nav>
        <div className={styles.footer}>
          <a href={FOOTER_ITEM.href} aria-current={active === FOOTER_ITEM.target ? "page" : undefined} className={styles.footerButton} tabIndex={desktop || open ? 0 : -1} onClick={() => setOpen(false)}><Settings size={14} aria-hidden="true" />Settings</a>
          <button type="button" onClick={handleLogout} className={styles.footerButton} disabled={loggingOut} tabIndex={desktop || open ? 0 : -1}><LogOut size={14} aria-hidden="true" />{loggingOut ? "Logging out..." : "Log Out"}</button>
          {logoutError ? <p role="alert" className={styles.error}>{logoutError}</p> : null}
        </div>
      </aside>
    </>
  );
}
