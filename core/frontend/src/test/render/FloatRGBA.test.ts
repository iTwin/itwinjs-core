/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ColorDef } from "@bentley/imodeljs-common";
import { FloatRgb2, FloatRgba2 } from "../../render/webgl/FloatRGBA";

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

function expectRgba(rgba: FloatRgba2, r: number, g: number, b: number, a: number) {
  expectRgb(rgba, r, g, b);
  expectComponent(rgba.alpha, a);
}

describe("FloatRgb2", () => {
  it("should create from ColorDef", () => {
    const rgb = FloatRgb2.fromColorDef(ColorDef.black);
    expect(rgb.tbgr).to.equal(ColorDef.black.tbgr);
    expectRgb(rgb, 0, 0, 0);

    rgb.setColorDef(ColorDef.white);
    expect(rgb.tbgr).to.equal(ColorDef.white.tbgr);
    expectRgb(rgb, 1, 1, 1);

    rgb.setColorDef(ColorDef.blue);
    expect(rgb.tbgr).to.equal(ColorDef.blue.tbgr);
    expectRgb(rgb, 0, 0, 1);

    // Transparency is ignored - always zero
    const color = ColorDef.from(25, 192, 212, 200);
    rgb.setColorDef(color);
    expect(rgb.tbgr).not.to.equal(color.tbgr);
    expectRgb(rgb, 25 / 255, 192 / 255, 212 / 255);
    expect(rgb.tbgr).to.equal(0x00D4C019);
  });

  it("should create from components", () => {
    const rgb = FloatRgb2.from(0, 0, 0);
    expect(rgb.tbgr).to.equal(ColorDef.black.tbgr);
    expectRgb(rgb, 0, 0, 0);

    rgb.set(1, 1, 1);
    expect(rgb.tbgr).to.equal(ColorDef.white.tbgr);
    expectRgb(rgb, 1, 1, 1);

    expect(() => rgb.set(-1, -1, -1)).to.throw("Assert: Programmer Error");
    expect(() => rgb.set(2, 2, 2)).to.throw("Assert: Programmer Error");
  });
});

describe("FloatRgba2", () => {
  it("should create from ColorDef", () => {
    const rgba = FloatRgba2.fromColorDef(ColorDef.black);
    expect(rgba.tbgr).to.equal(ColorDef.black.tbgr);
    expectRgba(rgba, 0, 0, 0, 1);
    expect(rgba.hasTranslucency).to.be.false;

    rgba.setColorDef(ColorDef.white);
    expect(rgba.tbgr).to.equal(ColorDef.white.tbgr);
    expectRgba(rgba, 1, 1, 1, 1);
    expect(rgba.hasTranslucency).to.be.false;

    const color = ColorDef.from(25, 192, 212, 200);
    rgba.setColorDef(color);
    expect(rgba.tbgr).to.equal(color.tbgr);
    expectRgba(rgba, 25 / 255, 192 / 255, 212 / 255, 55 / 255);
    expect(rgba.hasTranslucency).to.be.true;
  });

  it("should create from components", () => {
    const rgba = FloatRgba2.from(0, 0, 0, 1);
    expect(rgba.tbgr).to.equal(ColorDef.black.tbgr);
    expectRgba(rgba, 0, 0, 0, 1);
    expect(rgba.hasTranslucency).to.be.false;

    rgba.set(1, 1, 1, 1);
    expect(rgba.tbgr).to.equal(ColorDef.white.tbgr);
    expect(rgba.hasTranslucency).to.be.false;

    rgba.set(25 / 255, 192 / 255, 212 / 255, 200 / 255);
    expect(rgba.tbgr).to.equal(0x37D4C019);
    expectRgba(rgba, 25 / 255, 192 / 255, 212 / 255, 200 / 255);
    expect(rgba.hasTranslucency).to.be.true;

    expect(() => rgba.set(0.5, 0.5, 0.5, -1)).to.throw("Assert: Programmer Error");
    expect(() => rgba.set(0.5, 0.5, 0.5, 1.1)).to.throw("Assert: Programmer Error");
  });
});
