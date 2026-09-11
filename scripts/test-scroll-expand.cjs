const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'components/home/HomepageExperience.tsx'), 'utf8');
const titleSource = fs.readFileSync(path.join(root, 'components/home/HeroShuffleTitle.tsx'), 'utf8');
const page = fs.readFileSync(path.join(root, 'app/page.tsx'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8');

test('unified homepage experience uses one RAF-driven hero image', () => {
  assert.match(source, /frameRef\.current\.style\.clipPath/);
  assert.match(source, /mediaRef\.current\.style\.transform/);
  assert.match(source, /requestAnimationFrame\(tick\)/);
  assert.doesNotMatch(source, /useState/);
  assert.equal((source.match(/<Image\s/g) ?? []).length, 1);
  assert.match(source, /hero-experience relative overflow-x-clip/);
  assert.doesNotMatch(source, /hero-experience relative isolate/);
  assert.match(source, /hero-expand-frame absolute inset-0 overflow-hidden/);
});

test('scroll and resize subscriptions are passive and completely cleaned up', () => {
  assert.match(source, /addEventListener\("scroll", kick, \{ passive: true \}\)/);
  assert.match(source, /removeEventListener\("scroll", kick\)/);
  assert.match(source, /cancelAnimationFrame\(animationFrame\)/);
});

test('homepage uses one experience with the saved image and crop', () => {
  assert.match(page, /<HomepageExperience[\s\S]*?heroImage=\{heroImage\}[\s\S]*?objectFit=\{settings\?\.hero_object_fit\}/);
  assert.doesNotMatch(page, /<ScrollExpand|<HomepageHero/);
  assert.match(source, /<HeroShuffleTitle \/>/);
  assert.match(titleSource, /text: "XI TEKNIK"/);
  assert.match(titleSource, /text: "PEMESINAN 2"/);
  assert.match(titleSource, /aria-label="XI Teknik Pemesinan 2"/);
  assert.match(source, /Precision\. Discipline\. Growth\./);
  assert.match(source, /data-navbar-tone="dark"/);
});

test('About keeps a faint single-image background and splash has a timeout', () => {
  assert.match(source, /blur\(\$\{7 \* visual\.blurOpacity\}px\)/);
  assert.match(source, /veilRef\.current\.style\.opacity = String\(visual\.whiteOpacity\)/);
  assert.match(source, /window\.setTimeout\(finishSplash, 2000\)/);
  assert.match(source, /document\.fonts\?\.ready/);
});

test('splash and opening surround use the charcoal loader treatment', () => {
  assert.ok((source.match(/bg-\[#121212\]/g) ?? []).length >= 2);
  assert.match(source, /Array\.from\(\{ length: 4 \}/);
  assert.match(source, /LOADING<span className="hero-splash-cursor">_<\/span>/);
  assert.doesNotMatch(source, /<p[^>]*>XI TP2<\/p>/);
  assert.match(styles, /@keyframes hero-splash-bar/);
  assert.match(styles, /@keyframes hero-splash-type/);
  assert.match(styles, /@keyframes hero-splash-cursor/);
  assert.match(source, /fixed -inset-\[2px\] z-\[999\]/);
  assert.match(source, /document\.documentElement\.style\.backgroundColor = "#121212"/);
  assert.match(source, /restoreSplashPageColors\(\)/);
});
