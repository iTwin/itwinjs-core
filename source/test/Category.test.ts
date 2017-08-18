/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { Appearance, AppearanceProps, SubCategoryOverride } from "../Category";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { ColorDef } from "../Render";
import { BisCore } from "../BisCore";

// First, register any domains that will be used in the tests.
BisCore.registerSchema();

describe("Category tests", () => {

  it("Appearance should construct properly", () => {
    const opts: AppearanceProps = {
      color: ColorDef.blue(),
      weight: 3,
      priority: 4,
      transp: 6,
      style: new Id64("0x22"),
      material: new Id64("0x24"),
      dontPlot: true,
      dontLocate: true,
      dontSnap: true,
      invisible: true,
    };
    let a1 = new Appearance({} as AppearanceProps);
    assert.isFalse(a1.dontLocate);
    assert.isFalse(a1.dontPlot);
    assert.isFalse(a1.dontSnap);
    assert.isFalse(a1.invisible);
    assert.equal(a1.weight, 0);
    assert.equal(a1.transparency, 0);
    assert.equal(a1.priority, 0);
    assert.isTrue(a1.color.equals(ColorDef.black()));

    a1 = new Appearance();
    assert.isFalse(a1.dontLocate);
    assert.isFalse(a1.dontPlot);
    assert.isFalse(a1.dontSnap);
    assert.isFalse(a1.invisible);
    assert.equal(a1.weight, 0);
    assert.equal(a1.transparency, 0);
    assert.equal(a1.priority, 0);
    assert.isTrue(a1.color.equals(ColorDef.black()));

    a1 = new Appearance(opts);
    assert.isTrue(a1.dontPlot);
    assert.isTrue(a1.dontLocate);
    assert.isTrue(a1.dontSnap);
    assert.isTrue(a1.invisible);
    assert.equal(a1.weight, 3);
    assert.equal(a1.transparency, 6);
    assert.equal(a1.priority, 4);
    assert.isTrue(a1.color.equals(ColorDef.blue()));

    let json = JSON.stringify(a1);
    const a2 = new Appearance(JSON.parse(json));
    assert.isTrue(a1.equals(a2));

    const o1 = new SubCategoryOverride();
    o1.setColor(ColorDef.darkBlue());
    o1.setDisplayPriority(33);
    o1.setWeight(13);
    o1.setTransparency(133);
    o1.setInvisible(true);
    o1.setMaterial(new Id64("0x222"));
    o1.setStyle(new Id64("0x2"));
    o1.applyTo(a2);
    assert.isTrue(a2.color.equals(ColorDef.darkBlue()));
    assert.isTrue(a2.invisible);
    assert.equal(a2.weight, 13);
    assert.equal(a2.transparency, 133);
    assert.equal(a2.priority, 33);
    assert.isTrue(a2.styleId.equals(new Id64("0x2")));
    assert.isTrue(a2.materialId.equals(new Id64("0x222")));
    o1.setColor(ColorDef.darkRed());
    assert.isTrue(a2.color.equals(ColorDef.darkBlue()));

    json = JSON.stringify(o1);
    const o2 = SubCategoryOverride.fromJSON(JSON.parse(json));
    assert.deepEqual(o2, o1);
  });

});
