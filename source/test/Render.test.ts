/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { ViewFlags, RenderMode, ColorDef } from "../Render";
import { Light, ILight, Spot, LightType } from "../Lighting";
import { BisCore } from "../BisCore";

// First, register any domains that will be used in the tests.
BisCore.registerSchema();

describe("Render", () => {
  it("ColorDef should compare properly", () => {
    const color1 = ColorDef.from(1, 2, 3, 0);
    const color2 = ColorDef.from(1, 2, 3, 0);
    const color3 = ColorDef.from(0xa, 2, 3, 0);
    const blue = ColorDef.blue();

    assert.isTrue(color1.equals(color2), "color1 should equal color2");
    assert.isNotTrue(color1.equals(blue), "color1 should not equal blue");

    const blueVal = blue.rgba;
    assert.equal(blueVal, 0xff0000);
    assert.isTrue(blue.equals(new ColorDef(blueVal)));

    const colors = color3.getColors();
    ColorDef.from(colors.r, colors.g, colors.b, 0x30, color3);
    assert.isTrue(color3.equals(ColorDef.from(0xa, 2, 3, 0x30)));
  });

  it("ViewFlags", () => {
    const flags = new ViewFlags();
    assert(flags.acsTriad === false);
    assert(flags.grid === false);
    assert(flags.fill === true);
    assert(flags.renderMode === RenderMode.Wireframe);

    flags.renderMode = RenderMode.SmoothShade;
    flags.monochrome = true;
    const jsonstr = JSON.stringify(flags);
    const flags2 = ViewFlags.fromJSON(JSON.parse(jsonstr));
    assert(flags.acsTriad === flags2.acsTriad);
    assert(flags.renderMode === flags2.renderMode);
    assert(flags.monochrome === flags2.monochrome);
  });

  it("Lights", () => {
    const opts: ILight = {
      lightType: LightType.Ambient,
      intensity: 10,
      color: ColorDef.white(),
      kelvin: 100,
      shadows: 1,
      bulbs: 3,
      lumens: 2700,
    };

    const l1 = new Light(opts);
    assert.equal(l1.lightType, LightType.Ambient);
    assert.equal(l1.intensity, 10);
    assert.isTrue(l1.color.equals(ColorDef.white()));
    assert.equal(l1.kelvin, 100);
    assert.equal(l1.shadows, 1);
    assert.equal(l1.bulbs, 3);
    assert.equal(l1.lumens, 2700);

    const spotOpts = {
      intensity: 10,
      intensity2: 40,
      color: ColorDef.white(),
      color2: 333,
      kelvin: 100,
      shadows: 1,
      bulbs: 3,
      lumens: 2700,
      inner: { radians: 1.5 },
      outer: 45.0,
    };

    const s1 = new Spot(spotOpts as any);
    assert.equal(s1.lightType, LightType.Spot, "type");
    assert.equal(s1.intensity, 10);
    assert.equal(s1.kelvin, 100);
    assert.equal(s1.shadows, 1);
    assert.equal(s1.bulbs, 3);
    assert.equal(s1.lumens, 2700);
    assert.approximately(s1.inner.radians, 1.5, .001);
    assert.approximately(s1.outer.degrees, 45.0, .001);
    assert.isTrue(s1.color.equals(ColorDef.white()));
    assert.equal(s1.color2!.rgba, 333);

    let json = JSON.stringify(l1);
    const l2 = new Light(JSON.parse(json));
    assert.deepEqual(l1, l2);
    json = JSON.stringify(s1);
    const s2 = new Spot(JSON.parse(json));
    assert.deepEqual(s1, s2);
  });

});
