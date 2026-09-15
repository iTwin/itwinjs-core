// Temporary Windows profiling experiment: same coverage instrumentation, isolated/full/isolated.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawn } = require("node:child_process");
const { performance } = require("node:perf_hooks");

const root = path.resolve(__dirname, "../../../..");
const smoke = process.argv.includes("--smoke");
if (!smoke && process.platform !== "win32") throw new Error("Real profiling requires Windows; --smoke validates instrumentation only.");
const output = process.env.ITWIN_WINDOWS_PROFILE_OUTPUT || path.join(os.tmpdir(), `itwin-windows-profile-${Date.now()}`);
fs.mkdirSync(output, { recursive: true });
if (process.env.TF_BUILD) console.log("##vso[task.setvariable variable=WindowsProfileArtifactsReady]true");
const preload = path.join(__dirname, "backend-preload.cjs").replaceAll("\\", "/");
const summary = {
  smoke, platform: process.platform, arch: process.arch, node: process.version,
  logicalProcessors: os.cpus().length, cpuModel: os.cpus()[0]?.model, totalMemory: os.totalmem(),
  phases: [],
};
const save = () => fs.writeFileSync(path.join(output, "summary.json"), JSON.stringify(summary, null, 2));
const waitFor = (child) => new Promise((resolve) => {
  child.once("error", () => resolve({ code: null, spawnError: true }));
  child.once("close", (code, signal) => resolve({ code, signal }));
});

async function runPhase(name, isolated) {
  const dir = path.join(output, name);
  fs.mkdirSync(dir, { recursive: true });
  const stopFile = path.join(dir, "sampler.stop");
  const resourceFile = path.join(dir, "resources.jsonl");
  let sampler;
  let samplerResult;
  if (process.platform === "win32") {
    sampler = spawn("powershell.exe", ["-NoProfile", "-File", path.join(__dirname, "resources.ps1"),
      "-OutputFile", resourceFile, "-StopFile", stopFile], { stdio: "inherit" });
    let samplerExited = false;
    samplerResult = waitFor(sampler).then((result) => { samplerExited = true; return result; });
    const deadline = Date.now() + 30000;
    while (!fs.existsSync(`${resourceFile}.ready`) && !samplerExited && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!fs.existsSync(`${resourceFile}.ready`)) {
      sampler.kill();
      await samplerResult;
      const error = new Error("Windows resource counters unavailable; stopped before the coverage experiment");
      error.name = "WindowsTelemetryUnavailable";
      throw error;
    }
  }
  const args = smoke
    ? [path.join(root, "common/scripts/install-run-rushx.js"), "cover", "--", "--grep", "^NativeApp storage backend storage open/close$"]
    : [path.join(root, "common/scripts/install-run-rush.js"), "cover", "--verbose", ...(isolated ? ["--only", "@itwin/core-backend"] : [])];
  const env = {
    ...process.env,
    RUSH_PARALLELISM: "15",
    ITWIN_BACKEND_PROFILE_DIR: dir,
    NODE_OPTIONS: `${process.env.NODE_OPTIONS || ""} --require="${preload}"`.trim(),
  };
  console.log(`[WINDOWS-PROFILE] ${name}; ${smoke ? "instrumentation smoke only" : isolated ? "backend only" : "normal full coverage, parallelism=15"}`);
  const start = performance.now();
  const result = await waitFor(spawn(process.execPath, args, {
    cwd: smoke ? path.join(root, "core/backend") : root, env, stdio: "inherit",
  }));
  const wallSeconds = (performance.now() - start) / 1000;
  let resources;
  if (sampler) {
    fs.writeFileSync(stopFile, "stop");
    const timer = setTimeout(() => sampler.kill(), 15000);
    const status = await samplerResult;
    clearTimeout(timer);
    const samples = fs.existsSync(resourceFile)
      ? fs.readFileSync(resourceFile, "utf8").replace(/^\uFEFF/, "").trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)) : [];
    resources = { ...status, samples: samples.length, errors: samples.filter((row) => row.error).length };
  }
  const profiles = fs.readdirSync(dir).filter((file) => /^backend-\d+\.json$/.test(file)).map((file) => {
    const data = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    return { file, complete: data.complete, stats: data.stats, profilerErrors: data.profilerErrors, records: data.records.length,
      cpuProfilePresent: fs.existsSync(path.join(dir, file.replace(/\.json$/, ".cpuprofile"))) };
  });
  const instrumentationValid = profiles.length === 1 && profiles.every((p) => p.complete && p.cpuProfilePresent && p.records > 0 && p.stats?.tests > 0 && p.profilerErrors.length === 0);
  const telemetryValid = !resources || (resources.code === 0 && resources.samples > 0 && resources.errors === 0);
  summary.phases.push({ name, isolated, wallSeconds, ...result, profiles, resources, instrumentationValid, telemetryValid });
  save();
  console.log(`[WINDOWS-PROFILE] ${name}: ${wallSeconds.toFixed(2)}s; exit=${result.code}; instrumentation=${instrumentationValid}; telemetry=${telemetryValid}`);
}

(async () => {
  save();
  // The second isolated pass checks warm-cache/order effects; these are measurements, not retries.
  await runPhase("isolated-before", true);
  await runPhase("concurrent", false);
  await runPhase("isolated-after", true);
  const counts = summary.phases.map((phase) => JSON.stringify(phase.profiles.map((p) => [p.stats?.tests, p.stats?.pending])));
  summary.sameTestCounts = new Set(counts).size === 1;
  save();
  process.exitCode = !summary.sameTestCounts || summary.phases.some((phase) => phase.code !== 0 || !phase.instrumentationValid || !phase.telemetryValid) ? 1 : 0;
  console.log(`[WINDOWS-PROFILE] Results: ${output}`);
})().catch((error) => {
  summary.error = error.name;
  save();
  console.error(`[WINDOWS-PROFILE] Failed: ${error.name}`);
  process.exitCode = 1;
});
