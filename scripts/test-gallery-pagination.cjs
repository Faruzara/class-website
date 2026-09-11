const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "components", "gallery", "PublicGallery.tsx"), "utf8");
const styles = fs.readFileSync(path.join(__dirname, "..", "components", "gallery", "PublicGallery.module.css"), "utf8");
const dragGallery = fs.readFileSync(path.join(__dirname, "..", "components", "ui", "InfiniteDragGallery.tsx"), "utf8");

test("Gallery fetches randomized batches instead of every row at once", () => {
  assert.match(source, /const GALLERY_PAGE_SIZE = 24/);
  assert.match(source, /select\("id", \{ count: "exact", head: true \}\)/);
  assert.match(source, /pickUnloadedPage\(pageCountRef\.current/);
  assert.match(source, /shufflePhotos/);
  assert.match(source, /range\(from, from \+ GALLERY_PAGE_SIZE - 1\)/);
});

test("Infinite loading prevents duplicate requests and duplicate photos", () => {
  assert.match(source, /loadingPageRef\.current/);
  assert.match(source, /new IntersectionObserver/);
  assert.match(source, /rootMargin: "700px 0px"/);
  assert.match(source, /window\.requestIdleCallback/);
  assert.match(source, /const known = new Set\(current\.map\(\(photo\) => photo\.id\)\)/);
});

test("Second gallery is enabled immediately from the randomized first batch", () => {
  assert.match(source, /const SHOW_ACCORDION_GALLERY = true/);
  assert.match(source, /SHOW_ACCORDION_GALLERY && accordionPhotos\.length > 0 && <AccordionGallery/);
  assert.match(source, /paginationError/);
  assert.match(source, /onClick=\{\(\) => void loadNextPage\(\)\}/);
});

test("Gallery uses the draggable masonry while preserving the lightbox action", () => {
  assert.match(source, /<AnimatedGallery\s+photos=\{photos\}/);
  assert.match(source, /<DraggableContainer/);
  assert.match(source, /variant="masonry"/);
  assert.match(source, /<GridBody>/);
  assert.match(source, /<GridItem/);
  assert.match(source, /onOpen\(index\)/);
  assert.match(source, /lastDragEndRef/);
});

test("Upcoming photos remain lightweight without duplicating the gallery", () => {
  assert.match(source, /loading = "lazy"/);
  assert.match(source, /loading=\{loading\}/);
  assert.match(source, /const GALLERY_PAGE_SIZE = 24/);
  assert.doesNotMatch(source, /loading="eager"/);
});

test("Gallery uses responsive rounded draggable tiles", () => {
  assert.match(styles, /\.dragGallery \{/);
  assert.match(styles, /radial-gradient\(ellipse 72% 58% at 78% 16%/);
  assert.match(styles, /\.dragPhoto \{/);
  assert.match(styles, /border-radius: 8px/);
  assert.match(styles, /@media \(min-width: 768px\)[\s\S]*width: 256px;[\s\S]*height: 384px/);
});

test("Gallery content no longer depends on the old sticky scene", () => {
  assert.doesNotMatch(source, /gsap/);
  assert.doesNotMatch(source, /ScrollTrigger/);
  assert.doesNotMatch(source, /distributePhotos/);
  assert.doesNotMatch(styles, /\.scene|\.stickyStage/);
});

test("Drag gestures win over native image dragging", () => {
  assert.match(source, /draggable=\{false\}/);
  assert.match(source, /onDragStart=\{\(event\) => event\.preventDefault\(\)\}/);
  assert.match(styles, /\.image \{[\s\S]*pointer-events: none/);
});

test("Wheel movement is scoped and mobile has explicit gallery exits", () => {
  assert.match(dragGallery, /viewport\.addEventListener\("wheel", handleWheel, \{ passive: false \}\)/);
  assert.match(dragGallery, /event\.preventDefault\(\)/);
  assert.match(dragGallery, /wheelAnimationRef\.current\?\.stop\(\)/);
  assert.match(dragGallery, /aria-label="Keluar ke bagian atas galeri"/);
  assert.match(dragGallery, /aria-label="Keluar ke bagian bawah galeri"/);
});
