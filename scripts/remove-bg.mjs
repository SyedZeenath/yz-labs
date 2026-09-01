import { removeBackground } from "@imgly/background-removal-node";
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SRC_DIR = path.resolve("public/products");
const OUT_DIR = path.resolve("public/products/cutout");

const FILES = [
  "ridge-valet-tray.jpg",
  "spiral-propagation-vase.jpg",
  "strata-desk-set.jpg",
  "clock.jpeg",
];

async function run() {
  if (!existsSync(OUT_DIR)) await mkdir(OUT_DIR, { recursive: true });

  for (const file of FILES) {
    const inputPath = path.join(SRC_DIR, file);
    const outName = file.replace(/\.(jpe?g|png)$/i, ".png");
    const outputPath = path.join(OUT_DIR, outName);

    console.log(`Processing ${file}...`);
    const t0 = Date.now();
    const blob = await removeBackground(pathToFileURL(inputPath).href);
    const buffer = Buffer.from(await blob.arrayBuffer());
    await writeFile(outputPath, buffer);
    console.log(`  -> ${outName} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }

  console.log("Done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
