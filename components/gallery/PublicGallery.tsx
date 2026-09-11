"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Loader2, RotateCcw, X } from "lucide-react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { GaleriFoto } from "@/types";
import { DraggableContainer, GridBody, GridItem } from "@/components/ui/InfiniteDragGallery";
import styles from "./PublicGallery.module.css";

type LoadState = "loading" | "ready" | "empty" | "error";
const ACCORDION_GALLERY_LIMIT = 5;
const LIGHTBOX_THUMBNAIL_LIMIT = 7;
const GALLERY_PAGE_SIZE = 24;
const SHOW_ACCORDION_GALLERY = true;

function randomInteger(maxExclusive: number) {
  if (maxExclusive <= 1) return 0;
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] % maxExclusive;
}

function shufflePhotos(photos: GaleriFoto[]) {
  const shuffled = [...photos];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = randomInteger(index + 1);
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

function pickUnloadedPage(pageCount: number, loadedPages: Set<number>) {
  const available = Array.from({ length: pageCount }, (_, index) => index).filter((index) => !loadedPages.has(index));
  return available.length ? available[randomInteger(available.length)] : null;
}

export default function PublicGallery() {
  const [photos, setPhotos] = useState<GaleriFoto[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [accordionIndex, setAccordionIndex] = useState(2);
  const [slideDirection, setSlideDirection] = useState<"left" | "right">("right");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [paginationError, setPaginationError] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const touchStartXRef = useRef<number | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<SupabaseClient | null>(null);
  const pageCountRef = useRef(0);
  const loadedPagesRef = useRef(new Set<number>());
  const loadingPageRef = useRef(false);
  const mountedRef = useRef(false);
  const paginationRequestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setLoadState("empty");
      return;
    }

    let active = true;
    mountedRef.current = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 12000);
    const client = createClient(url, key);
    clientRef.current = client;
    loadingPageRef.current = true;
    void (async () => {
      try {
        const countResult = await client.from("galeri").select("id", { count: "exact", head: true }).abortSignal(controller.signal);
        if (countResult.error) throw countResult.error;
        if (!active) return;

        const total = countResult.count ?? 0;
        pageCountRef.current = Math.ceil(total / GALLERY_PAGE_SIZE);
        loadedPagesRef.current = new Set<number>();
        if (total === 0) {
          setLoadState("empty");
          return;
        }

        const firstPage = pickUnloadedPage(pageCountRef.current, loadedPagesRef.current) ?? 0;
        const from = firstPage * GALLERY_PAGE_SIZE;
        const { data, error } = await client.from("galeri").select("*").order("urutan").order("created_at").order("id").range(from, from + GALLERY_PAGE_SIZE - 1).abortSignal(controller.signal);
        if (error) throw error;
        if (!active) return;

        const nextPhotos = shufflePhotos((data ?? []) as GaleriFoto[]);
        loadedPagesRef.current.add(firstPage);
        setPhotos(nextPhotos);
        setHasMore(loadedPagesRef.current.size < pageCountRef.current);
        setLoadState(nextPhotos.length ? "ready" : "empty");
      } catch {
        if (active) setLoadState("error");
      } finally {
        loadingPageRef.current = false;
        window.clearTimeout(timer);
      }
    })();

    return () => {
      active = false;
      mountedRef.current = false;
      clientRef.current = null;
      paginationRequestRef.current?.abort();
      window.clearTimeout(timer);
      controller.abort();
    };
  }, []);

  const loadNextPage = useCallback(async () => {
    const client = clientRef.current;
    if (!client || loadingPageRef.current || !mountedRef.current) return;
    loadingPageRef.current = true;
    setLoadingMore(true);
    setPaginationError(null);
    const controller = new AbortController();
    paginationRequestRef.current = controller;
    const page = pickUnloadedPage(pageCountRef.current, loadedPagesRef.current);
    if (page === null) {
      setHasMore(false);
      setLoadingMore(false);
      loadingPageRef.current = false;
      return;
    }
    const from = page * GALLERY_PAGE_SIZE;

    try {
      const { data, error } = await client.from("galeri").select("*").order("urutan").order("created_at").order("id").range(from, from + GALLERY_PAGE_SIZE - 1).abortSignal(controller.signal);
      if (error) throw error;
      if (!mountedRef.current) return;
      const nextPhotos = shufflePhotos((data ?? []) as GaleriFoto[]);
      loadedPagesRef.current.add(page);
      setPhotos((current) => {
        const known = new Set(current.map((photo) => photo.id));
        return [...current, ...nextPhotos.filter((photo) => !known.has(photo.id))];
      });
      setHasMore(loadedPagesRef.current.size < pageCountRef.current);
    } catch (error) {
      if (!controller.signal.aborted && mountedRef.current) setPaginationError("Foto berikutnya belum dapat dimuat.");
    } finally {
      if (mountedRef.current) setLoadingMore(false);
      if (paginationRequestRef.current === controller) paginationRequestRef.current = null;
      loadingPageRef.current = false;
    }
  }, []);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || loadState !== "ready" || !hasMore || loadingMore || paginationError) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) void loadNextPage();
    }, { rootMargin: "700px 0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadNextPage, loadingMore, loadState, paginationError]);

  useEffect(() => {
    if (loadState !== "ready" || !hasMore || loadingMore || paginationError) return;
    const schedule = window.requestIdleCallback
      ? window.requestIdleCallback(() => void loadNextPage(), { timeout: 1200 })
      : window.setTimeout(() => void loadNextPage(), 300);
    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(schedule);
      else window.clearTimeout(schedule);
    };
  }, [hasMore, loadNextPage, loadingMore, loadState, paginationError, photos.length]);

  const accordionPhotos = useMemo(() => photos.slice(0, ACCORDION_GALLERY_LIMIT), [photos]);
  const lightboxThumbnails = useMemo(
    () => activeIndex === null ? [] : getPhotoWindow(photos, activeIndex, LIGHTBOX_THUMBNAIL_LIMIT),
    [activeIndex, photos],
  );

  const changePhoto = useCallback((step: -1 | 1) => {
    setSlideDirection(step > 0 ? "right" : "left");
    setActiveIndex((current) => {
      if (current === null || photos.length === 0) return current;
      return (current + step + photos.length) % photos.length;
    });
  }, [photos.length]);

  useEffect(() => {
    if (activeIndex === null) return;
    const previousOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveIndex(null);
      if (event.key === "ArrowLeft") changePhoto(-1);
      if (event.key === "ArrowRight") changePhoto(1);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeIndex, changePhoto]);

  useEffect(() => {
    if (photos.length === 0) return;
    setAccordionIndex((current) => Math.min(current, photos.length - 1));
  }, [photos.length]);

  if (loadState === "loading") return <GalleryPlaceholder label="Memuat galeri" />;
  if (loadState === "error") return <p role="alert" className="border-l-2 border-brand-500 py-1 pl-4 text-sm text-gray-500">Galeri belum dapat dimuat.</p>;
  if (loadState === "empty") return <p className="border-l-2 border-brand-500 py-1 pl-4 text-sm text-gray-500">Galeri masih kosong.</p>;

  return (
    <>
      <AnimatedGallery
        photos={photos}
        onOpen={(index) => {
          setSlideDirection("right");
          setActiveIndex(index);
        }}
      />

      {(hasMore || loadingMore || paginationError) && (
        <div ref={loadMoreRef} className="mx-auto flex min-h-24 max-w-7xl items-center justify-center px-5 py-6" aria-live="polite">
          {loadingMore ? <span className="inline-flex items-center gap-2 text-xs text-gray-500"><Loader2 size={15} className="animate-spin motion-reduce:animate-none" /> Memuat foto berikutnya</span> : paginationError ? <button type="button" onClick={() => void loadNextPage()} className="inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-brand-700"><RotateCcw size={15} /> Coba lagi</button> : <span className="h-px w-12 bg-surface-border" aria-hidden="true" />}
        </div>
      )}

      {SHOW_ACCORDION_GALLERY && accordionPhotos.length > 0 && <AccordionGallery
          photos={accordionPhotos}
          activeIndex={accordionIndex}
          onActivate={setAccordionIndex}
          onOpen={(index) => {
            setSlideDirection(index >= (activeIndex ?? index) ? "right" : "left");
            setActiveIndex(index);
          }}
        />}

      {activeIndex !== null && photos[activeIndex] && createPortal(
        <div
          className={styles.lightbox}
          role="dialog"
          aria-modal="true"
          aria-label="Pratinjau foto galeri"
          onClick={() => setActiveIndex(null)}
          onTouchStart={(event: TouchEvent<HTMLDivElement>) => {
            touchStartXRef.current = event.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event: TouchEvent<HTMLDivElement>) => {
            const start = touchStartXRef.current;
            const end = event.changedTouches[0]?.clientX;
            touchStartXRef.current = null;
            if (start === null || end === undefined || Math.abs(end - start) < 48) return;
            changePhoto(end < start ? 1 : -1);
          }}
        >
          <button ref={closeButtonRef} type="button" className={`${styles.lightboxControl} ${styles.closeButton}`} onClick={() => setActiveIndex(null)} aria-label="Tutup pratinjau">
            <X size={20} aria-hidden="true" />
          </button>

          {photos.length > 1 && (
            <button type="button" className={`${styles.lightboxControl} ${styles.previousButton}`} onClick={(event) => { event.stopPropagation(); changePhoto(-1); }} aria-label="Foto sebelumnya">
              <ChevronLeft size={24} aria-hidden="true" />
            </button>
          )}

          <div className={styles.lightboxStack} onClick={(event) => event.stopPropagation()}>
            <div className={styles.lightboxContent}>
              <div key={photos[activeIndex].id} className={styles.lightboxImageFrame} data-direction={slideDirection}>
                <LightboxPhoto photo={photos[activeIndex]} />
              </div>
              <p className={styles.lightboxPagination} aria-live="polite">
                {String(activeIndex + 1).padStart(2, "0")} / {String(photos.length).padStart(2, "0")}
              </p>
            </div>

            <div className={styles.lightboxThumbnails} role="list" aria-label="Pilih foto galeri">
              {lightboxThumbnails.map(({ photo, index }) => (
                <button
                  key={photo.id}
                  type="button"
                  role="listitem"
                  className={styles.lightboxThumbnail}
                  data-active={index === activeIndex}
                  aria-current={index === activeIndex ? "true" : undefined}
                  aria-label={`Lihat ${photo.judul || `foto ${index + 1}`}`}
                  onClick={() => {
                    if (index === activeIndex) return;
                    setSlideDirection(index > activeIndex ? "right" : "left");
                    setActiveIndex(index);
                  }}
                >
                  <GalleryPhoto photo={photo} sizes="160px" />
                </button>
              ))}
            </div>
          </div>

          {photos.length > 1 && (
            <button type="button" className={`${styles.lightboxControl} ${styles.nextButton}`} onClick={(event) => { event.stopPropagation(); changePhoto(1); }} aria-label="Foto berikutnya">
              <ChevronRight size={24} aria-hidden="true" />
            </button>
          )}

        </div>,
        document.body,
      )}
    </>
  );
}

function AnimatedGallery({ photos, onOpen }: { photos: GaleriFoto[]; onOpen: (index: number) => void }) {
  const lastDragEndRef = useRef(0);
  const galleryItems = useMemo(() => {
    const indexed = photos.map((photo, index) => ({ photo, index }));
    const minimumItems = 18;
    return Array.from(
      { length: Math.max(indexed.length, minimumItems) },
      (_, slot) => ({ ...indexed[slot % indexed.length], slot }),
    );
  }, [photos]);

  return (
    <div className={styles.dragGallery}>
      <DraggableContainer
        variant="masonry"
        onDragEnd={() => {
          lastDragEndRef.current = performance.now();
        }}
      >
        <GridBody>
          {galleryItems.map(({ photo, index, slot }) => (
            <GridItem key={`${photo.id}-${slot}`} className={styles.dragPhoto}>
              <button
                type="button"
                className={styles.photoButton}
                onClick={() => {
                  if (performance.now() - lastDragEndRef.current < 220) return;
                  onOpen(index);
                }}
                aria-label={`Lihat ${photo.judul || "foto galeri"}`}
              >
                <GalleryPhoto photo={photo} sizes="(max-width: 767px) 144px, 256px" />
                {(photo.judul || photo.deskripsi) && (
                  <span className={styles.caption}>
                    {photo.judul && <span className={styles.captionTitle}>{photo.judul}</span>}
                    {photo.deskripsi && <span className={styles.captionBody}>{photo.deskripsi}</span>}
                  </span>
                )}
              </button>
            </GridItem>
          ))}
        </GridBody>
      </DraggableContainer>
    </div>
  );
}

function getPhotoWindow(photos: GaleriFoto[], activeIndex: number, limit: number) {
  const windowSize = Math.min(limit, photos.length);
  const idealStart = activeIndex - Math.floor(windowSize / 2);
  const start = Math.min(Math.max(idealStart, 0), Math.max(photos.length - windowSize, 0));
  return photos.slice(start, start + windowSize).map((photo, offset) => ({ photo, index: start + offset }));
}

function AccordionGallery({
  photos,
  activeIndex,
  onActivate,
  onOpen,
}: {
  photos: GaleriFoto[];
  activeIndex: number;
  onActivate: (index: number) => void;
  onOpen: (index: number) => void;
}) {
  return (
    <section className={styles.accordionSection} aria-label="Galeri foto interaktif">
      <div className={styles.accordion} role="list">
        {photos.map((photo, index) => {
          const active = index === activeIndex;
          return (
            <button
              key={photo.id}
              type="button"
              role="listitem"
              className={styles.accordionPanel}
              data-active={active}
              data-side={index < activeIndex ? "before" : "after"}
              aria-current={active ? "true" : undefined}
              aria-label={`${active ? "Buka" : "Pilih"} ${photo.judul || `foto ${index + 1}`}`}
              onMouseEnter={() => {
                if (window.innerWidth >= 640 && window.matchMedia("(hover: hover)").matches) onActivate(index);
              }}
              onFocus={() => {
                if (window.innerWidth >= 640) onActivate(index);
              }}
              onClick={() => {
                if (active) onOpen(index);
                else onActivate(index);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                  event.preventDefault();
                  onActivate((index + 1) % photos.length);
                }
                if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                  event.preventDefault();
                  onActivate((index - 1 + photos.length) % photos.length);
                }
              }}
            >
              <span className={styles.accordionMedia}>
                <GalleryPhoto photo={photo} sizes="(max-width: 639px) 100vw, 52vw" />
              </span>
              <span className={styles.accordionWash} aria-hidden="true" />
              <span className={styles.accordionLabel} aria-hidden="true">
                <span className={styles.accordionBar} />
                <span>{photo.judul || `Memory ${String(index + 1).padStart(2, "0")}`}</span>
              </span>
            </button>
          );
        })}
      </div>
      {photos.length > 1 && (
        <div className={styles.accordionIndicators} aria-label="Pilih foto galeri">
          {photos.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              className={styles.accordionIndicator}
              data-active={index === activeIndex}
              aria-current={index === activeIndex ? "true" : undefined}
              aria-label={`Pilih ${photo.judul || `memory ${index + 1}`}`}
              onClick={() => onActivate(index)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function GalleryPhoto({ photo, sizes, loading = "lazy" }: { photo: GaleriFoto; sizes: string; loading?: "lazy" | "eager" }) {
  const originalSource = photo.foto_url;
  const thumbnailSource = photo.thumbnail_url ?? originalSource;
  const [source, setSource] = useState(thumbnailSource);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSource(thumbnailSource);
    setFailed(false);
  }, [photo.id, thumbnailSource]);

  if (failed) {
    return <span className={styles.imageFallback}>Foto tidak tersedia</span>;
  }

  return (
    <Image
      src={source}
      alt={photo.judul || photo.deskripsi || "Foto galeri XI TP2"}
      fill
      sizes={sizes}
      loading={loading}
      draggable={false}
      className={styles.image}
      onDragStart={(event) => event.preventDefault()}
      onError={() => {
        if (source !== originalSource) setSource(originalSource);
        else setFailed(true);
      }}
    />
  );
}

function LightboxPhoto({ photo }: { photo: GaleriFoto }) {
  const primarySource = photo.foto_url;
  const fallbackSource = photo.thumbnail_url;
  const [source, setSource] = useState(primarySource);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSource(primarySource);
    setFailed(false);
  }, [photo.id, primarySource]);

  if (failed) return <span className={styles.lightboxFallback}>Foto tidak tersedia</span>;

  return (
    <Image
      src={source}
      alt={photo.judul || photo.deskripsi || "Foto galeri XI TP2"}
      fill
      sizes="100vw"
      className={styles.lightboxImage}
      onError={() => {
        if (fallbackSource && source !== fallbackSource) setSource(fallbackSource);
        else setFailed(true);
      }}
    />
  );
}

function GalleryPlaceholder({ label }: { label: string }) {
  return (
    <div className={styles.placeholder} aria-busy="true" aria-label={label}>
      {Array.from({ length: 9 }, (_, index) => <span key={index} />)}
    </div>
  );
}
