/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Point2d, Point3d, Range3d } from "@itwin/core-geometry";
import { assert, describe, expect, it } from "vitest";
import { Base64 } from "js-base64";
import { DbQueryError, DbQueryRequest, DbQueryResponse, DbRequestKind, DbResponseKind, DbResponseStatus, QueryBinder, QueryOptions, QueryParamType } from "../ConcurrentQuery";
import { Id64String, ITwinError } from "@itwin/core-bentley";
import { ECSqlReader } from "../ECSqlReader";
import { ECSqlReaderBase } from "../ECSqlReaderBase";
import { Base64EncodedString } from "../Base64EncodedString";

class BinaryRowReader extends ECSqlReaderBase {
  public static decode(row: unknown): void {
    this.replaceBase64WithUint8Array(row);
  }

  protected getRowInternal(): unknown[] {
    return [];
  }
}

describe("ECSqlReader binary conversion", () => {
  it("decodes binary values in JSON rows, nested arrays and objects in place", () => {
    const bytes = new Uint8Array([0, 1, 127, 255]);
    const encoded = Base64EncodedString.fromUint8Array(bytes);
    const empty = Base64EncodedString.fromUint8Array(new Uint8Array());
    const row: unknown[] = [null, "", "ordinary text", 0, false, encoded, empty, [encoded, { blob: encoded, value: null }], { nested: [encoded], empty: [] }];
    const nested = row[7];
    BinaryRowReader.decode(row);
    assert.deepEqual(row, [null, "", "ordinary text", 0, false, bytes, new Uint8Array(), [bytes, { blob: bytes, value: null }], { nested: [bytes], empty: [] }]);
    assert.strictEqual(row[7], nested);
    BinaryRowReader.decode(row);
    assert.deepEqual(row[5], bytes);
  });

  it("ignores inherited and non-enumerable object properties", () => {
    const encoded = Base64EncodedString.fromUint8Array(new Uint8Array([9]));
    const row: { own: unknown } = { own: encoded };
    Object.setPrototypeOf(row, { inherited: encoded });
    Object.defineProperty(row, "hidden", { value: encoded });
    BinaryRowReader.decode(row);
    assert.deepEqual(row.own, new Uint8Array([9]));
    assert.equal(Object.getPrototypeOf(row).inherited, encoded);
    assert.equal(Object.getOwnPropertyDescriptor(row, "hidden")?.value, encoded);
  });

  it("preserves enumerable-property behavior for unusual arrays", () => {
    const encoded = Base64EncodedString.fromUint8Array(new Uint8Array([9]));
    const row: unknown[] & { extra: unknown } = Object.assign([encoded], { extra: encoded });
    Object.defineProperty(row, "1", { value: encoded, writable: true, enumerable: false });
    const prototype = Object.create(Array.prototype);
    prototype[2] = encoded;
    Object.setPrototypeOf(row, prototype);
    row.length = 3;
    BinaryRowReader.decode(row);
    assert.deepEqual(row[0], new Uint8Array([9]));
    assert.deepEqual(row.extra, new Uint8Array([9]));
    assert.equal(row[1], encoded);
    assert.equal(row[2], encoded);
    assert.isFalse(Object.hasOwn(row, "2"));
  });
});

describe("ECSqlReader cursor paging", () => {
  const stats = { cpuTime: 0, totalTime: 0, timeLimit: 0, memLimit: 0, memUsed: 0, prepareTime: 0 };
  const response = (status: DbResponseStatus, data: DbQueryResponse["data"], cursorId?: string): DbQueryResponse => ({
    status, kind: DbResponseKind.ECSql, data, cursorId, meta: [], rowCount: data.length, stats,
  });

  const makeReader = (handler: (request: DbQueryRequest) => DbQueryResponse | Promise<DbQueryResponse>, requests: DbQueryRequest[], options: QueryOptions = { useCursor: true, restartToken: "tok" }) =>
    new ECSqlReader({ execute: async (request) => { requests.push(request); return handler(request); } }, "SELECT 1", undefined, options);

  it("decodes binary result columns and nested values without changing other values", async () => {
    const bytes = new Uint8Array([0, 9, 255]);
    const encoded = Base64EncodedString.fromUint8Array(bytes);
    const data = [[encoded, null, 0, false, "text", [encoded, { blob: encoded }]]];
    const reader = makeReader(() => response(DbResponseStatus.Done, data), []);
    assert.isTrue(await reader.step());
    assert.deepEqual(reader.getRowInternal(), [bytes, null, 0, false, "text", [bytes, { blob: bytes }]]);
    assert.isFalse(await reader.step());
  });

  it("does not request cursors unless opted in", async () => {
    const requests: DbQueryRequest[] = [];
    const reader = makeReader(() => response(DbResponseStatus.Done, [[1]]), requests, {});
    while (await reader.step());
    assert.equal(requests.length, 1);
    assert.isUndefined(requests[0].useCursor);
    assert.isUndefined(requests[0].cursorId);
  });

  it("resumes partial pages and falls back when no cursor is returned", async () => {
    const requests: DbQueryRequest[] = [];
    const pages = [response(DbResponseStatus.Partial, [[1]], "cursor-1"), response(DbResponseStatus.Partial, [[2]]), response(DbResponseStatus.Done, [[3]])];
    const reader = makeReader(() => {
      const page = pages.shift();
      if (!page)
        throw new Error("unexpected query page");
      return page;
    }, requests);
    const rows: number[] = [];
    while (await reader.step())
      rows.push(reader.getRowInternal()[0]);
    assert.deepEqual(rows, [1, 2, 3]);
    assert.deepEqual(requests.map(({ cursorId, limit, useCursor }) => ({ cursorId, offset: limit?.offset, useCursor })), [
      { cursorId: undefined, offset: 0, useCursor: true },
      { cursorId: "cursor-1", offset: 1, useCursor: true },
      { cursorId: undefined, offset: 2, useCursor: true },
    ]);
  });

  it("closes an unused cursor when iteration ends early", async () => {
    const requests: DbQueryRequest[] = [];
    const reader = makeReader((request) => request.closeCursor ? response(DbResponseStatus.Done, []) : response(DbResponseStatus.Partial, [[1]], "cursor-2"), requests);
    for await (const _row of reader)
      break;
    assert.equal(requests.length, 2);
    assert.equal(requests[1].kind, DbRequestKind.ECSql);
    assert.equal(requests[1].closeCursor, true);
    assert.equal(requests[1].cursorId, "cursor-2");
    assert.isUndefined(requests[1].restartToken);
  });

  it("keeps the cursor id when a close fails so it can be retried", async () => {
    const requests: DbQueryRequest[] = [];
    let closeStatus = DbResponseStatus.QueueFull;
    const reader = makeReader((request) => request.closeCursor ? response(closeStatus, []) : response(DbResponseStatus.Partial, [[1]], "cursor-3"), requests);
    assert.isTrue(await reader.step());
    await expect(reader.return()).rejects.toBeInstanceOf(DbQueryError);
    closeStatus = DbResponseStatus.Done;
    await reader.return();
    const closes = requests.filter((r) => r.closeCursor).map((r) => r.cursorId);
    assert.deepEqual(closes, ["cursor-3", "cursor-3"]);
    await reader.return();
    assert.equal(requests.filter((r) => r.closeCursor).length, 2);
  });

  for (const continuation of [false, true]) {
    it(`waits for and closes a cursor returned by an in-flight ${continuation ? "continuation" : "first page"}`, async () => {
      const requests: DbQueryRequest[] = [];
      let deliverPage!: (page: DbQueryResponse) => void;
      const pendingPage = new Promise<DbQueryResponse>((resolve) => { deliverPage = resolve; });
      const reader = makeReader(async (request) => {
        if (request.closeCursor)
          return response(DbResponseStatus.Done, []);
        if (continuation && requests.length === 1)
          return response(DbResponseStatus.Partial, [[1]], "old-cursor");
        return pendingPage;
      }, requests);
      if (continuation)
        assert.isTrue(await reader.step());

      const next = reader.next();
      let closed = false;
      const closing = reader.return().then((result) => { closed = true; return result; });
      await Promise.resolve();
      assert.isFalse(closed);
      assert.isEmpty(requests.filter((request) => request.closeCursor));

      deliverPage(response(DbResponseStatus.Partial, [[2]], "late-cursor"));
      assert.isTrue((await next).done);
      assert.isTrue((await closing).done);
      const closes = requests.filter((request) => request.closeCursor);
      assert.equal(closes.length, 1);
      assert.equal(closes[0].cursorId, "late-cursor");
      assert.isUndefined(closes[0].restartToken);
      assert.throws(() => reader.getRowInternal(), "no current row");
      assert.isFalse(await reader.step());
      await reader.return();
      assert.equal(requests.length, continuation ? 3 : 2);
    });
  }

  it("can retry closing a cursor returned after iteration was stopped", async () => {
    const requests: DbQueryRequest[] = [];
    let deliverPage!: (page: DbQueryResponse) => void;
    const pendingPage = new Promise<DbQueryResponse>((resolve) => { deliverPage = resolve; });
    let closeStatus = DbResponseStatus.QueueFull;
    const reader = makeReader(async (request) => request.closeCursor ? response(closeStatus, []) : pendingPage, requests);
    const next = reader.next();
    const closing = expect(reader.return()).rejects.toBeInstanceOf(DbQueryError);
    deliverPage(response(DbResponseStatus.Partial, [[1]], "late-cursor"));
    assert.isTrue((await next).done);
    await closing;
    closeStatus = DbResponseStatus.Done;
    await reader.return();
    assert.deepEqual(requests.filter((request) => request.closeCursor).map((request) => request.cursorId), ["late-cursor", "late-cursor"]);
  });

  it("releases the existing cursor if an in-flight continuation fails during closure", async () => {
    const requests: DbQueryRequest[] = [];
    let rejectPage!: (error: Error) => void;
    const pendingPage = new Promise<DbQueryResponse>((_resolve, reject) => { rejectPage = reject; });
    const reader = makeReader(async (request) => {
      if (request.closeCursor)
        return response(DbResponseStatus.Done, []);
      return requests.length === 1 ? response(DbResponseStatus.Partial, [[1]], "old-cursor") : pendingPage;
    }, requests);
    assert.isTrue(await reader.step());
    const error = new Error("page failed");
    const next = expect(reader.next()).rejects.toBe(error);
    const closing = expect(reader.return()).rejects.toBe(error);
    rejectPage(error);
    await Promise.all([next, closing]);
    assert.deepEqual(requests.filter((request) => request.closeCursor).map((request) => request.cursorId), ["old-cursor"]);
    await reader.return();
    assert.equal(requests.length, 3);
  });

  it("releases the cursor of a reset reader before the next page", async () => {
    const requests: DbQueryRequest[] = [];
    const reader = makeReader((request) => request.closeCursor ? response(DbResponseStatus.Done, []) : response(DbResponseStatus.Partial, [[1]], "cursor-4"), requests);
    assert.isTrue(await reader.step());
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    reader.reset();
    assert.isTrue(await reader.step());
    assert.deepEqual(requests.map(({ cursorId, closeCursor }) => ({ cursorId, closeCursor })), [
      { cursorId: undefined, closeCursor: undefined },
      { cursorId: "cursor-4", closeCursor: true },
      { cursorId: undefined, closeCursor: undefined },
    ]);
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
