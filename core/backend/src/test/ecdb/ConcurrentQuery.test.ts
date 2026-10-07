import { DbQueryRequest, DbQueryResponse, DbResponseStatus, QueryBinder } from "@itwin/core-common";
import { expect } from "chai";
import * as os from "os";
import { ConcurrentQuery } from "../../ConcurrentQuery";
import { SnapshotDb } from "../../IModelDb";
import { _nativeDb } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

/**
 * The native default for `workerThreads` is 4, capped at the machine's hardware concurrency
 * (2-core CI agents report 2). An explicit request above hardware concurrency is rejected and
 * falls back to that default rather than being clamped.
 */
function defaultWorkerThreads(): number {
  return Math.min(4, os.availableParallelism());
}

describe("ConcurrentQuery", () => {
  it("default config", () => {
    const testFile = IModelTestUtils.resolveAssetFile("test.bim");
    const db = SnapshotDb.openFile(testFile);
    const defaultConfig = {
      autoShutdownWhenIdleForSeconds: 1800,
      doNotUsePrimaryConnToPrepare: false,
      globalQuota: { time: 60, memory: 8388608 },
      ignoreDelay: true,
      ignorePriority: false,
      memoryMapFileSize: 0,
      monitorPollInterval: 5000,
      progressOpCount: 5000,
      requestQueueSize: 2000,
      statementCacheSizePerWorker: 40,
      enableCursors: true,
      maxCursorsPerWorker: -1,
      cursorIdleTimeout: 30,
      workerThreads: defaultWorkerThreads(),
    };
    const config = ConcurrentQuery.resetConfig(db[_nativeDb], {});
    expect(config).deep.eq(defaultConfig);
    db.close();
  });

  it("modify config", () => {
    const testFile = IModelTestUtils.resolveAssetFile("test.bim");
    const db = SnapshotDb.openFile(testFile);
    const modifiedConfig = {
      autoShutdownWhenIdleForSeconds: 100,
      doNotUsePrimaryConnToPrepare: true,
      globalQuota: { time: 10, memory: 1000000 },
      ignoreDelay: false,
      ignorePriority: true,
      memoryMapFileSize: 100,
      monitorPollInterval: 2000,
      progressOpCount: 6000,
      requestQueueSize: 1000,
      statementCacheSizePerWorker: 20,
      enableCursors: false,
      maxCursorsPerWorker: 3,
      cursorIdleTimeout: 10,
      workerThreads: 1,
    };
    const config = ConcurrentQuery.resetConfig(db[_nativeDb], modifiedConfig);
    expect(config).deep.eq(modifiedConfig);
    db.close();
  });

  it("workerThreads above hardware concurrency falls back to the default", () => {
    const testFile = IModelTestUtils.resolveAssetFile("test.bim");
    const db = SnapshotDb.openFile(testFile);
    const requested = os.availableParallelism() + 8;
    const config = ConcurrentQuery.resetConfig(db[_nativeDb], { workerThreads: requested });
    expect(config.workerThreads).eq(defaultWorkerThreads());
    db.close();
  });

  it("resumes finite pages without losing rows, with OFFSET fallback when disabled", async () => {
    const db = SnapshotDb.openFile(IModelTestUtils.resolveAssetFile("test.bim"));
    try {
      for (const enableCursors of [false, true]) {
        ConcurrentQuery.shutdown(db[_nativeDb]);
        ConcurrentQuery.resetConfig(db[_nativeDb], { workerThreads: 1, enableCursors, globalQuota: { time: 60, memory: 1 } });
        const rows: number[] = [];
        let resumed = 0;
        while (rows.length < 20) {
          const resp = await ConcurrentQuery.executeQueryRequest(db[_nativeDb], {
            query: "WITH sequence(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM sequence WHERE n<50) SELECT n FROM sequence ORDER BY n DESC",
            cursorId: "finite-reader",
            limit: { offset: 5 + rows.length, count: 20 - rows.length },
          });
          expect(resp.status).eq(DbResponseStatus.Partial);
          expect(resp.data).deep.eq([[45 - rows.length]]);
          rows.push(resp.data[0][0]);
          if (resp.stats.resumed)
            ++resumed;
        }
        expect(rows).deep.eq(Array.from({ length: 20 }, (_, i) => 45 - i));
        expect(resumed).eq(enableCursors ? 19 : 0);
      }
    } finally {
      db.close();
    }
  });

  it("isolates readers and bindings and falls back after cursor eviction", async () => {
    const db = SnapshotDb.openFile(IModelTestUtils.resolveAssetFile("test.bim"));
    try {
      ConcurrentQuery.resetConfig(db[_nativeDb], { workerThreads: 1, maxCursorsPerWorker: 1, globalQuota: { time: 60, memory: 1 } });
      const query = "WITH sequence(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM sequence WHERE n<10) SELECT n+? FROM sequence ORDER BY n";
      const page = async (cursorId: string, offset: number, value: number) => ConcurrentQuery.executeQueryRequest(db[_nativeDb], {
        query, cursorId, args: new QueryBinder().bindInt(1, value).serialize(), limit: { offset, count: -1 },
      });
      expect((await page("a", 0, 0)).data).deep.eq([[1]]);
      expect((await page("a", 1, 0)).stats.resumed).eq(true);
      expect((await page("b", 0, 100)).data).deep.eq([[101]]);
      const evicted = await page("a", 2, 0);
      expect(evicted.stats.resumed).eq(false);
      expect(evicted.data).deep.eq([[3]]);
      const rebound = await page("a", 3, 100);
      expect(rebound.stats.resumed).eq(false);
      expect(rebound.data).deep.eq([[104]]);
    } finally {
      db.close();
    }
  });

  it("time limit check", async () => {
    const testFile = IModelTestUtils.resolveAssetFile("test.bim");
    const db = SnapshotDb.openFile(testFile);
    ConcurrentQuery.resetConfig(db[_nativeDb], { globalQuota: { time: 1, memory: 100000 }, progressOpCount: 1000 });
    // await runSingleRequest(db, `SELECT 1`);
    const req: DbQueryRequest = {
      query: `WITH sequence(n,k) AS (
                SELECT  1,1 UNION ALL SELECT n + 1, random() FROM sequence WHERE n < 10000000
              ) SELECT COUNT(*) FROM sequence s`
    };

    const resp = await ConcurrentQuery.executeQueryRequest(db[_nativeDb], req);
    expect(resp.status).equals(DbResponseStatus.Partial);
    expect(resp.stats.timeLimit).equals(1000);
    expect(resp.stats.memLimit).equals(100000);
    expect(resp.stats.cpuTime).to.be.closeTo(1000970, 500000);
    expect(resp.stats.totalTime).to.be.closeTo(1001, 100);
    expect(resp.stats.memUsed).to.be.closeTo(2, 3);
    // prepareTime varies on CI: the first query prepares against the (cold) shared schema-source
    // connection, so assert only that it is negligible relative to the ~1000ms execution rather than
    // pinning it to a tight tolerance (which flakes -- e.g. observed 7ms against a 0 +/- 4 bound).
    expect(resp.stats.prepareTime).to.be.lessThan(100);
    db.close();
  });

  it("memory limit check", async () => {
    const testFile = IModelTestUtils.resolveAssetFile("test.bim");
    const db = SnapshotDb.openFile(testFile);
    ConcurrentQuery.resetConfig(db[_nativeDb], { globalQuota: { time: 60, memory: 1000 }, progressOpCount: 1000 });
    // await runSingleRequest(db, `SELECT 1`);
    const req: DbQueryRequest = {
      query: `WITH sequence(n) AS (
                SELECT  1
                UNION ALL
                SELECT n + 1 FROM sequence WHERE n < 10000000
              )
              SELECT 'xxxxxxxxxx-xxxxxxxxxx-xxxxxxxxxx' FROM sequence s`
    };

    const resp = await ConcurrentQuery.executeQueryRequest(db[_nativeDb], req);
    expect(resp.status).equals(DbResponseStatus.Partial);
    expect(resp.stats.timeLimit).equals(60000);
    expect(resp.stats.memLimit).equals(1000);
    expect(resp.stats.memUsed).to.be.closeTo(1037, 100);
    db.close();
  });

  it("prepare error", async () => {
    const testFile = IModelTestUtils.resolveAssetFile("test.bim");
    const db = SnapshotDb.openFile(testFile);
    const req: DbQueryRequest = {
      query: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
    };

    const resp = await ConcurrentQuery.executeQueryRequest(db[_nativeDb], req);
    expect(resp.status).equals(DbResponseStatus.Error_ECSql_PreparedFailed);
    db.close();
  });

  it.skip("restart query #flaky", async () => {
    const testFile = IModelTestUtils.resolveAssetFile("test.bim");
    const db = SnapshotDb.openFile(testFile);
    ConcurrentQuery.resetConfig(db[_nativeDb], { globalQuota: { time: 60, memory: 10000000 }, progressOpCount: 1000 });
    const req0: DbQueryRequest = {
      query: `WITH sequence(n) AS (
                SELECT  1 UNION ALL SELECT n + 1 FROM sequence WHERE n < 10000000
              ) SELECT n FROM sequence s`,
      restartToken: "Blah",
    };

    const req1: DbQueryRequest = {
      query: `WITH sequence(n) AS (
                SELECT  1 UNION ALL SELECT n + 1 FROM sequence WHERE n < 1000
              ) SELECT n FROM sequence s`,
      restartToken: "Blah",
    };

    const resp1 = ConcurrentQuery.executeQueryRequest(db[_nativeDb], req0);
    await delay(1);
    const resp2 = ConcurrentQuery.executeQueryRequest(db[_nativeDb], req1);
    const resp = await Promise.all([resp1, resp2]);
    expect(resp[0].status).equals(DbResponseStatus.Cancel); // can result in DbResponseStatus.Partial instead of DbResponseStatus.Cancel
    expect(resp[1].status).equals(DbResponseStatus.Done);
    db.close();
  });

  it("queue limit check", async () => {
    const testFile = IModelTestUtils.resolveAssetFile("test.bim");
    const db = SnapshotDb.openFile(testFile);
    ConcurrentQuery.resetConfig(db[_nativeDb], { requestQueueSize: 40, globalQuota: { time: 5, memory: 100000 } });
    const req: DbQueryRequest = {
      query: `WITH sequence(n) AS (
                SELECT  1 UNION ALL SELECT n + 1 FROM sequence WHERE n < 10000000
              ) SELECT n FROM sequence s`,
    };

    const responsePromises: Promise<DbQueryResponse>[] = [];
    for (let i = 0; i < 60; ++i) {
      responsePromises.push(ConcurrentQuery.executeQueryRequest(db[_nativeDb], req));
    }
    const responses = await Promise.all(responsePromises);
    const queueResponses = Array.from(responses.filter((x) => x.status === DbResponseStatus.QueueFull));
    expect(queueResponses.length).to.be.greaterThanOrEqual(10);
    db.close();
  });

  it("timeout check", async () => {
    const testFile = IModelTestUtils.resolveAssetFile("test.bim");
    const db = SnapshotDb.openFile(testFile);
    ConcurrentQuery.resetConfig(db[_nativeDb], { monitorPollInterval: 1, globalQuota: { time: 5, memory: 10000000 } });
    const req: DbQueryRequest = {
      query: `WITH sequence(n) AS (
                SELECT  1 UNION ALL SELECT n + 1 FROM sequence WHERE n < 10000000
              ) SELECT n FROM sequence s`,
    };

    const responsePromises: Promise<DbQueryResponse>[] = [];
    for (let i = 0; i < 100; ++i) {
      responsePromises.push(ConcurrentQuery.executeQueryRequest(db[_nativeDb], req));
    }
    const responses = await Promise.all(responsePromises);
    const queueResponses = Array.from(responses.filter((x) => x.status === DbResponseStatus.Timeout));
    expect(queueResponses.length).to.be.greaterThanOrEqual(10);
    db.close();
  });

  it("should handle concurrent queries during shutdown without deadlock", async () => {
    const testFile = IModelTestUtils.resolveAssetFile("test.bim");
    const iModelDb = SnapshotDb.openFile(testFile);
    // Configure for maximum contention
    const config = {
      requestQueueSize: 1000,
      statementCacheSizePerWorker: 1, // Force frequent prepare calls
    };

    // Reset configuration
    ConcurrentQuery.resetConfig(iModelDb[_nativeDb], config);

    const responsePromises: Promise<DbQueryResponse>[] = [];
    const spamPromises: Promise<void>[] = [];
    let shouldStop = false;

    const spam = async () => {
      while (!shouldStop) {
        // Use random numbers to prevent query caching
        const query = `
            WITH sequence(n,k) AS (
                SELECT  1,1 UNION ALL SELECT n + 1, random() FROM sequence WHERE n < 10000000
              ) SELECT COUNT(*) FROM sequence s
          `;
        const request: DbQueryRequest = { query };
        const p = ConcurrentQuery.executeQueryRequest(iModelDb[_nativeDb], request);
        responsePromises.push(p);
        await new Promise(resolve => setImmediate(resolve));
      }
    };

    // Start spamming simple queries to increase contention
    spamPromises.push(spam());
    // Let queries start and establish contention
    await new Promise(resolve => setTimeout(resolve, 10));

    ConcurrentQuery.shutdown(iModelDb[_nativeDb]);

    shouldStop = true;

    // Wait for all promises to complete
    const results = await Promise.allSettled(responsePromises);
    await Promise.allSettled(spamPromises);

    const satisfiesShutDownResponse = results.some((result) => result.status === "fulfilled" && result.value.status === DbResponseStatus.ShuttingDown);

    expect(satisfiesShutDownResponse).to.be.true; // some queries should face shutdown

    // Restore original config by resetting to default
    ConcurrentQuery.resetConfig(iModelDb[_nativeDb], {});
    iModelDb.close();
  });
});
