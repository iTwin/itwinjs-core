/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { ColorDef, ColorIndex } from "@itwin/core-common";
import { ColorMap } from "../../../common/internal/render/ColorMap";

describe("ColorMap", () => {
  it("create a new ColorMap", () => {
    /** Test creating a ColorMap */
    const a: ColorMap = new ColorMap();
    expect(a.length).toEqual(0);
    expect(a.hasTransparency).toBe(false);
  });

  it("test insert function", () => {
    /** Test static getMaxIndex function */
    const a: ColorMap = new ColorMap();
    expect(a.insert(0xff0000)).toEqual(0);
    expect(a.length).toEqual(1);
    expect(a.hasTransparency).toBe(false);
    expect(a.insert(0x0000ff)).toEqual(1);
    expect(a.length).toEqual(2);
    expect(a.hasTransparency).toBe(false);
    expect(a.insert(0x0000ff)).toEqual(1);
    expect(a.length).toEqual(2);
    expect(a.hasTransparency).toBe(false);
    expect(a.insert(0xff0000)).toEqual(0);
    expect(a.length).toEqual(2);
    expect(a.hasTransparency).toBe(false);
    expect(a.insert(0xffffff)).toEqual(2);
    expect(a.length).toEqual(3);
    expect(a.hasTransparency).toBe(false);
    expect(a.insert(0x0000ff)).toEqual(1);
    expect(a.length).toEqual(3);
    expect(a.hasTransparency).toBe(false);
    expect(a.insert(0xff0000)).toEqual(0);
    expect(a.length).toEqual(3);
    expect(a.hasTransparency).toBe(false);
    expect(a.insert(0xffffff)).toEqual(2);
    expect(a.length).toEqual(3);
    expect(a.hasTransparency).toBe(false);
  });

  it("test hasTransparency function 1", () => {
    /** Test hasTransparency function */
    const a: ColorMap = new ColorMap();
    expect(a.hasTransparency).toBe(false);
    a.insert(0x01000000);
    expect(a.hasTransparency).toBe(true);
    a.insert(0xff000000);
    expect(a.hasTransparency).toBe(true);
    a.insert(0x7fffffff);
    expect(a.hasTransparency).toBe(true);
  });

  it("test hasTransparency function 2", () => {
    const a = new ColorMap();
    a.insert(0xff000000);
    expect(a.hasTransparency).toBe(true);
  });

  it("test hasTransparency function 3", () => {
    const a = new ColorMap();
    a.insert(0x7fffffff);
    expect(a.hasTransparency).toBe(true);
  });

  it("test hasTransparency function 4", () => {
    const a = new ColorMap();
    a.insert(0x00000000);
    expect(a.hasTransparency).toBe(false);
  });

  /** Test isUniform function */
  it("test isUniform function", () => {
    const a = new ColorMap();
    expect(a.isUniform).toBe(false);
    a.insert(0xff0000);
    expect(a.isUniform).toBe(true);
    a.insert(0x00ff00);
    expect(a.isUniform).toBe(false);
    a.insert(0x0000ff);
    expect(a.isUniform).toBe(false);
  });

  /** Test isFull function */
  it("test isFull function", () => {
    const a = new ColorMap();
    expect(a.isFull).toBe(false);
    for (let i = 0; a.length !== 0xffff; i++) {
      expect(a.isFull).toBe(false);
      a.insert(i);
    }
    expect(a.length).toBe(0xffff);
    expect(a.isFull).toBe(true);
  });

  /** Test getNumIndices function */
  it("test getNumIndices function", () => {
    const a = new ColorMap();
    expect(a.length).toBe(0);
    for (let i = 0; a.length !== 0xffff; i++) {
      expect(a.length).toBe(i);
      a.insert(i);
    }
    expect(a.length).toBe(0xffff);
  });

  /** Test size function */
  it("test size function", () => {
    const a = new ColorMap();
    expect(a.length).toBe(0);
    for (let i = 0; a.length !== 0xffff; i++) {
      expect(a.length).toBe(i);
      a.insert(i);
    }
    expect(a.length).toBe(0xffff);
  });

  /** Test empty function */
  it("test empty function", () => {
    const a = new ColorMap();
    expect(a.isEmpty).toBe(true);
    a.insert(0x00ffff);
    expect(a.isEmpty).toBe(false);
    a.insert(0xffff00);
    expect(a.isEmpty).toBe(false);
    a.insert(0xffffff);
    expect(a.isEmpty).toBe(false);
  });

  it("test toColorIndex function", () => {
    /** Test toColorIndex function */
    let a: ColorMap = new ColorMap();
    const indices = [0, 0];
    let colorIndex = new ColorIndex();

    a.insert(0xffffff);
    a.toColorIndex(colorIndex, indices);
    expect(colorIndex.uniform!.tbgr).toEqual(0xffffff);
    expect(colorIndex.numColors).toEqual(1);

    a = new ColorMap();
    colorIndex = new ColorIndex();
    expect(colorIndex.uniform!.tbgr).toEqual(ColorDef.white.tbgr);
    expect(colorIndex.numColors).toEqual(1);
    a.insert(0x0000ffff);
    a.toColorIndex(colorIndex, indices);
    expect(colorIndex.isUniform).toEqual(true);
    expect(colorIndex.uniform!.tbgr).toEqual(0x0000ffff);
    expect(colorIndex.numColors).toEqual(1);

    a = new ColorMap();
    a.insert(0x0000ffff);
    a.insert(0x000000ff);
    colorIndex = new ColorIndex();
    colorIndex.initUniform(0x00ff00ff);
    expect(colorIndex.numColors).toEqual(1);
    a.toColorIndex(colorIndex, indices);
    expect(colorIndex.isUniform).toEqual(false);
    expect(colorIndex.nonUniform && colorIndex.nonUniform.colors.length).toEqual(2);
    let values = colorIndex.nonUniform ? colorIndex.nonUniform.colors.values() : undefined;
    expect(values && values.next().value).toEqual(0x0000ffff);
    expect(values && values.next().value).toEqual(0x000000ff);
    expect(values && values.next().done).toBe(true);
    expect(colorIndex.numColors).toEqual(2);

    a = new ColorMap();
    a.insert(0x00000000);
    a.insert(0x0000ffff);
    a.insert(0x000000ff);
    colorIndex = new ColorIndex();
    expect(colorIndex.numColors).toBe(1);
    a.toColorIndex(colorIndex, indices);
    expect(colorIndex.isUniform).toBe(false);
    expect(colorIndex.nonUniform && colorIndex.nonUniform.colors.length).toBe(3);
    values = colorIndex.nonUniform ? colorIndex.nonUniform.colors.values() : undefined;
    expect(values && values.next().value).toBe(0x00000000);
    expect(values && values.next().value).toBe(0x0000ffff);
    expect(values && values.next().value).toBe(0x000000ff);
    expect(values && values.next().done).toBe(true);
    expect(colorIndex.numColors).toBe(3);
  });
});
