/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ColorDef } from "../ColorDef";
import type { ThematicGradientSettingsProps } from "../ThematicDisplay";
import { ThematicGradientColorScheme, ThematicGradientMode, ThematicGradientSettings } from "../ThematicDisplay";

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
});
