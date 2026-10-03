const assert = require("node:assert/strict");
const path = require("node:path");

const baselinePath = process.env.PERF_BASELINE_ADDON;
assert.ok(baselinePath, "Set PERF_BASELINE_ADDON to the directory of an isolated @bentley/imodeljs-native installation");
const backendEntry = require.resolve("@itwin/core-backend");
const installed = require(require.resolve("@bentley/imodeljs-native", { paths: [path.dirname(backendEntry)] }));
const baseline = require(path.resolve(baselinePath));
installed.NativeLibrary.load = baseline.NativeLibrary.load.bind(baseline.NativeLibrary);
