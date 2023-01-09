/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { LineString3d, Point3d, YawPitchRollAngles } from "@itwin/core-geometry";
import { ElementGeometry, GeometricElement3dProps, TextString, TextStringProps } from "../core-common";
import { areEqualElementGeometryInfos, areObjectsDeepEqual } from "../geometry/geometryDataEntryCompare";

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

    for (const eentry of eit) {
      if (!isTextStringProps(eentry.entity)) {
        assert.fail();
      } else {
        assert.equal(eentry.entity.text, textProps.text);
        assert.equal(eentry.entity.font, textProps.font);
        assert.equal(eentry.entity.height, textProps.height);
        assert.equal(eentry.entity.bold, textProps.bold);
      }
    }

    assert.isTrue(areEqualElementGeometryInfos({ entryArray: builder.entries }, { entryArray: builder.entries }));
  });

  it("LineString", () => {
    const testOrigin = Point3d.create(5, 10, 0);
    const testAngles = YawPitchRollAngles.createDegrees(90, 0, 0);

    const pts: Point3d[] = [];
    pts.push(Point3d.create(5, 10, 0));
    pts.push(Point3d.create(10, 10, 0));
    pts.push(Point3d.create(10, 15, 0));
    pts.push(Point3d.create(5, 15, 0));
    pts.push(pts[0].clone());

    const builder = new ElementGeometry.Builder();
    const primitive = LineString3d.create(pts);

    builder.setLocalToWorld3d(testOrigin, testAngles); // Establish world to local transform for append...
    const status = builder.appendGeometryQuery(primitive);
    assert.isTrue(status);

    assert.isTrue(areEqualElementGeometryInfos({ entryArray: builder.entries }, { entryArray: builder.entries }));
  });

  it("deepEqualIgnoringSomeProps", () => {
    const elementProps: GeometricElement3dProps = makeGeometricElement3dProps("");

    expect(areObjectsDeepEqual(null, elementProps, new Set<string>())).false;
    expect(areObjectsDeepEqual(1, elementProps, new Set<string>())).false;
    expect(areObjectsDeepEqual("str", elementProps, new Set<string>())).false;
    expect(areObjectsDeepEqual([1, 2], elementProps, new Set<string>())).false;
    expect(areObjectsDeepEqual(elementProps, { ...elementProps, aSymbol: Symbol("x") }, new Set<string>())).true; // symbols are ignored
    expect(areObjectsDeepEqual({ ...elementProps, aSymbol: Symbol("x") }, elementProps, new Set<string>())).true; // symbols are ignored
    expect(areObjectsDeepEqual(elementProps, { ...elementProps, userLabel: "foo-bar" }, new Set<string>())).false;
    expect(areObjectsDeepEqual(elementProps, { ...elementProps, stuff: "nonsense" }, new Set<string>())).false;
    expect(areObjectsDeepEqual({ ...elementProps, nonsense: "stuff" }, { ...elementProps, stuff: "nonsense" }, new Set<string>())).false;
    expect(areObjectsDeepEqual({ ...elementProps, userLabel: "foo-bar" }, elementProps, new Set<string>())).false;
    expect(areObjectsDeepEqual({ ...elementProps, userLabel: "foo-bar" }, elementProps, new Set<string>(["userLabel"]))).true;
    expect(areObjectsDeepEqual([1, 2], [1, 2], new Set<string>())).true;
    expect(areObjectsDeepEqual([1, 2], [1, 3], new Set<string>())).false;
    expect(areObjectsDeepEqual([1, 2], [1, 2, 3], new Set<string>())).false;
    expect(areObjectsDeepEqual(1, 1, new Set<string>())).true;
    expect(areObjectsDeepEqual("a", "a", new Set<string>())).true;
    expect(areObjectsDeepEqual("a", "b", new Set<string>())).false;
    expect(areObjectsDeepEqual("a", undefined, new Set<string>())).false;
    expect(areObjectsDeepEqual("a", 1, new Set<string>())).false;
    expect(areObjectsDeepEqual({ obj: 1 }, "a", new Set<string>())).false;
    expect(areObjectsDeepEqual({ obj: 1 }, undefined, new Set<string>())).false;
    expect(areObjectsDeepEqual(undefined, { obj: 1 }, new Set<string>())).false;
    expect(areObjectsDeepEqual(undefined, undefined, new Set<string>())).true;
    expect(areObjectsDeepEqual(null, null, new Set<string>())).true;
  });
});
