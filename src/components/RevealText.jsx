import { motion, useReducedMotion } from "motion/react";

// Splits text into words and reveals them individually as they scroll into
// view — fly up + unblur, staggered. `parts` lets a heading mix plain text,
// styled spans (accent color), and forced line breaks while the stagger
// index still runs continuously across all of them.
//
// parts: Array<string | { text: string, style?: object } | { break: true }>
export default function RevealText({
  parts,
  as: Tag = "span",
  className,
  style,
  amount = 0.5,
  once = true,
  stagger = 0.034,
  baseDelay = 0,
  y = 24,
  blur = 8,
}) {
  const reduceMotion = useReducedMotion();
  let wordIndex = 0;

  return (
    <Tag className={className} style={style}>
      {parts.map((part, pi) => {
        if (part && part.break) return <br key={`br-${pi}`} />;
        const isObj = typeof part === "object" && part !== null;
        const text = isObj ? part.text : part;
        const words = text.split(" ");

        return words.map((word, wi) => {
          const idx = wordIndex++;
          const isLast = wi === words.length - 1;
          return (
            <motion.span
              key={`${pi}-${wi}`}
              initial={reduceMotion ? undefined : { opacity: 0, y, filter: `blur(${blur}px)` }}
              whileInView={reduceMotion ? undefined : { opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once, amount }}
              transition={{ duration: 0.75, delay: baseDelay + idx * stagger, ease: [0.16, 1, 0.3, 1] }}
              style={{ display: "inline-block", whiteSpace: "pre", ...(isObj ? part.style : null) }}
            >
              {word + (isLast ? "" : " ")}
            </motion.span>
          );
        });
      })}
    </Tag>
  );
}
