import { useEffect, useRef, useState } from "react";
import { easeInOutCubic } from "../lib/particleField.js";
import HeroChapter from "./journey/HeroChapter.jsx";
import CatalogChapter from "./journey/CatalogChapter.jsx";
import ProcessChapter from "./journey/ProcessChapter.jsx";
import MaterialsChapter from "./journey/MaterialsChapter.jsx";
import GetNotifiedChapter from "./journey/GetNotifiedChapter.jsx";
import GetInTouchChapter from "./journey/GetInTouchChapter.jsx";

// One continuous pinned scroll experience replacing the flat Hero +
// MarqueeStrip + ProductGrid + ProcessSection + MaterialsSection + CTAFooter
// stack. Progress (0..1 across the whole wrapper) is measured the same
// manual way ScrollHero already proved reliable in this environment —
// Motion's scroll hooks were unreliable here — rather than introducing a
// second pattern. Every chapter, including the closing "get in touch" one,
// is pinned the same way — there's deliberately no point where the journey
// hands off to a normal-flow section that scrolls past under an ordinary
// scroll. An earlier version left the closing content in normal flow (it
// used to carry the legal/policy links, which need to stay crawlable); once
// those links moved into the cart drawer instead, nothing left in that
// content still needed to be normal-flow, so it became a real pinned
// chapter like everything else instead of the one place the page still
// behaved like an ordinary scrolling site.
//
// The marquee "transition beat" that used to sit between Hero and Catalog
// was cut — at only 6% of the scroll budget it read as an unclear blip,
// not a beat. Hero keeps that scroll instead (a longer hold on the CTA
// before the handoff) rather than leaving a gap.
const TOTAL_VH = 1800;
const BANDS = {
  hero: [0, 1 / 6],
  catalog: [1 / 6, 2 / 6],
  process: [2 / 6, 3 / 6],
  materials: [3 / 6, 4 / 6],
  getNotified: [4 / 6, 5 / 6],
  getInTouch: [5 / 6, 1],
};

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}
function bandProgress(progress, [start, end]) {
  return clamp01((progress - start) / (end - start));
}
function bandActive(progress, [start, end]) {
  return progress >= start && progress < end;
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
// A camera move at each chapter boundary instead of a flat crossfade: the
// next chapter slides in from a side while scaling up to size (a pan +
// push-in), and the outgoing one scales up past 1 as it fades — flying
// through it rather than just dissolving. sideOffset alternates per
// chapter so consecutive entrances don't all come from the same side.
// Both ramps ease in/out (rather than moving at a constant linear rate)
// so the handoff has weight instead of a mechanical, constant-speed feel.
//
// Entrance and exit are sequenced, not overlapped: the outgoing chapter's
// exit finishes (opacity 0) exactly at the shared boundary, and the
// incoming chapter's entrance only starts from there. A brief literal
// overlap was tried here — the incoming chapter starting to fade in
// slightly before the outgoing one fully exited — but because every
// chapter is a sibling in the same DOM stack, the incoming one paints on
// top of the outgoing one during that shared window; at the Hero↔Catalog
// boundary that put a faint product-ring tile visibly over the STUDIO
// mark when scrolling backward. Sequencing avoids that category of bug
// entirely: only one chapter is ever above zero opacity at a time.
//
// Every chapter's own internal content (heading formation, step index,
// ring rotation…) is driven by the SAME local progress that this entrance/
// exit ramp also consumes — so a wide TRANSITION_SPAN doesn't just make
// the handoff slower, it burns a chunk of the chapter's own content
// timeline while it's still fading in or out. At the old value (0.06, a
// full third of each chapter's ~0.1667-wide band on each side) a chapter
// was only genuinely stable — fully opaque, unscaled — across the middle
// ~28% of its own band; the rest played out half-transparent and shrunk.
// For continuous content (a ring rotating, one heading forming) that's
// easy to miss; for ProcessChapter's five discrete, sequential steps it
// was very visible — step 1 finished entirely inside the invisible
// entrance fade, and step 4 started right as the exit fade began, reading
// as "it skips straight to 3 and 4". Narrower here gives every chapter's
// content most of its own band to actually be seen in, not just occupied.
const TRANSITION_SPAN = 0.025;
// `hasExit` is false only for the last chapter — global progress is hard-
// capped at exactly 1.0 (Journey's own measure() clamps it), so a chapter
// whose band ends at 1.0 can never actually reach past `end`. There's
// nothing after the last chapter to exit into anyway, so it simply holds
// once entered.
function chapterMotion(progress, [start, end], sideOffset, hasExit = true) {
  if (progress < start) {
    return { opacity: 0, transform: `scale(0.86) translateX(${sideOffset}px)` };
  }
  // The very first chapter (start === 0) has no previous chapter to wait
  // on, so it's simply visible from the start instead of ramping in.
  if (start > 0 && progress < start + TRANSITION_SPAN) {
    const t = easeInOutCubic(clamp01((progress - start) / TRANSITION_SPAN));
    return { opacity: t, transform: `scale(${lerp(0.86, 1, t)}) translateX(${lerp(sideOffset, 0, t)}px)` };
  }
  if (hasExit && progress > end - TRANSITION_SPAN) {
    const t = easeInOutCubic(clamp01((end - progress) / TRANSITION_SPAN));
    return { opacity: t, transform: `scale(${lerp(1, 1.2, 1 - t)}) translateX(0px)` };
  }
  if (hasExit && progress > end) {
    return { opacity: 0, transform: "scale(1.2) translateX(0px)" };
  }
  return { opacity: 1, transform: "scale(1) translateX(0px)" };
}

export default function Journey() {
  const sectionRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.innerWidth < 760);

  useEffect(() => {
    function measure() {
      setNarrow(window.innerWidth < 760);
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = el.offsetHeight - window.innerHeight;
      if (total <= 0) {
        setProgress(0);
        return;
      }
      setProgress(clamp01(-rect.top / total));
    }
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    const id = setInterval(measure, 150);
    return () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      clearInterval(id);
    };
  }, []);

  const heroActive = bandActive(progress, BANDS.hero);
  const catalogActive = bandActive(progress, BANDS.catalog);
  const processActive = bandActive(progress, BANDS.process);
  const materialsActive = bandActive(progress, BANDS.materials);
  const getNotifiedActive = bandActive(progress, BANDS.getNotified);
  const getInTouchActive = bandActive(progress, BANDS.getInTouch) || progress >= BANDS.getInTouch[1];

  // Every chapter stays mounted the whole time (that's how a chapter can
  // fade back in when you scroll back to it), so an inactive chapter's own
  // interactive elements — a product tile, a form field — are still
  // sitting in the normal DOM tab order even while its wrapper is at
  // opacity 0. `pointerEvents: none` on that wrapper blocks mouse/touch,
  // but does nothing for keyboard users: Tab would still land on those
  // controls, with nothing visible on screen to show where focus went.
  // `inert` (same technique Nav.jsx already uses for its closed mobile
  // menu, set imperatively for the same React-18-JSX-prop reason) removes
  // an inactive chapter from the tab order and from assistive-tech
  // traversal entirely, so keyboard/screen-reader navigation only ever
  // reaches whatever is actually visible.
  const heroRef = useRef(null);
  const catalogRef = useRef(null);
  const processRef = useRef(null);
  const materialsRef = useRef(null);
  const getNotifiedRef = useRef(null);
  const getInTouchRef = useRef(null);
  useEffect(() => {
    if (heroRef.current) heroRef.current.inert = !heroActive;
    if (catalogRef.current) catalogRef.current.inert = !catalogActive;
    if (processRef.current) processRef.current.inert = !processActive;
    if (materialsRef.current) materialsRef.current.inert = !materialsActive;
    if (getNotifiedRef.current) getNotifiedRef.current.inert = !getNotifiedActive;
    if (getInTouchRef.current) getInTouchRef.current.inert = !getInTouchActive;
  }, [heroActive, catalogActive, processActive, materialsActive, getNotifiedActive, getInTouchActive]);

  return (
    <section ref={sectionRef} style={{ position: "relative", height: `${TOTAL_VH}vh` }}>
      {/* Zero-size markers in the tall, non-sticky flow so Nav's #catalog
          /#process/#materials hash links still land at the right scroll
          depth — camera state is a pure function of scrollY, so jumping
          scrollY here correctly lands the right chapter on screen. */}
      <div id="catalog" aria-hidden style={{ position: "absolute", top: `${BANDS.catalog[0] * (TOTAL_VH - 100)}vh`, width: 1, height: 1 }} />
      <div id="process" aria-hidden style={{ position: "absolute", top: `${BANDS.process[0] * (TOTAL_VH - 100)}vh`, width: 1, height: 1 }} />
      <div id="materials" aria-hidden style={{ position: "absolute", top: `${BANDS.materials[0] * (TOTAL_VH - 100)}vh`, width: 1, height: 1 }} />
      <div id="contact" aria-hidden style={{ position: "absolute", top: `${BANDS.getInTouch[0] * (TOTAL_VH - 100)}vh`, width: 1, height: 1 }} />

      <div style={{ position: "sticky", top: 0, height: "100svh", overflow: "hidden" }}>
        {/* Each wrapper spans the full viewport even when its chapter is
            invisible (opacity 0) — without an explicit pointer-events gate
            here, that invisible box still sits in the hit-testing stack
            above whichever chapter is actually active and swallows every
            click meant for it. The chapter components already gate their
            OWN pointer-events by `active`, but that only controls their
            own subtree, not this outer motion wrapper. */}
        <div
          ref={heroRef}
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: heroActive ? "auto" : "none",
            ...chapterMotion(progress, BANDS.hero, 0),
          }}
        >
          <HeroChapter progress={bandProgress(progress, BANDS.hero)} active={heroActive} narrow={narrow} />
        </div>
        <div
          ref={catalogRef}
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: catalogActive ? "auto" : "none",
            ...chapterMotion(progress, BANDS.catalog, -90),
          }}
        >
          <CatalogChapter progress={bandProgress(progress, BANDS.catalog)} active={catalogActive} narrow={narrow} />
        </div>
        <div
          ref={processRef}
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: processActive ? "auto" : "none",
            ...chapterMotion(progress, BANDS.process, 90),
          }}
        >
          <ProcessChapter progress={bandProgress(progress, BANDS.process)} active={processActive} narrow={narrow} />
        </div>
        <div
          ref={materialsRef}
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: materialsActive ? "auto" : "none",
            ...chapterMotion(progress, BANDS.materials, -90),
          }}
        >
          <MaterialsChapter progress={bandProgress(progress, BANDS.materials)} active={materialsActive} narrow={narrow} />
        </div>
        <div
          ref={getNotifiedRef}
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: getNotifiedActive ? "auto" : "none",
            ...chapterMotion(progress, BANDS.getNotified, 90),
          }}
        >
          <GetNotifiedChapter progress={bandProgress(progress, BANDS.getNotified)} active={getNotifiedActive} narrow={narrow} />
        </div>
        <div
          ref={getInTouchRef}
          style={{
            position: "absolute",
            inset: 0,
            // Last chapter: progress is clamped to 1.0 at max scroll, and
            // bandActive's strict `progress < end` would go false exactly
            // there — this OR keeps it interactive at the very last pixel
            // instead of going dead right when the user reaches the end.
            pointerEvents: getInTouchActive ? "auto" : "none",
            ...chapterMotion(progress, BANDS.getInTouch, -90, false),
          }}
        >
          <GetInTouchChapter
            progress={bandProgress(progress, BANDS.getInTouch)}
            active={getInTouchActive}
            narrow={narrow}
          />
        </div>
      </div>
    </section>
  );
}
