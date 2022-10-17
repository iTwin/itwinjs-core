/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { ColorDef, ColorIndex } from "@itwin/core-common";
import { ColorMap } from "../../../render/primitives/ColorMap";

describe("ColorMap", () => {
  it("create a new ColorMap", () => {
    /** Test creating a ColorMap */
    const a: ColorMap = new ColorMap();
    expect(a.length).to.equal(0);
    expect(a.hasTransparency).to.be.false;
  });

  it("test insert function", () => {
    /** Test static getMaxIndex function */
    const a: ColorMap = new ColorMap();
    assert.isTrue(a.insert(0xff0000) === 0);
    assert.isTrue(a.length === 1);
    assert.isFalse(a.hasTransparency);
    assert.isTrue(a.insert(0x0000ff) === 1);
    assert.isTrue(a.length === 2);
    assert.isFalse(a.hasTransparency);
    assert.isTrue(a.insert(0x0000ff) === 1);
    assert.isTrue(a.length === 2);
    assert.isFalse(a.hasTransparency);
    assert.isTrue(a.insert(0xff0000) === 0);
    assert.isTrue(a.length === 2);
    assert.isFalse(a.hasTransparency);
    assert.isTrue(a.insert(0xffffff) === 2);
    assert.isTrue(a.length === 3);
    assert.isFalse(a.hasTransparency);
    assert.isTrue(a.insert(0x0000ff) === 1);
    assert.isTrue(a.length === 3);
    assert.isFalse(a.hasTransparency);
    assert.isTrue(a.insert(0xff0000) === 0);
    assert.isTrue(a.length === 3);
    assert.isFalse(a.hasTransparency);
    assert.isTrue(a.insert(0xffffff) === 2);
    assert.isTrue(a.length === 3);
    assert.isFalse(a.hasTransparency);
  });

  it("test hasTransparency function 1", () => {
    /** Test hasTransparency function */
    const a: ColorMap = new ColorMap();
    assert.isFalse(a.hasTransparency);
    a.insert(0x01000000);
    assert.isTrue(a.hasTransparency);
    a.insert(0xff000000);
    assert.isTrue(a.hasTransparency);
    a.insert(0x7fffffff);
    assert.isTrue(a.hasTransparency);
  });
  it("test hasTransparency function 2", () => {
    const a = new ColorMap();
    a.insert(0xff000000);
    assert.isTrue(a.hasTransparency);
  });
  it("test hasTransparency function 3", () => {
    const a = new ColorMap();
    a.insert(0x7fffffff);
    assert.isTrue(a.hasTransparency);
  });
  it("test hasTransparency function 4", () => {
    const a = new ColorMap();
    a.insert(0x00000000);
    assert.isFalse(a.hasTransparency);
  });

  /** Test isUniform function */
  it("test isUniform function", () => {
    const a = new ColorMap();
    assert.isFalse(a.isUniform);
    a.insert(0xff0000);
    assert.isTrue(a.isUniform);
    a.insert(0x00ff00);
    assert.isFalse(a.isUniform);
    a.insert(0x0000ff);
    assert.isFalse(a.isUniform);
  });

  /** Test isFull function */
  it("test isFull function", () => {
    const a = new ColorMap();
    assert.isFalse(a.isFull);
    for (let i = 0; a.length !== 0xffff; i++) {
      assert.isFalse(a.isFull);
      a.insert(i);
    }
    assert.isTrue(a.length === 0xffff);
    assert.isTrue(a.isFull);
  });

  /** Test getNumIndices function */
  it("test getNumIndices function", () => {
    const a = new ColorMap();
    assert.isTrue(a.length === 0);
    for (let i = 0; a.length !== 0xffff; i++) {
      assert.isTrue(a.length === i);
      a.insert(i);
    }
    assert.isTrue(a.length === 0xffff);
  });

  /** Test size function */
  it("test size function", () => {
    const a = new ColorMap();
    assert.isTrue(a.length === 0);
    for (let i = 0; a.length !== 0xffff; i++) {
      assert.isTrue(a.length === i);
      a.insert(i);
    }
    assert.isTrue(a.length === 0xffff);
  });

  /** Test empty function */
  it("test empty function", () => {
    const a = new ColorMap();
    assert.isTrue(a.isEmpty);
    a.insert(0x00ffff);
    assert.isFalse(a.isEmpty);
    a.insert(0xffff00);
    assert.isFalse(a.isEmpty);
    a.insert(0xffffff);
    assert.isFalse(a.isEmpty);
  });

  it("test toColorIndex function", () => {
    /** Test toColorIndex function */
    let a: ColorMap = new ColorMap();
    const indices = [0, 0];
    let colorIndex = new ColorIndex();

    a.insert(0xffffff);
    a.toColorIndex(colorIndex, indices);
    expect(colorIndex.uniform!.tbgr).to.equal(0xffffff);
    assert.isTrue(colorIndex.numColors === 1);

    a = new ColorMap();
    colorIndex = new ColorIndex();
    expect(colorIndex.uniform!.tbgr).to.equal(ColorDef.white.tbgr);
    assert.isTrue(colorIndex.numColors === 1);
    a.insert(0x0000ffff);
    a.toColorIndex(colorIndex, indices);
    expect(colorIndex.isUniform).to.equal(true);
    assert.isTrue(colorIndex.uniform!.tbgr === 0x0000ffff);
    assert.isTrue(colorIndex.numColors === 1);

    a = new ColorMap();
    a.insert(0x0000ffff);
    a.insert(0x000000ff);
    colorIndex = new ColorIndex();
    colorIndex.initUniform(0x00ff00ff);
    assert.isTrue(colorIndex.numColors === 1);
    a.toColorIndex(colorIndex, indices);
    assert.isFalse(colorIndex.isUniform);
    assert.isTrue(colorIndex.nonUniform && colorIndex.nonUniform.colors.length === 2);
    let values = colorIndex.nonUniform ? colorIndex.nonUniform.colors.values() : undefined;
    assert.isTrue(values && values.next().value === 0x0000ffff);
    assert.isTrue(values && values.next().value === 0x000000ff);
    assert.isTrue(values && values.next().done);
    assert.isTrue(colorIndex.numColors === 2);

    a = new ColorMap();
    a.insert(0x00000000);
    a.insert(0x0000ffff);
    a.insert(0x000000ff);
    colorIndex = new ColorIndex();
    assert.isTrue(colorIndex.numColors === 1);
    a.toColorIndex(colorIndex, indices);
    assert.isFalse(colorIndex.isUniform);
    assert.isTrue(colorIndex.nonUniform && colorIndex.nonUniform.colors.length === 3);
    values = colorIndex.nonUniform ? colorIndex.nonUniform.colors.values() : undefined;
    assert.isTrue(values && values.next().value === 0x00000000);
    assert.isTrue(values && values.next().value === 0x0000ffff);
    assert.isTrue(values && values.next().value === 0x000000ff);
    assert.isTrue(values && values.next().done);
    assert.isTrue(colorIndex.numColors === 3);
  });
});
