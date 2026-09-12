import { useEffect, useState } from "react";

// India's device range is wide enough that "desktop-first" isn't a safe
// default. This checks real capability signals rather than guessing from a
// user-agent string, and picks the single most expensive thing the Hero
// does (continuously seeking a compressed video on scroll, which is
// decoder-bound and can visibly stutter on a weak SoC) as the one thing to
// cut. Everything else the Hero does is transform/opacity, cheap anywhere.
export default function useLiteMode() {
  const [lite, setLite] = useState(false);

  useEffect(() => {
    const conn =
      navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
    const saveData = Boolean(conn && conn.saveData);
    const slowConnection = Boolean(conn && ["slow-2g", "2g", "3g"].includes(conn.effectiveType));
    const weakCpu = Boolean(navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
    const weakMemory = Boolean(navigator.deviceMemory && navigator.deviceMemory <= 2);

    setLite(saveData || slowConnection || weakCpu || weakMemory);
  }, []);

  return lite;
}
