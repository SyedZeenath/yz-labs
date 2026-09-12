import { useReducedMotion } from "motion/react";
import Nav from "../components/Nav.jsx";
import ScrollHero from "../components/ScrollHero.jsx";
import MarqueeStrip from "../components/MarqueeStrip.jsx";
import ProductGrid from "../components/ProductGrid.jsx";
import ProcessSection from "../components/ProcessSection.jsx";
import MaterialsSection from "../components/MaterialsSection.jsx";
import GetNotifiedSection from "../components/GetNotifiedSection.jsx";
import CTAFooter from "../components/CTAFooter.jsx";
import ScrollProgress from "../components/ScrollProgress.jsx";
import Journey from "../components/Journey.jsx";
import useLiteMode from "../hooks/useLiteMode.js";

// The flat, normal-flow stack — today's actual site. Used verbatim for
// reduced-motion and budget-Android visitors rather than a toned-down
// version of the pinned Journey: forced scroll-jacking motion and heavy
// per-frame particle canvases are exactly the class of thing those two
// preferences exist to opt out of.
function ClassicHome() {
  return (
    <>
      <ScrollHero />
      <MarqueeStrip />
      <ProductGrid />
      <ProcessSection />
      <MaterialsSection />
      <GetNotifiedSection />
      <CTAFooter />
    </>
  );
}

// The Journey path never hands off to CTAFooter in normal flow — its own
// pinned GetInTouchChapter (heading, email/Instagram, copyright) is the
// journey's real closing chapter, kept pinned like everything before it
// rather than dropping into an ordinary scrolling footer. CTAFooter still
// exists for ClassicHome (reduced-motion / budget-Android), which is
// normal-flow throughout and has nothing pinned to hand off to.
export default function Home() {
  const reduceMotion = useReducedMotion();
  const liteMode = useLiteMode();
  const classic = reduceMotion || liteMode;

  return (
    <>
      <ScrollProgress />
      <Nav />
      <main>{classic ? <ClassicHome /> : <Journey />}</main>
    </>
  );
}
