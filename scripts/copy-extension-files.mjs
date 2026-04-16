import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const filesToCopy = [
  ["manifest.json", "manifest.json"],
  ["icons/icon16.png", "icons/icon16.png"],
  ["icons/icon32.png", "icons/icon32.png"],
  ["icons/icon48.png", "icons/icon48.png"],
  ["icons/icon128.png", "icons/icon128.png"],
  ["icons/icon-source.svg", "icons/icon-source.svg"]
];

async function copyStaticFiles() {
  for (const [source, destination] of filesToCopy) {
    const sourcePath = resolve(process.cwd(), source);
    const destinationPath = resolve(process.cwd(), "dist", destination);
    await mkdir(dirname(destinationPath), { recursive: true });
    await copyFile(sourcePath, destinationPath);
  }
}

await copyStaticFiles();
