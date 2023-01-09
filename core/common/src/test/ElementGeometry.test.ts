/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { Box, GeometryQuery, LineString3d, Point3d, Range3d, YawPitchRollAngles } from "@itwin/core-geometry";
import { ElementGeometry, GeometricElement3dProps, TextString, TextStringProps } from "../core-common";
import { areEqualElementGeometryEntities, areObjectsDeepEqual } from "../geometry/geometryDataEntryCompare";

const assert = chai.assert;
const expect = chai.expect;

function isTextStringProps(obj: unknown): obj is TextStringProps {
  return (typeof (obj) === "object") && (obj !== null) && ("text" in obj);
}

const aCode = { scope: "0x1", spec: "0x11", value: "codeValue" };

function makeGeometricElement3dProps(id: string | undefined = undefined): GeometricElement3dProps {
  return {
    classFullName: "Generic:PhysicalObject",
    code: aCode,
    federationGuid: "--",
    id,
    jsonProperties: {},
    model: "0x17",
    userLabel: "userlabel",
    category: "0x44",
    elementGeometryBuilderParams: {
      entryArray: [],
      viewIndependent: false,
    },
    placement: { // match the format that makePbGeometricElement3dProps will create and than will be used as input
      angles: { yaw: { degrees: 90 } },
      origin: { x: 1, y: 2, z: 0 },
      bbox: { low: { x: -1, y: -1, z: -1 }, high: { x: 1, y: 1, z: 1 } },
    },
  };
}

function checkGeometryQueriesInIteration(builder: ElementGeometry.Builder, expected: Array<GeometryQuery>) {
  const it = new ElementGeometry.Iterator({ entryArray: builder.entries });
  const eit = new ElementGeometry.EntityPropsIterator(it);
  let count = 0;
  for (const eentry of eit) {
    if (!(eentry.entity instanceof GeometryQuery)) {
      assert.fail();
    } else {
      expect(eentry.entity.isAlmostEqual(expected[count])).true;
    }
    ++count;
  }
  expect(count).eq(expected.length);

  // a stream s/ equal itself
  const eit21 = new ElementGeometry.EntityPropsIterator(new ElementGeometry.Iterator({ entryArray: builder.entries }));
  const eit22 = new ElementGeometry.EntityPropsIterator(new ElementGeometry.Iterator({ entryArray: builder.entries }));
  expect(areEqualElementGeometryEntities(eit21, eit22)).true;

  // a stream w/ added entry s/ not equal the original stream
  const eit31 = new ElementGeometry.EntityPropsIterator(new ElementGeometry.Iterator({ entryArray: builder.entries }));
  const eit32 = new ElementGeometry.EntityPropsIterator(new ElementGeometry.Iterator({ entryArray: [...builder.entries, builder.entries[1]] }));
  expect(areEqualElementGeometryEntities(eit31, eit32)).false;
}

describe("ElementGeometry.EntityPropsIterator", () => {

  it("TextString", async () => {
    const testOrigin = Point3d.create(5, 10, 0);
    const testAngles = YawPitchRollAngles.createDegrees(45, 0, 0);
    const builder = new ElementGeometry.Builder();

    builder.setLocalToWorld3d(testOrigin, testAngles);

    const textProps: TextStringProps = {
      text: "ABC",
      font: 22,
      height: 2,
      bold: true,
    };

    const textString = new TextString(textProps);
    builder.appendTextString(textString);

    const it = new ElementGeometry.Iterator({ entryArray: builder.entries });
    const eit = new ElementGeometry.EntityPropsIterator(it);
    let count = 0;
    for (const eentry of eit) {
      ++count;
      if (!isTextStringProps(eentry.entity)) {
        assert.fail();
      } else {
        expect(eentry.entity.text).eq(textProps.text);
        expect(eentry.entity.font).eq(textProps.font);
        expect(eentry.entity.height).eq(textProps.height);
        expect(eentry.entity.bold).eq(textProps.bold);
      }
    }
    expect(count).eq(1);

    const eit21 = new ElementGeometry.EntityPropsIterator(new ElementGeometry.Iterator({ entryArray: builder.entries }));
    const eit22 = new ElementGeometry.EntityPropsIterator(new ElementGeometry.Iterator({ entryArray: builder.entries }));
    expect(areEqualElementGeometryEntities(eit21, eit22)).true;
  });

  it("LineString", () => {
    const queries: Array<GeometryQuery> = [
      LineString3d.create([Point3d.create(5, 10, 0), Point3d.create(10, 10, 0), Point3d.create(10, 15, 0)]),
      Box.createRange(Range3d.create(Point3d.create(-5, -5, -5), Point3d.create(5, 5, 5)), true)!,
      // TODO More kinds of GeometryQuery
    ];

    const builder = new ElementGeometry.Builder();
    queries.forEach((gq) => builder.appendGeometryQuery(gq));

    checkGeometryQueriesInIteration(builder, queries);
  });

  it("areObjectsDeepEqual cases", () => {
    const elementProps: GeometricElement3dProps = makeGeometricElement3dProps("");
    const opts = { topLevelKeysToIgnore: new Set<string>(), ignoreSymbols: true };

    expect(areObjectsDeepEqual(null, elementProps, opts)).false;
    expect(areObjectsDeepEqual(1, elementProps, opts)).false;
    expect(areObjectsDeepEqual("str", elementProps, opts)).false;
    expect(areObjectsDeepEqual([1, 2], elementProps, opts)).false;
    expect(areObjectsDeepEqual(elementProps, { ...elementProps, aSymbol: Symbol("x") }, opts)).true; // symbols are ignored
    expect(areObjectsDeepEqual({ ...elementProps, aSymbol: Symbol("x") }, elementProps, opts)).true; // symbols are ignored
    expect(areObjectsDeepEqual(elementProps, { ...elementProps, userLabel: "foo-bar" }, opts)).false;
    expect(areObjectsDeepEqual(elementProps, { ...elementProps, stuff: "nonsense" }, opts)).false;
    expect(areObjectsDeepEqual({ ...elementProps, nonsense: "stuff" }, { ...elementProps, stuff: "nonsense" }, opts)).false;
    expect(areObjectsDeepEqual({ ...elementProps, userLabel: "foo-bar" }, elementProps, opts)).false;
    expect(areObjectsDeepEqual({ ...elementProps, userLabel: "foo-bar" }, elementProps, { topLevelKeysToIgnore: new Set<string>(["userLabel"]), ignoreSymbols: true })).true;
    expect(areObjectsDeepEqual([1, 2], [1, 2], opts)).true;
    expect(areObjectsDeepEqual([1, 2], [1, 3], opts)).false;
    expect(areObjectsDeepEqual([1, 2], [1, 2, 3], opts)).false;
    expect(areObjectsDeepEqual(1, 1, opts)).true;
    expect(areObjectsDeepEqual("a", "a", opts)).true;
    expect(areObjectsDeepEqual("a", "b", opts)).false;
    expect(areObjectsDeepEqual("a", undefined, opts)).false;
    expect(areObjectsDeepEqual("a", 1, opts)).false;
    expect(areObjectsDeepEqual({ obj: 1 }, "a", opts)).false;
    expect(areObjectsDeepEqual({ obj: 1 }, undefined, opts)).false;
    expect(areObjectsDeepEqual(undefined, { obj: 1 }, opts)).false;
    expect(areObjectsDeepEqual(undefined, undefined, opts)).true;
    expect(areObjectsDeepEqual(null, null, opts)).true;
    expect(areObjectsDeepEqual({}, {}, opts)).true;
    expect(areObjectsDeepEqual({}, { foo: undefined }, opts)).true;
    expect(areObjectsDeepEqual({}, { foo: undefined }, { ...opts, missingNotEquivalentToUndefined: true })).false;
  });
});
