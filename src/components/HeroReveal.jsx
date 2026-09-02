import { motion, useReducedMotion } from "motion/react";

// Per-line "wipe up + unblur" reveal, matching the reference: each line
// sits inside an overflow-hidden mask and slides up from below its own
// baseline while coming into focus. Driven by an `active` boolean (not
// scroll position) so it replays every time a Hero chapter becomes active —
// including the very first chapter on page load.
export function RevealLine({ children, active, index = 0, stagger = 0.11, baseDelay = 0, style }) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div style={style}>{children}</div>;
  }

  return (
    <div style={{ overflow: "hidden" }}>
      <motion.div
        initial={false}
        animate={{
          y: active ? "0%" : "115%",
          opacity: active ? 1 : 0,
          filter: active ? "blur(0px)" : "blur(10px)",
        }}
        transition={{ duration: 0.95, delay: active ? baseDelay + index * stagger : 0, ease: [0.16, 1, 0.3, 1] }}
        style={style}
      >
        {children}
      </motion.div>
    </div>
  );
}

// Lighter companion for supporting copy (eyebrow tag, body text, CTAs) —
// a plain staggered fade + rise, no mask/blur. Same activation model.
export function RevealFade({ children, active, index = 0, stagger = 0.11, baseDelay = 0, y = 14, style }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={false}
      animate={
        reduceMotion
          ? { opacity: active ? 1 : 0 }
          : { opacity: active ? 1 : 0, y: active ? 0 : y }
      }
      transition={{ duration: 0.8, delay: active ? baseDelay + index * stagger : 0, ease: [0.16, 1, 0.3, 1] }}
      style={style}
    >
      {children}
    </motion.div>
  );
}
