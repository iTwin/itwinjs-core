/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { ModelMapLayerDrapeTarget, ModelMapLayerProps, ModelMapLayerSettings } from "../core-common";

const testMapLayer0 = { name: "TestName", modelId: "0x123", visible: true };
const testMapLayer1 = { name: "TestName", modelId: "0x123", transparency: .5, transparentBackground: false, visible: true };
const testMapLayer2 = { name: "TestName", modelId: "0x123", visible: false };

describe("ModelMapLayerSettings", () => {
  const expectMatches = (output: ModelMapLayerProps, expected: ModelMapLayerProps) => {
    expect(output.name).to.equal(expected.name);
    expect(output.visible).to.equal(expected.visible);
    expect(output.modelId).to.equal(expected.modelId);
    expect(output.transparency).to.equal(expected.transparency);
    expect(output.transparentBackground).to.equal(expected.transparentBackground);
    expect(output.drapeTarget).to.equal(expected.drapeTarget);
  };

  it("round-trips through JSON", () => {
    const roundTrip = (input: ModelMapLayerProps, expected: ModelMapLayerProps | "input") => {

      if ("input" === expected)
        expected = JSON.parse(JSON.stringify(input)) as ModelMapLayerProps;

      const settings = ModelMapLayerSettings.fromJSON(input);
      expect(settings).not.to.be.undefined;
      const output = settings.toJSON();
      expectMatches(output, expected);
    };

    roundTrip(testMapLayer0, "input");
    roundTrip(testMapLayer1, "input");
    roundTrip(testMapLayer2, "input");
  });

  it("clones", () => {
    const clone = (input: ModelMapLayerProps, changed: Partial<ModelMapLayerProps>, expected: ModelMapLayerProps) => {
      const settings = ModelMapLayerSettings.fromJSON(input);
      const output = settings.clone(changed);
      expectMatches(output.toJSON(), expected);
    };

    // Turn off visibility
    clone(testMapLayer0, { visible: false }, { name: "TestName", modelId: "0x123", visible: false });

    // turn on visibility
    clone(testMapLayer2, { visible: true }, { name: "TestName", modelId: "0x123", visible: true });

    // Set transparency
    clone(testMapLayer0, { transparency: .5 }, { name: "TestName", modelId: "0x123", transparency: .5, visible: true });
  });

  it("round-trips with drapeTarget set to RealityData", () => {
    const input: ModelMapLayerProps = {
      name: "TestName",
      modelId: "0x123",
      visible: true,
      drapeTarget: ModelMapLayerDrapeTarget.RealityData
    };
    const settings = ModelMapLayerSettings.fromJSON(input);
    expect(settings).not.to.be.undefined;
    const output = settings.toJSON();
    expectMatches(output, input);
  });

  it("clones and changes drapeTarget to RealityData", () => {
    const input: ModelMapLayerProps = { name: "TestName", modelId: "0x123", visible: true };
    const settings = ModelMapLayerSettings.fromJSON(input);
    const cloned = settings.clone({ drapeTarget: ModelMapLayerDrapeTarget.RealityData });
    const expected: ModelMapLayerProps = {
      name: "TestName",
      modelId: "0x123",
      visible: true,
      drapeTarget: ModelMapLayerDrapeTarget.RealityData
    };
    expectMatches(cloned.toJSON(), expected);
  });

  it("default drapeTarget is not RealityData", () => {
    const defaultSettings = ModelMapLayerSettings.fromJSON({ name: "TestName", modelId: "0x123", visible: true });
    const defaultJson = defaultSettings.toJSON();

    const newSettings = defaultSettings.clone({ drapeTarget: ModelMapLayerDrapeTarget.RealityData });
    const newJson = newSettings.toJSON();

    expect(defaultJson.drapeTarget).to.not.equal(newJson.drapeTarget);
  });
});
