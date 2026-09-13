import { useEffect, useRef } from "react";

// A small, continuously-drifting dust layer — deliberately not the same
// system as useParticleField (which scatters-then-assembles once and
// holds). This one never "arrives" anywhere; it just gives the Hero's
// mostly-black scene a little ambient life after the product/heading have
// formed, at a restrained count and a slow, near-static drift so it never
// reads as noise or competes with the product for attention.
const DRIFT_SPEED = 12; // px/sec, randomized +/- per particle
const POINTER_RADIUS = 130;
const POINTER_STRENGTH = 20;

function prefersCoarsePointer() {
  return typeof window !== "undefined" && window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
}

// `protectedRect` (in canvas-space px, {x,y,width,height}) dims any
// particle passing behind it — the headline and Nav logo need to stay the
// most legible things on screen, not compete with drifting dust behind them.
export default function useAmbientParticles({
  canvasRef,
  width,
  height,
  count = 48,
  color = "244,243,238",
  baseOpacity = 0.22,
  protectedRect,
  active = true,
}) {
  const particlesRef = useRef([]);
  const pointerRef = useRef({ x: -9999, y: -9999, active: false });
  const dprRef = useRef(1);
  const rafRef = useRef(null);
  const protectedRectRef = useRef(protectedRect);
  protectedRectRef.current = protectedRect;

  useEffect(() => {
    if (!width || !height) return;
    particlesRef.current = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * DRIFT_SPEED,
      vy: (Math.random() - 0.5) * DRIFT_SPEED,
      size: 1 + Math.random() * 1.3,
    }));
  }, [count, width, height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !width || !height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    dprRef.current = dpr;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }, [canvasRef, width, height]);

  // Pointer influence is opt-out for touch: a finger doesn't hover, so
  // there's nothing to "influence nearby particles" with, and leaving a
  // touchmove listener wired up here would just fight page scrolling.
  useEffect(() => {
    if (!active || prefersCoarsePointer()) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    function onMove(e) {
      const r = canvas.getBoundingClientRect();
      pointerRef.current = { x: e.clientX - r.left, y: e.clientY - r.top, active: true };
    }
    function onLeave() {
      pointerRef.current.active = false;
    }
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, [canvasRef, active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !width || !height || !active) return;
    const ctx = canvas.getContext("2d");
    let last = performance.now();

    function tick(now) {
      const dt = Math.min(48, now - last) / 1000;
      last = now;
      const dpr = dprRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const pointer = pointerRef.current;
      const zone = protectedRectRef.current;

      for (const p of particlesRef.current) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x < -8) p.x = width + 8;
        else if (p.x > width + 8) p.x = -8;
        if (p.y < -8) p.y = height + 8;
        else if (p.y > height + 8) p.y = -8;

        let drawX = p.x;
        let drawY = p.y;
        if (pointer.active) {
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const dist = Math.hypot(dx, dy);
          if (dist < POINTER_RADIUS && dist > 0.001) {
            const force = (1 - dist / POINTER_RADIUS) * POINTER_STRENGTH;
            drawX += (dx / dist) * force;
            drawY += (dy / dist) * force;
          }
        }

        let opacity = baseOpacity;
        if (zone && drawX > zone.x && drawX < zone.x + zone.width && drawY > zone.y && drawY < zone.y + zone.height) {
          opacity *= 0.15;
        }

        ctx.fillStyle = `rgba(${color},${opacity})`;
        ctx.fillRect(drawX, drawY, p.size, p.size);
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [canvasRef, width, height, active, baseOpacity, color]);
}
