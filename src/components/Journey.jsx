import { useEffect, useRef, useState } from "react";
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
//
// Entrance and exit are sequenced, not overlapped: the outgoing chapter's
// exit finishes (opacity 0) exactly at the shared boundary, and the
// incoming chapter's entrance only starts from that boundary onward. They
// used to share one symmetric crossfade window, so for a stretch of scroll
// both chapters sat on screen at once, each half-formed — two overlapping
// particle fields read as noise, not a clean handoff. Sequencing them
// means the incoming chapter stays fully invisible until the previous one
// is unambiguously gone, then materializes on its own. TRANSITION_SPAN is
// also wider than the old margin (0.035, so 0.07 total) — the handoff
// itself takes longer, deliberately slower rather than a quick snap.
const TRANSITION_SPAN = 0.06;
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
    const t = clamp01((progress - start) / TRANSITION_SPAN);
    return { opacity: t, transform: `scale(${lerp(0.86, 1, t)}) translateX(${lerp(sideOffset, 0, t)}px)` };
  }
  if (hasExit && progress > end - TRANSITION_SPAN) {
    const t = clamp01((end - progress) / TRANSITION_SPAN);
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
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: bandActive(progress, BANDS.hero) ? "auto" : "none",
            ...chapterMotion(progress, BANDS.hero, 0),
          }}
        >
          <HeroChapter progress={bandProgress(progress, BANDS.hero)} active={bandActive(progress, BANDS.hero)} narrow={narrow} />
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: bandActive(progress, BANDS.catalog) ? "auto" : "none",
            ...chapterMotion(progress, BANDS.catalog, -90),
          }}
        >
          <CatalogChapter progress={bandProgress(progress, BANDS.catalog)} active={bandActive(progress, BANDS.catalog)} narrow={narrow} />
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: bandActive(progress, BANDS.process) ? "auto" : "none",
            ...chapterMotion(progress, BANDS.process, 90),
          }}
        >
          <ProcessChapter progress={bandProgress(progress, BANDS.process)} active={bandActive(progress, BANDS.process)} narrow={narrow} />
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: bandActive(progress, BANDS.materials) ? "auto" : "none",
            ...chapterMotion(progress, BANDS.materials, -90),
          }}
        >
          <MaterialsChapter progress={bandProgress(progress, BANDS.materials)} active={bandActive(progress, BANDS.materials)} narrow={narrow} />
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: bandActive(progress, BANDS.getNotified) ? "auto" : "none",
            ...chapterMotion(progress, BANDS.getNotified, 90),
          }}
        >
          <GetNotifiedChapter progress={bandProgress(progress, BANDS.getNotified)} active={bandActive(progress, BANDS.getNotified)} narrow={narrow} />
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            // Last chapter: progress is clamped to 1.0 at max scroll, and
            // bandActive's strict `progress < end` would go false exactly
            // there — this OR keeps it interactive at the very last pixel
            // instead of going dead right when the user reaches the end.
            pointerEvents: bandActive(progress, BANDS.getInTouch) || progress >= BANDS.getInTouch[1] ? "auto" : "none",
            ...chapterMotion(progress, BANDS.getInTouch, -90, false),
          }}
        >
          <GetInTouchChapter
            progress={bandProgress(progress, BANDS.getInTouch)}
            active={bandActive(progress, BANDS.getInTouch) || progress >= BANDS.getInTouch[1]}
            narrow={narrow}
          />
        </div>
      </div>
    </section>
  );
}
