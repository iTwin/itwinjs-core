/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/*
import { assert } from "chai";
import { ColorDef } from "@bentley/imodeljs-common";
import { FloatRgb, FloatRgba, FloatPreMulRgba } from "@bentley/imodeljs-frontend/lib/rendering";

describe("FloatRgb", () => {
  it("should create and store rgb from ColorDef", () => {
    const aFloatRgb: FloatRgb = new FloatRgb();

    // Test initFromColorDef function
    aFloatRgb.initFromColorDef(ColorDef.from(0, 0, 0));
    assert.isTrue(aFloatRgb.red === 0 && aFloatRgb.green === 0 && aFloatRgb.blue === 0,
      "initFromColorDef test 1 failed\nred=" + aFloatRgb.red + "\ngreen=" + aFloatRgb.green + "\nblue=" + aFloatRgb.blue);
    aFloatRgb.initFromColorDef(ColorDef.from(51, 102, 255));
    assert.isTrue(aFloatRgb.red === 0.2 && aFloatRgb.green === 0.4 && aFloatRgb.blue === 1,
      "initFromColorDef test 2 failed\nred=" + aFloatRgb.red + "\ngreen=" + aFloatRgb.green + "\nblue=" + aFloatRgb.blue);

    // Test fromColorDef function
    let bFloatRgb: FloatRgb = FloatRgb.fromColorDef(ColorDef.from(0, 0, 0));
    assert.isTrue(bFloatRgb.red === 0 && bFloatRgb.green === 0 && bFloatRgb.blue === 0,
      "fromColorDef test 1 failed\nred=" + bFloatRgb.red + "\ngreen=" + bFloatRgb.green + "\nblue=" + bFloatRgb.blue);
    bFloatRgb = FloatRgb.fromColorDef(ColorDef.from(51, 102, 255));
    aFloatRgb.initFromColorDef(ColorDef.from(51, 102, 255));
    assert.isTrue(aFloatRgb.red === bFloatRgb.red && aFloatRgb.green === bFloatRgb.green && aFloatRgb.blue === bFloatRgb.blue,
      "fromColorDef test 2 failed\nred=" + aFloatRgb.red + "\ngreen=" + aFloatRgb.green + "\nblue=" + aFloatRgb.blue);
  });
});

describe("FloatRgba", () => {
  it("should create and store rgba in a variety of ways", () => {
    const aFloatRgba: FloatRgba = new FloatRgba();
    let bFloatRgba: FloatRgba = new FloatRgba();

    // Test hasTranslucency function
    aFloatRgba.alpha = 0.0;
    assert.isFalse(aFloatRgba.hasTranslucency(),
      "hasTranslucency test 1 failed\nred=" + aFloatRgba.red + "\ngreen=" + aFloatRgba.green + "\nblue=" + aFloatRgba.blue + "\nalpha=" + aFloatRgba.alpha);
    aFloatRgba.alpha = 0.5;
    assert.isFalse(aFloatRgba.hasTranslucency(),
      "hasTranslucency test 2 failed\nred=" + aFloatRgba.red + "\ngreen=" + aFloatRgba.green + "\nblue=" + aFloatRgba.blue + "\nalpha=" + aFloatRgba.alpha);
    aFloatRgba.alpha = 1.0;
    assert.isTrue(aFloatRgba.hasTranslucency(),
      "hasTranslucency test 3 failed\nred=" + aFloatRgba.red + "\ngreen=" + aFloatRgba.green + "\nblue=" + aFloatRgba.blue + "\nalpha=" + aFloatRgba.alpha);

    // Test fromPreMulRgba function
    const aPreMulRgba = new FloatPreMulRgba();
    aPreMulRgba.red = 0.5;
    aPreMulRgba.green = 0.2;
    aPreMulRgba.blue = 0.3;
    aPreMulRgba.alpha = 0.5;
    const bPreMulRgba = new FloatPreMulRgba();
    bPreMulRgba.red = 0.0;
    bPreMulRgba.green = 1.0;
    bPreMulRgba.blue = 0.0;
    bPreMulRgba.alpha = 1.0;
    bFloatRgba = FloatRgba.fromPreMulRgba(aPreMulRgba);
    assert.exists(bFloatRgba);
    assert.isTrue(bFloatRgba.red === 1.0 && bFloatRgba.green === 0.4 && bFloatRgba.blue === 0.6 && bFloatRgba.alpha === 0.5,
      "fromPreMulRgba test 1 failed\nred=" + bFloatRgba.red + "\ngreen=" + bFloatRgba.green + "\nblue=" + bFloatRgba.blue + "\nalpha=" + bFloatRgba.alpha);
    bFloatRgba = FloatRgba.fromPreMulRgba(bPreMulRgba);
    assert.isTrue(bFloatRgba.red === 0.0 && bFloatRgba.green === 1.0 && bFloatRgba.blue === 0.0 && bFloatRgba.alpha === 1.0,
      "fromPreMulRgba test 2 failed\nred=" + bFloatRgba.red + "\ngreen=" + bFloatRgba.green + "\nblue=" + bFloatRgba.blue + "\nalpha=" + bFloatRgba.alpha);

    // Test from function
    bFloatRgba = FloatRgba.from(0.5, 0.2, 1.0, 0.7);
    assert.exists(bFloatRgba,
      "from test 1 failed");
    assert.isTrue(bFloatRgba.red === 0.5 && bFloatRgba.green === 0.2 && bFloatRgba.blue === 1.0 && bFloatRgba.alpha === 0.7,
      "from test 2 failed\nred=" + bFloatRgba.red + "\ngreen=" + bFloatRgba.green + "\nblue=" + bFloatRgba.blue + "\nalpha=" + bFloatRgba.alpha);
    bFloatRgba = FloatRgba.from(0.0, 1.0, 0.0, 1.0);
    assert.exists(bFloatRgba,
      "from test 3 failed");
    assert.isTrue(bFloatRgba.red === 0.0 && bFloatRgba.green === 1.0 && bFloatRgba.blue === 0.0 && bFloatRgba.alpha === 1.0,
      "from test 4 failed\nred=" + bFloatRgba.red + "\ngreen=" + bFloatRgba.green + "\nblue=" + bFloatRgba.blue + "\nalpha=" + bFloatRgba.alpha);

    // Test initFromPreMulRgba function
    bFloatRgba = new FloatRgba();
    bFloatRgba.initFromPreMulRgba(aPreMulRgba);
    assert.isTrue(bFloatRgba.red === 1.0 && bFloatRgba.green === 0.4 && bFloatRgba.blue === 0.6 && bFloatRgba.alpha === 0.5,
      "initFromPreMulRgba test 1 failed\nred=" + bFloatRgba.red + "\ngreen=" + bFloatRgba.green + "\nblue=" + bFloatRgba.blue + "\nalpha=" + bFloatRgba.alpha);
    bFloatRgba.initFromPreMulRgba(bPreMulRgba);
    assert.isTrue(bFloatRgba.red === 0.0 && bFloatRgba.green === 1.0 && bFloatRgba.blue === 0.0 && bFloatRgba.alpha === 1.0,
      "initFromPreMulRgba test 2 failed\nred=" + bFloatRgba.red + "\ngreen=" + bFloatRgba.green + "\nblue=" + bFloatRgba.blue + "\nalpha=" + bFloatRgba.alpha);

    // Test fromRgb function
    bFloatRgba = new FloatRgba();
    const aFloatRgb: FloatRgb = FloatRgb.fromColorDef(ColorDef.from(51, 102, 255));
    bFloatRgba = FloatRgba.fromRgb(aFloatRgb);
    assert.isTrue(bFloatRgba.red === 0.2 && bFloatRgba.green === 0.4 && bFloatRgba.blue === 1.0 && bFloatRgba.alpha === 1.0,
      "fromRgb test 1 failed\nred=" + bFloatRgba.red + "\ngreen=" + bFloatRgba.green + "\nblue=" + bFloatRgba.blue + "\nalpha=" + bFloatRgba.alpha);
    const bFloatRgb: FloatRgb = FloatRgb.fromColorDef(ColorDef.from(0, 255, 0));
    bFloatRgba = FloatRgba.fromRgb(bFloatRgb, 0.7);
    assert.isTrue(bFloatRgba.red === 0.0 && bFloatRgba.green === 1.0 && bFloatRgba.blue === 0.0 && bFloatRgba.alpha === 0.7,
      "fromRgb test 2 failed\nred=" + bFloatRgba.red + "\ngreen=" + bFloatRgba.green + "\nblue=" + bFloatRgba.blue + "\nalpha=" + bFloatRgba.alpha);

    // Test initFromColorDef function
    aFloatRgba.initFromColorDef(ColorDef.from(0, 0, 0));
    assert.isTrue(aFloatRgba.red === 0 && aFloatRgba.green === 0 && aFloatRgba.blue === 0,
      "initFromColorDef test 1 failed\nred=" + aFloatRgba.red + "\ngreen=" + aFloatRgba.green + "\nblue=" + aFloatRgba.blue + "\nalpha=" + aFloatRgba.alpha);
    aFloatRgba.initFromColorDef(ColorDef.from(51, 102, 255));
    assert.isTrue(aFloatRgba.red === 0.2 && aFloatRgba.green === 0.4 && aFloatRgba.blue === 1,
      "initFromColorDef test 2 failed\nred=" + aFloatRgba.red + "\ngreen=" + aFloatRgba.green + "\nblue=" + aFloatRgba.blue + "\nalpha=" + aFloatRgba.alpha);

    // Test fromColorDef function
    bFloatRgba = FloatRgba.fromColorDef(ColorDef.from(0, 0, 0));
    assert.isTrue(bFloatRgba.red === 0 && bFloatRgba.green === 0 && bFloatRgba.blue === 0,
      "fromColorDef test 1 failed\nred=" + bFloatRgba.red + "\ngreen=" + bFloatRgba.green + "\nblue=" + bFloatRgba.blue + "\nalpha=" + bFloatRgba.alpha);
    bFloatRgba = FloatRgba.fromColorDef(ColorDef.from(51, 102, 255));
    aFloatRgba.initFromColorDef(ColorDef.from(51, 102, 255));
    assert.isTrue(aFloatRgba.red === bFloatRgba.red && aFloatRgba.green === bFloatRgba.green && aFloatRgba.blue === bFloatRgba.blue,
      "fromColorDef test 2 failed\nred=" + aFloatRgba.red + "\ngreen=" + aFloatRgba.green + "\nblue=" + aFloatRgba.blue + "\nalpha=" + aFloatRgba.alpha);

    // Test equals function
    aFloatRgba.initFromColorDef(ColorDef.from(51, 102, 255));
    aFloatRgba.alpha = 0.2;
    bFloatRgba.initFromColorDef(ColorDef.from(51, 102, 255));
    bFloatRgba.alpha = 0.2;
    assert.isTrue(aFloatRgba.equals(bFloatRgba),
      "equals test 1 failed\naFloatRgba:\nred=" + aFloatRgba.red + "\ngreen=" + aFloatRgba.green + "\nblue=" + aFloatRgba.blue
      + "\nbFloatRgba:\nred=" + bFloatRgba.red + "\ngreen=" + bFloatRgba.green + "\nblue=" + bFloatRgba.blue + "\nalpha=" + bFloatRgba.alpha);
    bFloatRgba.initFromColorDef(ColorDef.from(50, 102, 255));
    assert.isFalse(aFloatRgba.equals(bFloatRgba),
      "equals test 2 failed\naFloatRgba:\nred=" + aFloatRgba.red + "\ngreen=" + aFloatRgba.green + "\nblue=" + aFloatRgba.blue
      + "\nbFloatRgba:\nred=" + bFloatRgba.red + "\ngreen=" + bFloatRgba.green + "\nblue=" + bFloatRgba.blue + "\nalpha=" + bFloatRgba.alpha);
    bFloatRgba.initFromColorDef(ColorDef.from(51, 103, 255));
    assert.isFalse(aFloatRgba.equals(bFloatRgba),
      "equals test 3 failed\naFloatRgba:\nred=" + aFloatRgba.red + "\ngreen=" + aFloatRgba.green + "\nblue=" + aFloatRgba.blue
      + "\nbFloatRgba:\nred=" + bFloatRgba.red + "\ngreen=" + bFloatRgba.green + "\nblue=" + bFloatRgba.blue + "\nalpha=" + bFloatRgba.alpha);
    bFloatRgba.initFromColorDef(ColorDef.from(51, 102, 254));
    assert.isFalse(aFloatRgba.equals(bFloatRgba),
      "equals test 4 failed\naFloatRgba:\nred=" + aFloatRgba.red + "\ngreen=" + aFloatRgba.green + "\nblue=" + aFloatRgba.blue
      + "\nbFloatRgba:\nred=" + bFloatRgba.red + "\ngreen=" + bFloatRgba.green + "\nblue=" + bFloatRgba.blue + "\nalpha=" + bFloatRgba.alpha);
    bFloatRgba.initFromColorDef(ColorDef.from(51, 102, 255));
    bFloatRgba.alpha = 0.5;
    assert.isFalse(aFloatRgba.equals(bFloatRgba),
      "equals test 5 failed\naFloatRgba:\nred=" + aFloatRgba.red + "\ngreen=" + aFloatRgba.green + "\nblue=" + aFloatRgba.blue
      + "\nbFloatRgba:\nred=" + bFloatRgba.red + "\ngreen=" + bFloatRgba.green + "\nblue=" + bFloatRgba.blue + "\nalpha=" + bFloatRgba.alpha);
    bFloatRgba.alpha = 0.2;
    assert.isTrue(aFloatRgba.equals(bFloatRgba),
      "equals test 6 failed\naFloatRgba:\nred=" + aFloatRgba.red + "\ngreen=" + aFloatRgba.green + "\nblue=" + aFloatRgba.blue
      + "\nbFloatRgba:\nred=" + bFloatRgba.red + "\ngreen=" + bFloatRgba.green + "\nblue=" + bFloatRgba.blue + "\nalpha=" + bFloatRgba.alpha);
  });
});

describe("FloatPreMulRgba", () => {
  it("should create and store a FloatPreMulRgba in a variety of ways", () => {
    const aFloatPreMulRgba: FloatPreMulRgba = new FloatPreMulRgba();
    let bFloatPreMulRgba: FloatPreMulRgba = new FloatPreMulRgba();

    // Test hasTranslucency function
    aFloatPreMulRgba.alpha = 0.0;
    assert.isFalse(aFloatPreMulRgba.hasTranslucency(),
      "hasTranslucency test 1 failed\nalpha=" + aFloatPreMulRgba.alpha);
    aFloatPreMulRgba.alpha = 0.5;
    assert.isFalse(aFloatPreMulRgba.hasTranslucency(),
      "hasTranslucency test 2 failed\nalpha=" + aFloatPreMulRgba.alpha);
    aFloatPreMulRgba.alpha = 1.0;
    assert.isTrue(aFloatPreMulRgba.hasTranslucency(),
      "hasTranslucency test 3 failed\nalpha=" + aFloatPreMulRgba.alpha);

    // Test fromRgba function
    bFloatPreMulRgba = new FloatPreMulRgba();
    const aFloatRgba: FloatRgba = FloatRgba.from(0.2, 0.4, 1.0, 1.0);
    bFloatPreMulRgba = FloatPreMulRgba.fromRgba(aFloatRgba);
    assert.isTrue(bFloatPreMulRgba.red === 0.2 && bFloatPreMulRgba.green === 0.4 && bFloatPreMulRgba.blue === 1.0 && bFloatPreMulRgba.alpha === 1.0,
      "fromRgba test 1 failed\nred=" + bFloatPreMulRgba.red + "\ngreen=" + bFloatPreMulRgba.green + "\nblue=" + bFloatPreMulRgba.blue + "\nalpha=" + bFloatPreMulRgba.alpha);
    const bFloatRgba: FloatRgba = FloatRgba.from(0.0, 1.0, 0.0, 0.7);
    bFloatPreMulRgba = FloatPreMulRgba.fromRgba(bFloatRgba);
    assert.isTrue(bFloatPreMulRgba.red === 0.0 && bFloatPreMulRgba.green === 0.7 && bFloatPreMulRgba.blue === 0.0 && bFloatPreMulRgba.alpha === 0.7,
      "fromRgba test 2 failed\nred=" + bFloatPreMulRgba.red + "\ngreen=" + bFloatPreMulRgba.green + "\nblue=" + bFloatPreMulRgba.blue + "\nalpha=" + bFloatPreMulRgba.alpha);

    // Test initFromRgba function
    bFloatPreMulRgba.initFromRgba(aFloatRgba);
    assert.isTrue(bFloatPreMulRgba.red === 0.2 && bFloatPreMulRgba.green === 0.4 && bFloatPreMulRgba.blue === 1.0 && bFloatPreMulRgba.alpha === 1.0,
      "initFromRgba test 1 failed\nred=" + bFloatPreMulRgba.red + "\ngreen=" + bFloatPreMulRgba.green + "\nblue=" + bFloatPreMulRgba.blue + "\nalpha=" + bFloatPreMulRgba.alpha);
    bFloatPreMulRgba.initFromRgba(bFloatRgba);
    assert.isTrue(bFloatPreMulRgba.red === 0.0 && bFloatPreMulRgba.green === 0.7 && bFloatPreMulRgba.blue === 0.0 && bFloatPreMulRgba.alpha === 0.7,
      "initFromRgba test 2 failed\nred=" + bFloatPreMulRgba.red + "\ngreen=" + bFloatPreMulRgba.green + "\nblue=" + bFloatPreMulRgba.blue + "\nalpha=" + bFloatPreMulRgba.alpha);

    // Test fromColorDef function
    bFloatPreMulRgba = FloatPreMulRgba.fromColorDef(ColorDef.from(0, 0, 0, 255));
    assert.isTrue(bFloatPreMulRgba.red === 0 && bFloatPreMulRgba.green === 0 && bFloatPreMulRgba.blue === 0 && bFloatPreMulRgba.alpha === 1.0,
      "fromColorDef test 1 failed\nred=" + bFloatPreMulRgba.red + "\ngreen=" + bFloatPreMulRgba.green + "\nblue=" + bFloatPreMulRgba.blue + "\nalpha=" + bFloatPreMulRgba.alpha);
    bFloatPreMulRgba = FloatPreMulRgba.fromColorDef(ColorDef.from(51, 102, 255, 102));
    assert.isTrue(bFloatPreMulRgba.red === 0.2 && bFloatPreMulRgba.green === 0.4 && bFloatPreMulRgba.blue === 1.0 && bFloatPreMulRgba.alpha === 0.4,
      "fromColorDef test 2 failed\nred=" + bFloatPreMulRgba.red + "\ngreen=" + bFloatPreMulRgba.green + "\nblue=" + bFloatPreMulRgba.blue + "\nalpha=" + bFloatPreMulRgba.alpha);

    // Test initFromColorDef function
    bFloatPreMulRgba.initFromColorDef(ColorDef.from(0, 0, 0, 255));
    assert.isTrue(bFloatPreMulRgba.red === 0 && bFloatPreMulRgba.green === 0 && bFloatPreMulRgba.blue === 0 && bFloatPreMulRgba.alpha === 1.0,
      "initFromColorDef test 1 failed\nred=" + bFloatPreMulRgba.red + "\ngreen=" + bFloatPreMulRgba.green + "\nblue=" + bFloatPreMulRgba.blue + "\nalpha=" + bFloatPreMulRgba.alpha);
    bFloatPreMulRgba.initFromColorDef(ColorDef.from(51, 102, 255, 102));
    assert.isTrue(bFloatPreMulRgba.red === 0.2 && bFloatPreMulRgba.green === 0.4 && bFloatPreMulRgba.blue === 1.0 && bFloatPreMulRgba.alpha === 0.4,
      "initFromColorDef test 2 failed\nred=" + bFloatPreMulRgba.red + "\ngreen=" + bFloatPreMulRgba.green + "\nblue=" + bFloatPreMulRgba.blue + "\nalpha=" + bFloatPreMulRgba.alpha);

    // Test equals function
    aFloatPreMulRgba.initFromColorDef(ColorDef.from(51, 102, 255));
    aFloatPreMulRgba.alpha = 0.2;
    bFloatPreMulRgba.initFromColorDef(ColorDef.from(51, 102, 255));
    bFloatPreMulRgba.alpha = 0.2;
    assert.isTrue(aFloatPreMulRgba.equals(bFloatPreMulRgba),
      "equals test 1 failed\naFloatPreMulRgba:\nred=" + aFloatPreMulRgba.red + "\ngreen=" + aFloatPreMulRgba.green + "\nblue=" + aFloatPreMulRgba.blue + "\nalpha=" + aFloatPreMulRgba.alpha
      + "\nbFloatPreMulRgba:\nred=" + bFloatPreMulRgba.red + "\ngreen=" + bFloatPreMulRgba.green + "\nblue=" + bFloatPreMulRgba.blue + "\nalpha=" + bFloatPreMulRgba.alpha);
    bFloatPreMulRgba.initFromColorDef(ColorDef.from(50, 102, 255));
    assert.isFalse(aFloatPreMulRgba.equals(bFloatPreMulRgba),
      "equals test 2 failed\naFloatPreMulRgba:\nred=" + aFloatPreMulRgba.red + "\ngreen=" + aFloatPreMulRgba.green + "\nblue=" + aFloatPreMulRgba.blue + "\nalpha=" + aFloatPreMulRgba.alpha
      + "\nbFloatPreMulRgba:\nred=" + bFloatPreMulRgba.red + "\ngreen=" + bFloatPreMulRgba.green + "\nblue=" + bFloatPreMulRgba.blue + "\nalpha=" + bFloatPreMulRgba.alpha);
    bFloatPreMulRgba.initFromColorDef(ColorDef.from(51, 103, 255));
    assert.isFalse(aFloatPreMulRgba.equals(bFloatPreMulRgba),
      "equals test 3 failed\naFloatPreMulRgba:\nred=" + aFloatPreMulRgba.red + "\ngreen=" + aFloatPreMulRgba.green + "\nblue=" + aFloatPreMulRgba.blue + "\nalpha=" + aFloatPreMulRgba.alpha
      + "\nbFloatPreMulRgba:\nred=" + bFloatPreMulRgba.red + "\ngreen=" + bFloatPreMulRgba.green + "\nblue=" + bFloatPreMulRgba.blue + "\nalpha=" + bFloatPreMulRgba.alpha);
    bFloatPreMulRgba.initFromColorDef(ColorDef.from(51, 102, 254));
    assert.isFalse(aFloatPreMulRgba.equals(bFloatPreMulRgba),
      "equals test 4 failed\naFloatPreMulRgba:\nred=" + aFloatPreMulRgba.red + "\ngreen=" + aFloatPreMulRgba.green + "\nblue=" + aFloatPreMulRgba.blue + "\nalpha=" + aFloatPreMulRgba.alpha
      + "\nbFloatPreMulRgba:\nred=" + bFloatPreMulRgba.red + "\ngreen=" + bFloatPreMulRgba.green + "\nblue=" + bFloatPreMulRgba.blue + "\nalpha=" + bFloatPreMulRgba.alpha);
    bFloatPreMulRgba.initFromColorDef(ColorDef.from(51, 102, 255));
    bFloatPreMulRgba.alpha = 0.5;
    assert.isFalse(aFloatPreMulRgba.equals(bFloatPreMulRgba),
      "equals test 5 failed\naFloatPreMulRgba:\nred=" + aFloatPreMulRgba.red + "\ngreen=" + aFloatPreMulRgba.green + "\nblue=" + aFloatPreMulRgba.blue + "\nalpha=" + aFloatPreMulRgba.alpha
      + "\nbFloatPreMulRgba:\nred=" + bFloatPreMulRgba.red + "\ngreen=" + bFloatPreMulRgba.green + "\nblue=" + bFloatPreMulRgba.blue + "\nalpha=" + bFloatPreMulRgba.alpha);
    bFloatPreMulRgba.alpha = 0.2;
    assert.isTrue(aFloatPreMulRgba.equals(bFloatPreMulRgba),
      "equals test 6 failed\naFloatPreMulRgba:\nred=" + aFloatPreMulRgba.red + "\ngreen=" + aFloatPreMulRgba.green + "\nblue=" + aFloatPreMulRgba.blue + "\nalpha=" + aFloatPreMulRgba.alpha
      + "\nbFloatPreMulRgba:\nred=" + bFloatPreMulRgba.red + "\ngreen=" + bFloatPreMulRgba.green + "\nblue=" + bFloatPreMulRgba.blue + "\nalpha=" + bFloatPreMulRgba.alpha);
  });
});
*/
