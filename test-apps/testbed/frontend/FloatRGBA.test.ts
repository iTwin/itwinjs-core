/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ColorDef } from "@bentley/imodeljs-common";
import { FloatRgb, FloatRgba, FloatPreMulRgba, Rgba } from "@bentley/imodeljs-frontend/lib/webgl";

interface Rgb {
  red: number;
  green: number;
  blue: number;
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
    let aFloatRgb: FloatRgb = new FloatRgb(0, 0, 0);

    // Test fromColorDef function
    let bFloatRgb: FloatRgb = FloatRgb.fromColorDef(ColorDef.from(0, 0, 0));
    expectRgb(bFloatRgb, 0, 0, 0);

    bFloatRgb = FloatRgb.fromColorDef(ColorDef.from(51, 102, 255));
    aFloatRgb = new FloatRgb(51 / 255, 102 / 255, 255 / 255);
    expectEqualRgb(bFloatRgb, aFloatRgb);
  });
});

describe("FloatRgba", () => {
  it("should create and store rgba in a variety of ways", () => {
    let aFloatRgba: FloatRgba = new FloatRgba(0, 0, 0, 0);
    let bFloatRgba: FloatRgba = new FloatRgba(0, 0, 0, 0);
    expectEqualRgba(aFloatRgba, bFloatRgba);

    // Test hasTranslucency function
    aFloatRgba = new FloatRgba(0, 0, 0, 0);
    expect(aFloatRgba.hasTranslucency).to.be.true;
    aFloatRgba = new FloatRgba(0, 0, 0, 0.5);
    expect(aFloatRgba.hasTranslucency).to.be.true;
    aFloatRgba = new FloatRgba(0, 0, 0, 1.0);
    expect(aFloatRgba.hasTranslucency).to.be.false;

    // Test fromPreMulRgba function
    const aPreMulRgba = FloatPreMulRgba.fromRgba(new FloatRgba(1.0, 0.4, 0.6, 0.5));
    const bPreMulRgba = FloatPreMulRgba.fromRgba(new FloatRgba(0.0, 1.0, 0.0, 1.0));
    bFloatRgba = FloatRgba.fromPreMulRgba(aPreMulRgba);
    expectRgba(bFloatRgba, 1, 0.4, 0.6, 0.5);
    bFloatRgba = FloatRgba.fromPreMulRgba(bPreMulRgba);
    expectEqualRgba(bFloatRgba, bPreMulRgba);

    // Test fromRgb function
    const aFloatRgb: FloatRgb = FloatRgb.fromColorDef(ColorDef.from(51, 102, 255));
    bFloatRgba = FloatRgba.fromRgb(aFloatRgb);
    expectRgba(bFloatRgba, 51 / 255, 102 / 255, 255 / 255, 1);
    const bFloatRgb: FloatRgb = FloatRgb.fromColorDef(ColorDef.from(0, 255, 0));
    bFloatRgba = FloatRgba.fromRgb(bFloatRgb, 0.7);
    expectRgba(bFloatRgba, 0, 1, 0, 0.7);

    // Test fromColorDef function
    bFloatRgba = FloatRgba.fromColorDef(ColorDef.from(0, 0, 0));
    expectRgba(bFloatRgba, 0, 0, 0, 1);
    bFloatRgba = FloatRgba.fromColorDef(ColorDef.from(51, 102, 255));
    aFloatRgba = new FloatRgba(0.2, 0.4, 1.0, 1.0);
    expectEqualRgba(aFloatRgba, bFloatRgba);

    // Test equals function
    aFloatRgba = new FloatRgba(0.2, 0.4, 1.0, 0.2);
    bFloatRgba = new FloatRgba(0.2, 0.4, 1.0, 0.2);
    expect(aFloatRgba.equals(bFloatRgba)).to.be.true;
    bFloatRgba = new FloatRgba(0.201, 0.4, 1.0, 0.2);
    expect(aFloatRgba.equals(bFloatRgba)).to.be.false;
    bFloatRgba = new FloatRgba(0.2, 0.401, 1.0, 0.2);
    expect(aFloatRgba.equals(bFloatRgba)).to.be.false;
    bFloatRgba = new FloatRgba(0.2, 0.4, 0.999, 0.2);
    expect(aFloatRgba.equals(bFloatRgba)).to.be.false;
    bFloatRgba = new FloatRgba(0.2, 0.4, 1.0, 0.5);
    expect(aFloatRgba.equals(bFloatRgba)).to.be.false;
    bFloatRgba = new FloatRgba(0.2, 0.4, 1.0, 0.2);
    expect(aFloatRgba.equals(bFloatRgba)).to.be.true;
    bFloatRgba = new FloatRgba(0.200000000000001, 0.4, 1.0, 0.2);
    expect(aFloatRgba.equals(bFloatRgba)).to.be.true;
  });
});

describe("FloatPreMulRgba", () => {
  it("should create and store a FloatPreMulRgba in a variety of ways", () => {
    let aFloatPreMulRgba: FloatPreMulRgba;
    let bFloatPreMulRgba: FloatPreMulRgba;

    // Test hasTranslucency function
    aFloatPreMulRgba = FloatPreMulRgba.fromRgba(new FloatRgba(0.0, 1.0, 0.0, 0.0));
    expect(aFloatPreMulRgba.hasTranslucency).to.be.true;
    aFloatPreMulRgba = FloatPreMulRgba.fromRgba(new FloatRgba(0.0, 1.0, 0.0, 0.5));
    expect(aFloatPreMulRgba.hasTranslucency).to.be.true;
    aFloatPreMulRgba = FloatPreMulRgba.fromRgba(new FloatRgba(0.0, 1.0, 0.0, 1.0));
    expect(aFloatPreMulRgba.hasTranslucency).to.be.false;

    // Test fromRgba function
    bFloatPreMulRgba = FloatPreMulRgba.fromRgba(new FloatRgba(0.0, 1.0, 0.0, 0.0));
    const aFloatRgba: FloatRgba = new FloatRgba(0.2, 0.4, 1.0, 1.0);
    bFloatPreMulRgba = FloatPreMulRgba.fromRgba(aFloatRgba);
    expectEqualRgba(bFloatPreMulRgba, aFloatRgba);
    const bFloatRgba: FloatRgba = new FloatRgba(0.0, 1.0, 0.0, 0.7);
    bFloatPreMulRgba = FloatPreMulRgba.fromRgba(bFloatRgba);
    expectRgba(bFloatPreMulRgba, 0, 0.7, 0, 0.7);

    // Test fromColorDef function
    bFloatPreMulRgba = FloatPreMulRgba.fromColorDef(ColorDef.from(0, 0, 0, 0));
    expectRgba(bFloatPreMulRgba, 0, 0, 0, 1);
    bFloatPreMulRgba = FloatPreMulRgba.fromColorDef(ColorDef.from(51, 102, 255, 51));
    expectRgba(bFloatPreMulRgba, 0.16, 0.32, 0.8, 0.8);

    // Test equals function
    aFloatPreMulRgba = FloatPreMulRgba.fromRgba(new FloatRgba(0.2, 0.4, 1.0, 0.2));
    bFloatPreMulRgba = FloatPreMulRgba.fromRgba(new FloatRgba(0.2, 0.4, 1.0, 0.2));
    expect(aFloatPreMulRgba.equals(bFloatPreMulRgba)).to.be.true;
    bFloatPreMulRgba = FloatPreMulRgba.fromRgba(new FloatRgba(0.199, 0.4, 1.0, 0.2));
    expect(aFloatPreMulRgba.equals(bFloatPreMulRgba)).to.be.false;
    bFloatPreMulRgba = FloatPreMulRgba.fromRgba(new FloatRgba(0.2, 0.399, 1.0, 0.2));
    expect(aFloatPreMulRgba.equals(bFloatPreMulRgba)).to.be.false;
    bFloatPreMulRgba = FloatPreMulRgba.fromRgba(new FloatRgba(0.2, 0.4, 0.999, 0.2));
    expect(aFloatPreMulRgba.equals(bFloatPreMulRgba)).to.be.false;
    bFloatPreMulRgba = FloatPreMulRgba.fromRgba(new FloatRgba(0.2, 0.4, 1.0, 0.5));
    expect(aFloatPreMulRgba.equals(bFloatPreMulRgba)).to.be.false;
    bFloatPreMulRgba = FloatPreMulRgba.fromRgba(new FloatRgba(0.2, 0.4, 1.0, 0.2));
    expect(aFloatPreMulRgba.equals(bFloatPreMulRgba)).to.be.true;
  });
});
