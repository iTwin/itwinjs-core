/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ColorDef } from "@bentley/imodeljs-common";
import { FloatRgb, Rgba, FloatRgba, FloatPreMulRgba } from "../../render/webgl/FloatRGBA";

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
  const epsilon = 0.00001;
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

function expectRgba(rgba: Rgba, r: number, g: number, b: number, a: number) {
  expectRgb(rgba, r, g, b);
  expectComponent(rgba.alpha, a);
}

function expectEqualRgba(a: Rgba, b: Rgba) {
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
