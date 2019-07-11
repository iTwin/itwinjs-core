/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ColorDef } from "@bentley/imodeljs-common";
import { FloatRgb, FloatRgb2, Rgba, FloatRgba, FloatRgba2, FloatPreMulRgba } from "../../render/webgl/FloatRGBA";

interface Rgb {
  red: number;
  green: number;
  blue: number;
}

class TestRgb extends FloatRgb {
  public constructor(red: number, green: number, blue: number) {
    super();
    this.setFromColorDef(ColorDef.from(red, green, blue));
  }
}

class TestRgba extends FloatRgba {
  public constructor(red: number, green: number, blue: number, alpha: number) {
    super();
    this.setFromColorDef(ColorDef.from(red, green, blue, 255 - alpha));
  }
}

class TestPreMulRgba extends FloatPreMulRgba {
  public constructor(red: number, green: number, blue: number, alpha: number) {
    super();
    this.setFromColorDef(ColorDef.from(red, green, blue, 255 - alpha));
  }
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

function expectEqualRgb<T extends Rgb>(a: T, b: T) {
  expectRgb(a, b.red, b.green, b.blue);
}

function expectRgba(rgba: Rgba | FloatRgba2, r: number, g: number, b: number, a: number) {
  expectRgb(rgba, r, g, b);
  expectComponent(rgba.alpha, a);
}

function expectEqualRgba(a: Rgba | FloatRgba2, b: Rgba | FloatRgba2) {
  expectRgba(a, b.red, b.green, b.blue, b.alpha);
}

describe("FloatRgb", () => {
  it("should create and store rgb from ColorDef", () => {
    let aFloatRgb: FloatRgb = new TestRgb(0, 0, 0);

    // Test fromColorDef function
    let bFloatRgb: FloatRgb = FloatRgb.fromColorDef(ColorDef.from(0, 0, 0));
    expectRgb(bFloatRgb, 0, 0, 0);

    bFloatRgb = FloatRgb.fromColorDef(ColorDef.from(51, 102, 255));
    aFloatRgb = new TestRgb(51, 102, 255);
    expectEqualRgb(bFloatRgb, aFloatRgb);
  });
});

describe("FloatRgba", () => {
  it("should create and store rgba in a variety of ways", () => {
    let aFloatRgba: FloatRgba = new TestRgba(0, 0, 0, 0);
    let bFloatRgba: FloatRgba = new TestRgba(0, 0, 0, 0);
    expectEqualRgba(aFloatRgba, bFloatRgba);

    // Test hasTranslucency function
    aFloatRgba = new TestRgba(0, 0, 0, 0);
    expect(aFloatRgba.hasTranslucency).to.be.true;
    aFloatRgba = new TestRgba(0, 0, 0, 127);
    expect(aFloatRgba.hasTranslucency).to.be.true;
    aFloatRgba = new TestRgba(0, 0, 0, 255);
    expect(aFloatRgba.hasTranslucency).to.be.false;

    // Test fromColorDef function
    bFloatRgba = FloatRgba.fromColorDef(ColorDef.from(0, 0, 0));
    expectRgba(bFloatRgba, 0, 0, 0, 1);
    bFloatRgba = FloatRgba.fromColorDef(ColorDef.from(51, 102, 255));
    aFloatRgba = new TestRgba(51, 102, 255, 255);
    expectEqualRgba(aFloatRgba, bFloatRgba);

    // Test equals function
    aFloatRgba = new TestRgba(51, 102, 255, 51);
    bFloatRgba = new TestRgba(51, 102, 255, 51);
    expect(aFloatRgba.equals(bFloatRgba)).to.be.true;
    bFloatRgba = new TestRgba(51, 102, 255, 127);
    expect(aFloatRgba.equals(bFloatRgba)).to.be.false;
  });
});

describe("FloatPreMulRgba", () => {
  it("should create and store a FloatPreMulRgba in a variety of ways", () => {
    let aFloatPreMulRgba: FloatPreMulRgba;
    let bFloatPreMulRgba: FloatPreMulRgba;

    // Test hasTranslucency function
    aFloatPreMulRgba = new TestPreMulRgba(0, 255, 0, 0);
    expect(aFloatPreMulRgba.hasTranslucency).to.be.true;
    aFloatPreMulRgba = new TestPreMulRgba(0, 255, 0, 127);
    expect(aFloatPreMulRgba.hasTranslucency).to.be.true;
    aFloatPreMulRgba = new TestPreMulRgba(0, 255, 0, 255);
    expect(aFloatPreMulRgba.hasTranslucency).to.be.false;

    // Test fromColorDef function
    bFloatPreMulRgba = TestPreMulRgba.fromColorDef(ColorDef.from(0, 0, 0, 0));
    expectRgba(bFloatPreMulRgba, 0, 0, 0, 1);
    bFloatPreMulRgba = TestPreMulRgba.fromColorDef(ColorDef.from(51, 102, 255, 51));
    expectRgba(bFloatPreMulRgba, 0.16, 0.32, 0.8, 0.8);

    // Test equals function
    aFloatPreMulRgba = new TestPreMulRgba(51, 102, 255, 51);
    bFloatPreMulRgba = new TestPreMulRgba(51, 102, 255, 51);
    expect(aFloatPreMulRgba.equals(bFloatPreMulRgba)).to.be.true;
    bFloatPreMulRgba = new TestPreMulRgba(51, 102, 255, 127);
    expect(aFloatPreMulRgba.equals(bFloatPreMulRgba)).to.be.false;
  });
});

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
