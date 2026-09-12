import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { useProducts } from "../store/products.jsx";
import useLiteMode from "../hooks/useLiteMode.js";

// One authored sequence, not a cycling slideshow: scroll straight through
// the studio's actual positioning (real batch transparency, not a mass
// reseller) in three beats on one product, then hand off into the real
// catalog. The video is real footage of the Round Planter turning, its
// currentTime driven by scroll position, not autoplay — scroll back up and
// it turns backward. Reduced motion drops the pin/scrub entirely rather
// than a softer version of it: forced scroll-linked motion is exactly the
// class of thing that preference exists to opt out of, not just decoration
// to tone down.
const FEATURED_ID = "round-planter";
const SCRUB_VH = 320;

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}

function SpecRow({ label, value }) {
  if (!value) return null;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        padding: "9px 0",
        borderTop: "1px solid var(--border)",
        fontSize: 12,
      }}
    >
      <span style={{ textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>{label}</span>
      <span style={{ color: "var(--fg-dim)", fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

// The pinned, scroll-scrubbed experience. Only rendered when motion is
// allowed; StaticHero below covers the reduced-motion and no-JS-benefit
// path so this component never has to defend against being half-used.
function ScrubbedHero({ featured, others, liteMode }) {
  const sectionRef = useRef(null);
  const videoRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [videoReady, setVideoReady] = useState(false);
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
    // A light poll alongside the scroll listener, not instead of it: real
    // scrolling always fires real events, this only guarantees the frame
    // can't visually drift out of sync with where it actually is.
    const id = setInterval(measure, 150);
    return () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      clearInterval(id);
    };
  }, []);

  const turnP = clamp01(progress / 0.32);
  const specP = clamp01((progress - 0.3) / 0.14) * (1 - clamp01((progress - 0.58) / 0.08));
  const introOpacity = 1 - clamp01((progress - 0.22) / 0.12);
  const revealP = clamp01((progress - 0.6) / 0.4);
  const railP = progress;

  useEffect(() => {
    const v = videoRef.current;
    if (!v || liteMode || !videoReady || !v.duration) return;
    v.currentTime = turnP * (v.duration - 0.05);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnP, videoReady, liteMode]);

  const stageScale = lerp(1, narrow ? 0.5 : 0.62, revealP);
  const stageX = narrow ? 0 : lerp(0, -220, revealP);
  const otherRestPositions = narrow ? [-64, 0, 64] : [190, 380, 570];
  const otherRestY = narrow ? 130 : 0;

  return (
    <section ref={sectionRef} id="top" style={{ position: "relative", height: `${SCRUB_VH}vh` }}>
      <div
        style={{
          position: "sticky",
          top: 0,
          height: "100svh",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div className="grid-overlay" />
        <div className="corner-tag" style={{ top: 96, left: "clamp(20px,4vw,48px)" }}>
          01 / STUDIO
        </div>
        <div className="corner-tag" style={{ top: 96, right: "clamp(20px,4vw,48px)" }}>
          LAT 12.97 · LON 77.59
        </div>
        <div
          className="eyebrow"
          style={{ position: "absolute", top: 96, left: "50%", transform: "translateX(-50%)", zIndex: 2 }}
        >
          Small-batch 3D print studio
        </div>

        {/* progress rail, right edge — the same hairline-plus-marker
            language the catalog's own scroll UI already uses */}
        <div
          aria-hidden
          style={{ position: "absolute", right: 28, top: "50%", transform: "translateY(-50%)", width: 1, height: 160, background: "var(--border)" }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: 1,
              height: "100%",
              background: "var(--accent)",
              transform: `scaleY(${railP})`,
              transformOrigin: "top",
              transition: "transform 60ms linear",
            }}
          />
        </div>

        {/* intro headline — anchored to the sticky viewport itself with a
            floor/ceiling clamp, not to the stage below. The stage's own
            box changes shape across breakpoints (aspect-ratio, maxHeight),
            so a percentage offset of *that* box drifted straight into the
            corner tags on short/narrow viewports instead of clearing them. */}
        <div
          style={{
            position: "absolute",
            top: "clamp(128px, 20svh, 190px)",
            left: "50%",
            transform: "translateX(-50%)",
            width: "min(90vw, 460px)",
            textAlign: "center",
            opacity: introOpacity,
            pointerEvents: introOpacity > 0.05 ? "auto" : "none",
          }}
        >
          <p className="mono" style={{ fontSize: 12, color: "var(--accent)", letterSpacing: "0.14em", marginBottom: 12 }}>
            STUDIO / 01
          </p>
          <h1 style={{ fontSize: "clamp(26px, 3.6vw, 44px)", lineHeight: 1.1, textTransform: "uppercase" }}>
            Objects, printed
            <br />
            layer by layer.
          </h1>
        </div>

        {/* central stage: video/photo, recedes and shifts left as the
            reveal beat brings the rest of the catalog in beside it */}
        <div
          style={{
            position: "relative",
            width: "min(72vw, 360px)",
            transform: `translate(${stageX}px, 0) scale(${stageScale})`,
            transition: "transform 60ms linear",
          }}
        >
          <div style={{ position: "relative", width: "100%", aspectRatio: "9 / 16", maxHeight: "58svh", margin: "0 auto" }}>
            {!liteMode && (
              <video
                ref={videoRef}
                muted
                playsInline
                preload="auto"
                onLoadedMetadata={() => setVideoReady(true)}
                poster={featured?.heroImage || undefined}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  borderRadius: 8,
                  display: "block",
                  filter: "drop-shadow(0 34px 40px rgba(0,0,0,0.6))",
                  opacity: videoReady ? 1 : 0,
                  transition: "opacity 300ms ease",
                }}
              >
                <source src="/products/round/turntable.mp4" type="video/mp4" />
              </video>
            )}
            {(liteMode || !videoReady) && featured?.heroImage && (
              <img
                src={featured.heroImage}
                alt={featured.name}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  filter: "drop-shadow(0 34px 40px rgba(0,0,0,0.6))",
                }}
              />
            )}
            {/* masks the AI-tool watermark baked into one corner of the
                generated clip; blends flush since the plate is pure black */}
            {!liteMode && <div aria-hidden style={{ position: "absolute", right: "2%", bottom: "3%", width: "15%", height: "7%", background: "var(--bg)", borderRadius: 3 }} />}
          </div>

          {/* spec sheet, fades in once the object has settled, fades back
              out before the reveal beat begins. Sits to the right on wide
              viewports (a leader-line off the object, echoing the old
              side-panel); the media query below moves it under the stage
              instead of just hiding it once there's no room beside it. */}
          <div
            className="hero-spec-line"
            aria-hidden
            style={{ position: "absolute", left: "100%", top: "50%", width: 28, height: 1, background: "var(--border-strong)", opacity: specP }}
          />
          <div
            className="mono hero-spec-panel"
            style={{
              position: "absolute",
              left: "calc(100% + 28px)",
              top: "50%",
              transform: "translateY(-50%)",
              width: 220,
              opacity: specP,
              pointerEvents: specP > 0.3 ? "auto" : "none",
            }}
          >
            <p style={{ color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14, fontSize: 12 }}>
              Spec sheet
            </p>
            <SpecRow label="Material" value={featured?.material} />
            <SpecRow label="Colorway" value={featured?.colorway} />
            <SpecRow label="Dimensions" value={featured?.dims} />
            <SpecRow label="Weight" value={featured?.weight} />
            <SpecRow label="Price" value={featured ? `₹${featured.price}` : null} />
          </div>
        </div>

        {/* reveal beat: the other three real products fly in beside the
            (now smaller) featured one to complete the current run */}
        {others.map((p, i) => {
          const restX = otherRestPositions[i] ?? 0;
          const fromX = restX + (narrow ? 0 : 260);
          const fromY = otherRestY + (narrow ? 80 : 0);
          const x = lerp(fromX, restX, revealP);
          const y = lerp(fromY, otherRestY, revealP);
          return (
            <div
              key={p.id}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: `translate(-50%,-50%) translate(${x}px, ${y}px) scale(${lerp(0.7, narrow ? 0.85 : 1, revealP)})`,
                opacity: clamp01(revealP * 1.6),
                width: narrow ? 84 : 118,
                textAlign: "center",
              }}
            >
              {p.heroImage && (
                <img src={p.heroImage} alt={p.name} style={{ width: "100%", height: 140, objectFit: "contain", filter: "drop-shadow(0 18px 20px rgba(0,0,0,0.55))" }} />
              )}
              <p className="mono" style={{ fontSize: 10, color: "var(--muted)", marginTop: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {p.name}
              </p>
            </div>
          );
        })}

        {/* catalog tag + CTAs, only once the reveal has mostly landed */}
        <div
          style={{
            position: "absolute",
            bottom: "14%",
            left: "50%",
            transform: "translateX(-50%)",
            textAlign: "center",
            opacity: clamp01((revealP - 0.6) / 0.4),
            pointerEvents: revealP > 0.8 ? "auto" : "none",
          }}
        >
          <p className="mono" style={{ fontSize: 12, color: "var(--accent)", letterSpacing: "0.14em", marginBottom: 10 }}>
            02 / CATALOG
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="#catalog" className="btn btn-primary">
              Shop the catalog
            </a>
            <a href="#process" className="btn btn-ghost">
              See how it's made
            </a>
          </div>
        </div>

        <div
          className="mono"
          style={{
            position: "absolute",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: 11,
            color: "var(--muted)",
            letterSpacing: "0.14em",
            display: "flex",
            alignItems: "center",
            gap: 8,
            opacity: 1 - clamp01(progress / 0.08),
          }}
        >
          SCROLL
          <span style={{ width: 1, height: 22, background: "var(--muted)" }} />
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          /* Coordinates are the least essential thing in the top chrome,
             and there isn't room for two corner tags plus a centered
             eyebrow on one line at this width without them overlapping. */
          #top .corner-tag { display: none; }
        }
        @media (max-width: 760px) {
          .hero-spec-line { display: none; }
          .hero-spec-panel {
            left: 50% !important;
            top: auto !important;
            bottom: -34% !important;
            transform: translateX(-50%) !important;
            width: 200px !important;
            text-align: center;
          }
        }
      `}</style>
    </section>
  );
}

// The reduced-motion and pre-hydration path: everything the sequence
// tells, at once, in normal document flow. No pin, no scrub, no cycling —
// the safest version of "preserve the state changes that carry meaning"
// is to just show all of them together rather than choreograph any of it.
function StaticHero({ featured, others }) {
  return (
    <section id="top" className="section-frame" style={{ position: "relative", padding: "140px 0 100px" }}>
      <div className="grid-overlay" />
      <div className="corner-tag" style={{ top: 96, left: "clamp(20px,4vw,48px)" }}>
        01 / STUDIO
      </div>
      <div className="corner-tag" style={{ top: 96, right: "clamp(20px,4vw,48px)" }}>
        LAT 12.97 · LON 77.59
      </div>
      <div className="container" style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr minmax(280px, 38vw) 1fr", gap: 48, alignItems: "center" }}>
        <div>
          <p className="eyebrow" style={{ marginBottom: 16 }}>
            Small-batch 3D print studio
          </p>
          <h1 style={{ fontSize: "clamp(26px, 3.4vw, 42px)", lineHeight: 1.15, textTransform: "uppercase" }}>
            Objects, printed
            <br />
            layer by layer.
          </h1>
          <p style={{ marginTop: 20, maxWidth: 360, fontSize: 15.5, color: "var(--fg-dim)", lineHeight: 1.6 }}>
            Small-batch propagation planters, sliced and finished by hand. Not a warehouse in sight.
          </p>
          <div style={{ display: "flex", gap: 14, marginTop: 30, flexWrap: "wrap" }}>
            <a href="#catalog" className="btn btn-primary">
              Shop the catalog
            </a>
            <a href="#process" className="btn btn-ghost">
              See how it's made
            </a>
          </div>
        </div>

        <div style={{ width: "100%" }}>
          {featured?.heroImage && (
            <img src={featured.heroImage} alt={featured.name} style={{ width: "100%", filter: "drop-shadow(0 30px 34px rgba(0,0,0,0.55))" }} />
          )}
        </div>

        <div className="mono">
          <p style={{ color: "var(--fg-dim)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16, fontSize: 12 }}>
            Spec sheet
          </p>
          <SpecRow label="Material" value={featured?.material} />
          <SpecRow label="Colorway" value={featured?.colorway} />
          <SpecRow label="Dimensions" value={featured?.dims} />
          <SpecRow label="Weight" value={featured?.weight} />
          <SpecRow label="Price" value={featured ? `₹${featured.price}` : null} />
        </div>
      </div>

      <div className="container" style={{ marginTop: 64, display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
        {others.map((p) => (
          <div key={p.id} style={{ width: 100, textAlign: "center" }}>
            {p.heroImage && <img src={p.heroImage} alt={p.name} style={{ width: "100%", height: 110, objectFit: "contain" }} />}
            <p className="mono" style={{ fontSize: 10, color: "var(--muted)", marginTop: 6, textTransform: "uppercase" }}>
              {p.name}
            </p>
          </div>
        ))}
      </div>

      <style>{`
        @media (max-width: 900px) {
          #top .container:first-of-type { grid-template-columns: 1fr !important; text-align: center; justify-items: center; }
        }
      `}</style>
    </section>
  );
}

export default function ScrollHero() {
  const products = useProducts();
  const reduceMotion = useReducedMotion();
  const liteMode = useLiteMode();

  const featured = products.find((p) => p.id === FEATURED_ID);
  const others = products.filter((p) => p.id !== FEATURED_ID);

  if (reduceMotion) return <StaticHero featured={featured} others={others} />;
  return <ScrubbedHero featured={featured} others={others} liteMode={liteMode} />;
}
