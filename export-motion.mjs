import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";

const [inputFile, outputName, durationArg = "12000"] = process.argv.slice(2);

if (!inputFile || !outputName) {
  console.error(
    "Usage: node export-motion.mjs <html-file> <output-name.webm> <duration-ms>"
  );
  process.exit(1);
}

const durationMs = Number(durationArg);

if (!Number.isFinite(durationMs) || durationMs <= 0) {
  console.error("Duration must be a positive number in milliseconds.");
  process.exit(1);
}

const inputPath = path.resolve(inputFile);
const outputDir = path.resolve("motion-exports");
const outputPath = path.join(outputDir, outputName);

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
});

const context = await browser.newContext({
  viewport: {
    width: 1920,
    height: 1080,
  },
  recordVideo: {
    dir: outputDir,
    size: {
      width: 1920,
      height: 1080,
    },
  },
  deviceScaleFactor: 1,
});

const page = await context.newPage();
const video = page.video();

const fileUrl = `${pathToFileURL(inputPath).href}?motion=1`;

await page.goto(fileUrl, {
  waitUntil: "load",
});

await page.waitForTimeout(durationMs);

await context.close();

const temporaryVideoPath = await video.path();
await copyFile(temporaryVideoPath, outputPath);

await browser.close();

console.log(`Exported: ${outputPath}`);