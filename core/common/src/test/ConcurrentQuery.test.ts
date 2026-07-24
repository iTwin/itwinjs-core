/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Point2d, Point3d, Range3d } from "@itwin/core-geometry";
import { assert, describe, it } from "vitest";
import { Base64 } from "js-base64";
import { QueryBinder, QueryParamType } from "../ConcurrentQuery";
import { Id64String, ITwinError } from "@itwin/core-bentley";

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
    const invalidIds = [undefined, null, "0", "50", "", "not an id", 123, {}, ["0x1"]];
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
          queryBinder.bindIdSet("idSetValue", ids as unknown as Id64String[]);
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
      assert.throws(() => queryBinder.bindIdSet("idSetValue", ["0x22bd8", undefined] as unknown as Id64String[]));
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

    it("distinguishes a string entry from an array entry in the error message", () => {
      const queryBinder = new QueryBinder();
      try {
        queryBinder.bindIdSet("idSetValue", [["0x1"]] as unknown as Id64String[]);
        assert.fail("expected bindIdSet to throw");
      } catch (error) {
        if (!ITwinError.isError(error, "itwin-QueryBinder", "invalid-arguments"))
          throw error;
        // JSON.stringify(["0x1"]) preserves the brackets; naive string interpolation would collapse it to "0x1", indistinguishable from a valid id.
        assert.include(error.message, "[\"0x1\"]");
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
