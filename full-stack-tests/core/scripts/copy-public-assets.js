/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

// Collects public assets from dependency packages into lib/public/ so Vite's
// publicDir can serve them all under one root. This mirrors Certa's
// chromeOptions.publicDirs and how production iTwin.js apps copy worker scripts.
//
// Add entries to `publicDirs` when a new package needs assets served at the root.

const fs = require("fs");
const path = require("path");

const outDir = path.resolve(__dirname, "../lib/public");

// Each entry: the lib/public/ directory of a workspace package whose assets
// must be served at the browser root (e.g. /scripts/parse-imdl-worker.js).
const publicDirs = [
  // scripts/parse-imdl-worker.js, draco wasm, sprites, checkbrowser.js
  path.resolve(__dirname, "../node_modules/@itwin/core-frontend/lib/public"),
  // locales/en/HyperModeling.json (tool keyin registration), SVG markers
  path.resolve(__dirname, "../node_modules/@itwin/hypermodeling-frontend/lib/public"),
];

fs.mkdirSync(outDir, { recursive: true });

for (const dir of publicDirs) {
  if (!fs.existsSync(dir)) {
    console.warn(`[copy-public-assets] skipping missing dir: ${dir}`);
    continue;
  }
  fs.cpSync(dir, outDir, { recursive: true, force: true });
}
