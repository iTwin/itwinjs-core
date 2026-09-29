/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { monitorEventLoopDelay, performance } from "node:perf_hooks";
import { _nativeDb, GeoCoordConfig, IModelDb, IModelHost, SettingsPriority, SnapshotDb, StandaloneDb, withEditTxn } from "@itwin/core-backend";
import { ConcurrentQuery } from "@itwin/core-backend/lib/cjs/ConcurrentQuery";
import { DbQueryConfig, DbQueryRequest, DbQueryResponse, ECSqlReader, QueryOptions, QueryStats } from "@itwin/core-common";

// Run one case per process from this package using `rushx perftest:ecSqlDeployment`.
// Required: PERF_IMODEL=/path/to/closed.bim PERF_RESULT=/path/to/new-result.json.
// Select PERF_SCENARIO=desktop-read|desktop-edit|web-cached|web-varied, PERF_CURSOR=0|1,
// PERF_MMAP_BYTES, PERF_ROWS, PERF_QUERIES, PERF_CLIENTS and PERF_WORKERS.
// For an isolated published native baseline, set PERF_BASELINE_ADDON to its package directory
// and NODE_OPTIONS="--require ./scripts/ecsqlNativeBaseline.cjs". Set PERF_EXPECT_NATIVE_SHA256
// to the known binary hash for both old and new runs to detect an incorrect package resolution.
// Repeat cases in fresh processes,
// alternate baseline/changed order, and compare paired medians. No network/frontends are timed.
type Scenario = "desktop-read" | "desktop-edit" | "web-cached" | "web-varied";

interface QueryResult {
  elapsedMs: number;
  firstRowMs: number;
  rows: number;
  digest?: string;
  stats: QueryStats;
}

function integerOption(name: string, fallback: number, minimum = 1): number {
  const value = Number(process.env[name] ?? fallback);
  assert.ok(Number.isSafeInteger(value) && value >= minimum, `${name} must be an integer >= ${minimum}`);
  return value;
}

function percentile(values: number[], fraction: number): number {
  assert.ok(values.length > 0);
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.max(0, Math.ceil(fraction * ordered.length) - 1)];
}

async function clients<T>(count: number, concurrency: number, task: (index: number) => Promise<T>): Promise<T[]> {
  let next = 0;
  const results = new Array<T>(count);
  // Fixed closed-loop clients avoid the unbounded client-side queue that would otherwise distort
  // latency. All clients are drained before teardown, including when one query fails.
  const completed = await Promise.allSettled(Array.from({ length: Math.min(count, concurrency) }, async () => {
    while (next < count) {
      const index = next++;
      results[index] = await task(index);
    }
  }));
  const failures = completed.filter((result): result is PromiseRejectedResult => result.status === "rejected");
  if (failures.length)
    throw new AggregateError(failures.map((failure) => failure.reason), "Benchmark queries failed");
  return results;
}

(process.env.PERF_IMODEL ? describe : describe.skip)("ECSQL deployment performance", () => {
  it("measures one controlled desktop or shared-backend case", async function () {
    this.timeout(600_000);
    const source = path.resolve(process.env.PERF_IMODEL!);
    assert.ok(process.env.PERF_RESULT, "PERF_RESULT must name a new JSON result file");
    const output = path.resolve(process.env.PERF_RESULT);
    assert.ok(!fs.existsSync(output), "Do not overwrite existing measurements");
    fs.mkdirSync(path.dirname(output), { recursive: true });
    const scenario = process.env.PERF_SCENARIO ?? "desktop-read";
    assert.ok(["desktop-read", "desktop-edit", "web-cached", "web-varied"].includes(scenario));
    const desktop = scenario.startsWith("desktop");
    const editing = scenario === "desktop-edit";
    const config = {
      scenario: scenario as Scenario,
      label: process.env.PERF_LABEL ?? "local",
      rows: integerOption("PERF_ROWS", 500_000),
      queries: integerOption("PERF_QUERIES", desktop ? 3 : 5000),
      concurrency: integerOption("PERF_CLIENTS", desktop ? 1 : 8),
      workers: integerOption("PERF_WORKERS", 4),
      cursor: process.env.PERF_CURSOR === "1",
      mmapBytes: integerOption("PERF_MMAP_BYTES", 0, 0),
      pageBytes: integerOption("PERF_PAGE_BYTES", desktop ? 64 * 1024 : 8 * 1024 * 1024),
      editEveryRows: integerOption("PERF_EDIT_EVERY_ROWS", 10_000),
    };
    assert.ok(!editing || config.concurrency === 1, "The editing case has one foreground reader");
    assert.ok(desktop || !config.cursor, "Web cases intentionally use stateless paging");
    assert.ok(!fs.existsSync(`${source}-wal`) && !fs.existsSync(`${source}-shm`), "Source must be closed/checkpointed before benchmarking");
    const working = `${output}.bim`;
    let db: IModelDb | undefined;
    let ownsCopy = false;
    let hostStarted = false;
    const startedAt = new Date().toISOString();
    try {
      await IModelHost.startup({ cacheDir: path.join(path.dirname(output), "host-cache"), implicitWriteEnforcement: "throw" });
      hostStarted = true;
      IModelHost.appWorkspace.settings.addDictionary(
        { name: "performance-disable-gcs-downloads", priority: SettingsPriority.application },
        { [GeoCoordConfig.settingName.disableWorkspaces]: true },
      );
      if (desktop) {
        assert.ok(!fs.existsSync(working));
        if (process.platform === "darwin")
          execFileSync("/bin/cp", ["-cn", source, working]); // APFS clone; never edit the source.
        else
          fs.copyFileSync(source, working, fs.constants.COPYFILE_EXCL);
        ownsCopy = true;
        StandaloneDb.convertToStandalone(working);
        db = StandaloneDb.openFile(working);
        db[_nativeDb].enableWalMode(true);
      } else {
        db = SnapshotDb.openFile(source);
        assert.equal(db.isReadonly, true);
      }
      const model = db;
      const nativeConfig: DbQueryConfig = {
        workerThreads: config.workers,
        memoryMapFileSize: config.mmapBytes,
        statementCacheSizePerWorker: 40,
        requestQueueSize: 2000,
        globalQuota: { time: 60, memory: config.pageBytes },
      };
      const applied = ConcurrentQuery.resetConfig(model[_nativeDb], nativeConfig);
      assert.equal(applied.workerThreads, config.workers);
      assert.equal(applied.memoryMapFileSize, config.mmapBytes);
      const sql = "SELECT ECInstanceId, ECClassId, Model.Id, CodeValue FROM bis.Element ORDER BY ECInstanceId";
      const options: QueryOptions = { useCursor: config.cursor, limit: { count: config.rows } };
      let pages = 0;
      let cursorPages = 0;
      let continuationRequests = 0;
      let pendingEdit = false;
      let writes = 0;
      let peakWalBytes = 0;
      const writeMs: number[] = [];
      const rootProps = editing ? model.elements.getElementProps("0x1") : undefined;
      const edit = () => {
        assert.ok(rootProps);
        const editStart = performance.now();
        withEditTxn(model, (txn) => txn.updateElement({ ...rootProps, userLabel: `ecsql-perf-${writes}` }));
        writeMs.push(performance.now() - editStart);
        ++writes;
        peakWalBytes = Math.max(peakWalBytes, fs.existsSync(`${working}-wal`) ? fs.statSync(`${working}-wal`).size : 0);
      };
      const execute = async (request: DbQueryRequest): Promise<DbQueryResponse> => {
        if (!request.closeCursor) {
          ++pages;
          if (request.cursorId)
            ++continuationRequests;
        }
        const response = ConcurrentQuery.executeQueryRequest(model[_nativeDb], request);
        // Commit on the JS/main thread while a worker request is outstanding, at deterministic
        // row boundaries rather than giving faster variants a lighter write workload.
        let write: Promise<void> | undefined;
        if (pendingEdit && !request.closeCursor) {
          pendingEdit = false;
          write = new Promise<void>((resolve, reject) => setImmediate(() => {
            try { edit(); resolve(); } catch (error) { reject(error instanceof Error ? error : new Error("Edit failed", { cause: error })); }
          }));
        }
        const [result] = await Promise.all([response, write]);
        if (result.cursorId)
          ++cursorPages;
        return result;
      };
      const query = async (statement: string, queryOptions: QueryOptions, checkDigest: boolean, withEdits = false): Promise<QueryResult> => {
        const reader = new ECSqlReader({ execute }, statement, undefined, queryOptions);
        let rows = 0;
        let firstRowMs = 0;
        const digest = checkDigest ? createHash("sha256") : undefined;
        const queryStart = performance.now();
        try {
          while (await reader.step()) {
            if (rows === 0)
              firstRowMs = performance.now() - queryStart;
            const row: unknown[] = reader.getRowInternal();
            if (digest)
              digest.update(`${JSON.stringify(row)}\n`);
            ++rows;
            if (withEdits && rows % config.editEveryRows === 0 && rows < config.rows)
              pendingEdit = true;
          }
        } finally {
          await reader.return();
        }
        return { elapsedMs: performance.now() - queryStart, firstRowMs, rows, digest: digest?.digest("hex"), stats: { ...reader.stats } };
      };

      let expectedDigest: string | undefined;
      const ids: string[] = [];
      if (desktop) {
        const warmup = await query(sql, options, true);
        assert.equal(warmup.rows, config.rows, "Dataset must contain the requested number of elements");
        expectedDigest = warmup.digest;
      } else {
        const sample = model.createQueryReader("SELECT ECInstanceId FROM bis.Element ORDER BY ECInstanceId LIMIT 1024");
        try {
          while (await sample.step()) {
            const id: unknown = sample.getRowInternal()[0];
            assert.equal(typeof id, "string");
            ids.push(String(id));
          }
        } finally {
          await sample.return();
        }
        assert.equal(ids.length, 1024, "Dataset needs at least 1024 elements");
      }
      const webStatement = (index: number) => {
        const id = ids[scenario === "web-cached" ? index % 8 : (index * 37) % 1000];
        const templates = [
          `SELECT ECInstanceId, ECClassId, Model.Id, CodeValue FROM bis.Element WHERE ECInstanceId=${id}`,
          `SELECT ECInstanceId, ECClassId FROM bis.Element WHERE ECInstanceId>=${id} ORDER BY ECInstanceId LIMIT 25`,
          `SELECT $ FROM bis.Element WHERE ECInstanceId=${id}`,
          `SELECT ECInstanceId, ECClassId, Model.Id FROM bis.GeometricElement3d WHERE ECInstanceId>=${id} ORDER BY ECInstanceId LIMIT 25`,
        ];
        return `${templates[index % templates.length]}${scenario === "web-varied" ? ` /* unique-request-${index} */` : ""}`;
      };
      if (!desktop)
        await clients(64, config.concurrency, async (i) => query(webStatement(i + config.queries), {}, false));

      pages = cursorPages = continuationRequests = 0;
      const rssBefore = process.memoryUsage().rss;
      let peakRss = rssBefore;
      const rssTimer = setInterval(() => { peakRss = Math.max(peakRss, process.memoryUsage().rss); }, 20);
      const loopDelay = monitorEventLoopDelay({ resolution: 10 });
      loopDelay.enable();
      const cpuStart = process.cpuUsage();
      const start = performance.now();
      let results: QueryResult[];
      try {
        results = await clients(config.queries, config.concurrency, async (i) => {
          const result = await query(desktop ? sql : webStatement(i), desktop ? options : {}, desktop, editing);
          if (desktop) {
            assert.equal(result.rows, config.rows);
            assert.equal(result.digest, expectedDigest, "No missing, duplicated, or changed projected rows");
          } else {
            assert.ok(result.rows > 0 && result.rows <= 25, "Web queries must return bounded, nonempty results");
            if (i % 4 === 0 || i % 4 === 2)
              assert.equal(result.rows, 1);
          }
          return result;
        });
      } finally {
        clearInterval(rssTimer);
        loopDelay.disable();
      }
      const wallMs = performance.now() - start;
      const cpu = process.cpuUsage(cpuStart);
      const rssEnd = process.memoryUsage().rss;
      peakRss = Math.max(peakRss, rssEnd);
      if (config.cursor)
        assert.ok(cursorPages > 0 && continuationRequests > 0, "Cursor measurement must actually return and submit cursors");
      if (editing) {
        assert.equal(pendingEdit, false);
        assert.equal(writes, Math.floor((config.rows - 1) / config.editEveryRows) * config.queries);
        model.withQueryReader("SELECT UserLabel FROM bis.Subject WHERE ECInstanceId=0x1", (reader) => {
          assert.ok(reader.step());
          assert.equal(reader.current[0], `ecsql-perf-${writes - 1}`);
        });
      }
      const checkpointStart = performance.now();
      if (desktop)
        model.performCheckpoint();
      const checkpointMs = desktop ? performance.now() - checkpointStart : 0;
      const walAfterCheckpoint = desktop && fs.existsSync(`${working}-wal`) ? fs.statSync(`${working}-wal`).size : 0;
      const binaries = Object.keys(require.cache).filter((file) => file.endsWith("imodeljs.node"));
      assert.equal(binaries.length, 1, "Each process must load exactly one native addon");
      const nativeSha256 = createHash("sha256").update(fs.readFileSync(binaries[0])).digest("hex");
      if (process.env.PERF_EXPECT_NATIVE_SHA256)
        assert.equal(nativeSha256, process.env.PERF_EXPECT_NATIVE_SHA256, "Wrong native addon loaded");
      const outputData = {
        startedAt,
        configuration: config,
        applied,
        input: { basename: path.basename(source), bytes: fs.statSync(source).size },
        machine: { platform: process.platform, arch: process.arch, node: process.version, cpu: os.cpus()[0].model, logicalCpus: os.cpus().length, memoryBytes: os.totalmem() },
        native: { path: binaries[0], sha256: nativeSha256 },
        measurement: {
          wallMs,
          throughputQps: results.length * 1000 / wallMs,
          rowsPerSecond: results.reduce((sum, result) => sum + result.rows, 0) * 1000 / wallMs,
          latencyP50Ms: percentile(results.map((result) => result.elapsedMs), 0.5),
          latencyP95Ms: percentile(results.map((result) => result.elapsedMs), 0.95),
          firstRowP50Ms: percentile(results.map((result) => result.firstRowMs), 0.5),
          cpuMs: (cpu.user + cpu.system) / 1000,
          rssBefore, rssEnd, peakRss,
          eventLoopP95Ms: loopDelay.percentile(95) / 1e6,
          pages, cursorPages, continuationRequests,
          retries: results.reduce((sum, result) => sum + result.stats.retryCount, 0),
          prepareMs: results.reduce((sum, result) => sum + result.stats.prepareTime, 0),
          writes, writeMs, peakWalBytes, checkpointMs, walAfterCheckpoint,
        },
        queries: results,
        limitations: [
          "Warm filesystem caches; process startup, opening the iModel, and warmup are excluded.",
          "Native/backend-only, not Electron UI, browser, HTTP, or RPC end-to-end timing.",
          "Closed-loop clients share one open database and one backend process.",
          "Desktop edits update and commit the root subject label, not geometry or schema changes.",
          "Continuation requests count submitted cursor ids, not verified native cache hits.",
          "mmapBytes is the requested native configuration, not independently observed mapped residency.",
          "Desktop p95 has few samples; compare repeated trial medians rather than treating it as a robust tail estimate.",
        ],
      };
      fs.writeFileSync(output, JSON.stringify(outputData, undefined, 2), { flag: "wx" });
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ label: config.label, scenario, ...outputData.measurement, writeMs: undefined }));
    } finally {
      try {
        db?.close();
      } finally {
        try {
          if (hostStarted)
            await IModelHost.shutdown();
        } finally {
          if (ownsCopy) {
            for (const suffix of ["", "-wal", "-shm"])
              fs.rmSync(`${working}${suffix}`, { force: true });
          }
        }
      }
    }
  });
});
