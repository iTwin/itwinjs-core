/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { ColorDef } from "@itwin/core-common";
import { FloatRgb, FloatRgba } from "../../../render/webgl/FloatRGBA";

interface Rgb {
  red: number;
  green: number;
  blue: number;
}

function expectComponent(actual: number, expected: number) {
  // Floating-point color types store components as 32-bit floats. Expect precision issues when comparing to 64-bit floats.
  const epsilon = 1.0 / 255.0;
  expect(Math.abs(expected - actual)).to.be.lessThan(epsilon);
}

function expectRgb<T extends Rgb>(rgb: T, r: number, g: number, b: number) {
  expectComponent(rgb.red, r);
  expectComponent(rgb.green, g);
  expectComponent(rgb.blue, b);
}

function expectRgba(rgba: FloatRgba, r: number, g: number, b: number, a: number) {
  expectRgb(rgba, r, g, b);
  expectComponent(rgba.alpha, a);
}

describe("FloatRgb", () => {
  it("should initialize to black", () => {
    const rgb = new FloatRgb();
    expect(rgb.tbgr).toEqual(ColorDef.black.tbgr);
  });

  it("should create from ColorDef", () => {
    const rgb = FloatRgb.fromColorDef(ColorDef.black);
    expect(rgb.tbgr).toEqual(ColorDef.black.tbgr);
    expectRgb(rgb, 0, 0, 0);

    rgb.setColorDef(ColorDef.white);
    expect(rgb.tbgr).toEqual(ColorDef.white.tbgr);
    expectRgb(rgb, 1, 1, 1);

    rgb.setColorDef(ColorDef.blue);
    expect(rgb.tbgr).toEqual(ColorDef.blue.tbgr);
    expectRgb(rgb, 0, 0, 1);

    // Transparency is ignored - always zero
    const color = ColorDef.from(25, 192, 212, 200);
    rgb.setColorDef(color);
    expect(rgb.tbgr).not.toEqual(color.tbgr);
    expectRgb(rgb, 25 / 255, 192 / 255, 212 / 255);
    expect(rgb.tbgr).toEqual(0x00d4c019);
  });

  it("should create from components", () => {
    const rgb = FloatRgb.from(0, 0, 0);
    expect(rgb.tbgr).toEqual(ColorDef.black.tbgr);
    expectRgb(rgb, 0, 0, 0);

    rgb.set(1, 1, 1);
    expect(rgb.tbgr).toEqual(ColorDef.white.tbgr);
    expectRgb(rgb, 1, 1, 1);

    rgb.set(-1, -1, -1);
    expectRgb(rgb, 0, 0, 0);

    rgb.set(2, 2, 2);
    expectRgb(rgb, 1, 1, 1);
  });

  it("should convert to ColorDef", () => {
    const rgb = FloatRgb.fromColorDef(ColorDef.red);
    expect(rgb.tbgr).toEqual(ColorDef.red.tbgr);

    rgb.setColorDef(ColorDef.blue);
    expect(rgb.tbgr).toEqual(ColorDef.blue.tbgr);
  });
});

describe("FloatRgba", () => {
  it("should initialize to opaque black", () => {
    const rgba = new FloatRgba();
    expect(rgba.tbgr).toEqual(ColorDef.black.tbgr);
    expect(rgba.hasTranslucency).toBe(false);
  });

  it("should create from ColorDef", () => {
    const rgba = FloatRgba.fromColorDef(ColorDef.black);
    expect(rgba.tbgr).toEqual(ColorDef.black.tbgr);
    expectRgba(rgba, 0, 0, 0, 1);
    expect(rgba.hasTranslucency).toBe(false);

    rgba.setColorDef(ColorDef.white);
    expect(rgba.tbgr).toEqual(ColorDef.white.tbgr);
    expectRgba(rgba, 1, 1, 1, 1);
    expect(rgba.hasTranslucency).toBe(false);

    const color = ColorDef.from(25, 192, 212, 200);
    rgba.setColorDef(color);
    expect(rgba.tbgr).toEqual(color.tbgr);
    expectRgba(rgba, 25 / 255, 192 / 255, 212 / 255, 55 / 255);
    expect(rgba.hasTranslucency).toBe(true);
  });

  it("should create from components", () => {
    const rgba = FloatRgba.from(0, 0, 0, 1);
    expect(rgba.tbgr).toEqual(ColorDef.black.tbgr);
    expectRgba(rgba, 0, 0, 0, 1);
    expect(rgba.hasTranslucency).toBe(false);

    rgba.set(1, 1, 1, 1);
    expect(rgba.tbgr).toEqual(ColorDef.white.tbgr);
    expect(rgba.hasTranslucency).toBe(false);

    rgba.set(25 / 255, 192 / 255, 212 / 255, 200 / 255);
    expect(rgba.tbgr).toEqual(0x37d4c019);
    expectRgba(rgba, 25 / 255, 192 / 255, 212 / 255, 200 / 255);
    expect(rgba.hasTranslucency).toBe(true);

    rgba.set(-0.5, -1, 1.5, -1);
    expectRgba(rgba, 0, 0, 1, 0);

    rgba.set(0, 0, 0, 1.1);
    expectRgba(rgba, 0, 0, 0, 1);
  });
});
