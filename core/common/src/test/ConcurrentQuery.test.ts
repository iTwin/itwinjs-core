/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Point2d, Point3d, Range3d } from "@itwin/core-geometry";
import { afterEach, assert, describe, expect, it, vi } from "vitest";
import { Base64 } from "js-base64";
import { DbQueryRequest, DbQueryResponse, DbResponseKind, DbResponseStatus, QueryBinder, QueryParamType } from "../ConcurrentQuery";
import { ECSqlReader } from "../ECSqlReader";
import { Id64String, ITwinError } from "@itwin/core-bentley";

describe("ECSqlReader cursor hints", () => {
  function response(status: DbResponseStatus, rows: number[][]): DbQueryResponse {
    return {
      kind: DbResponseKind.ECSql, status, data: rows, rowCount: rows.length, meta: [],
      stats: { cpuTime: 0, totalTime: 0, timeLimit: 0, memLimit: 0, memUsed: 0, prepareTime: 0 },
    };
  }

  it("keeps one identity across pages and retries, without sharing it with other readers", async () => {
    const requests: DbQueryRequest[] = [];
    const executor = {
      execute: async (request: DbQueryRequest) => {
        requests.push(request);
        return requests.length === 1 ? response(DbResponseStatus.Partial, []) :
          requests.length === 2 ? response(DbResponseStatus.Partial, [[3], [4]]) : response(DbResponseStatus.Done, [[5]]);
      },
    };
    const reader = new ECSqlReader(executor, "SELECT n", undefined, { limit: { offset: 2, count: 3 } });
    assert.deepEqual(await reader.toArray(), [[3], [4], [5]]);
    assert.isString(requests[0].cursorId);
    assert.isNotEmpty(requests[0].cursorId);
    assert.equal(requests[0].cursorId, requests[1].cursorId);
    assert.equal(requests[1].cursorId, requests[2].cursorId);
    assert.deepEqual(requests.map((r) => r.limit), [{ offset: 2, count: 3 }, { offset: 2, count: 3 }, { offset: 4, count: 1 }]);

    const other = new ECSqlReader(executor, "SELECT n");
    await other.toArray();
    assert.notEqual(requests[3].cursorId, requests[0].cursorId);
  });

  it("changes identity when reset or bindings are reset", async () => {
    const ids: Array<string | undefined> = [];
    const reader = new ECSqlReader({
      execute: async (request) => {
        ids.push(request.cursorId);
        return response(DbResponseStatus.Done, [[1]]);
      },
    }, "SELECT 1");
    await reader.toArray();
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    reader.reset();
    await reader.toArray();
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    reader.reset();
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    reader.resetBindings();
    await reader.toArray();
    assert.equal(new Set(ids).size, 3);
  });
});

describe("ECSqlReader timing statistics", () => {
  afterEach(() => vi.restoreAllMocks());

  function response(status: DbResponseStatus, elapsed: number, rows: number[][] = []): DbQueryResponse {
    return {
      kind: DbResponseKind.ECSql, status, data: rows, rowCount: rows.length, meta: [],
      stats: { cpuTime: elapsed * 1000, totalTime: elapsed, prepareTime: elapsed / 2, timeLimit: 0, memLimit: 0, memUsed: rows.length },
    };
  }

  it("counts every retry attempt once without changing non-timing counters", async () => {
    const responses = [response(DbResponseStatus.Partial, 100), response(DbResponseStatus.Timeout, 0.25), response(DbResponseStatus.Done, 20, [[1]])];
    const reader = new ECSqlReader({ execute: async () => responses.shift()! }, "SELECT 1");
    assert.deepEqual(await reader.toArray(), [[1]]);
    assert.equal(reader.stats.backendTotalTime, 120.25);
    assert.equal(reader.stats.backendCpuTime, 120250);
    assert.equal(reader.stats.prepareTime, 60.125);
    assert.equal(reader.stats.backendRowsReturned, 1);
    assert.equal(reader.stats.backendMemUsed, 1);
    assert.equal(reader.stats.retryCount, 2);
  });

  it("accounts for all attempts before retry exhaustion", async () => {
    const reader = new ECSqlReader({ execute: async () => response(DbResponseStatus.Partial, 0.125) }, "SELECT 1");
    await expect(reader.toArray()).rejects.toThrow("query too long");
    assert.equal(reader.stats.backendTotalTime, 1.25);
    assert.equal(reader.stats.prepareTime, 0.625);
    assert.equal(reader.stats.retryCount, 9);
  });

  it("retains native timings on an initial error or cancellation", async () => {
    for (const status of [DbResponseStatus.Error, DbResponseStatus.Cancel]) {
      const rs = response(status, 80);
      Object.assign(rs.stats, { cloudSqliteTimingState: "measured", downloadTime: 50, executionTime: 30, downloadBlocks: 1, downloadBlockSize: 4096 });
      const reader = new ECSqlReader({ execute: async () => rs }, "SELECT 1", undefined, { collectCloudSqliteStats: true });
      try {
        await reader.toArray();
        assert.fail("expected query failure");
      } catch (error) {
        assert.propertyVal(error, "response", rs);
      }
      assert.equal(reader.stats.backendTotalTime, 80);
      assert.equal(reader.stats.prepareTime, 40);
      assert.equal(reader.stats.backendDownloadBlocks, 1);
      assert.deepEqual(reader.stats.backendDownloadBlockSizes, [4096]);
    }
  });

  it("measures rejected calls monotonically and preserves discarded native timing and the original error", async () => {
    let now = 10;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.spyOn(Date, "now").mockReturnValue(-10000);
    const error = new Error("transport failure");
    const reader = new ECSqlReader({
      execute: async (_request, onDiscardedResponse) => {
        const discarded = response(DbResponseStatus.Done, 5, [[99]]);
        Object.assign(discarded.stats, { cloudSqliteTimingState: "measured", downloadTime: 2, executionTime: 3, downloadBlocks: 1, downloadBlockSize: 4096 });
        onDiscardedResponse?.(discarded);
        now = 17.5;
        throw error;
      },
    }, "SELECT 1", undefined, { collectCloudSqliteStats: true });
    try {
      await reader.toArray();
      assert.fail("expected executor rejection");
    } catch (caught) {
      assert.strictEqual(caught, error);
    }
    assert.equal(reader.stats.totalTime, 7.5);
    assert.equal(reader.stats.backendTotalTime, 5);
    assert.equal(reader.stats.backendRowsReturned, 0);
    assert.notProperty(reader.stats, "backendDownloadTime");
    assert.notProperty(reader.stats, "backendDownloadBlocks");
    assert.notProperty(reader.stats, "backendDownloadBlockSizes");
  });

  it("aggregates cloud waits across queue-only retries, discarded executions, and pages", async () => {
    let attempt = 0;
    const reader = new ECSqlReader({
      execute: async (_request, onDiscardedResponse) => {
        if (++attempt === 1) {
          const queued = response(DbResponseStatus.QueueFull, 1);
          queued.stats.cloudSqliteTimingState = "notExecuted";
          return queued;
        }
        const measured = response(attempt === 2 ? DbResponseStatus.Partial : DbResponseStatus.Done, 20, [[attempt]]);
        Object.assign(measured.stats, { cloudSqliteTimingState: "measured", downloadTime: 3.25, executionTime: 6.75, downloadBlocks: 2, downloadBlockSize: 4096 });
        if (attempt === 2) {
          const discarded = response(DbResponseStatus.Done, 10, [[99]]);
          Object.assign(discarded.stats, { cloudSqliteTimingState: "measured", downloadTime: 2, executionTime: 4, downloadBlocks: 1, downloadBlockSize: 8192 });
          onDiscardedResponse?.(discarded);
        }
        return measured;
      },
    }, "SELECT 1", undefined, { collectCloudSqliteStats: true });
    assert.deepEqual(await reader.toArray(), [[2], [3]]);
    assert.equal(reader.stats.backendTotalTime, 51);
    assert.equal(reader.stats.backendDownloadTime, 8.5);
    assert.equal(reader.stats.backendExecutionTime, 17.5);
    assert.equal(reader.stats.backendDownloadBlocks, 5);
    assert.deepEqual(reader.stats.backendDownloadBlockSizes, [8192, 4096, 4096, 4096, 4096]);
    assert.equal(reader.stats.backendRowsReturned, 2);
    assert.equal(reader.stats.totalTime >= 0, true);
  });

  it("keeps unavailable cloud measurements absent, rather than producing partial or false-zero totals", async () => {
    for (const missingState of [undefined, "unavailable"] as const) {
      let attempt = 0;
      const reader = new ECSqlReader({
        execute: async () => {
          const rs = response(++attempt === 3 ? DbResponseStatus.Done : DbResponseStatus.Partial, 1, [[attempt]]);
          if (attempt === 2)
            rs.stats.cloudSqliteTimingState = missingState;
          else
            Object.assign(rs.stats, { cloudSqliteTimingState: "measured", downloadTime: 0, executionTime: 1, downloadBlocks: 0, downloadBlockSize: 4096 });
          return rs;
        },
      }, "SELECT 1", undefined, { collectCloudSqliteStats: true });
      await reader.toArray();
      assert.notProperty(reader.stats, "backendDownloadTime");
      assert.notProperty(reader.stats, "backendExecutionTime");
      assert.notProperty(reader.stats, "backendDownloadBlocks");
      assert.notProperty(reader.stats, "backendDownloadBlockSizes");
    }
  });

  it("does not turn disabled lifetime measurements into a complete total after reset opts in", async () => {
    const reader = new ECSqlReader({
      execute: async () => {
        const rs = response(DbResponseStatus.Done, 1, [[1]]);
        Object.assign(rs.stats, { cloudSqliteTimingState: "measured", downloadTime: 0, executionTime: 1, downloadBlocks: 0, downloadBlockSize: 4096 });
        return rs;
      },
    }, "SELECT 1");
    await reader.toArray();
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    reader.reset({ collectCloudSqliteStats: true });
    await reader.toArray();
    assert.equal(reader.stats.backendTotalTime, 2);
    assert.notProperty(reader.stats, "backendDownloadTime");
    assert.notProperty(reader.stats, "backendExecutionTime");
    assert.notProperty(reader.stats, "backendDownloadBlocks");
    assert.notProperty(reader.stats, "backendDownloadBlockSizes");
  });

  it("distinguishes measured cache hits from disabled collection and preserves lifetime totals on reset", async () => {
    for (const collectCloudSqliteStats of [true, false, undefined]) {
      const reader = new ECSqlReader({
        execute: async () => {
          const rs = response(DbResponseStatus.Done, 0.25, [[1]]);
          Object.assign(rs.stats, { cloudSqliteTimingState: "measured", downloadTime: 0, executionTime: 0.25, downloadBlocks: 0, downloadBlockSize: 4096 });
          return rs;
        },
      }, "SELECT 1", undefined, { collectCloudSqliteStats });
      await reader.toArray();
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      reader.reset();
      await reader.toArray();
      assert.equal(reader.stats.backendTotalTime, 0.5);
      assert.equal(reader.stats.backendDownloadTime, collectCloudSqliteStats ? 0 : undefined);
      assert.equal(reader.stats.backendExecutionTime, collectCloudSqliteStats ? 0.5 : undefined);
      assert.equal(reader.stats.backendDownloadBlocks, collectCloudSqliteStats ? 0 : undefined);
      assert.deepEqual(reader.stats.backendDownloadBlockSizes, collectCloudSqliteStats ? [] : undefined);
    }
  });

  it("does not present partial block totals when a page has legacy timing-only statistics", async () => {
    let attempt = 0;
    const reader = new ECSqlReader({
      execute: async () => {
        const rs = response(++attempt === 3 ? DbResponseStatus.Done : DbResponseStatus.Partial, 1, [[attempt]]);
        Object.assign(rs.stats, { cloudSqliteTimingState: "measured", downloadTime: 0.25, executionTime: 0.75 });
        if (attempt !== 2)
          Object.assign(rs.stats, { downloadBlocks: 1, downloadBlockSize: 4096 });
        return rs;
      },
    }, "SELECT 1", undefined, { collectCloudSqliteStats: true });
    await reader.toArray();
    assert.equal(reader.stats.backendDownloadTime, 0.75);
    assert.equal(reader.stats.backendExecutionTime, 2.25);
    assert.notProperty(reader.stats, "backendDownloadBlocks");
    assert.notProperty(reader.stats, "backendDownloadBlockSizes");
  });
});

describe("QueryBinder", () => {
  it("binds values", async () => {
    const queryBinder = new QueryBinder();

    queryBinder.bindBoolean("booleanValue", true);
    queryBinder.bindBlob("blobValue", new Uint8Array([65, 65, 65]));
    queryBinder.bindDouble("doubleValue", 12.12);
    queryBinder.bindId("idValue", "0xfa1");
    queryBinder.bindIdSet("idSetValue", ["0x22bd8"]);
    queryBinder.bindInt("intValue", 10);
    queryBinder.bindStruct("structValue", { val: "test struct value" });
    queryBinder.bindLong("longValue", 1e9);
    queryBinder.bindString("stringValue", "test string value");
    queryBinder.bindNull("nullValue");
    queryBinder.bindPoint2d("point2dValue", new Point2d(10, 20));
    queryBinder.bindPoint3d("point3dValue", new Point3d(15, 25, 35));
    queryBinder.bindRange3d("range3dValue", new Range3d(1.2, 2.3, 3.4, 4.5, 5.6, 6.7));
    queryBinder.bindBoolean(2, true);

    assert.deepEqual(queryBinder.serialize(), {
      booleanValue: {
        type: QueryParamType.Boolean,
        value: true,
      },
      blobValue: {
        type: QueryParamType.Blob,
        value: Base64.fromUint8Array(new Uint8Array([65, 65, 65])),
      },
      doubleValue: {
        type: QueryParamType.Double,
        value: 12.12,
      },
      idValue: {
        type: QueryParamType.Id,
        value: "0xfa1",
      },
      idSetValue: {
        type: QueryParamType.IdSet,
        value: "+22BD8",
      },
      intValue: {
        type: QueryParamType.Integer,
        value: 10,
      },
      structValue: {
        type: QueryParamType.Struct,
        value: {
          val: "test struct value",
        },
      },
      longValue: {
        type: QueryParamType.Long,
        value: 1e9,
      },
      stringValue: {
        type: QueryParamType.String,
        value: "test string value",
      },
      nullValue: {
        type: QueryParamType.Null,
        value: null,
      },
      point2dValue: {
        type: QueryParamType.Point2d,
        value: {
          x: 10,
          y: 20,
        },
      },
      point3dValue: {
        type: QueryParamType.Point3d,
        value: {
          x: 15,
          y: 25,
          z: 35,
        },
      },
      range3dValue: {
        type: QueryParamType.Blob,
        value: Base64.fromUint8Array(new Uint8Array(Range3d.toFloat64Array({ low: { x: 1.2, y: 2.3, z: 3.4 }, high: { x: 4.5, y: 5.6, z: 6.7 } }).buffer)),
      },
      2: {
        type: QueryParamType.Boolean,
        value: true,
      },
    });
  });

  it("verifies incorrect values", () => {
    const queryBinder = new QueryBinder();

    assert.throws(
      () => queryBinder.bindBoolean("wrong index", true),
      "expect named parameter to meet identifier specification",
    );

    assert.throws(
      () => queryBinder.bindBoolean(0, true),
      "expect index to be >= 1",
    );
  });

  describe("bindIdSet invalid entries", () => {
    const invalidIds = ["0", "50", "", "not an id"];
    const cases = invalidIds.flatMap((invalidId) => [
      { label: `${JSON.stringify(invalidId)} as the first entry`, ids: [invalidId, "0x22bd8"] },
      { label: `${JSON.stringify(invalidId)} as the last entry`, ids: ["0x22bd8", invalidId] },
      { label: `${JSON.stringify(invalidId)} as the only entry`, ids: [invalidId] },
    ]);

    for (const { label, ids } of cases) {
      it(`throws an ITwinError with ${label}`, () => {
        const queryBinder = new QueryBinder();
        let thrown: unknown;
        try {
          queryBinder.bindIdSet("idSetValue", ids);
        } catch (error) {
          thrown = error;
        }
        assert.isDefined(thrown, "expected bindIdSet to throw");
        assert.isTrue(ITwinError.isError(thrown, "itwin-QueryBinder", "invalid-arguments"), 'expected an ITwinError with scope "itwin-QueryBinder" and key "invalid-arguments"');
      });
    }

    it("throws when a single invalid Id64String (not wrapped in an array) is passed directly", () => {
      const queryBinder = new QueryBinder();
      assert.throws(() => queryBinder.bindIdSet("idSetValue", "not an id"));
    });

    it("does not bind a value when it throws", () => {
      const queryBinder = new QueryBinder();
      assert.throws(() => queryBinder.bindIdSet("idSetValue", ["0x22bd8", "not an id"]));
      assert.deepEqual(queryBinder.serialize(), {});
    });

    it("includes the offending value and the parameter name in the error message", () => {
      const queryBinder = new QueryBinder();
      try {
        queryBinder.bindIdSet("idSetValue", ["0x22bd8", "not an id"]);
        assert.fail("expected bindIdSet to throw");
      } catch (error) {
        if (!ITwinError.isError(error, "itwin-QueryBinder", "invalid-arguments"))
          throw error;
        assert.include(error.message, "\"not an id\"");
        assert.include(error.message, "idSetValue");
      }
    });

  });

  it("bindIdSet accepts an empty iterable", () => {
    const queryBinder = new QueryBinder();
    queryBinder.bindIdSet("idSetValue", []);
    assert.deepEqual(queryBinder.serialize(), {
      idSetValue: {
        type: QueryParamType.IdSet,
        value: "",
      },
    });
  });

  it("bindIdSet accepts any Iterable<Id64String>, not just arrays", () => {
    const queryBinder = new QueryBinder();
    queryBinder.bindIdSet("idSetValue", new Set(["0x22bd9", "0x22bd8"]));
    assert.deepEqual(queryBinder.serialize(), {
      idSetValue: {
        type: QueryParamType.IdSet,
        value: "+22BD8+1",
      },
    });
  });

  it("bindIdSet sorts and deduplicates ids", () => {
    const queryBinder = new QueryBinder();
    queryBinder.bindIdSet("idSetValue", ["0x22bd9", "0x22bd8", "0x22bd8"]);
    assert.deepEqual(queryBinder.serialize(), {
      idSetValue: {
        type: QueryParamType.IdSet,
        value: "+22BD8+1",
      },
    });
  });

  it("bindIdSet treats a single Id64String as a single id, not a string of characters", () => {
    const queryBinder = new QueryBinder();
    queryBinder.bindIdSet("idSetValue", "0x22bd8");
    assert.deepEqual(queryBinder.serialize(), {
      idSetValue: {
        type: QueryParamType.IdSet,
        value: "+22BD8",
      },
    });
  });

  it("allows bulk binding", () => {
    assert.deepEqual(QueryBinder.from(undefined), new QueryBinder());

    assert.deepEqual(
      QueryBinder.from([
        true,
        1,
        "test string",
        new Uint8Array([10, 10, 10]), // blob type
        new Point2d(6, 12),
        new Point3d(7, 14, 21),
        new Range3d(1.2, 2.3, 3.4, 4.5, 5.6, 6.7),
        ["0x22bd8"], // id set type
        { val: "test struct" },
        null,
      ]).serialize(),
      {
        1: {
          type: QueryParamType.Boolean,
          value: true,
        },
        2: {
          type: QueryParamType.Double,
          value: 1,
        },
        3: {
          type: QueryParamType.String,
          value: "test string",
        },
        4: {
          type: QueryParamType.Blob,
          value: Base64.fromUint8Array(new Uint8Array([10, 10, 10])),
        },
        5: {
          type: QueryParamType.Point2d,
          value: {
            x: 6,
            y: 12,
          },
        },
        6: {
          type: QueryParamType.Point3d,
          value: {
            x: 7,
            y: 14,
            z: 21,
          },
        },
        7: {
          type: QueryParamType.Blob,
          value: Base64.fromUint8Array(new Uint8Array(Range3d.toFloat64Array({ low: { x: 1.2, y: 2.3, z: 3.4 }, high: { x: 4.5, y: 5.6, z: 6.7 } }).buffer)),
        },
        8: {
          type: QueryParamType.IdSet,
          value: "+22BD8",
        },
        9: {
          type: QueryParamType.Struct,
          value: {
            val: "test struct",
          },
        },
        10: {
          type: QueryParamType.Null,
          value: null,
        },
      },
    );

    assert.deepEqual(
      QueryBinder.from({
        booleanValue: true,
      }).serialize(),
      {
        booleanValue: {
          type: QueryParamType.Boolean,
          value: true,
        },
      },
    );

    assert.throw(() => QueryBinder.from([["a"]]), "unsupported type");
  });

  it("fromSkippingNullish skips undefined and null values", () => {
    assert.deepEqual(
      QueryBinder.fromSkippingNullish({ model: "used", parent: undefined, other: null }).serialize(),
      {
        model: {
          type: QueryParamType.String,
          value: "used",
        },
      },
    );

    // positional-array form: undefined/null positions are left unbound, later positions keep their index
    assert.deepEqual(
      QueryBinder.fromSkippingNullish([1, undefined, "third", null]).serialize(),
      {
        1: {
          type: QueryParamType.Double,
          value: 1,
        },
        3: {
          type: QueryParamType.String,
          value: "third",
        },
      },
    );

    // QueryBinder.from behavior is unchanged: undefined/null bind NULL
    assert.deepEqual(
      QueryBinder.from({ parent: undefined }).serialize(),
      {
        parent: {
          type: QueryParamType.Null,
          value: null,
        },
      },
    );
  });

  it("Should not fail on empty array", () => {
    const idSet: Id64String[] = [];
    const binder = QueryBinder.from([idSet]);
    const serializedObj = binder.serialize();

    assert.deepEqual(serializedObj, { '1': { type: 3, value: '' } });
  });

});
