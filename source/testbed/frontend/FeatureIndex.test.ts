/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { ColorIndex } from "../../frontend/render/FeatureIndex";
import { ColorDef } from "../../common/ColorDef";

describe("ColorIndex", () => {
  it("should create, store and retrieve from ColorIndex", () => {
    const ci: ColorIndex = new ColorIndex();

    assert.isTrue(ci.isValid(), "newly created ColorIndex should be valid");
    assert.isTrue(ci.isUniform(), "newly created ColorIndex should be Uniform");
    assert.isTrue(0x00ffffff === ci.uniform, "newly created ColorIndex should have uniform color of 0x00ffffff");
    assert.isTrue(undefined === ci.nonUniform, "newly created ColorIndex should have undefined nonUniform");
    assert.isFalse(ci.hasAlpha(), "newly created ColorIndex should not have alpha");

    ci.setUniform(0xff000000);
    assert.isTrue(ci.isValid(), "Uniform ColorIndex set to 0xff000000 should be valid");
    assert.isTrue(ci.isUniform(), "Uniform ColorIndex set to 0xff000000 should be Uniform");
    assert.isTrue(0xff000000 === ci.uniform, "Uniform ColorIndex set to 0xff000000 should have uniform color of 0xff000000");
    assert.isTrue(undefined === ci.nonUniform, "Uniform ColorIndex set to 0xff000000 should have undefined nonUniform");
    assert.isTrue(ci.hasAlpha(), "Uniform ColorIndex set to 0xff000000 should have alpha");

    ci.setUniform(ColorDef.from(255, 127, 63, 31));
    assert.isTrue(ci.isValid(), "Uniform ColorIndex set to ColorDef.from(255, 127, 63, 31) should be valid");
    assert.isTrue(ci.isUniform(), "Uniform ColorIndex set to ColorDef.from(255, 127, 63, 31) should be Uniform");
    assert.isTrue(0x1f3f7fff === ci.uniform, "Uniform ColorIndex set to ColorDef.from(255, 127, 63, 31) should have uniform color of 0x1f3f7fff");
    assert.isTrue(undefined === ci.nonUniform, "Uniform ColorIndex set to ColorDef.from(255, 127, 63, 31) should have undefined nonUniform");
    assert.isTrue(ci.hasAlpha(), "Uniform ColorIndex set to ColorDef.from(255, 127, 63, 31) should have alpha");

    ci.reset();
    assert.isTrue(ci.isValid(), "Uniform ColorIndex which has been reset should be valid");
    assert.isTrue(ci.isUniform(), "Uniform ColorIndex which has been reset should be Uniform");
    assert.isTrue(0x00ffffff === ci.uniform, "Uniform ColorIndex which has been reset should have uniform color of 0x00ffffff");
    assert.isTrue(undefined === ci.nonUniform, "Uniform ColorIndex which has been reset should have undefined nonUniform");
    assert.isFalse(ci.hasAlpha(), "Uniform ColorIndex which has been reset should not have alpha");

    const numColors: number = 10;
    const colors: Uint32Array = new Uint32Array(numColors);
    const indices: Uint16Array = new Uint16Array(numColors);
    for (let i = 0; i < numColors; ++i) {
      colors[i] = ColorDef.from(i, i * 2, i * 4, 64).tbgr;
      indices[i] = i;
    }
    ci.setNonUniform(numColors, colors, indices, true);
    assert.isTrue(ci.isValid(), "NonUniform ColorIndex should be valid");
    assert.isFalse(ci.isUniform(), "NonUniform ColorIndex should not be Uniform");
    assert.isTrue(ci.hasAlpha(), "NonUniform ColorIndex should have alpha");

    ci.reset();
    assert.isTrue(ci.isValid(), "uniform ColorIndex which has been reset should be valid");
    assert.isTrue(ci.isUniform(), "uniform ColorIndex which has been reset should be Uniform");
    assert.isTrue(0x00ffffff === ci.uniform, "uniform ColorIndex which has been reset should have uniform color of 0x00ffffff");
    assert.isTrue(undefined === ci.nonUniform, "uniform ColorIndex which has been reset should have undefined nonUniform");
    assert.isFalse(ci.hasAlpha(), "uniform ColorIndex which has been reset should not have alpha");
  });
});
