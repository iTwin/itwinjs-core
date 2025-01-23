import { Logger, LogLevel, StopWatch } from "@itwin/core-bentley";
import { DbQueryConfig, ECSqlReader, QueryStats } from "@itwin/core-common";
import { expect } from "chai";
import { ConcurrentQuery } from "../../ConcurrentQuery";
import { ECDb } from "../../ECDb";
import { IModelDb, SnapshotDb } from "../../IModelDb";
import { _nativeDb } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";

interface ITaskResult {
  stats: QueryStats;
  error?: any;
}

interface ISenario {
  name: string;
  config?: DbQueryConfig;
  totalBatches: number;
  taskPerBatch: number;
  createReader: (db: ECDb | IModelDb) => ECSqlReader;
}


class LoadSimulator {
  constructor(public db: ECDb | IModelDb, public senario: ISenario) { }
  private async runQueryTask(reader: ECSqlReader): Promise<ITaskResult> {
    try {
      while (await reader.step()) { }
      return { stats: reader.stats };
    } catch (err) {
      return { stats: reader.stats, error: err };
    }
  }

  public async run() {
    ConcurrentQuery.shutdown(this.db[_nativeDb]);
    if (this.senario.config) {
      const config = ConcurrentQuery.resetConfig(this.db[_nativeDb], this.senario.config);
      // eslint-disable-next-line no-console
      console.log(config);
    }
    const overalTime = new StopWatch();
    overalTime.start();
    const results: ITaskResult[] = [];
    for (let i = 0; i < this.senario.totalBatches; ++i) {
      const promises: Promise<ITaskResult>[] = [];
      const readerTasks = Array(this.senario.taskPerBatch).fill(undefined).map(() => this.senario.createReader(this.db));
      readerTasks.forEach((reader) => {
        promises.push(this.runQueryTask(reader));
      });
      results.push(... await Promise.all(promises));

    }
    overalTime.stop();
    const errors = results.filter((x) => x.error !== undefined);
    const errorsMap = new Map<string, number>();
    errors.forEach((x) => {
      if (x.error instanceof Error) {
        if (!errorsMap.has(x.error.message)) {
          errorsMap.set(x.error.message, 1);
        } else {
          errorsMap.set(x.error.message, errorsMap.get(x.error.message)! + 1);
        }
      } else {
        if (!errorsMap.has("error")) {
          errorsMap.set("error", 1);
        } else {
          errorsMap.set("error", errorsMap.get("error")! + 1);
        }
      }
    });
    const errorCount = errors.length;
    let backendCpuTime: bigint = BigInt(0);
    let backendTotalTime: bigint = BigInt(0);
    let backendMemUsed: bigint = BigInt(0);
    let backendRowsReturned: bigint = BigInt(0);
    let totalTime: bigint = BigInt(0);
    let retryCount: bigint = BigInt(0);
    let prepareTime: bigint = BigInt(0);

    // Calculate average
    results.forEach((r: ITaskResult) => {
      backendCpuTime += BigInt(r.stats.backendCpuTime);
      backendTotalTime += BigInt(r.stats.backendTotalTime);
      backendMemUsed += BigInt(r.stats.backendMemUsed);
      backendRowsReturned += BigInt(r.stats.backendRowsReturned);
      totalTime += BigInt(r.stats.totalTime);
      retryCount += BigInt(r.stats.retryCount);
      prepareTime += BigInt(r.stats.prepareTime);
    });

    backendCpuTime /= BigInt(results.length);
    backendTotalTime /= BigInt(results.length);
    backendMemUsed /= BigInt(results.length);
    backendRowsReturned /= BigInt(results.length);
    totalTime /= BigInt(results.length);
    retryCount /= BigInt(results.length);
    // prepareTime /= BigInt(results.length);

    return {
      result: {
        backendCpuTime,
        backendTotalTime,
        backendMemUsed,
        backendRowsReturned,
        totalTime,
        retryCount,
        prepareTime,
      },
      overalTimeInSec: overalTime.currentSeconds,
      errorCount,
      totalQueries: results.length,
      errorMap: errorsMap
    };

  }
}

describe.skip("ConcurrentQueryLoad", () => {
  it("should run", async () => {
    Logger.initializeToConsole();
    Logger.setLevel("ECDb.ConcurrentQuery", LogLevel.Trace);
    // {
    //   workerThreads: 4,
    //   requestQueueSize: 2000,
    //   ignorePriority: false,
    //   ignoreDelay: true,
    //   doNotUsePrimaryConnToPrepare: false,
    //   autoShutdowWhenIdlelForSeconds: 300,
    //   statementCacheSizePerWorker: 40,
    //   monitorPollInterval: 1000,
    //   memoryMapFileSize: 0,
    //   allowTestingArgs: false,
    //   globalQuota: { time: 60, memory: 8388608 }
    // }

    const senario: ISenario = {
      name: "ConcurrentQueryLoad",
      config: {

      },
      totalBatches: 1,
      taskPerBatch: 1,
      createReader: (dbs: ECDb | IModelDb) => {
        const quries = [
          {
            sql: `
            WITH sequence(n) AS (
              SELECT  1
              UNION ALL
              SELECT n + 1 FROM sequence WHERE n < 10000
            )
            SELECT  COUNT(*)
            FROM bis.SpatialIndex i, sequence s
            WHERE i.ECInstanceId MATCH  iModel_spatial_overlap_aabb(
              iModel_bbox(random(), random(), random(), random(),random(), random()))`
          },
          {
            sql: `
            WITH sequence(n) AS (
              SELECT  1
              UNION ALL
              SELECT n + 1 FROM sequence WHERE n < 1000000
            )
            SELECT  COUNT(*) FROM sequence`
          },
          {
            sql: "SELECT $ FROM bis.Element LIMIT 10000"
          }
        ];
        const idx = Math.floor(Math.random() * quries.length);
        return dbs.createQueryReader(quries[idx].sql);
      }
    };

    const verySmallFile = IModelTestUtils.resolveAssetFile("test.bim");
    const db = SnapshotDb.openFile(verySmallFile);
    const simulator = new LoadSimulator(db, senario);
    const result = await simulator.run();
    // eslint-disable-next-line no-console
    console.log(result);
    db.close();
    expect(result.errorCount).to.be.equal(0);
  });

});