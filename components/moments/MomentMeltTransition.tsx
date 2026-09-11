"use client";

import { useEffect, useRef, useState } from "react";
import { Mesh, Program, Renderer, Texture, Triangle } from "ogl";
import { gsap } from "gsap";

const VERTEX = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }
`;

const FRAGMENT = `
precision highp float;
uniform sampler2D tCurrent;
uniform sampler2D tNext;
uniform vec2 uResolution;
uniform vec2 uCurrentSize;
uniform vec2 uNextSize;
uniform float uProgress;
uniform float uTime;
varying vec2 vUv;

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float value = 0.0, amplitude = 0.5;
  for (int i = 0; i < 5; i++) { value += amplitude * noise(p); p *= 2.0; amplitude *= 0.5; }
  return value;
}
vec2 coverUV(vec2 uv, vec2 resolution, vec2 imageSize) {
  float viewportRatio = resolution.x / max(resolution.y, 1.0);
  float imageRatio = imageSize.x / max(imageSize.y, 1.0);
  vec2 scale = vec2(1.0);
  float ratio = viewportRatio / max(imageRatio, 0.0001);
  if (ratio > 1.0) scale.y = 1.0 / ratio; else scale.x = ratio;
  return (uv - 0.5) * scale + 0.5;
}
void main() {
  float progress = clamp(uProgress, 0.0, 1.0);
  float envelope = sin(progress * 3.14159265359);
  vec2 uv = vUv;
  uv += vec2(sin(uTime * 0.25 + uv.y * 4.0), cos(uTime * 0.22 + uv.x * 4.0)) * 0.0032;
  float n = fbm(uv * 2.4 + uTime * 0.03);
  float warp = fbm(uv * 4.08 - uTime * 0.02);
  vec2 displacement = (vec2(n, warp) - 0.5) * 0.275;
  vec2 currentUV = coverUV(uv + displacement * progress, uResolution, uCurrentSize);
  vec2 nextUV = coverUV(uv - displacement * (1.0 - progress), uResolution, uNextSize);
  float mask = smoothstep(n - 0.15, n + 0.15, progress);
  float aberration = envelope * 0.0105;
  vec3 currentColor = vec3(texture2D(tCurrent, currentUV + vec2(aberration, 0.0)).r, texture2D(tCurrent, currentUV).g, texture2D(tCurrent, currentUV - vec2(aberration, 0.0)).b);
  vec3 nextColor = vec3(texture2D(tNext, nextUV + vec2(aberration, 0.0)).r, texture2D(tNext, nextUV).g, texture2D(tNext, nextUV - vec2(aberration, 0.0)).b);
  vec3 color = mix(currentColor, nextColor, mask);
  float vignette = smoothstep(1.25, 0.25, length(uv - 0.5));
  color = mix(color, vec3(0.02, 0.024, 0.04), (1.0 - vignette) * 0.28);
  gl_FragColor = vec4(color, 1.0);
}
`;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

export default function MomentMeltTransition({ currentSrc, nextSrc, onComplete }: { currentSrc: string; nextSrc: string; onComplete: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const completeRef = useRef(onComplete);
  const [fallback, setFallback] = useState(false);
  completeRef.current = onComplete;

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let disposed = false;
    let renderer: Renderer | null = null;
    let frame = 0;
    let tween: gsap.core.Tween | null = null;
    let observer: ResizeObserver | null = null;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    const finishFallback = () => {
      if (disposed) return;
      setFallback(true);
      fallbackTimer = setTimeout(() => { if (!disposed) completeRef.current(); }, 260);
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finishFallback();
      return () => { disposed = true; if (fallbackTimer) clearTimeout(fallbackTimer); };
    }

    void Promise.all([loadImage(currentSrc), loadImage(nextSrc)]).then(([current, next]) => {
      if (disposed) return;
      try {
        renderer = new Renderer({ alpha: false, antialias: true, dpr: Math.min(window.devicePixelRatio || 1, 2) });
        const gl = renderer.gl;
        const canvas = gl.canvas as HTMLCanvasElement;
        canvas.className = "pointer-events-none absolute inset-0 h-full w-full";
        container.appendChild(canvas);
        const currentTexture = new Texture(gl, { image: current, generateMipmaps: false });
        const nextTexture = new Texture(gl, { image: next, generateMipmaps: false });
        const program = new Program(gl, { vertex: VERTEX, fragment: FRAGMENT, uniforms: {
          tCurrent: { value: currentTexture }, tNext: { value: nextTexture }, uResolution: { value: [1, 1] },
          uCurrentSize: { value: [current.naturalWidth, current.naturalHeight] }, uNextSize: { value: [next.naturalWidth, next.naturalHeight] },
          uProgress: { value: 0 }, uTime: { value: 0 },
        } });
        const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });
        const resize = () => {
          if (!renderer) return;
          const bounds = container.getBoundingClientRect();
          renderer.setSize(Math.max(bounds.width, 1), Math.max(bounds.height, 1));
          program.uniforms.uResolution.value = [gl.canvas.width, gl.canvas.height];
        };
        observer = new ResizeObserver(resize); observer.observe(container); resize();
        const render = (time: number) => { program.uniforms.uTime.value = time * 0.001; renderer?.render({ scene: mesh }); frame = requestAnimationFrame(render); };
        frame = requestAnimationFrame(render);
        tween = gsap.to(program.uniforms.uProgress, { value: 1, duration: 1.1, ease: "power2.inOut", onComplete: () => { if (!disposed) completeRef.current(); } });
      } catch { finishFallback(); }
    }).catch(finishFallback);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      tween?.kill(); observer?.disconnect();
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (renderer?.gl.canvas.parentNode === container) container.removeChild(renderer.gl.canvas);
      renderer?.gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [currentSrc, nextSrc]);

  return <div ref={host} className="absolute inset-0 overflow-hidden">
    <img src={currentSrc} alt="" aria-hidden="true" draggable={false} className="absolute inset-0 h-full w-full select-none object-cover" />
    <img src={nextSrc} alt="" aria-hidden="true" draggable={false} className={`absolute inset-0 h-full w-full select-none object-cover transition-opacity duration-300 ${fallback ? "opacity-100" : "opacity-0"}`} />
  </div>;
}
