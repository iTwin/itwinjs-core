/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Point3d, Range1d, Vector3d } from "@itwin/core-geometry";
import { expect } from "chai";
import { ColorDef } from "../ColorDef";
import type { ThematicDisplayProps} from "../ThematicDisplay";
import { ThematicDisplay, ThematicDisplayMode, ThematicDisplaySensorSettings, ThematicGradientColorScheme, ThematicGradientMode } from "../ThematicDisplay";

describe("ThematicDisplay", () => {
  it("Ensures ThematicDisplay derives values properly from JSON, including handling defaults and incorrect values", () => {
    function verifyDefaults(thematicDisplay: ThematicDisplay) {
      expect(thematicDisplay.axis).to.deep.equal(Vector3d.fromJSON({ x: 0.0, y: 0.0, z: 0.0 }));
      expect(thematicDisplay.displayMode).to.equal(ThematicDisplayMode.Height);
      expect(thematicDisplay.gradientSettings.mode).to.equal(ThematicGradientMode.Smooth);
      expect(thematicDisplay.gradientSettings.stepCount).to.equal(10);
      expect(thematicDisplay.gradientSettings.colorScheme).to.equal(ThematicGradientColorScheme.BlueRed);
      expect(thematicDisplay.gradientSettings.marginColor.colors.r).to.equal(0);
      expect(thematicDisplay.gradientSettings.marginColor.colors.g).to.equal(0);
      expect(thematicDisplay.gradientSettings.marginColor.colors.b).to.equal(0);
      expect(thematicDisplay.gradientSettings.marginColor.colors.t).to.equal(0);
      expect(thematicDisplay.gradientSettings.customKeys.length).to.equal(0);
      expect(thematicDisplay.range).to.deep.equal(Range1d.createNull());
      expect(thematicDisplay.sensorSettings).to.deep.equal(ThematicDisplaySensorSettings.fromJSON());
      expect(thematicDisplay.sensorSettings.sensors).to.deep.equal([]);
      expect(thematicDisplay.sensorSettings.distanceCutoff).to.equal(0);
    }

    // check if the creation and back-and-forth via JSON works
    function verifyBackAndForth(a: ThematicDisplay) {
      const aCopy = ThematicDisplay.fromJSON(a.toJSON());
      expect(aCopy.equals(a)).to.be.true;
    }

    // create default ThematicDisplay object and verify the default values are correct
    const defaultThematicDisplay = ThematicDisplay.fromJSON();
    verifyDefaults(defaultThematicDisplay);

    // check if the creation and back-and-forth via JSON works using the default object
    verifyBackAndForth(defaultThematicDisplay);

    // check if setting bad values for displayMode, gradient mode, and gradient color scheme yields expected defaults
    let badThematicProps: ThematicDisplayProps = {
      displayMode: 99999,
      gradientSettings: {
        mode: 99999,
        colorScheme: 99999,
      },
    };
    let td = ThematicDisplay.fromJSON(badThematicProps);
    expect(td.equals(defaultThematicDisplay)).to.be.true;
    verifyBackAndForth(td);

    // verify that sensor settings propagate properly through JSON to the object
    const sensorSettingsProps = {
      sensors: [
        { position: [1.0, 2.0, 3.0], value: 0.25 },
        { position: [4.0, 5.0, 6.0], value: 0.5 },
        { position: [7.0, 8.0, 9.0], value: 0.75 },
        { position: [10.0, 11.0, 12.0], value: -1.0 },
        { position: [13.0, 14.0, 15.0], value: 2.0 },
      ],
      distanceCutoff: 5.0,
    };
    td = ThematicDisplay.fromJSON({ sensorSettings: sensorSettingsProps });
    expect(td.sensorSettings.sensors.length).to.equal(5);
    expect(td.sensorSettings.sensors[0].position).to.deep.equal(Point3d.fromJSON(sensorSettingsProps.sensors[0].position));
    expect(td.sensorSettings.sensors[0].value).to.equal(sensorSettingsProps.sensors[0].value);
    expect(td.sensorSettings.sensors[1].position).to.deep.equal(Point3d.fromJSON(sensorSettingsProps.sensors[1].position));
    expect(td.sensorSettings.sensors[1].value).to.equal(sensorSettingsProps.sensors[1].value);
    expect(td.sensorSettings.sensors[2].position).to.deep.equal(Point3d.fromJSON(sensorSettingsProps.sensors[2].position));
    expect(td.sensorSettings.sensors[2].value).to.equal(sensorSettingsProps.sensors[2].value);
    expect(td.sensorSettings.sensors[3].position).to.deep.equal(Point3d.fromJSON(sensorSettingsProps.sensors[3].position));
    expect(td.sensorSettings.sensors[3].value).to.equal(0); // verify that the 'bad' value of -1 gets clamped to 0
    expect(td.sensorSettings.sensors[4].position).to.deep.equal(Point3d.fromJSON(sensorSettingsProps.sensors[4].position));
    expect(td.sensorSettings.sensors[4].value).to.equal(1); // verify that the 'bad' value of 2 gets clamped to 1
    expect(td.sensorSettings.distanceCutoff).to.equal(sensorSettingsProps.distanceCutoff);
    verifyBackAndForth(td); // verify round-trip

    // check if configuring custom color scheme incorrectly is resolved as expected
    badThematicProps = {
      gradientSettings: {
        colorScheme: ThematicGradientColorScheme.Custom,
        customKeys: [{ value: 0.0, color: 0 }], // (one entry is not okay - need at least two)
      },
    };
    td = ThematicDisplay.fromJSON(badThematicProps);
    expect(td.gradientSettings.customKeys.length).to.equal(2); // 2 entries should get manufactured
    expect(td.gradientSettings.customKeys[0].color).to.deep.equal(ColorDef.from(255, 255, 255, 0)); // first should be white
    expect(td.gradientSettings.customKeys[0].value).to.equal(0.0); // value for black should be 0.0
    expect(td.gradientSettings.customKeys[1].color).to.deep.equal(ColorDef.from(0, 0, 0, 0)); // second should be black
    expect(td.gradientSettings.customKeys[1].value).to.equal(1.0); // value for white should be 1.0
    verifyBackAndForth(td);

    // check if incorrectly configuring gradient mode / thematic display mode combination is resolved as expected - IsoLines / Sensors
    badThematicProps = {
      gradientSettings: {
        mode: ThematicGradientMode.IsoLines,
      },
      displayMode: ThematicDisplayMode.InverseDistanceWeightedSensors,
    };
    td = ThematicDisplay.fromJSON(badThematicProps);
    expect(td.gradientSettings.mode).to.equal(ThematicGradientMode.Smooth); // should default to smooth because of incorrect combo
    verifyBackAndForth(td);

    // check if incorrectly configuring gradient mode / thematic display mode combination is resolved as expected - SteppedWithDelimiter / Sensors
    badThematicProps = {
      gradientSettings: {
        mode: ThematicGradientMode.SteppedWithDelimiter,
      },
      displayMode: ThematicDisplayMode.InverseDistanceWeightedSensors,
    };
    td = ThematicDisplay.fromJSON(badThematicProps);
    expect(td.gradientSettings.mode).to.equal(ThematicGradientMode.Smooth); // should default to smooth because of incorrect combo
    verifyBackAndForth(td);

    // check if incorrectly configuring gradient mode / thematic display mode combination is resolved as expected - Slope
    badThematicProps = {
      gradientSettings: {
        mode: ThematicGradientMode.SteppedWithDelimiter,
      },
      displayMode: ThematicDisplayMode.Slope,
    };
    td = ThematicDisplay.fromJSON(badThematicProps);
    expect(td.gradientSettings.mode).to.equal(ThematicGradientMode.Smooth); // should default to smooth because of incorrect combo
    verifyBackAndForth(td);

    // check if incorrectly configuring gradient mode / thematic display mode combination is resolved as expected - HillShade
    badThematicProps = {
      gradientSettings: {
        mode: ThematicGradientMode.SteppedWithDelimiter,
      },
      displayMode: ThematicDisplayMode.HillShade,
    };
    td = ThematicDisplay.fromJSON(badThematicProps);
    expect(td.gradientSettings.mode).to.equal(ThematicGradientMode.Smooth); // should default to smooth because of incorrect combo
    verifyBackAndForth(td);
  });
});
