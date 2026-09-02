import { removeBackground } from "@imgly/background-removal-node";
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SRC_DIR = path.resolve("public/products");
const OUT_DIR = path.resolve("public/products/cutout");

// Relative to public/products/ — subfolders are preserved under cutout/.
const FILES = ["round/3.png", "step/1.png"];

async function run() {
  for (const file of FILES) {
    const inputPath = path.join(SRC_DIR, file);
    const outputPath = path.join(OUT_DIR, file);
    await mkdir(path.dirname(outputPath), { recursive: true });

    console.log(`Processing ${file}...`);
    const t0 = Date.now();
    const blob = await removeBackground(pathToFileURL(inputPath).href);
    const buffer = Buffer.from(await blob.arrayBuffer());
    await writeFile(outputPath, buffer);
    console.log(`  -> cutout/${file} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }

  console.log("Done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
