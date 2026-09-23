import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import AdminLoginPage from "./AdminLoginPage.jsx";

const TABS = [
  { to: "/admin/products", label: "Products" },
  { to: "/admin/contacts", label: "Contacts" },
  { to: "/admin/orders", label: "Orders" },
];

// The admin cookie is httpOnly (see server/adminAuth.js) — deliberately
// unreadable from JS, so this is the only way the client can know whether
// it's logged in. Own lightweight shell rather than reusing LegalLayout.jsx:
// that one's tuned for prose (narrow column, legal-links footer), wrong for
// a data table UI.
export default function AdminLayout() {
  // idle (checking) | in | out
  const [session, setSession] = useState("idle");

  const checkSession = useCallback(() => {
    fetch("/api/admin/session")
      .then((res) => setSession(res.ok ? "in" : "out"))
      .catch(() => setSession("out"));
  }, []);

  useEffect(checkSession, [checkSession]);

  const logout = () => {
    fetch("/api/admin/logout", { method: "POST" }).finally(() => setSession("out"));
  };

  if (session === "idle") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p className="mono" style={{ color: "var(--muted)", fontSize: 13 }}>
          Checking session…
        </p>
      </div>
    );
  }

  if (session === "out") {
    return <AdminLoginPage onLoggedIn={() => setSession("in")} />;
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header style={{ borderBottom: "1px solid var(--border)" }}>
        <div
          className="container"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, flexWrap: "wrap", gap: 12 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            <Link to="/admin/products" className="eyebrow" style={{ whiteSpace: "nowrap" }}>
              YZ Labs admin
            </Link>
            <nav style={{ display: "flex", gap: 4 }}>
              {TABS.map((tab) => (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  className="mono"
                  style={({ isActive }) => ({
                    padding: "8px 14px",
                    fontSize: 13,
                    color: isActive ? "var(--fg)" : "var(--muted)",
                    borderBottom: isActive ? "2px solid var(--accent)" : "2px solid transparent",
                  })}
                >
                  {tab.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Link to="/" className="mono" style={{ fontSize: 12, color: "var(--fg-dim)" }}>
              ← Back to store
            </Link>
            <button onClick={logout} className="btn btn-ghost" style={{ padding: "8px 16px", fontSize: 12 }}>
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="container" style={{ flex: 1, padding: "32px 0 80px" }}>
        <Outlet />
      </main>
    </div>
  );
}
