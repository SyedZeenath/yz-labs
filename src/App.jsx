import { Suspense, lazy, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Home from "./pages/Home.jsx";
import CatalogPage from "./pages/CatalogPage.jsx";
import TermsPage from "./pages/TermsPage.jsx";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage.jsx";
import RefundPolicyPage from "./pages/RefundPolicyPage.jsx";
import ShippingPolicyPage from "./pages/ShippingPolicyPage.jsx";
import ContactPage from "./pages/ContactPage.jsx";
import CartDrawer from "./components/CartDrawer.jsx";
import ContactModal from "./components/ContactModal.jsx";
import { useContact } from "./store/contact.jsx";

// Lazy: almost no visitor ever hits /admin, and it's the one part of the app
// that needs auth — no reason for its code (forms, tables) to sit in the
// public storefront's bundle.
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout.jsx"));
const AdminProductsPage = lazy(() => import("./pages/admin/AdminProductsPage.jsx"));
const AdminContactsPage = lazy(() => import("./pages/admin/AdminContactsPage.jsx"));
const AdminOrdersPage = lazy(() => import("./pages/admin/AdminOrdersPage.jsx"));

// react-router doesn't reset scroll position on navigation by itself, and
// this site's `html { scroll-behavior: smooth }` would otherwise animate a
// long, visible scroll back up from wherever the previous page left off.
// Jump instantly instead, same fix used elsewhere in this app for the
// smooth-scroll-vs-scrollTo interaction.
//
// A hash in the URL (Nav's "Process" link, for one — it targets `/#process`
// so it works identically whether you're already on the homepage or on
// /catalog, /terms, etc.) means scroll to that element instead of
// resetting to the top. The target may not exist in the DOM yet on the
// very first render after a cross-page navigation (Home/Journey is still
// mounting), so this polls for it across a few frames rather than assuming
// it's already there — same reasoning as HeroChapter's own image-load race.
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      let cancelled = false;
      let attempts = 0;
      const target = hash.slice(1);
      function tryScroll() {
        if (cancelled) return;
        const el = document.getElementById(target);
        if (el) {
          el.scrollIntoView({ block: "start" });
        } else if (attempts++ < 40) {
          requestAnimationFrame(tryScroll);
        }
      }
      tryScroll();
      return () => {
        cancelled = true;
      };
    }
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, hash]);
  return null;
}

// One shared modal instance for the whole app — Nav's "Contact" link and
// every "Email" button (GetInTouchChapter, CTAFooter) all open this same
// instance via useContact(), instead of each carrying its own separate,
// unrelated local open/close state.
function GlobalContactModal() {
  const { isOpen, closeContact } = useContact();
  return <ContactModal open={isOpen} onClose={closeContact} />;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/refund-policy" element={<RefundPolicyPage />} />
        <Route path="/shipping-policy" element={<ShippingPolicyPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route
          path="/admin"
          element={
            <Suspense
              fallback={
                <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <p className="mono" style={{ color: "var(--muted)", fontSize: 13 }}>
                    Loading…
                  </p>
                </div>
              }
            >
              <AdminLayout />
            </Suspense>
          }
        >
          <Route index element={<Navigate to="/admin/products" replace />} />
          <Route path="products" element={<AdminProductsPage />} />
          <Route path="contacts" element={<AdminContactsPage />} />
          <Route path="orders" element={<AdminOrdersPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <CartDrawer />
      <GlobalContactModal />
    </>
  );
}
