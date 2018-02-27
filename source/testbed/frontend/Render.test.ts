/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { Feature, GeometryClass } from "../../common/Render";

describe("Feature", () => {
  it("constructor works as expected", () => {
    const a = new Feature(new Id64(), new Id64());
    assert.isTrue(a.elementId.value === "0", "elementId is correct - 1");
    assert.isTrue(a.subCategoryId.value === "0", "subCategoryId is correct - 1");
    assert.isTrue(a.geometryClass === GeometryClass.Primary, "geometryClass is correct - 1");

    const b = new Feature(new Id64("0x800"), new Id64("0x800"), GeometryClass.Dimension);
    assert.isTrue(b.elementId.value === "0x800", "elementId is correct - 2");
    assert.isTrue(b.subCategoryId.value === "0x800", "subCategoryId is correct - 2");
    assert.isTrue(b.geometryClass === GeometryClass.Dimension, "geometryClass is correct - 2");
  });
  it("isDefined/isUndefined works as expected", () => {
    const a = new Feature(new Id64(), new Id64());
    const b = new Feature(new Id64("0x800"), new Id64("0x800"), GeometryClass.Dimension);
    const c = new Feature(new Id64(), new Id64(), GeometryClass.Dimension);
    assert.isTrue(a.isDefined === false, "invalid elementId/subcategoryId result in isDefined returning false if GeometryClass is Primary");
    assert.isTrue(b.isDefined === true, "valid elementId/subcategoryId result in isDefined returning false");
    assert.isTrue(c.isDefined === true, "invalid elementId/subcategoryId but geometryclass that isn't Primary returns true for isDefined");
  });
  it("equals works as expected", () => {
    const a = new Feature(new Id64(), new Id64());
    const b = new Feature(new Id64("0x800"), new Id64("0x800"), GeometryClass.Dimension);
    const c = new Feature(new Id64("0x800"), new Id64("0x800"), GeometryClass.Dimension);
    assert.isFalse(a.equals(b), "a - b");
    assert.isTrue(b.equals(c), "b - c");
  });
});
