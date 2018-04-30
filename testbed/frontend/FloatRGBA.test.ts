/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { ColorDef } from "@bentley/imodeljs-common";
import { FloatRgb, FloatRgba, FloatPreMulRgba } from "@bentley/imodeljs-frontend/lib/rendering";

describe("FloatRgb", () => {
  it("should create and store rgb from ColorDef", () => {
    let aFloatRgb: FloatRgb = new FloatRgb(0, 0, 0);

    // Test fromColorDef function
    let bFloatRgb: FloatRgb = FloatRgb.fromColorDef(ColorDef.from(0, 0, 0));
    assert.isTrue(bFloatRgb.red === 0 && bFloatRgb.green === 0 && bFloatRgb.blue === 0,
      "fromColorDef test 1 failed\nred=" + bFloatRgb.red + "\ngreen=" + bFloatRgb.green + "\nblue=" + bFloatRgb.blue);
    bFloatRgb = FloatRgb.fromColorDef(ColorDef.from(51, 102, 255));
    aFloatRgb = new FloatRgb(0.2, 0.4, 1.0);
    assert.isTrue(aFloatRgb.red === bFloatRgb.red && aFloatRgb.green === bFloatRgb.green && aFloatRgb.blue === bFloatRgb.blue,
      "fromColorDef test 2 failed\nred=" + aFloatRgb.red + "\ngreen=" + aFloatRgb.green + "\nblue=" + aFloatRgb.blue);
  });
});

describe("FloatRgba", () => {
  it("should create and store rgba in a variety of ways", () => {
    let aFloatRgba: FloatRgba = new FloatRgba(0, 0, 0, 0);
    let bFloatRgba: FloatRgba = new FloatRgba(0, 0, 0, 0);

    // Test hasTranslucency function
    aFloatRgba = new FloatRgba(0, 0, 0, 0);
    assert.isTrue(aFloatRgba.hasTranslucency,
      "hasTranslucency test 1 failed\nred=" + aFloatRgba.red + "\ngreen=" + aFloatRgba.green + "\nblue=" + aFloatRgba.blue + "\nalpha=" + aFloatRgba.alpha);
    aFloatRgba = new FloatRgba(0, 0, 0, 0.5);
    assert.isTrue(aFloatRgba.hasTranslucency,
      "hasTranslucency test 2 failed\nred=" + aFloatRgba.red + "\ngreen=" + aFloatRgba.green + "\nblue=" + aFloatRgba.blue + "\nalpha=" + aFloatRgba.alpha);
    aFloatRgba = new FloatRgba(0, 0, 0, 1.0);
    assert.isFalse(aFloatRgba.hasTranslucency,
      "hasTranslucency test 3 failed\nred=" + aFloatRgba.red + "\ngreen=" + aFloatRgba.green + "\nblue=" + aFloatRgba.blue + "\nalpha=" + aFloatRgba.alpha);

    // Test fromPreMulRgba function
    const aPreMulRgba = FloatPreMulRgba.fromRgba(new FloatRgba(1.0, 0.4, 0.6, 0.5));
    const bPreMulRgba = FloatPreMulRgba.fromRgba(new FloatRgba(0.0, 1.0, 0.0, 1.0));
    bFloatRgba = FloatRgba.fromPreMulRgba(aPreMulRgba);
    assert.exists(bFloatRgba);
    assert.isTrue(bFloatRgba.red === 1.0 && bFloatRgba.green === 0.4 && bFloatRgba.blue === 0.6 && bFloatRgba.alpha === 0.5,
      "fromPreMulRgba test 1 failed\nred=" + bFloatRgba.red + "\ngreen=" + bFloatRgba.green + "\nblue=" + bFloatRgba.blue + "\nalpha=" + bFloatRgba.alpha);
    bFloatRgba = FloatRgba.fromPreMulRgba(bPreMulRgba);
    assert.isTrue(bFloatRgba.red === 0.0 && bFloatRgba.green === 1.0 && bFloatRgba.blue === 0.0 && bFloatRgba.alpha === 1.0,
      "fromPreMulRgba test 2 failed\nred=" + bFloatRgba.red + "\ngreen=" + bFloatRgba.green + "\nblue=" + bFloatRgba.blue + "\nalpha=" + bFloatRgba.alpha);

    // Test fromRgb function
    const aFloatRgb: FloatRgb = FloatRgb.fromColorDef(ColorDef.from(51, 102, 255));
    bFloatRgba = FloatRgba.fromRgb(aFloatRgb);
    assert.isTrue(bFloatRgba.red === 0.2 && bFloatRgba.green === 0.4 && bFloatRgba.blue === 1.0 && bFloatRgba.alpha === 1.0,
      "fromRgb test 1 failed\nred=" + bFloatRgba.red + "\ngreen=" + bFloatRgba.green + "\nblue=" + bFloatRgba.blue + "\nalpha=" + bFloatRgba.alpha);
    const bFloatRgb: FloatRgb = FloatRgb.fromColorDef(ColorDef.from(0, 255, 0));
    bFloatRgba = FloatRgba.fromRgb(bFloatRgb, 0.7);
    assert.isTrue(bFloatRgba.red === 0.0 && bFloatRgba.green === 1.0 && bFloatRgba.blue === 0.0 && bFloatRgba.alpha === 0.7,
      "fromRgb test 2 failed\nred=" + bFloatRgba.red + "\ngreen=" + bFloatRgba.green + "\nblue=" + bFloatRgba.blue + "\nalpha=" + bFloatRgba.alpha);

    // Test fromColorDef function
    bFloatRgba = FloatRgba.fromColorDef(ColorDef.from(0, 0, 0));
    assert.isTrue(bFloatRgba.red === 0 && bFloatRgba.green === 0 && bFloatRgba.blue === 0,
      "fromColorDef test 1 failed\nred=" + bFloatRgba.red + "\ngreen=" + bFloatRgba.green + "\nblue=" + bFloatRgba.blue + "\nalpha=" + bFloatRgba.alpha);
    bFloatRgba = FloatRgba.fromColorDef(ColorDef.from(51, 102, 255));
    aFloatRgba = new FloatRgba(0.2, 0.4, 1.0, 0);
    assert.isTrue(aFloatRgba.red === bFloatRgba.red && aFloatRgba.green === bFloatRgba.green && aFloatRgba.blue === bFloatRgba.blue,
      "fromColorDef test 2 failed\nred=" + aFloatRgba.red + "\ngreen=" + aFloatRgba.green + "\nblue=" + aFloatRgba.blue + "\nalpha=" + aFloatRgba.alpha);

    // Test equals function
    aFloatRgba = new FloatRgba(0.2, 0.4, 1.0, 0.2);
    bFloatRgba = new FloatRgba(0.2, 0.4, 1.0, 0.2);
    assert.isTrue(aFloatRgba.equals(bFloatRgba),
      "equals test 1 failed\naFloatRgba:\nred=" + aFloatRgba.red + "\ngreen=" + aFloatRgba.green + "\nblue=" + aFloatRgba.blue
      + "\nbFloatRgba:\nred=" + bFloatRgba.red + "\ngreen=" + bFloatRgba.green + "\nblue=" + bFloatRgba.blue + "\nalpha=" + bFloatRgba.alpha);
    bFloatRgba = new FloatRgba(0.201, 0.4, 1.0, 0.2);
    assert.isFalse(aFloatRgba.equals(bFloatRgba),
      "equals test 2 failed\naFloatRgba:\nred=" + aFloatRgba.red + "\ngreen=" + aFloatRgba.green + "\nblue=" + aFloatRgba.blue
      + "\nbFloatRgba:\nred=" + bFloatRgba.red + "\ngreen=" + bFloatRgba.green + "\nblue=" + bFloatRgba.blue + "\nalpha=" + bFloatRgba.alpha);
    bFloatRgba = new FloatRgba(0.2, 0.401, 1.0, 0.2);
    assert.isFalse(aFloatRgba.equals(bFloatRgba),
      "equals test 3 failed\naFloatRgba:\nred=" + aFloatRgba.red + "\ngreen=" + aFloatRgba.green + "\nblue=" + aFloatRgba.blue
      + "\nbFloatRgba:\nred=" + bFloatRgba.red + "\ngreen=" + bFloatRgba.green + "\nblue=" + bFloatRgba.blue + "\nalpha=" + bFloatRgba.alpha);
    bFloatRgba = new FloatRgba(0.2, 0.4, 0.999, 0.2);
    assert.isFalse(aFloatRgba.equals(bFloatRgba),
      "equals test 4 failed\naFloatRgba:\nred=" + aFloatRgba.red + "\ngreen=" + aFloatRgba.green + "\nblue=" + aFloatRgba.blue
      + "\nbFloatRgba:\nred=" + bFloatRgba.red + "\ngreen=" + bFloatRgba.green + "\nblue=" + bFloatRgba.blue + "\nalpha=" + bFloatRgba.alpha);
    bFloatRgba = new FloatRgba(0.2, 0.4, 1.0, 0.5);
    assert.isFalse(aFloatRgba.equals(bFloatRgba),
      "equals test 5 failed\naFloatRgba:\nred=" + aFloatRgba.red + "\ngreen=" + aFloatRgba.green + "\nblue=" + aFloatRgba.blue
      + "\nbFloatRgba:\nred=" + bFloatRgba.red + "\ngreen=" + bFloatRgba.green + "\nblue=" + bFloatRgba.blue + "\nalpha=" + bFloatRgba.alpha);
    bFloatRgba = new FloatRgba(0.2, 0.4, 1.0, 0.2);
    assert.isTrue(aFloatRgba.equals(bFloatRgba),
      "equals test 6 failed\naFloatRgba:\nred=" + aFloatRgba.red + "\ngreen=" + aFloatRgba.green + "\nblue=" + aFloatRgba.blue
      + "\nbFloatRgba:\nred=" + bFloatRgba.red + "\ngreen=" + bFloatRgba.green + "\nblue=" + bFloatRgba.blue + "\nalpha=" + bFloatRgba.alpha);
  });
});

describe("FloatPreMulRgba", () => {
  it("should create and store a FloatPreMulRgba in a variety of ways", () => {
    let aFloatPreMulRgba: FloatPreMulRgba;
    let bFloatPreMulRgba: FloatPreMulRgba;

    // Test hasTranslucency function
    aFloatPreMulRgba = FloatPreMulRgba.fromRgba(new FloatRgba(0.0, 1.0, 0.0, 0.0));
    assert.isTrue(aFloatPreMulRgba.hasTranslucency,
      "hasTranslucency test 1 failed\nalpha=" + aFloatPreMulRgba.alpha);
    aFloatPreMulRgba = FloatPreMulRgba.fromRgba(new FloatRgba(0.0, 1.0, 0.0, 0.5));
    assert.isTrue(aFloatPreMulRgba.hasTranslucency,
      "hasTranslucency test 2 failed\nalpha=" + aFloatPreMulRgba.alpha);
    aFloatPreMulRgba = FloatPreMulRgba.fromRgba(new FloatRgba(0.0, 1.0, 0.0, 1.0));
    assert.isFalse(aFloatPreMulRgba.hasTranslucency,
      "hasTranslucency test 3 failed\nalpha=" + aFloatPreMulRgba.alpha);

    // Test fromRgba function
    bFloatPreMulRgba = FloatPreMulRgba.fromRgba(new FloatRgba(0.0, 1.0, 0.0, 0.0));
    const aFloatRgba: FloatRgba = new FloatRgba(0.2, 0.4, 1.0, 1.0);
    bFloatPreMulRgba = FloatPreMulRgba.fromRgba(aFloatRgba);
    assert.isTrue(bFloatPreMulRgba.red === 0.2 && bFloatPreMulRgba.green === 0.4 && bFloatPreMulRgba.blue === 1.0 && bFloatPreMulRgba.alpha === 1.0,
      "fromRgba test 1 failed\nred=" + bFloatPreMulRgba.red + "\ngreen=" + bFloatPreMulRgba.green + "\nblue=" + bFloatPreMulRgba.blue + "\nalpha=" + bFloatPreMulRgba.alpha);
    const bFloatRgba: FloatRgba = new FloatRgba(0.0, 1.0, 0.0, 0.7);
    bFloatPreMulRgba = FloatPreMulRgba.fromRgba(bFloatRgba);
    assert.isTrue(bFloatPreMulRgba.red === 0.0 && bFloatPreMulRgba.green === 0.7 && bFloatPreMulRgba.blue === 0.0 && bFloatPreMulRgba.alpha === 0.7,
      "fromRgba test 2 failed\nred=" + bFloatPreMulRgba.red + "\ngreen=" + bFloatPreMulRgba.green + "\nblue=" + bFloatPreMulRgba.blue + "\nalpha=" + bFloatPreMulRgba.alpha);

    // Test fromColorDef function
    bFloatPreMulRgba = FloatPreMulRgba.fromColorDef(ColorDef.from(0, 0, 0, 0));
    assert.isTrue(bFloatPreMulRgba.red === 0 && bFloatPreMulRgba.green === 0 && bFloatPreMulRgba.blue === 0 && bFloatPreMulRgba.alpha === 1.0,
      "fromColorDef test 1 failed\nred=" + bFloatPreMulRgba.red + "\ngreen=" + bFloatPreMulRgba.green + "\nblue=" + bFloatPreMulRgba.blue + "\nalpha=" + bFloatPreMulRgba.alpha);
    bFloatPreMulRgba = FloatPreMulRgba.fromColorDef(ColorDef.from(51, 102, 255, 51));
    assert.isTrue(bFloatPreMulRgba.red === 0.16 && bFloatPreMulRgba.green === 0.32 && bFloatPreMulRgba.blue === 0.8 && bFloatPreMulRgba.alpha === 0.8,
      "fromColorDef test 2 failed\nred=" + bFloatPreMulRgba.red + "\ngreen=" + bFloatPreMulRgba.green + "\nblue=" + bFloatPreMulRgba.blue + "\nalpha=" + bFloatPreMulRgba.alpha);

    // Test equals function
    aFloatPreMulRgba = FloatPreMulRgba.fromRgba(new FloatRgba(0.2, 0.4, 1.0, 0.2));
    bFloatPreMulRgba = FloatPreMulRgba.fromRgba(new FloatRgba(0.2, 0.4, 1.0, 0.2));
    assert.isTrue(aFloatPreMulRgba.equals(bFloatPreMulRgba),
      "equals test 1 failed\naFloatPreMulRgba:\nred=" + aFloatPreMulRgba.red + "\ngreen=" + aFloatPreMulRgba.green + "\nblue=" + aFloatPreMulRgba.blue + "\nalpha=" + aFloatPreMulRgba.alpha
      + "\nbFloatPreMulRgba:\nred=" + bFloatPreMulRgba.red + "\ngreen=" + bFloatPreMulRgba.green + "\nblue=" + bFloatPreMulRgba.blue + "\nalpha=" + bFloatPreMulRgba.alpha);
    bFloatPreMulRgba = FloatPreMulRgba.fromRgba(new FloatRgba(0.199, 0.4, 1.0, 0.2));
    assert.isFalse(aFloatPreMulRgba.equals(bFloatPreMulRgba),
      "equals test 2 failed\naFloatPreMulRgba:\nred=" + aFloatPreMulRgba.red + "\ngreen=" + aFloatPreMulRgba.green + "\nblue=" + aFloatPreMulRgba.blue + "\nalpha=" + aFloatPreMulRgba.alpha
      + "\nbFloatPreMulRgba:\nred=" + bFloatPreMulRgba.red + "\ngreen=" + bFloatPreMulRgba.green + "\nblue=" + bFloatPreMulRgba.blue + "\nalpha=" + bFloatPreMulRgba.alpha);
    bFloatPreMulRgba = FloatPreMulRgba.fromRgba(new FloatRgba(0.2, 0.399, 1.0, 0.2));
    assert.isFalse(aFloatPreMulRgba.equals(bFloatPreMulRgba),
      "equals test 3 failed\naFloatPreMulRgba:\nred=" + aFloatPreMulRgba.red + "\ngreen=" + aFloatPreMulRgba.green + "\nblue=" + aFloatPreMulRgba.blue + "\nalpha=" + aFloatPreMulRgba.alpha
      + "\nbFloatPreMulRgba:\nred=" + bFloatPreMulRgba.red + "\ngreen=" + bFloatPreMulRgba.green + "\nblue=" + bFloatPreMulRgba.blue + "\nalpha=" + bFloatPreMulRgba.alpha);
    bFloatPreMulRgba = FloatPreMulRgba.fromRgba(new FloatRgba(0.2, 0.4, 0.999, 0.2));
    assert.isFalse(aFloatPreMulRgba.equals(bFloatPreMulRgba),
      "equals test 4 failed\naFloatPreMulRgba:\nred=" + aFloatPreMulRgba.red + "\ngreen=" + aFloatPreMulRgba.green + "\nblue=" + aFloatPreMulRgba.blue + "\nalpha=" + aFloatPreMulRgba.alpha
      + "\nbFloatPreMulRgba:\nred=" + bFloatPreMulRgba.red + "\ngreen=" + bFloatPreMulRgba.green + "\nblue=" + bFloatPreMulRgba.blue + "\nalpha=" + bFloatPreMulRgba.alpha);
    bFloatPreMulRgba = FloatPreMulRgba.fromRgba(new FloatRgba(0.2, 0.4, 1.0, 0.5));
    assert.isFalse(aFloatPreMulRgba.equals(bFloatPreMulRgba),
      "equals test 5 failed\naFloatPreMulRgba:\nred=" + aFloatPreMulRgba.red + "\ngreen=" + aFloatPreMulRgba.green + "\nblue=" + aFloatPreMulRgba.blue + "\nalpha=" + aFloatPreMulRgba.alpha
      + "\nbFloatPreMulRgba:\nred=" + bFloatPreMulRgba.red + "\ngreen=" + bFloatPreMulRgba.green + "\nblue=" + bFloatPreMulRgba.blue + "\nalpha=" + bFloatPreMulRgba.alpha);
    bFloatPreMulRgba = FloatPreMulRgba.fromRgba(new FloatRgba(0.2, 0.4, 1.0, 0.2));
    assert.isTrue(aFloatPreMulRgba.equals(bFloatPreMulRgba),
      "equals test 6 failed\naFloatPreMulRgba:\nred=" + aFloatPreMulRgba.red + "\ngreen=" + aFloatPreMulRgba.green + "\nblue=" + aFloatPreMulRgba.blue + "\nalpha=" + aFloatPreMulRgba.alpha
      + "\nbFloatPreMulRgba:\nred=" + bFloatPreMulRgba.red + "\ngreen=" + bFloatPreMulRgba.green + "\nblue=" + bFloatPreMulRgba.blue + "\nalpha=" + bFloatPreMulRgba.alpha);
  });
});
