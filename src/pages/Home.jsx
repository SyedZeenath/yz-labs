import Nav from "../components/Nav.jsx";
import Hero from "../components/Hero.jsx";
import MarqueeStrip from "../components/MarqueeStrip.jsx";
import ProductGrid from "../components/ProductGrid.jsx";
import ProcessSection from "../components/ProcessSection.jsx";
import MaterialsSection from "../components/MaterialsSection.jsx";
import CTAFooter from "../components/CTAFooter.jsx";
import ScrollProgress from "../components/ScrollProgress.jsx";

export default function Home() {
  return (
    <>
      <ScrollProgress />
      <Nav />
      <main>
        <Hero />
        <MarqueeStrip />
        <ProductGrid />
        <ProcessSection />
        <MaterialsSection />
        <CTAFooter />
      </main>
    </>
  );
}
