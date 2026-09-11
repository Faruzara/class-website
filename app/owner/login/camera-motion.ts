export const CAMERA_CYCLE_MS = 12_000;
export const CAMERA_SCALE = 1.025;

// Periodic curves have matching position AND velocity at the loop seam.
// Small secondary movements add camera-like sway without random direction changes.
export function getCameraPose(progress: number) {
  const angle = progress * Math.PI * 2;
  return {
    x: 22 * Math.sin(angle) + 2 * Math.sin(angle * 3),
    y: 11 * Math.cos(angle) + 1.5 * Math.sin(angle * 2),
    rotation: 0.2 * Math.sin(angle + 0.35),
  };
}

export function createCameraKeyframes(): Keyframe[] {
  return Array.from({ length: 121 }, (_, index) => {
    const offset = index / 120;
    const { x, y, rotation } = getCameraPose(index === 120 ? 0 : offset);
    return {
      offset,
      transform: `translate3d(${x.toFixed(4)}px, ${y.toFixed(4)}px, 0) rotate(${rotation.toFixed(4)}deg) scale(${CAMERA_SCALE})`,
    };
  });
}
