/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { ViewFlags, RenderMode, ColorDef, Light, LightProps, Spot, LightType, SpotProps, Gradient } from "@bentley/imodeljs-common";
import { Angle } from "../../../geometry/lib/Geometry";

describe("Render", () => {

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
    const opts: LightProps = {
      lightType: LightType.Ambient,
      intensity: 10,
      color: ColorDef.white,
      kelvin: 100,
      shadows: 1,
      bulbs: 3,
      lumens: 2700,
    };

    const l1 = new Light(opts);
    assert.equal(l1.lightType, LightType.Ambient);
    assert.equal(l1.intensity, 10);
    assert.isTrue(l1.color.equals(ColorDef.white));
    assert.equal(l1.kelvin, 100);
    assert.equal(l1.shadows, 1);
    assert.equal(l1.bulbs, 3);
    assert.equal(l1.lumens, 2700);

    const spotOpts: SpotProps = {
      intensity: 10,
      intensity2: 40,
      color: ColorDef.white,
      color2: 333,
      kelvin: 100,
      shadows: 1,
      bulbs: 3,
      lumens: 2700,
      inner: { radians: 1.5 },
      outer: 45.0,
    };

    const s1 = new Spot(spotOpts);
    assert.equal(s1.lightType, LightType.Spot, "type");
    assert.equal(s1.intensity, 10);
    assert.equal(s1.kelvin, 100);
    assert.equal(s1.shadows, 1);
    assert.equal(s1.bulbs, 3);
    assert.equal(s1.lumens, 2700);
    assert.approximately(s1.inner.radians, 1.5, .001);
    assert.approximately(s1.outer.degrees, 45.0, .001);
    assert.isTrue(s1.color.equals(ColorDef.white));
    assert.equal(s1.color2!.tbgr, 333);

    let json = JSON.stringify(l1);
    const l2 = new Light(JSON.parse(json));
    assert.deepEqual(l1, l2);
    json = JSON.stringify(s1);
    const s2 = new Spot(JSON.parse(json));
    assert.equal(json, JSON.stringify(s2));
  });

  it("Gradient.Symb", () => {
    let symb = Gradient.Symb.fromJSON({
      mode: Gradient.Mode.Linear,
      flags: Gradient.Flags.Outline,
      angle: Angle.createDegrees(45.5),
      tint: 0.6,
      shift: 1,
      keys: [{ value: .65, color: new ColorDef(100) }, { value: .12, color: new ColorDef(100) }],
    });

    const symbCopy = symb.clone();
    assert.isTrue(symb.isEqualTo(symbCopy));

    // Assert that ordering of symbology is correct using implemented compare method
    const symbArr: Gradient.Symb[] = [];
    const numCreated = 10;
    for (let i = 0; i < numCreated; i++) {
      symb = Gradient.Symb.fromJSON({
        mode: (i < 1) ? Math.floor(Math.random() * 1234) % 7 : Gradient.Mode.Linear,
        flags: (i < 2) ? Math.floor(Math.random() * 1234) % 3 : Gradient.Flags.None,
        tint: (i < 3) ? Math.random() : 5,
        shift: (i < 4) ? Math.random() * 10 : 6,
        angle: (i < 5) ? Angle.createDegrees(Math.random() * 100) : Angle.create360(),
        keys: [{ value: (i < 6) ? Math.random() : 5, color: new ColorDef(Math.random() * 1000) }, { value: Math.random(), color: new ColorDef(Math.random() * 1000) }],
      });
      symbArr.push(symb);
    }
    symbArr[numCreated - 1].keys.pop(); // Get a symbology with a fewer # of keys
    symbArr.sort(Gradient.Symb.compareSymb);

    for (let i = 1; i < numCreated; i++) {
      const prev = symbArr[i - 1];
      const current = symbArr[i];
      if (current.mode !== prev.mode) {
        assert.isTrue(current.mode > prev.mode);
        continue;
      }
      if (current.flags !== prev.flags) {
        assert.isTrue(current.flags > prev.flags);
        continue;
      }
      if (current.tint !== prev.tint) {
        assert.isTrue(current.tint! > prev.tint!);
        continue;
      }
      if (current.shift !== prev.shift) {
        assert.isTrue(current.shift! > prev.shift!);
        continue;
      }
      if (current.angle!.degrees !== prev.angle!.degrees) {
        assert.isTrue(current.angle!.degrees > prev.angle!.degrees);
        continue;
      }
      if (current.keys.length !== prev.keys.length) {
        assert.isTrue(current.keys.length > prev.keys.length);
        continue;
      }
      if (current.keys[0].value !== prev.keys[0].value) {
        assert.isTrue(current.keys[0].value > prev.keys[0].value);
        continue;
      }
      if (current.keys[0].color.tbgr !== prev.keys[0].color.tbgr) {
        assert.isTrue(current.keys[0].color.tbgr > prev.keys[0].color.tbgr);
        continue;
      }
      assert.isTrue(current.isEqualTo(prev));
    }
  });
});
