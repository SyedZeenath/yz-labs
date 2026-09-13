import { useEffect, useMemo, useRef } from "react";
import { clamp01, easeOutCubic } from "../lib/particleField.js";

// How much of the remaining gap the drawn frame closes per animation
// frame — smaller = slower, heavier motion. The scrubbed `progress` prop
// can jump around a lot (fast scroll, a step change resetting it near 0),
// so the canvas doesn't draw `progress` directly; it chases a smoothed
// value toward it every frame instead. That's what makes formation read
// as unhurried, weighted motion rather than snapping instantly to
// wherever the scrollbar happens to be. This is the default for every
// chapter; pass a smaller `catchUp` prop to slow one call down further
// (e.g. Hero's load-triggered reveal, which isn't scroll-paced at all).
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
export default function useParticleField({ canvasRef, targetPoints, progress, width, height, targetBox, particleSize = 1.6, catchUp = CATCH_UP, onSettle }) {
  const dprRef = useRef(1);
  const catchUpRef = useRef(catchUp);
  catchUpRef.current = catchUp;
  // Stored in a ref, not a dependency of the loop effect below — callers
  // that pass an inline arrow function (a new reference every render)
  // would otherwise restart the whole rAF loop on every render. Every
  // existing caller simply omits this, so it's a no-op for them.
  const onSettleRef = useRef(onSettle);
  onSettleRef.current = onSettle;
  const progressRef = useRef(progress);
  const particlesRef = useRef([]);
  const drawnRef = useRef(progress);
  const rafRef = useRef(null);
  const kickRef = useRef(null);

  // Split from the target-position calculation below on purpose: this is
  // the particle set's actual *identity* (which points, their scatter
  // origin, color, size) — it should only be rebuilt when `targetPoints`
  // itself points to a genuinely new shape to form (a new step icon, a
  // newly-loaded product photo), never merely because the viewport
  // resized. `width`/`height` still gate whether there's a canvas to
  // scatter across at all, but a *value* change in them (a mobile
  // browser's address bar hiding/showing mid-scroll, a window resize)
  // must not regenerate scatter origins or restart formation — see the
  // drawnRef reset below, which is deliberately keyed on this same,
  // narrower dependency for that reason.
  const baseParticles = useMemo(() => {
    if (!targetPoints || !targetPoints.length || !width || !height) return [];
    return targetPoints.map((p) => ({
      nx: p.x,
      ny: p.y,
      sx: Math.random() * width,
      sy: Math.random() * height,
      color: p.color,
      size: particleSize * (0.75 + Math.random() * 0.6),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetPoints]);

  // The on-screen target position for each particle — recomputed whenever
  // the target box actually moves or resizes, so a formation in progress
  // still tracks a live-changing layout correctly, but (unlike
  // `baseParticles` above) recomputing this never resets `drawnRef`: it's
  // the same shape, just relocated, not a new one to scatter and reform.
  const particles = useMemo(() => {
    if (!targetBox) return [];
    return baseParticles.map((p) => ({
      ...p,
      tx: targetBox.x + p.nx * targetBox.width,
      ty: targetBox.y + p.ny * targetBox.height,
    }));
  }, [baseParticles, targetBox?.x, targetBox?.y, targetBox?.width, targetBox?.height]);

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
        // Fires once per genuine settle, not once per frame: the loop
        // stops scheduling itself right after this, so tick() won't run
        // again until progress actually changes and kick() is called.
        if (onSettleRef.current) onSettleRef.current(target);
        return;
      }
      drawnRef.current += diff * catchUpRef.current;
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

  // Keeps the draw loop's actual point data (including live target
  // position) up to date on every change — this fires on a pure
  // reposition too, which is exactly what's wanted: a formation in
  // progress should track a moved/resized target box, not ignore it.
  useEffect(() => {
    particlesRef.current = particles;
    if (kickRef.current) kickRef.current();
  }, [particles]);

  // A brand-new target point set (e.g. ProcessChapter swapping to the next
  // step's icon) must always start from a fresh scatter, never from
  // whatever `drawnRef` happened to be mid-flight for the *previous*
  // target — without this reset, the new points would be drawn at
  // `easeOutCubic(drawnRef.current)` on the very next frame, which for a
  // just-settled previous shape is close to 1: the new shape would flash
  // in already fully formed, then visibly un-form as `drawnRef` eases back
  // down toward the new (near-zero) progress. Resetting here means every
  // new target genuinely materializes instead of momentarily snapping in.
  //
  // Keyed on `baseParticles`, not `particles` — a merely *repositioned*
  // shape (targetBox shifting because the viewport resized) must not
  // trigger this: a mobile browser's address bar hiding/showing mid-
  // formation used to retrigger `particles` (position depends on
  // targetBox, which depends on viewport size) and silently reset
  // formation progress back to 0, which — combined with the very slow
  // catch-up Hero's reveal uses — could repeatedly interrupt it before it
  // ever visibly finished, reading as "sometimes the product just never
  // resolves into a photo." Only an actual new shape should restart it.
  useEffect(() => {
    drawnRef.current = 0;
  }, [baseParticles]);
}
