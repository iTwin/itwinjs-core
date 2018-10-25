/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { Id64 } from "@bentley/bentleyjs-core";
import { Feature, GeometryClass, PolylineFlags } from "@bentley/imodeljs-common";

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

describe("PolylineFlags", () => {
  it("converts to and from numeric representation", () => {
    const f = new PolylineFlags();
    expect(f.pack()).to.equal(0);
    let f2 = PolylineFlags.unpack(0);
    expect(f.equals(f2)).to.equal(true);

    f.isPlanar = f.isDisjoint = true;
    f.setIsOutlineEdge();

    expect(f.pack()).to.equal(19);
    f2 = PolylineFlags.unpack(19);
    expect(f.equals(f2)).to.equal(true);

    f2 = PolylineFlags.unpack(21);
    expect(f.equals(f2)).to.equal(false);
  });
});
