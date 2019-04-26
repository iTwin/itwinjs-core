/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { ViewFlags, RenderMode, ColorDef, Light, LightProps, Spot, LightType, SpotProps, Gradient } from "@bentley/imodeljs-common";
import { Angle } from "@bentley/geometry-core";

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
    assert.isTrue(symb.equals(symbCopy));

    // Assert that ordering of symbology is correct using implemented compare method
    const symbArr: Gradient.Symb[] = [];
    symb = Gradient.Symb.fromJSON({
      mode: 3,
      flags: 1,
      tint: 0.042133128966509004,
      shift: 3.45912515864202,
      angle: Angle.createDegrees(92.94598821201656),
      keys: [{ value: 0.6804815398789292, color: new ColorDef(610) }, { value: 0.731472008309797, color: new ColorDef(230) }],
    });
    symbArr.push(symb);
    symb = Gradient.Symb.fromJSON({
      mode: 3,
      flags: 1,
      tint: 0.042133128966509004,
      shift: 3.45912515864202,
      angle: Angle.createDegrees(92.94598821201656),
      keys: [{ value: 0.6804815398789292, color: new ColorDef(610) }, { value: 0.731472008309797, color: new ColorDef(230) }],
    });
    symbArr.push(symb);
    symb = Gradient.Symb.fromJSON({
      mode: 3,
      flags: 1,
      tint: 0.042133128966509004,
      shift: 3.45912515864202,
      angle: Angle.createDegrees(92.94598821201656),
      keys: [{ value: 0.6804815398789292, color: new ColorDef(610) }],
    });
    symbArr.push(symb);
    symb = Gradient.Symb.fromJSON({
      mode: 3,
      flags: 0,
      tint: 0.042133128966509004,
      shift: 3.45912515864202,
      angle: Angle.createDegrees(92.94598821201656),
      keys: [{ value: 0.6804815398789292, color: new ColorDef(610) }, { value: 0.731472008309797, color: new ColorDef(230) }],
    });
    symbArr.push(symb);
    symb = Gradient.Symb.fromJSON({
      mode: 3,
      flags: 2,
      tint: 0.042133128966509004,
      shift: 3.45912515864202,
      angle: Angle.createDegrees(92.94598821201656),
      keys: [{ value: 0.6804815398789292, color: new ColorDef(610) }, { value: 0.731472008309797, color: new ColorDef(230) }],
    });
    symbArr.push(symb);
    symb = Gradient.Symb.fromJSON({
      mode: 3,
      flags: 1,
      tint: 0.02,
      shift: 3.45912515864202,
      angle: Angle.createDegrees(92.94598821201656),
      keys: [{ value: 0.6804815398789292, color: new ColorDef(610) }, { value: 0.731472008309797, color: new ColorDef(230) }],
    });
    symbArr.push(symb);
    symb = Gradient.Symb.fromJSON({
      mode: 3,
      flags: 1,
      tint: 0.6,
      shift: 3.45912515864202,
      angle: Angle.createDegrees(92.94598821201656),
      keys: [{ value: 0.6804815398789292, color: new ColorDef(610) }, { value: 0.731472008309797, color: new ColorDef(230) }],
    });
    symbArr.push(symb);
    symb = Gradient.Symb.fromJSON({
      mode: 3,
      flags: 1,
      tint: 0.042133128966509004,
      shift: 2,
      angle: Angle.createDegrees(92.94598821201656),
      keys: [{ value: 0.6804815398789292, color: new ColorDef(610) }, { value: 0.731472008309797, color: new ColorDef(230) }],
    });
    symbArr.push(symb);
    symb = Gradient.Symb.fromJSON({
      mode: 3,
      flags: 1,
      tint: 0.042133128966509004,
      shift: 5.576,
      angle: Angle.createDegrees(92.94598821201656),
      keys: [{ value: 0.6804815398789292, color: new ColorDef(610) }, { value: 0.731472008309797, color: new ColorDef(230) }],
    });
    symbArr.push(symb);
    symb = Gradient.Symb.fromJSON({
      mode: 3,
      flags: 1,
      tint: 0.042133128966509004,
      shift: 3.45912515864202,
      angle: Angle.createDegrees(20.6),
      keys: [{ value: 0.6804815398789292, color: new ColorDef(610) }, { value: 0.731472008309797, color: new ColorDef(230) }],
    });
    symbArr.push(symb);
    symb = Gradient.Symb.fromJSON({
      mode: 3,
      flags: 1,
      tint: 0.042133128966509004,
      shift: 3.45912515864202,
      angle: Angle.createDegrees(122),
      keys: [{ value: 0.6804815398789292, color: new ColorDef(610) }, { value: 0.731472008309797, color: new ColorDef(230) }],
    });
    symbArr.push(symb);
    symb = Gradient.Symb.fromJSON({
      mode: 3,
      flags: 1,
      tint: 0.042133128966509004,
      shift: 3.45912515864202,
      angle: Angle.createDegrees(92.94598821201656),
      keys: [{ value: 0.333, color: new ColorDef(610) }, { value: 0.731472008309797, color: new ColorDef(230) }],
    });
    symbArr.push(symb);
    symb = Gradient.Symb.fromJSON({
      mode: 3,
      flags: 1,
      tint: 0.042133128966509004,
      shift: 3.45912515864202,
      angle: Angle.createDegrees(92.94598821201656),
      keys: [{ value: 0.78, color: new ColorDef(610) }, { value: 0.731472008309797, color: new ColorDef(230) }],
    });
    symbArr.push(symb);
    symb = Gradient.Symb.fromJSON({
      mode: 3,
      flags: 1,
      tint: 0.042133128966509004,
      shift: 3.45912515864202,
      angle: Angle.createDegrees(92.94598821201656),
      keys: [{ value: 0.6804815398789292, color: new ColorDef(425) }, { value: 0.731472008309797, color: new ColorDef(230) }],
    });
    symbArr.push(symb);
    symb = Gradient.Symb.fromJSON({
      mode: 3,
      flags: 1,
      tint: 0.042133128966509004,
      shift: 3.45912515864202,
      angle: Angle.createDegrees(92.94598821201656),
      keys: [{ value: 0.6804815398789292, color: new ColorDef(611) }, { value: 0.731472008309797, color: new ColorDef(230) }],
    });
    symbArr.push(symb);
    symb = Gradient.Symb.fromJSON({
      mode: 3,
      flags: 1,
      tint: 0.042133128966509004,
      shift: 3.45912515864202,
      angle: Angle.createDegrees(92.94598821201656),
      keys: [{ value: 0.6804815398789292, color: new ColorDef(610) }, { value: 0.6767, color: new ColorDef(230) }],
    });
    symbArr.push(symb);
    symb = Gradient.Symb.fromJSON({
      mode: 3,
      flags: 1,
      tint: 0.042133128966509004,
      shift: 3.45912515864202,
      angle: Angle.createDegrees(92.94598821201656),
      keys: [{ value: 0.6804815398789292, color: new ColorDef(610) }, { value: 0.8787, color: new ColorDef(230) }],
    });
    symbArr.push(symb);
    symb = Gradient.Symb.fromJSON({
      mode: 3,
      flags: 1,
      tint: 0.042133128966509004,
      shift: 3.45912515864202,
      angle: Angle.createDegrees(92.94598821201656),
      keys: [{ value: 0.6804815398789292, color: new ColorDef(610) }, { value: 0.731472008309797, color: new ColorDef(231) }],
    });
    symbArr.push(symb);
    symb = Gradient.Symb.fromJSON({
      mode: 3,
      flags: 1,
      tint: 0.042133128966509004,
      shift: 3.45912515864202,
      angle: Angle.createDegrees(92.94598821201656),
      keys: [{ value: 0.6804815398789292, color: new ColorDef(610) }, { value: 0.731472008309797, color: new ColorDef(229) }],
    });
    symbArr.push(symb);

    symbArr.sort(Gradient.Symb.compareSymb);

    for (let i = 1; i < symbArr.length; i++) {
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
      if (current.keys[1].value !== prev.keys[1].value) {
        assert.isTrue(current.keys[1].value > prev.keys[1].value);
        continue;
      }
      if (current.keys[1].color.tbgr !== prev.keys[1].color.tbgr) {
        assert.isTrue(current.keys[1].color.tbgr > prev.keys[1].color.tbgr);
        continue;
      }
      assert.isTrue(current.equals(prev));
    }
  });
});
