import { useEffect, useMemo, useRef } from "react";
import { clamp01, easeOutCubic } from "../lib/particleField.js";

// How much of the remaining gap the drawn frame closes per animation
// frame — smaller = slower, heavier motion. The scrubbed `progress` prop
// can jump around a lot (fast scroll, a step change resetting it near 0),
// so the canvas doesn't draw `progress` directly; it chases a smoothed
// value toward it every frame instead. That's what makes formation read
// as unhurried, weighted motion rather than snapping instantly to
// wherever the scrollbar happens to be.
const CATCH_UP = 0.06;
const SETTLE_EPSILON = 0.0008;

// Draws off a controlled `progress` (0..1) prop instead of an internal
// clock — the same scroll tick that drives every other journey chapter
// also drives this, so formation scrubs forward and backward with the
// scrollbar exactly like the old video-scrub Hero did — but the actual
// drawn position eases toward that prop over real frames (see CATCH_UP)
// rather than snapping straight to it, so the motion has some weight.
//
// The canvas spans the full viewport (`width`/`height`) rather than a small
// box around the formed shape — particles scatter from anywhere on screen,
// not from a tight cloud hugging the target, which is what actually reads
// as "materializing out of the world" instead of "a sprite fading in."
// `targetBox` places the formed shape's own on-screen rectangle within
// that full canvas; `targetPoints` stay normalized 0..1 within that box.
export default function useParticleField({ canvasRef, targetPoints, progress, width, height, targetBox, particleSize = 1.6 }) {
  const dprRef = useRef(1);
  const progressRef = useRef(progress);
  const particlesRef = useRef([]);
  const drawnRef = useRef(progress);
  const rafRef = useRef(null);
  const kickRef = useRef(null);

  const particles = useMemo(() => {
    if (!targetPoints || !targetPoints.length || !width || !height || !targetBox) return [];
    return targetPoints.map((p) => ({
      tx: targetBox.x + p.x * targetBox.width,
      ty: targetBox.y + p.y * targetBox.height,
      sx: Math.random() * width,
      sy: Math.random() * height,
      color: p.color,
      size: particleSize * (0.75 + Math.random() * 0.6),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetPoints, width, height, targetBox?.x, targetBox?.y, targetBox?.width, targetBox?.height]);

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

  // The animation loop itself: reads progress/particles off refs (not
  // props) so it never needs restarting when either changes — only a
  // canvas/size change re-inits it. It stops scheduling frames once the
  // drawn value has caught up, and a frame is kicked off again whenever
  // progress or particles actually change (the effects below).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !width || !height) return;
    const ctx = canvas.getContext("2d");

    function draw(p) {
      const dpr = dprRef.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const pts = particlesRef.current;
      if (!pts.length) return;
      const t = easeOutCubic(clamp01(p));
      for (const particle of pts) {
        const x = particle.sx + (particle.tx - particle.sx) * t;
        const y = particle.sy + (particle.ty - particle.sy) * t;
        ctx.fillStyle = particle.color;
        ctx.fillRect(x, y, particle.size, particle.size);
      }
    }

    function tick() {
      const target = clamp01(progressRef.current);
      const diff = target - drawnRef.current;
      if (Math.abs(diff) < SETTLE_EPSILON) {
        drawnRef.current = target;
        draw(target);
        rafRef.current = null;
        return;
      }
      drawnRef.current += diff * CATCH_UP;
      draw(drawnRef.current);
      rafRef.current = requestAnimationFrame(tick);
    }

    kickRef.current = () => {
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(tick);
    };
    kickRef.current();

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      kickRef.current = null;
    };
  }, [canvasRef, width, height]);

  useEffect(() => {
    progressRef.current = progress;
    if (kickRef.current) kickRef.current();
  }, [progress]);

  useEffect(() => {
    particlesRef.current = particles;
    if (kickRef.current) kickRef.current();
  }, [particles]);
}
