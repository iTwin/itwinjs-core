/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Id64 } from "@bentley/bentleyjs-core";
import { ColorDef, ColorByName, SubCategoryAppearance, SubCategoryOverride } from "@bentley/imodeljs-common";

// spell-checker: disable

describe("Category tests", () => {
  it("Appearance should construct properly", () => {
    const opts: SubCategoryAppearance.Props = {
      color: ColorByName.blue,
      weight: 3,
      priority: 4,
      transp: 6,
      style: "0x22",
      material: "0x24",
      dontPlot: true,
      dontLocate: true,
      dontSnap: true,
      invisible: true,
    };
    let a1 = new SubCategoryAppearance({} as SubCategoryAppearance.Props);
    assert.isFalse(a1.dontLocate);
    assert.isFalse(a1.dontPlot);
    assert.isFalse(a1.dontSnap);
    assert.isFalse(a1.invisible);
    assert.equal(a1.weight, 0);
    assert.equal(a1.transparency, 0);
    assert.equal(a1.priority, 0);
    assert.isTrue(a1.color.equals(ColorDef.black));

    a1 = new SubCategoryAppearance();
    assert.isFalse(a1.dontLocate);
    assert.isFalse(a1.dontPlot);
    assert.isFalse(a1.dontSnap);
    assert.isFalse(a1.invisible);
    assert.equal(a1.weight, 0);
    assert.equal(a1.transparency, 0);
    assert.equal(a1.priority, 0);
    assert.isTrue(a1.color.equals(ColorDef.black));

    a1 = new SubCategoryAppearance(opts);
    assert.isTrue(a1.dontPlot);
    assert.isTrue(a1.dontLocate);
    assert.isTrue(a1.dontSnap);
    assert.isTrue(a1.invisible);
    assert.equal(a1.weight, 3);
    assert.equal(a1.transparency, 6);
    assert.equal(a1.priority, 4);
    assert.isTrue(a1.color.equals(ColorDef.blue));

    let json = JSON.stringify(a1);
    const a2 = new SubCategoryAppearance(JSON.parse(json));
    assert.isTrue(a1.equals(a2));

    // If SubCategoryOverride defines no overrides, override() returns its input...
    const o1 = SubCategoryOverride.fromJSON();
    assert.isFalse(o1.anyOverridden);
    const a3 = o1.override(a2);
    assert.equal(a2, a3);

    const o2 = SubCategoryOverride.fromJSON({
      color: new ColorDef("darkblue"),
      priority: 33,
      weight: 13,
      transp: 133,
      invisible: true,
      material: new Id64("0x222"),
      style: new Id64("0x2"),
    });

    const a4 = o2.override(a2);
    assert.isFalse(a4 === a2);

    assert.equal(a4.color.tbgr, ColorByName.darkBlue);
    assert.isTrue(a4.invisible);
    assert.equal(a4.weight, 13);
    assert.equal(a4.transparency, 133);
    assert.equal(a4.priority, 33);
    assert.isTrue(a4.styleId.equals(new Id64("0x2")));
    assert.isTrue(a4.materialId.equals(new Id64("0x222")));
    assert.equal(a4.color.tbgr, ColorByName.darkBlue);

    json = JSON.stringify(o2);
    const o3 = SubCategoryOverride.fromJSON(JSON.parse(json));
    assert.deepEqual(o3, o2);
  });
});
