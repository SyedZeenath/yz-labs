import { motion, useReducedMotion } from "motion/react";

// The "box" counterpart to RevealText — for cards, rows, tiles, anything
// that isn't a line of type. Same family of motion (soft blur clearing as
// it settles, gentle rise, generous easing) so every section reads as one
// consistent language as you scroll, not a grab-bag of different reveals.
export default function RevealBox({
  children,
  index = 0,
  stagger = 0.09,
  baseDelay = 0,
  duration = 0.75,
  y = 26,
  blur = 5,
  amount = 0.35,
  once = true,
  style,
  className,
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? undefined : { opacity: 0, y, filter: `blur(${blur}px)` }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once, amount }}
      transition={{ duration, delay: baseDelay + index * stagger, ease: [0.16, 1, 0.3, 1] }}
      style={style}
    >
      {children}
    </motion.div>
  );
}
