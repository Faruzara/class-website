const clamp = (value: number) => Math.min(1, Math.max(0, value));

function easeRange(progress: number, start: number, end: number) {
  const value = clamp((progress - start) / (end - start));
  return value * value * (3 - 2 * value);
}

// Follow the real About section entering the viewport, not a tall empty spacer.
// The same positions produce the same image/text on both scroll directions.
export function getHeroStoryFrame(aboutTop: number, scrollDistance: number) {
  const progress = clamp(1 - aboutTop / Math.max(scrollDistance, 1));
  const fog = easeRange(progress, 0.14, 0.94);
  const reveal = easeRange(progress, 0.26, 0.78);
  return {
    progress,
    blurOpacity: fog,
    // Keep the photograph visible behind readable dark text, never a blank screen.
    whiteOpacity: 0.84 * easeRange(progress, 0.20, 0.92),
    titleOpacity: 1 - easeRange(progress, 0.02, 0.50),
    aboutOpacity: reveal,
    aboutY: 22 * (1 - reveal),
    hintOpacity: 1 - easeRange(progress, 0, 0.18),
  };
}
