import { DbQueryRequest, DbQueryResponse, DbRequestKind, DbResponse, DbResponseKind, DbResponseStatus, DbValueFormat, QueryBinder } from "@itwin/core-common";
import { expect } from "chai";
import { deserialize, serialize } from "node:v8";
import * as os from "os";
import * as sinon from "sinon";
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
      useV8Serialization: false,
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
      useV8Serialization: false,
      maxCursorsPerWorker: 3,
      cursorIdleTimeout: 10,
      workerThreads: 1,
    };
    const config = ConcurrentQuery.resetConfig(db[_nativeDb], modifiedConfig);
    expect(config).deep.eq(modifiedConfig);
    db.close();
  });

  it("decodes V8 query responses without changing the reader response shape", async () => {
    const db = SnapshotDb.openFile(IModelTestUtils.resolveAssetFile("test.bim"));
    let stub: sinon.SinonStub | undefined;
    try {
      const expected = await ConcurrentQuery.executeQueryRequest(db[_nativeDb], { query: "SELECT NULL, 1, NULL" });
      const payload = { ...expected, data: serialize(expected.data), dataEncoding: "v8" };
      stub = sinon.stub(db[_nativeDb], "concurrentQueryExecute").callsFake((_request, onResponse) => onResponse(payload));
      const actual = await ConcurrentQuery.executeQueryRequest(db[_nativeDb], { query: "SELECT NULL, 1, NULL" });
      expect(actual).deep.eq(expected);
      expect(actual.kind).eq(DbResponseKind.ECSql);
      expect(actual).not.to.have.property("dataEncoding");
    } finally {
      stub?.restore();
      db.close();
    }
  });

  it("rejects malformed V8 query payloads and row-count mismatches", async () => {
    const db = SnapshotDb.openFile(IModelTestUtils.resolveAssetFile("test.bim"));
    let stub: sinon.SinonStub | undefined;
    try {
      const expected = await ConcurrentQuery.executeQueryRequest(db[_nativeDb], { query: "SELECT 1" });
      for (const data of [Buffer.from([0xff, 15]), serialize(123), serialize([])]) {
        const payload = { ...expected, data, dataEncoding: "v8" };
        stub = sinon.stub(db[_nativeDb], "concurrentQueryExecute").callsFake((_request, onResponse) => onResponse(payload));
        await expect(ConcurrentQuery.executeQueryRequest(db[_nativeDb], { query: "SELECT 1" })).rejectedWith(Error);
        stub.restore();
        stub = undefined;
      }
    } finally {
      stub?.restore();
      db.close();
    }
  });

  it("rejects explicit V8 configuration with an unsupported native addon", () => {
    const db = SnapshotDb.openFile(IModelTestUtils.resolveAssetFile("test.bim"));
    const stub = sinon.stub(db[_nativeDb], "concurrentQueryResetConfig").returns({});
    try {
      expect(() => ConcurrentQuery.resetConfig(db[_nativeDb], { useV8Serialization: true })).throws("does not support useV8Serialization");
      expect(ConcurrentQuery.resetConfig(db[_nativeDb], { useV8Serialization: false })).deep.eq({});
    } finally {
      stub.restore();
      db.close();
    }
  });

  it("preserves rendered values and finite paging through V8 and JSON transports", async () => {
    const db = SnapshotDb.openFile(IModelTestUtils.resolveAssetFile("test.bim"));
    const retained: { data: Uint8Array; copy: Uint8Array }[] = [];
    const text = `${"x".repeat(16384)}"\\\n\t\u00e9`;
    const requests: DbQueryRequest[] = [
      { query: "SELECT NULL, 1, NULL" },
      { query: "SELECT NULL" },
      { query: "SELECT 1 FROM meta.ECClassDef WHERE 1=0" },
      {
        query: "SELECT ECInstanceId, ECClassId, Model.Id, CodeValue, UserLabel, JsonProperties FROM BisCore.Element ORDER BY ECInstanceId",
        limit: { count: 10, offset: 0 }, convertClassIdsToClassNames: true,
      },
      {
        query: "WITH sequence(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM sequence WHERE n<4) SELECT n, ?, NULL, ?, NULL FROM sequence ORDER BY n",
        args: new QueryBinder().bindString(1, text).bindDouble(2, 9.9999999999999995e-21).serialize(),
      },
    ];
    try {
      const expected: DbQueryResponse[] = [];
      for (const useV8Serialization of [false, true, false]) {
        ConcurrentQuery.shutdown(db[_nativeDb]);
        expect(ConcurrentQuery.resetConfig(db[_nativeDb], { useV8Serialization }).useV8Serialization).eq(useV8Serialization);
        for (const usePrimaryConn of [false, true]) {
          const rawRequest: DbQueryRequest = { kind: DbRequestKind.ECSql, query: requests[0].query, usePrimaryConn };
          const raw = await new Promise<DbResponse>(resolve =>
            db[_nativeDb].concurrentQueryExecute(rawRequest, resolve));
          if (!("data" in raw))
            throw new Error(`Native query returned no data: ${raw.error}`);
          if (useV8Serialization) {
            expect("dataEncoding" in raw && raw.dataEncoding).eq("v8");
            if (!(raw.data instanceof Uint8Array))
              throw new Error("Expected an owned native binary query response");
            expect(raw.data.byteLength).eq(raw.stats.memUsed);
            expect(deserialize(raw.data)).deep.eq([[null, 1]]);
            retained.push({ data: raw.data, copy: Uint8Array.from(raw.data) });
          } else {
            expect(raw).not.to.have.property("dataEncoding");
            expect(raw.data).deep.eq([[null, 1]]);
          }
        }
        for (let i = 0; i < requests.length; ++i) {
          for (const usePrimaryConn of [false, true]) {
            const response = await ConcurrentQuery.executeQueryRequest(db[_nativeDb], { ...requests[i], usePrimaryConn });
            expect(response.status, `query=${i}, primary=${usePrimaryConn}, v8=${useV8Serialization}: ${response.error}`).eq(DbResponseStatus.Done);
            if (expected.length <= i)
              expected.push(response);
            expect(response.data).deep.eq(expected[i].data);
            expect(response.meta).deep.eq(expected[i].meta);
            expect(response.rowCount).eq(expected[i].rowCount);
          }
        }
      }
      for (const useV8Serialization of [false, true]) {
        ConcurrentQuery.shutdown(db[_nativeDb]);
        ConcurrentQuery.resetConfig(db[_nativeDb], { useV8Serialization, workerThreads: 1, globalQuota: { time: 60, memory: 1 } });
        for (let offset = 0; offset < 4; ++offset) {
          const response = await ConcurrentQuery.executeQueryRequest(db[_nativeDb], {
            query: requests[4].query, args: requests[4].args, cursorId: "serialization-reader", limit: { offset, count: 4 - offset },
          });
          expect(response.status).eq(DbResponseStatus.Partial);
          expect(response.data).deep.eq([expected[4].data[offset]]);
          expect(response.stats.resumed).eq(offset > 0);
        }
      }
    } finally {
      ConcurrentQuery.shutdown(db[_nativeDb]);
      ConcurrentQuery.resetConfig(db[_nativeDb], {});
      db.close();
    }
    for (const { data, copy } of retained)
      expect([...data]).deep.eq([...copy]);
  });

  it("workerThreads above hardware concurrency falls back to the default", () => {
    const testFile = IModelTestUtils.resolveAssetFile("test.bim");
    const db = SnapshotDb.openFile(testFile);
    const requested = os.availableParallelism() + 8;
    const config = ConcurrentQuery.resetConfig(db[_nativeDb], { workerThreads: requested });
    expect(config.workerThreads).eq(defaultWorkerThreads());
    db.close();
  });

  it("round-trips the page-cache target in KiB and rejects invalid sizes", () => {
    const db = SnapshotDb.openFile(IModelTestUtils.resolveAssetFile("test.bim"));
    try {
      expect(ConcurrentQuery.resetConfig(db[_nativeDb], {}).cacheSizeInKB).eq(undefined);
      for (const cacheSizeInKB of [0, 8192, 2147483647])
        expect(ConcurrentQuery.resetConfig(db[_nativeDb], { cacheSizeInKB }).cacheSizeInKB).eq(cacheSizeInKB);
      for (const cacheSizeInKB of [-1, 1.5, 2147483648, NaN, Infinity, -Infinity])
        expect(ConcurrentQuery.resetConfig(db[_nativeDb], { cacheSizeInKB }).cacheSizeInKB).eq(undefined);
    } finally {
      db.close();
    }
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

  it("preserves class and navigation rendering across worker connections", async () => {
    const db = SnapshotDb.openFile(IModelTestUtils.resolveAssetFile("test.bim"));
    try {
      ConcurrentQuery.resetConfig(db[_nativeDb], { workerThreads: defaultWorkerThreads(), globalQuota: { time: 60, memory: 8388608 } });
      const query = "SELECT ECClassId, Schema FROM meta.ECClassDef ORDER BY ECInstanceId LIMIT 20";
      for (const valueFormat of [DbValueFormat.ECSqlNames, DbValueFormat.JsNames]) {
        const request: DbQueryRequest = {
          query, valueFormat,
          convertClassIdsToClassNames: true,
        };
        const primary = await ConcurrentQuery.executeQueryRequest(db[_nativeDb], { ...request, usePrimaryConn: true });
        expect(primary.status).eq(DbResponseStatus.Done);
        expect(primary.data.length).eq(20);
        const workers = await Promise.all(Array.from({ length: defaultWorkerThreads() * 2 },
          async () => ConcurrentQuery.executeQueryRequest(db[_nativeDb], request)));
        for (const worker of workers) {
          expect(worker.status).eq(DbResponseStatus.Done);
          expect(worker.data).deep.eq(primary.data);
          expect(worker.meta).deep.eq(primary.meta);
        }
      }
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
