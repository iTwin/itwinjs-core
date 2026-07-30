#!/usr/bin/env node
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/**
 * Order-balanced A/B benchmark for `TileAdmin.Props.enableExternalTileCacheLookup`.
 *
 * Measures the cost of the external tile-cache lookup and RPC retry that every newly
 * requested IModelTile performs when the backend has no external tile storage configured.
 *
 * Methodology notes. These matter: a naive A/B run of this comparison produces badly
 * misleading numbers.
 *
 *  - A discarded warm-up run is performed for each variant before any measurement. The
 *    backend keeps a persistent native tile cache beside the iModel (`<model>.bim.Tiles`).
 *    Whichever variant runs first against a cold cache pays for tile *generation*, which is
 *    far larger than the effect being measured and is otherwise misattributed to that
 *    variant. Warming first makes generation cost a constant that cancels out.
 *  - Runs alternate ABBA across reps, so run order cannot systematically favor a variant.
 *  - Each run uses a fresh Electron process. Frontend tile trees and `TileAdmin` state must
 *    not carry between runs: a tile already resident on the frontend is never re-requested,
 *    and a tile that has missed once keeps the RPC channel for the rest of its lifetime.
 *  - Medians and interquartile ranges are reported rather than single samples.
 *  - The reported dispatched/miss/completed counts are the control. The completed count must
 *    match across both variants for a view, which is what demonstrates that both variants
 *    performed identical frontend work and only the dispatch count differed.
 *
 * Because the tile cache is pre-warmed, results describe the steady-state backend rather
 * than a user's first-ever open of a model. That is the correct isolation for the cost of
 * the redundant lookup itself, but on a genuinely cold backend the same overhead would be a
 * smaller fraction of a much larger total.
 *
 * Usage:
 *
 *   node scripts/ab-tile-cache-lookup.mjs \
 *     --iModelLocation /path/to/models \
 *     --iModelName model.bim \
 *     --views "Floor B1,Overview,Section AA" \
 *     [--reps 5] [--out /tmp/ab-results] [--width 2400] [--height 1600]
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith("--"))
      throw new Error(`Unexpected argument "${argv[i]}"`);
    args[argv[i].slice(2)] = argv[i + 1];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const iModelLocation = args.iModelLocation;
const iModelName = args.iModelName;
const views = (args.views ?? "").split(",").map((v) => v.trim()).filter((v) => v.length > 0);
const reps = Number(args.reps ?? 5);
const root = args.out ?? join("/tmp", `ab-tile-cache-${iModelName ?? "model"}`);
const width = Number(args.width ?? 2400);
const height = Number(args.height ?? 1600);

if (!iModelLocation || !iModelName || 0 === views.length) {
  console.error(`Missing required arguments.

  --iModelLocation <dir>   directory containing the iModel
  --iModelName <file.bim>  iModel file name
  --views "View A,View B"  comma-separated saved view names
  [--reps 5]               measured repetitions per variant
  [--out <dir>]            output directory
  [--width 2400] [--height 1600]
`);
  process.exit(1);
}

rmSync(root, { recursive: true, force: true });
mkdirSync(root, { recursive: true });

function writeConfig(outDir, enableExternalTileCacheLookup) {
  const config = {
    outputName: "results.csv",
    outputPath: outDir,
    iModelLocation,
    iModelName,
    view: { width, height },
    numRendersToSkip: 10,
    numRendersToTime: 10,
    testSet: [{
      tileProps: { enableExternalTileCacheLookup },
      tests: views.map((viewName) => ({ viewName })),
    }],
  };
  const configPath = join(outDir, "config.json");
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  return configPath;
}

async function runOnce(label, enableExternalTileCacheLookup) {
  const outDir = join(root, label);
  mkdirSync(outDir, { recursive: true });
  const configPath = writeConfig(outDir, enableExternalTileCacheLookup);
  const started = Date.now();

  await new Promise((res, rej) => {
    const child = spawn("npx", ["electron", "./lib/backend/ElectronMain.js", configPath, "no_debug"], {
      cwd: appDir,
      env: { ...process.env, IMJS_NO_DEV_TOOLS: "1" },
      stdio: "ignore",
    });
    // A hung run would otherwise stall the entire sweep.
    const timeout = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // already exited
      }
    }, 15 * 60 * 1000);
    child.on("exit", () => {
      clearTimeout(timeout);
      res();
    });
    child.on("error", rej);
  });

  const elapsed = ((Date.now() - started) / 1000).toFixed(0);
  const missing = existsSync(join(outDir, "results.csv")) ? "" : "  [NO CSV PRODUCED]";
  console.log(`  ${label} (lookup=${enableExternalTileCacheLookup}) finished in ${elapsed}s${missing}`);
  return outDir;
}

function parseResults(outDir) {
  const csvPath = join(outDir, "results.csv");
  if (!existsSync(csvPath))
    return [];

  const lines = readFileSync(csvPath, "utf8").split("\n");
  const header = lines[0].split(",");
  const columns = {
    view: header.indexOf("View"),
    load: header.indexOf("Tile Loading Time"),
    misses: header.indexOf("Tile Cache Misses"),
    dispatched: header.indexOf("Tile Dispatched Requests"),
    completed: header.indexOf("Tile Completed Requests"),
  };

  const results = [];
  for (const line of lines.slice(1)) {
    // Splitting on commas is safe here: no numeric column contains a comma, and the
    // leading quoted text columns are read positionally.
    const fields = line.split(",");
    if (fields.length < header.length - 1)
      continue;
    const view = (fields[columns.view] ?? "").replace(/"/g, "");
    if (!views.includes(view))
      continue;
    results.push({
      view,
      load: Number(fields[columns.load]),
      misses: Number(fields[columns.misses]),
      dispatched: Number(fields[columns.dispatched]),
      completed: Number(fields[columns.completed]),
    });
  }
  return results;
}

function quantile(values, q) {
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

const unique = (values) => [...new Set(values)].join("/");

async function main() {
  console.log(`\n=== ${iModelName}: warm-up runs (discarded; equalizes the native tile cache) ===`);
  await runOnce("warmup-on", true);
  await runOnce("warmup-off", false);

  const samples = { on: [], off: [] };
  for (let rep = 0; rep < reps; rep++) {
    const order = 0 === rep % 2 ? [true, false] : [false, true];
    console.log(`\n=== ${iModelName}: rep ${rep + 1}/${reps} (order: ${order.map((v) => (v ? "on" : "off")).join(" -> ")}) ===`);
    for (const lookup of order) {
      const key = lookup ? "on" : "off";
      samples[key].push(parseResults(await runOnce(`rep${rep}-${key}`, lookup)));
    }
  }

  const report = { iModelName, reps, views: [] };
  let aggregateOn = 0;
  let aggregateOff = 0;

  console.log(`\n\n===== ${iModelName}: n=${reps} per variant, order-balanced, warm tile cache =====`);
  console.log(`${"View".padEnd(28)}${"tiles".padStart(6)}${"on".padStart(9)}${"on IQR".padStart(14)}${"off".padStart(9)}${"off IQR".padStart(14)}${"delta".padStart(9)}${"delta %".padStart(9)}`);

  for (const view of views) {
    const pick = (variant) => samples[variant].map((run) => run.find((r) => r.view === view)).filter((r) => undefined !== r);
    const on = pick("on");
    const off = pick("off");
    if (0 === on.length || 0 === off.length) {
      console.log(`${view.padEnd(28)}  (no data)`);
      continue;
    }

    const onLoad = on.map((r) => r.load);
    const offLoad = off.map((r) => r.load);
    const onMedian = quantile(onLoad, 0.5);
    const offMedian = quantile(offLoad, 0.5);
    const tiles = quantile(on.map((r) => r.completed), 0.5);
    const delta = onMedian - offMedian;
    aggregateOn += onMedian;
    aggregateOff += offMedian;

    const row = {
      view,
      tiles,
      onMedian,
      offMedian,
      delta,
      deltaPercent: 0 !== onMedian ? (delta / onMedian) * 100 : 0,
      msPerTile: tiles > 0 ? delta / tiles : 0,
      onIQR: [quantile(onLoad, 0.25), quantile(onLoad, 0.75)],
      offIQR: [quantile(offLoad, 0.25), quantile(offLoad, 0.75)],
      onLoadSamples: onLoad,
      offLoadSamples: offLoad,
      onDispatched: unique(on.map((r) => r.dispatched)),
      offDispatched: unique(off.map((r) => r.dispatched)),
      onMisses: unique(on.map((r) => r.misses)),
      offMisses: unique(off.map((r) => r.misses)),
      onCompleted: unique(on.map((r) => r.completed)),
      offCompleted: unique(off.map((r) => r.completed)),
    };
    report.views.push(row);

    console.log(
      view.padEnd(28) +
      String(tiles).padStart(6) +
      onMedian.toFixed(0).padStart(9) +
      `[${row.onIQR[0].toFixed(0)}-${row.onIQR[1].toFixed(0)}]`.padStart(14) +
      offMedian.toFixed(0).padStart(9) +
      `[${row.offIQR[0].toFixed(0)}-${row.offIQR[1].toFixed(0)}]`.padStart(14) +
      delta.toFixed(0).padStart(9) +
      `${row.deltaPercent.toFixed(1)}%`.padStart(9),
    );
  }

  report.aggregate = {
    onMedianTotal: aggregateOn,
    offMedianTotal: aggregateOff,
    delta: aggregateOn - aggregateOff,
    deltaPercent: 0 !== aggregateOn ? ((aggregateOn - aggregateOff) / aggregateOn) * 100 : 0,
  };
  console.log(`\nAggregate: on=${aggregateOn.toFixed(0)}ms  off=${aggregateOff.toFixed(0)}ms  delta=${report.aggregate.delta.toFixed(0)}ms (${report.aggregate.deltaPercent.toFixed(1)}%)`);

  console.log("\nRequest counts (exact, not statistical; completed must match across variants):");
  for (const row of report.views)
    console.log(`  ${row.view.padEnd(28)} on: dispatched=${row.onDispatched} misses=${row.onMisses} completed=${row.onCompleted}  |  off: dispatched=${row.offDispatched} misses=${row.offMisses} completed=${row.offCompleted}`);

  const reportPath = join(root, "report.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nFull report written to ${reportPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
