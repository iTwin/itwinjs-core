/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, describe, it } from "vitest";
import { Id64 } from "@itwin/core-bentley";
import { Feature } from "../FeatureTable";
import { GeometryClass } from "../GeometryParams";

describe("Feature", () => {
  it("constructor works as expected", () => {
    const a = new Feature(Id64.invalid, Id64.invalid);
    assert.isTrue(a.elementId === "0", "elementId is correct - 1");
    assert.isTrue(a.subCategoryId === "0", "subCategoryId is correct - 1");
    assert.isTrue(a.geometryClass === GeometryClass.Primary, "geometryClass is correct - 1");

    const b = new Feature(Id64.fromString("0x800"), Id64.fromString("0x800"), GeometryClass.Dimension);
    assert.isTrue(b.elementId === "0x800", "elementId is correct - 2");
    assert.isTrue(b.subCategoryId === "0x800", "subCategoryId is correct - 2");
    assert.isTrue(b.geometryClass === GeometryClass.Dimension, "geometryClass is correct - 2");
  });
  it("isDefined/isUndefined works as expected", () => {
    const a = new Feature(Id64.invalid, Id64.invalid);
    const b = new Feature(Id64.fromString("0x800"), Id64.fromString("0x800"), GeometryClass.Dimension);
    const c = new Feature(Id64.invalid, Id64.invalid, GeometryClass.Dimension);
    assert.isTrue(a.isDefined === false, "invalid elementId/subcategoryId result in isDefined returning false if GeometryClass is Primary");
    assert.isTrue(b.isDefined === true, "valid elementId/subcategoryId result in isDefined returning false");
    assert.isTrue(c.isDefined === true, "invalid elementId/subcategoryId but geometryclass that isn't Primary returns true for isDefined");
  });
  it("equals works as expected", () => {
    const a = new Feature(Id64.invalid, Id64.invalid);
    const b = new Feature(Id64.fromString("0x800"), Id64.fromString("0x800"), GeometryClass.Dimension);
    const c = new Feature(Id64.fromString("0x800"), Id64.fromString("0x800"), GeometryClass.Dimension);
    assert.isFalse(a.equals(b), "a - b");
    assert.isTrue(b.equals(c), "b - c");
  });
});
