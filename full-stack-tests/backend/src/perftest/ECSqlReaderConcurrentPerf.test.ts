/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { Id64, StopWatch } from "@itwin/core-bentley";
import { Arc3d, IModelJson as GeomJson, Point3d } from "@itwin/core-geometry";
import {
  BriefcaseIdValue, Code, ColorDef, DbQueryConfig, GeometryStreamProps, IModel, QueryStats, SubCategoryAppearance,
} from "@itwin/core-common";
import { Reporter } from "@itwin/perf-tools";
import { _nativeDb, IModelDb, IModelHost, IModelJsFs, SnapshotDb, SpatialCategory } from "@itwin/core-backend";
import { IModelTestUtils, KnownTestLocations, withEditTxn } from "@itwin/core-backend/lib/cjs/test/index";

// @ts-expect-error package.json will resolve from the lib/{cjs,esm} dir without copying it into the build output we deliver
// eslint-disable-next-line @itwin/import-within-package
import { version } from "../../../../../core/backend/package.json";

import { ConcurrencyQueue } from "./ConcurrencyQueue";

const ITWINJS_CORE_VERSION = version as string;
const CORE_MAJ_MIN = `${ITWINJS_CORE_VERSION.split(".")[0]}.${ITWINJS_CORE_VERSION.split(".")[1]}.x`;

/** Label for this run (e.g. baseline / newaddon / newaddon-sharedtsfn); keeps CSVs separate. */
const RUN_LABEL = (process.env.RUN_LABEL ?? "run").replace(/[^A-Za-z0-9._-]/g, "_");

/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable no-console */

const SUB_DIR = "ECSqlReaderConcurrentPerformance";

interface IHarnessConfig {
  /** Number of elements inserted for each class in `classNames` (one shared seed iModel). */
  elementsPerClass: number;
  /** PerfTestDomain classes to populate. The hierarchy is PerfElement <- Sub1 <- Sub2 <- Sub3. */
  classNames: string[];
  /** Worker-thread counts to sweep. The native concurrent-query default is 4. */
  workerThreadCounts: number[];
  /** Total number of ECSqlReader queries issued (timed) per case. */
  totalQueries: number;
  /** Maximum number of in-flight parallel queries. Each value is a separate case. */
  maxConcurrentRequestsCases: number[];
  /** Number of untimed queries run after (re)configuring workers to spin up the pool. */
  warmupQueries: number;
  /**
   * Each value is a separate case. When true, every generated statement embeds varying literals
   * so each ECSQL string is (almost) unique. Because the native addon caches prepared statements
   * per worker keyed by the exact ECSQL text, varying the text forces real preparation
   * (cache-miss path). When false, the literals are quantized to a small set so the same
   * statements repeat and the worker statement cache is exercised on the cache-hit path.
   */
  varyStatementsCases: boolean[];
  /** Times each case is repeated; the median run (by throughput) is reported to reduce noise. */
  repeatsPerCase: number;
  /** Seed for the deterministic statement generator so every sweep runs an identical stream. */
  randomSeed: number;
  /** Maximum number of cached prepared statements per worker. Native default is 40. */
  statementCacheSizePerWorker: number;
  /** Max queue size after which queries are rejected with QueueFull. Native default is 2000. */
  requestQueueSize: number;
  /** Per-query time quota in seconds. Native default is 60. */
  queryQuotaSeconds: number;
  /** Per-query memory quota in bytes. Native default is 8 MiB. */
  queryQuotaMemoryBytes: number;
}

interface ITaskResult {
  stats: QueryStats;
  rowCount: number;
  error?: unknown;
}

interface IWorkloadResult {
  wallSeconds: number;
  throughputQps: number;
  totalQueries: number;
  errorCount: number;
  distinctStatements: number;
  totalRows: number;
  avgBackendCpuMs: number;
  avgPrepareMs: number;
  avgBackendTotalMs: number;
  avgRoundTripMs: number;
  totalRetries: number;
  errorSamples: string[];
}

/** Small, fast, deterministic PRNG (mulberry32) so the query stream is reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates a stream of varied, valid ECSQL statements spanning several statement shapes so a
 * single cached prepared statement does not dominate the measurement.
 */
class EcsqlStatementGenerator {
  private readonly _rng: () => number;
  private readonly _seen = new Set<string>();

  public constructor(seed: number, private readonly _classNames: string[], private readonly _elementsPerClass: number, private readonly _vary: boolean) {
    this._rng = mulberry32(seed);
  }

  /** Number of distinct ECSQL strings produced so far (a proxy for statement-cache pressure). */
  public get distinctCount(): number {
    return this._seen.size;
  }

  private int(min: number, max: number): number {
    const span = Math.max(1, max - min + 1);
    if (this._vary)
      return min + Math.floor(this._rng() * span);
    // Quantize into a few buckets so the same statements recur (exercises the cache-hit path).
    const bucket = Math.floor(this._rng() * 3);
    return min + Math.min(span - 1, Math.floor((bucket / 3) * span));
  }

  private pickClass(): string {
    return this._classNames[Math.floor(this._rng() * this._classNames.length)];
  }

  /** Returns the next ECSQL statement to execute. */
  public next(): string {
    const cls = this.pickClass();
    const n = this._elementsPerClass;
    const templates: Array<() => string> = [
      () => `SELECT * FROM PerfTestDomain:${cls} LIMIT ${this.int(1, n)}`,
      () => `SELECT ECInstanceId, ECClassId, BaseStr, BaseLong, BaseDouble FROM PerfTestDomain:${cls} WHERE ECInstanceId >= ${this.int(1, n)} LIMIT ${this.int(1, n)}`,
      () => `SELECT COUNT(*) FROM PerfTestDomain:${cls} WHERE BaseDouble > ${(this.int(0, 1000) / 100 - 5).toFixed(3)}`,
      () => `SELECT BaseStr, BaseDouble FROM PerfTestDomain:${cls} ORDER BY ECInstanceId LIMIT ${this.int(1, n)} OFFSET ${this.int(0, Math.max(1, n - 1))}`,
      () => `SELECT $ FROM PerfTestDomain:${cls} LIMIT ${this.int(1, n)}`,
      () => `SELECT ECInstanceId FROM ONLY PerfTestDomain:${cls} LIMIT ${this.int(1, n)}`,
      () => `SELECT ECClassId, COUNT(*) cnt FROM PerfTestDomain:${cls} GROUP BY ECClassId HAVING COUNT(*) >= ${this.int(0, 1)}`,
      () => `SELECT e.ECInstanceId, m.ECInstanceId modelId FROM bis.Element e JOIN bis.Model m ON e.Model.Id = m.ECInstanceId WHERE e.ECInstanceId >= ${this.int(1, n)} LIMIT ${this.int(1, n)}`,
      () => `SELECT ECInstanceId, UserLabel FROM bis.GeometricElement3d WHERE ECInstanceId > ${this.int(1, n)} LIMIT ${this.int(1, n)}`,
      () => `SELECT Name FROM meta.ECClassDef WHERE Name LIKE 'Perf%' LIMIT ${this.int(1, 64)}`,
    ];
    const sql = templates[Math.floor(this._rng() * templates.length)]();
    this._seen.add(sql);
    return sql;
  }
}

const values: any = {
  baseStr: "PerfElement - InitValue", sub1Str: "PerfElementSub1 - InitValue",
  sub2Str: "PerfElementSub2 - InitValue", sub3Str: "PerfElementSub3 - InitValue",
  baseLong: "0x989680", sub1Long: "0x1312d00", sub2Long: "0x1c9c380", sub3Long: "0x2625a00",
  baseDouble: -3.1416, sub1Double: 2.71828, sub2Double: 1.414121, sub3Double: 1.61803398874,
};

interface TestElementProps {
  classFullName: string;
  model: string;
  category: string;
  code: any;
  geom: GeometryStreamProps;
  baseStr?: string;
  baseLong?: string;
  baseDouble?: number;
  sub1Str?: string;
  sub2Str?: string;
  sub3Str?: string;
  sub1Long?: string;
  sub2Long?: string;
  sub3Long?: string;
  sub1Double?: number;
  sub2Double?: number;
  sub3Double?: number;
}

function createElemProps(className: string, modId: string, catId: string): TestElementProps {
  const geomArray: Arc3d[] = [
    Arc3d.createXY(Point3d.create(0, 0), 5),
    Arc3d.createXY(Point3d.create(5, 5), 2),
    Arc3d.createXY(Point3d.create(-5, -5), 20),
  ];
  const geometryStream: GeometryStreamProps = [];
  for (const geom of geomArray) {
    geometryStream.push(GeomJson.Writer.toIModelJson(geom));
  }
  const elementProps: TestElementProps = {
    classFullName: `PerfTestDomain:${className}`,
    model: modId,
    category: catId,
    code: Code.createEmpty(),
    geom: geometryStream,
  };
  if (className.includes("Sub3")) {
    elementProps.sub3Str = values.sub3Str;
    elementProps.sub3Long = values.sub3Long;
    elementProps.sub3Double = values.sub3Double;
  }
  if (className.includes("Sub3") || className.includes("Sub2")) {
    elementProps.sub2Str = values.sub2Str;
    elementProps.sub2Long = values.sub2Long;
    elementProps.sub2Double = values.sub2Double;
  }
  if (className.includes("Sub")) {
    elementProps.sub1Str = values.sub1Str;
    elementProps.sub1Long = values.sub1Long;
    elementProps.sub1Double = values.sub1Double;
  }
  elementProps.baseStr = values.baseStr;
  elementProps.baseLong = values.baseLong;
  elementProps.baseDouble = values.baseDouble;
  return elementProps;
}

function ensureDirectoryExists(dir: string) {
  if (!IModelJsFs.existsSync(dir))
    IModelJsFs.mkdirSync(dir);
}

/**
 * Reconfigures the native concurrent-query manager. Shutting it down first forces the worker
 * pool to be recreated with the new configuration (notably `workerThreads`) on the next query.
 * This mirrors the backend's internal `ConcurrentQuery` helper, but the harness lives outside
 * the backend package so it calls the native addon directly via the exported `_nativeDb`.
 */
function applyConcurrentQueryConfig(db: IModelDb, config: DbQueryConfig): DbQueryConfig {
  const nativeDb = db[_nativeDb];
  nativeDb.concurrentQueryShutdown();
  return nativeDb.concurrentQueryResetConfig(config);
}

async function runQueryTask(db: IModelDb, sql: string): Promise<ITaskResult> {
  const reader = db.createQueryReader(sql);
  try {
    let rowCount = 0;
    while (await reader.step())
      rowCount++;
    return { stats: reader.stats, rowCount };
  } catch (error) {
    return { stats: reader.stats, rowCount: 0, error };
  }
}

/** Issues `totalQueries` ECSqlReader queries with at most `maxConcurrent` in flight at once. */
async function runWorkload(db: IModelDb, generator: EcsqlStatementGenerator, totalQueries: number, maxConcurrent: number): Promise<IWorkloadResult> {
  const queue = new ConcurrencyQueue<ITaskResult>(maxConcurrent);
  const sw = new StopWatch(undefined, true);
  const tasks: Array<Promise<ITaskResult>> = [];
  for (let i = 0; i < totalQueries; ++i) {
    const sql = generator.next();
    tasks.push(queue.push(async () => runQueryTask(db, sql)));
  }
  const results = await Promise.all(tasks);
  sw.stop();

  let totalRows = 0;
  let backendCpuMicros = 0;
  let prepareMs = 0;
  let backendTotalMs = 0;
  let roundTripMs = 0;
  let totalRetries = 0;
  const errorSamples = new Set<string>();
  for (const r of results) {
    totalRows += r.rowCount;
    backendCpuMicros += r.stats.backendCpuTime;
    prepareMs += r.stats.prepareTime;
    backendTotalMs += r.stats.backendTotalTime;
    roundTripMs += r.stats.totalTime;
    totalRetries += r.stats.retryCount;
    if (r.error !== undefined && errorSamples.size < 5)
      errorSamples.add(r.error instanceof Error ? r.error.message : "non-Error value thrown");
  }

  const errorCount = results.filter((r) => r.error !== undefined).length;
  const count = results.length || 1;
  const wallSeconds = sw.currentSeconds;
  return {
    wallSeconds,
    throughputQps: wallSeconds > 0 ? results.length / wallSeconds : 0,
    totalQueries: results.length,
    errorCount,
    distinctStatements: generator.distinctCount,
    totalRows,
    avgBackendCpuMs: backendCpuMicros / 1000 / count,
    avgPrepareMs: prepareMs / count,
    avgBackendTotalMs: backendTotalMs / count,
    avgRoundTripMs: roundTripMs / count,
    totalRetries,
    errorSamples: [...errorSamples],
  };
}

describe("ECSqlReaderConcurrentPerformanceTests", () => {
  const outDir: string = path.join(KnownTestLocations.outputDir, SUB_DIR);
  const reporter = new Reporter();
  const config = require(path.join(__dirname, "ECSqlReaderConcurrentPerfConfig.json")) as IHarnessConfig; // eslint-disable-line @typescript-eslint/no-require-imports
  let seedFileName: string;

  before(async () => {
    ensureDirectoryExists(KnownTestLocations.outputDir);
    ensureDirectoryExists(outDir);

    await IModelHost.startup();

    // A single seed iModel populated with every configured class so cross-class, polymorphic and
    // join queries all return data.
    const fileName = `ECSqlReaderConcurrentPerf_seed_${config.elementsPerClass}x${config.classNames.length}.bim`;
    seedFileName = path.join(outDir, fileName);
    if (IModelJsFs.existsSync(seedFileName))
      return;

    const seedIModel = SnapshotDb.createEmpty(IModelTestUtils.prepareOutputFile(SUB_DIR, fileName), { rootSubject: { name: "ECSqlReaderConcurrentPerfTest" } });
    const testSchemaName = path.join(KnownTestLocations.assetsDir, "PerfTestDomain.ecschema.xml");
    await seedIModel.importSchemas([testSchemaName]);
    seedIModel[_nativeDb].resetBriefcaseId(BriefcaseIdValue.Unassigned);

    const [, newModelId] = withEditTxn(seedIModel, (txn) => IModelTestUtils.createAndInsertPhysicalPartitionAndModel(txn, Code.createEmpty(), true));
    let spatialCategoryId = SpatialCategory.queryCategoryIdByName(seedIModel, IModel.dictionaryId, "MySpatialCategory");
    if (undefined === spatialCategoryId)
      spatialCategoryId = withEditTxn(seedIModel, (txn) => SpatialCategory.insert(txn, IModel.dictionaryId, "MySpatialCategory", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() })));

    withEditTxn(seedIModel, (txn) => {
      for (const name of config.classNames) {
        for (let m = 0; m < config.elementsPerClass; ++m) {
          const elementProps = createElemProps(name, newModelId, spatialCategoryId);
          const geomElement = seedIModel.elements.createElement(elementProps);
          const id = txn.insertElement(geomElement.toJSON());
          assert.isTrue(Id64.isValidId64(id), "insert worked");
        }
      }
    }); // auto-saves

    seedIModel.close();
  });

  after(async () => {
    const csvPath = path.join(outDir, `ECSqlReaderConcurrentPerformanceResults_${RUN_LABEL}.csv`);
    reporter.exportCSV(csvPath);
    console.log(`ECSqlReader concurrent perf results written to: ${csvPath}`);
    await IModelHost.shutdown();
  });

  it("parallel ECSqlReader throughput across worker-thread counts", async () => {
    const testFileName = IModelTestUtils.prepareOutputFile(SUB_DIR, "ECSqlReaderConcurrentPerf_run.bim");
    const perfimodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);

    const totalErrors: string[] = [];
    try {
      console.log(`ECSqlReader concurrent perf | runLabel=${RUN_LABEL} | ${config.classNames.length} classes x ${config.elementsPerClass} elements | totalQueries=${config.totalQueries} | repeats=${config.repeatsPerCase} | sharedTsfnEnv=${process.env.ITWIN_CONCURRENT_QUERY_SHARED_TSFN ?? "<unset>"}`);

      for (const varyStatements of config.varyStatementsCases) {
        for (const maxConcurrent of config.maxConcurrentRequestsCases) {
          for (const workerThreads of config.workerThreadCounts) {
            const runs: IWorkloadResult[] = [];
            let appliedWorkers = workerThreads;
            for (let repeat = 0; repeat < config.repeatsPerCase; ++repeat) {
              // Reconfigure (and thereby clear per-worker statement caches) before each run.
              const applied = applyConcurrentQueryConfig(perfimodel, {
                workerThreads,
                statementCacheSizePerWorker: config.statementCacheSizePerWorker,
                requestQueueSize: config.requestQueueSize,
                ignoreDelay: true,
                globalQuota: { time: config.queryQuotaSeconds, memory: config.queryQuotaMemoryBytes },
              });
              appliedWorkers = applied.workerThreads ?? workerThreads;

              // Spin up the freshly configured worker pool before timing.
              const warmupGen = new EcsqlStatementGenerator(config.randomSeed + 1, config.classNames, config.elementsPerClass, varyStatements);
              await runWorkload(perfimodel, warmupGen, config.warmupQueries, maxConcurrent);

              // Every repeat runs the identical (seeded) query stream for a fair comparison.
              const generator = new EcsqlStatementGenerator(config.randomSeed, config.classNames, config.elementsPerClass, varyStatements);
              runs.push(await runWorkload(perfimodel, generator, config.totalQueries, maxConcurrent));
            }

            runs.sort((a, b) => a.throughputQps - b.throughputQps);
            const median = runs[Math.floor(runs.length / 2)];
            const minQps = runs[0].throughputQps;
            const maxQps = runs[runs.length - 1].throughputQps;
            // Aggregate errors from every repeat, not just the median run, so the
            // zero-error assertion below cannot pass while a non-median run had errors.
            for (const run of runs)
              totalErrors.push(...run.errorSamples);

            console.log(
              `vary=${varyStatements ? "Y" : "N"} maxConc=${String(maxConcurrent).padStart(3)} workers=${String(workerThreads).padStart(2)} (applied=${appliedWorkers}) | ` +
              `medThroughput=${median.throughputQps.toFixed(1)} q/s (min=${minQps.toFixed(0)}, max=${maxQps.toFixed(0)}) | ` +
              `wall=${(median.wallSeconds * 1000).toFixed(0)}ms | distinctSql=${median.distinctStatements} | rows=${median.totalRows} | ` +
              `avgBackendCpu=${median.avgBackendCpuMs.toFixed(2)}ms | avgPrepare=${median.avgPrepareMs.toFixed(2)}ms | ` +
              `avgRoundTrip=${median.avgRoundTripMs.toFixed(2)}ms | retries=${median.totalRetries} | errors=${median.errorCount}`,
            );

            const info = {
              RunLabel: RUN_LABEL,
              WorkerThreads: workerThreads,
              MaxConcurrentRequests: maxConcurrent,
              VaryStatements: varyStatements,
              TotalQueries: config.totalQueries,
              RepeatsPerCase: config.repeatsPerCase,
              ElementsPerClass: config.elementsPerClass,
              Classes: config.classNames.join("+"),
              DistinctStatements: median.distinctStatements,
              StatementCacheSizePerWorker: config.statementCacheSizePerWorker,
              Errors: median.errorCount,
              CoreVersion: CORE_MAJ_MIN,
            };
            reporter.addEntry("ECSqlReaderConcurrentPerformanceTests", "Throughput", "Queries per second", median.throughputQps, info);
            reporter.addEntry("ECSqlReaderConcurrentPerformanceTests", "ThroughputMax", "Queries per second", maxQps, info);
            reporter.addEntry("ECSqlReaderConcurrentPerformanceTests", "WallTime", "Total time (ms)", median.wallSeconds * 1000, info);
            reporter.addEntry("ECSqlReaderConcurrentPerformanceTests", "AvgBackendCpuTime", "Average time (ms)", median.avgBackendCpuMs, info);
            reporter.addEntry("ECSqlReaderConcurrentPerformanceTests", "AvgPrepareTime", "Average time (ms)", median.avgPrepareMs, info);
            reporter.addEntry("ECSqlReaderConcurrentPerformanceTests", "AvgRoundTripTime", "Average time (ms)", median.avgRoundTripMs, info);
            reporter.addEntry("ECSqlReaderConcurrentPerformanceTests", "RowsReturned", "Total rows", median.totalRows, info);
          }
        }
      }
    } finally {
      perfimodel.close();
    }

    if (totalErrors.length > 0)
      console.log(`ECSqlReader perf encountered query errors (showing up to 5): ${totalErrors.join(" | ")}`);
    assert.strictEqual(totalErrors.length, 0, "all generated ECSQL statements should execute without error");
  });
});
