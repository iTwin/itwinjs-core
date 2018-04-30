/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { ColorMap } from "@bentley/imodeljs-frontend/lib/rendering";
import { ColorDef, ColorIndex } from "@bentley/imodeljs-common";

describe("ColorMap", () => {
  it("create a new ColorMap", () => {
    /** Test creating a ColorMap */
    const a: ColorMap = new ColorMap();
    assert.exists(a, "color map does not exist");
    assert.isTrue(a.map.size === 0, "color map did not set map size correctly");
    assert.isFalse(a.hasAlpha, "color map did not set hasAlpha correctly");
  });

  it("test getIndex function", () => {
    /** Test static getMaxIndex function */
    const a: ColorMap = new ColorMap();
    assert.isTrue(a.map.size === 0, "assert getIndex function test 1");
    assert.isFalse(a.hasAlpha, "assert getIndex function test 2");
    assert.isTrue(a.getIndex(0xFF0000) === 0, "assert getIndex function test 3");
    assert.isTrue(a.map.size === 1, "assert getIndex function test 4");
    assert.isTrue(a.hasAlpha, "assert getIndex function test 5");
    assert.isTrue(a.getIndex(0x0000FF) === 1, "assert getIndex function test 6");
    assert.isTrue(a.map.size === 2, "assert getIndex function test 7");
    assert.isTrue(a.hasAlpha, "assert getIndex function test 8");
    assert.isTrue(a.getIndex(0x0000FF) === 1, "assert getIndex function test 9");
    assert.isTrue(a.map.size === 2, "assert getIndex function test 10");
    assert.isTrue(a.hasAlpha, "assert getIndex function test 11");
    assert.isTrue(a.getIndex(0xFF0000) === 0, "assert getIndex function test 12");
    assert.isTrue(a.map.size === 2, "assert getIndex function test 13");
    assert.isTrue(a.hasAlpha, "assert getIndex function test 14");
    assert.isTrue(a.getIndex(0xFFFFFF) === 2, "assert getIndex function test 15");
    assert.isTrue(a.map.size === 3, "assert getIndex function test 16");
    assert.isTrue(a.hasAlpha, "assert getIndex function test 17");
    assert.isTrue(a.getIndex(0x0000FF) === 1, "assert getIndex function test 18");
    assert.isTrue(a.map.size === 3, "assert getIndex function test 19");
    assert.isTrue(a.hasAlpha, "assert getIndex function test 20");
    assert.isTrue(a.getIndex(0xFF0000) === 0, "assert getIndex function test 21");
    assert.isTrue(a.map.size === 3, "assert getIndex function test 22");
    assert.isTrue(a.hasAlpha, "assert getIndex function test 23");
    assert.isTrue(a.getIndex(0xFFFFFF) === 2, "assert getIndex function test 24");
    assert.isTrue(a.map.size === 3, "assert getIndex function test 25");
    assert.isTrue(a.hasAlpha, "assert getIndex function test 26");
  });

  it("test simple return functions", () => {
    /** Test hasTransparency function */
    let a: ColorMap = new ColorMap();
    assert.isFalse(a.hasTransparency(), "assert hasTransparency function test 1");
    a.getIndex(0xFF0000);
    assert.isTrue(a.hasTransparency(), "assert hasTransparency function test 2");

    /** Test isUniform function */
    a = new ColorMap();
    assert.isFalse(a.isUniform(), "assert isUniform function test 1");
    a.getIndex(0xFF0000);
    assert.isTrue(a.isUniform(), "assert isUniform function test 2");
    a.getIndex(0x00FF00);
    assert.isFalse(a.isUniform(), "assert isUniform function test 3");
    a.getIndex(0x0000FF);
    assert.isFalse(a.isUniform(), "assert isUniform function test 4");

    /** Test isFull function */
    a = new ColorMap();
    assert.isFalse(a.isFull(), "assert isFull function test 1");
    for (let i = 0; a.size() !== 0xffff; i++) {
      assert.isFalse(a.isFull(), "assert isFull function test 2." + a.size());
      a.getIndex(i);
    }
    assert.isTrue(a.size() === 0xffff, "assert isFull function test 3");
    assert.isTrue(a.isFull(), "assert isFull function test 4");

    /** Test getNumIndices function */
    a = new ColorMap();
    assert.isTrue(a.getNumIndices() === 0, "assert getNumIndices function test 1");
    for (let i = 0; a.map.size !== 0xffff; i++) {
      assert.isTrue(a.getNumIndices() === i, "assert getNumIndices function test 2." + a.size());
      a.getIndex(i);
    }
    assert.isTrue(a.getNumIndices() === 0xffff, "assert getNumIndices function test 3");

    /** Test size function */
    a = new ColorMap();
    assert.isTrue(a.size() === 0, "assert size function test 1");
    for (let i = 0; a.getNumIndices() !== 0xffff; i++) {
      assert.isTrue(a.map.size === i, "assert size function test 2." + a.size());
      a.getIndex(i);
    }
    assert.isTrue(a.size() === 0xffff, "assert size function test 3");

    /** Test empty function */
    a = new ColorMap();
    assert.isTrue(a.empty(), "assert empty function test 1");
    a.getIndex(0x00FFFF);
    assert.isFalse(a.empty(), "assert empty function test 2");
    a.getIndex(0xFFFF00);
    assert.isFalse(a.empty(), "assert empty function test 3");
    a.getIndex(0xFFFFFF);
    assert.isFalse(a.empty(), "assert empty function test 4");

    /** Test get function */
    a = new ColorMap();
    a.getIndex(0x00FFFF);
    assert.isTrue(a.get(0x00FFFF) === 0, "assert get function test 1");
    a.getIndex(0xFFFF00);
    a.getIndex(0xFFFFFF);
    assert.isTrue(a.get(0xFFFFFF) === 2, "assert get function test 2");
    assert.isTrue(a.get(0xFFFF00) === 1, "assert get function test 3");
  });

  it("test toColorIndex function", () => {
    /** Test toColorIndex function */
    let a: ColorMap = new ColorMap();
    const uint16: Uint16Array = new Uint16Array(2);
    let colorIndex = new ColorIndex();

    a.getIndex(0xFFFFFF);
    a.toColorIndex(colorIndex, uint16);
    expect(colorIndex.uniform!.tbgr).to.equal(0xFFFFFF);
    assert.isTrue(colorIndex.numColors === 1, "assert toColorIndex function test 5");

    a = new ColorMap();
    colorIndex = new ColorIndex();
    expect(colorIndex.uniform!.tbgr).to.equal(ColorDef.white.tbgr);
    assert.isTrue(colorIndex.numColors === 1, "assert toColorIndex function test 7");
    a.getIndex(0x0000FFFF);
    a.toColorIndex(colorIndex, uint16);
    expect(colorIndex.isUniform).to.equal(true);
    assert.isTrue(colorIndex.uniform!.tbgr === 0x0000FFFF, "assert toColorIndex function test 9");
    assert.isTrue(colorIndex.numColors === 1, "assert toColorIndex function test 10");

    a = new ColorMap();
    a.getIndex(0x0000FFFF);
    a.getIndex(0x000000FF);
    colorIndex = new ColorIndex();
    colorIndex.initUniform(0x00FF00FF);
    assert.isTrue(colorIndex.numColors === 1, "assert toColorIndex function test 9");
    a.toColorIndex(colorIndex, uint16);
    assert.isFalse(colorIndex.isUniform, "assert toColorIndex function test 10");
    assert.isTrue(colorIndex.nonUniform && colorIndex.nonUniform.colors.length === 2, "assert toColorIndex function test 11");
    let values = colorIndex.nonUniform ? colorIndex.nonUniform.colors.values() : undefined;
    assert.isTrue(values && values.next().value === 0x0000FFFF, "assert toColorIndex function test 12");
    assert.isTrue(values && values.next().value === 0x000000FF, "assert toColorIndex function test 13");
    assert.isTrue(values && values.next().done, "assert toColorIndex function test 14");
    assert.isTrue(colorIndex.numColors === 2, "assert toColorIndex function test 15");

    a = new ColorMap();
    a.getIndex(0x00000000);
    a.getIndex(0x0000FFFF);
    a.getIndex(0x000000FF);
    colorIndex = new ColorIndex();
    assert.isTrue(colorIndex.numColors === 1, "assert toColorIndex function test 16");
    a.toColorIndex(colorIndex, uint16);
    assert.isFalse(colorIndex.isUniform, "assert toColorIndex function test 17");
    assert.isTrue(colorIndex.nonUniform && colorIndex.nonUniform.colors.length === 3, "assert toColorIndex function test 18");
    values = colorIndex.nonUniform ? colorIndex.nonUniform.colors.values() : undefined;
    assert.isTrue(values && values.next().value === 0x00000000, "assert toColorIndex function test 19");
    assert.isTrue(values && values.next().value === 0x0000FFFF, "assert toColorIndex function test 20");
    assert.isTrue(values && values.next().value === 0x000000FF, "assert toColorIndex function test 21");
    assert.isTrue(values && values.next().done, "assert toColorIndex function test 22");
    assert.isTrue(colorIndex.numColors === 3, "assert toColorIndex function test 23");
  });
});
