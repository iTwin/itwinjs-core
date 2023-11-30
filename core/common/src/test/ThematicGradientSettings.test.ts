/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ColorDef } from "../ColorDef";
import { TextureTransparency } from "../TextureProps";
import {
  ThematicGradientColorScheme, ThematicGradientMode, ThematicGradientSettings, ThematicGradientSettingsProps, ThematicGradientTransparencyMode,
} from "../ThematicDisplay";

describe("ThematicGradientSettings", () => {
  it("compares", () => {
    const propsA: ThematicGradientSettingsProps = {
      mode: ThematicGradientMode.Stepped,
      stepCount: 5,
      marginColor: ColorDef.blue.toJSON(),
      colorScheme: ThematicGradientColorScheme.Topographic,
      customKeys: [
        {value: 0.0, color: ColorDef.green.toJSON()},
        {value: 0.5, color: ColorDef.red.toJSON()},
        {value: 1.0, color: ColorDef.white.toJSON()},
      ],
      colorMix: 0.5,
      transparencyMode: ThematicGradientTransparencyMode.MultiplySurfaceAndGradient,
    };
    const settingsA = ThematicGradientSettings.fromJSON(propsA);

    // Make sure A equals B when B is fully copied from A.
    let propsB = settingsA.toJSON();
    expect(ThematicGradientSettings.compare(settingsA, ThematicGradientSettings.fromJSON(propsB))).to.equal(0);

    // Make sure A > B when B lowers the stepCount.
    propsB = settingsA.toJSON();
    propsB.stepCount = 4;
    expect(ThematicGradientSettings.compare(settingsA, ThematicGradientSettings.fromJSON(propsB))).to.greaterThan(0);

    // Make sure A < B when B raises the stepCount.
    propsB = settingsA.toJSON();
    propsB.stepCount = 6;
    expect(ThematicGradientSettings.compare(settingsA, ThematicGradientSettings.fromJSON(propsB))).to.lessThan(0);

    // Make sure A > B when B lowers the mode.
    propsB = settingsA.toJSON();
    propsB.mode = ThematicGradientMode.Smooth;
    expect(ThematicGradientSettings.compare(settingsA, ThematicGradientSettings.fromJSON(propsB))).to.greaterThan(0);

    // // Make sure A < B when B raises the mode.
    propsB = settingsA.toJSON();
    propsB.mode = ThematicGradientMode.SteppedWithDelimiter;
    expect(ThematicGradientSettings.compare(settingsA, ThematicGradientSettings.fromJSON(propsB))).to.lessThan(0);

    // // Make sure A > B when B lowers the colorScheme.
    propsB = settingsA.toJSON();
    propsB.colorScheme = ThematicGradientColorScheme.Monochrome;
    expect(ThematicGradientSettings.compare(settingsA, ThematicGradientSettings.fromJSON(propsB))).to.greaterThan(0);

    // // Make sure A < B when B raises the colorScheme.
    propsB = settingsA.toJSON();
    propsB.colorScheme = ThematicGradientColorScheme.SeaMountain;
    expect(ThematicGradientSettings.compare(settingsA, ThematicGradientSettings.fromJSON(propsB))).to.lessThan(0);

    // // Make sure A > B when B lowers the colorMix.
    propsB = settingsA.toJSON();
    propsB.colorMix = 0.4;
    expect(ThematicGradientSettings.compare(settingsA, ThematicGradientSettings.fromJSON(propsB))).to.greaterThan(0);

    // Make sure A < B when B raises the colorMix.
    propsB = settingsA.toJSON();
    propsB.colorMix = 0.6;
    expect(ThematicGradientSettings.compare(settingsA, ThematicGradientSettings.fromJSON(propsB))).to.lessThan(0);

    propsB = settingsA.toJSON();
    propsB.transparencyMode = ThematicGradientTransparencyMode.SurfaceOnly;
    expect(ThematicGradientSettings.compare(settingsA, ThematicGradientSettings.fromJSON(propsB))).to.greaterThan(0);

    // Make sure A !== B when B changes the marginColor.
    propsB = settingsA.toJSON();
    propsB.marginColor = ColorDef.red.toJSON();
    expect(ThematicGradientSettings.compare(settingsA, ThematicGradientSettings.fromJSON(propsB))).to.not.equal(0);

    // Make sure A !== B when B changes the customKeys.
    propsB = settingsA.toJSON();
    propsB.customKeys = [
      {value: 0.0, color: ColorDef.black.toJSON()},
      {value: 0.5, color: ColorDef.white.toJSON()},
      {value: 1.0, color: ColorDef.green.toJSON()},
    ],
    expect(ThematicGradientSettings.compare(settingsA, ThematicGradientSettings.fromJSON(propsB))).to.not.equal(0);
  });

  it("computes texture transparency", () => {
    const op = ColorDef.red;
    const tr = ColorDef.blue.withTransparency(127);

    function expectTransparency(expected: "opaque" | "transparent" | "mixed", margin: ColorDef, custom?: ColorDef[]): void {
      const props: ThematicGradientSettingsProps = {
        colorScheme: undefined !== custom ? ThematicGradientColorScheme.Custom : ThematicGradientColorScheme.BlueRed,
        marginColor: margin.toJSON(),
        customKeys: custom ? custom.map((x) => { return { value: 0.5, color: x.toJSON() }; }) : undefined,
      };

      const remap = { opaque: TextureTransparency.Opaque, transparent: TextureTransparency.Translucent, mixed: TextureTransparency.Mixed };
      const settings = ThematicGradientSettings.fromJSON(props);
      expect(settings.textureTransparency).to.equal(remap[expected]);
    }

    expectTransparency("opaque", op);
    expectTransparency("mixed", tr);

    expectTransparency("opaque", op, [op, op]);
    expectTransparency("transparent", tr, [tr, tr]);
    expectTransparency("mixed", op, [tr, tr]);
    expectTransparency("mixed", tr, [op, op]);
    expectTransparency("mixed", op, [tr, op]);
    expectTransparency("mixed", tr, [tr, op]);
  });
});
