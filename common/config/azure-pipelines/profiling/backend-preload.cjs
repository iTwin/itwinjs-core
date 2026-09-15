// Temporary, opt-in diagnostic instrumentation. No test behavior or timeouts are changed.
const path = require("node:path");
const fs = require("node:fs");
const output = process.env.ITWIN_BACKEND_PROFILE_DIR;
const backend = path.resolve(__dirname, "../../../../core/backend");

// NYC's spawn wrapper rewrites argv after preloads run. Observe Mocha's actual module loads instead.
if (output && process.cwd() === backend) {
  const Module = require("node:module");
  const { performance } = require("node:perf_hooks");
  const inspector = require("node:inspector");
  const runnableFile = require.resolve(path.join(backend, "node_modules/mocha/lib/runnable"));
  const runnerFile = require.resolve(path.join(backend, "node_modules/mocha/lib/runner"));
  const records = [];
  const profilerErrors = [];
  let session;
  let startedAt;
  let finished = false;
  let timingsWritten = false;
  let runnablePatched = false;
  let runnerPatched = false;

  function start() {
    startedAt = new Date().toISOString();
    fs.mkdirSync(output, { recursive: true });
    session = new inspector.Session();
    session.connect();
    session.post("Profiler.enable", (error) => {
      if (error) profilerErrors.push(error.message);
    });
    session.post("Profiler.setSamplingInterval", { interval: 10000 }, (error) => {
      if (error) profilerErrors.push(error.message);
    });
    session.post("Profiler.start", (error) => {
      if (error) profilerErrors.push(error.message);
    });
    process.once("exit", () => {
      // Exit handlers cannot depend on asynchronous profiler callbacks. Preserve incomplete timings synchronously.
      if (!timingsWritten) writeTimings(undefined, false);
    });
  }

  function writeTimings(runner, complete) {
    fs.writeFileSync(path.join(output, `backend-${process.pid}.json`), JSON.stringify({
      pid: process.pid, platform: process.platform, arch: process.arch, node: process.version,
      startedAt, finishedAt: new Date().toISOString(), complete,
      stats: runner?.stats, profilerErrors, records,
    }, null, 2));
    timingsWritten = true;
  }

  function finish(runner, complete) {
    if (finished) return;
    finished = true;
    session.post("Profiler.stop", (error, result) => {
      if (error) profilerErrors.push(error.message);
      if (result?.profile) {
        fs.writeFileSync(path.join(output, `backend-${process.pid}.cpuprofile`), JSON.stringify(result.profile));
      }
      writeTimings(runner, complete);
      session.disconnect();
    });
  }

  const originalLoad = Module._load;
  function profileLoad(request, parent, isMain) {
    const exported = originalLoad.call(this, request, parent, isMain);
    if (!/(?:^|[/\\])(runnable|runner)(?:\.js)?$/.test(request)) return exported;
    const file = Module._resolveFilename(request, parent, isMain);
    if (file === runnableFile && !runnablePatched) {
      runnablePatched = true;
      start();
      const originalRun = exported.prototype.run;
      exported.prototype.run = function (done) {
        const startTime = performance.now();
        const cpu = process.cpuUsage();
        const title = this.fullTitle();
        const type = this.type;
        return originalRun.call(this, function (...args) {
          const usage = process.cpuUsage(cpu);
          records.push({
            type, title, wallMs: performance.now() - startTime,
            startedAt: new Date(performance.timeOrigin + startTime).toISOString(),
            userCpuMs: usage.user / 1000, systemCpuMs: usage.system / 1000,
            errorType: args[0]?.name,
          });
          return done.apply(this, args);
        });
      };
    }
    if (file === runnerFile && !runnerPatched) {
      runnerPatched = true;
      const originalRun = exported.prototype.run;
      exported.prototype.run = function (...args) {
        this.once("end", () => finish(this, true));
        return originalRun.apply(this, args);
      };
    }
    if (runnablePatched && runnerPatched && Module._load === profileLoad) Module._load = originalLoad;
    return exported;
  }
  Module._load = profileLoad;
}
