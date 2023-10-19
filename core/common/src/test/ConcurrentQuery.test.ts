/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Point2d, Point3d } from "@itwin/core-geometry";
import { assert } from "chai";
import { Base64 } from "js-base64";
import { QueryBinder, QueryParamType } from "../ConcurrentQuery";

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
          type: QueryParamType.IdSet,
          value: "+22BD8",
        },
        8: {
          type: QueryParamType.Struct,
          value: {
            val: "test struct",
          },
        },
        9: {
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
});
