/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { AmbientOcclusion } from "../AmbientOcclusion";

describe("AmbientOcclusion.Settings", () => {
  it("toJSON() should return defaults as undefined", () => {
    const aoSettings = AmbientOcclusion.Settings.fromJSON().toJSON();
    expect(aoSettings.angleOffset).to.be.undefined;
    expect(aoSettings.spacialOffset).to.be.undefined;
    expect(aoSettings.c1).to.be.undefined;
    expect(aoSettings.c2).to.be.undefined;
    expect(aoSettings.ssaoLimit).to.be.undefined;
    expect(aoSettings.ssaoSamples).to.be.undefined;
    expect(aoSettings.ssaoRadius).to.be.undefined;
    expect(aoSettings.ssaoFalloff).to.be.undefined;
    expect(aoSettings.ssaoThicknessMix).to.be.undefined;
    expect(aoSettings.ssaoMaxStride).to.be.undefined;
    expect(aoSettings.blurDelta).to.be.undefined;
    expect(aoSettings.blurSigma).to.be.undefined;
    expect(aoSettings.blurTexelStepSize).to.be.undefined;
    expect(aoSettings.maxDistance).to.be.undefined;
  });

  it("toJSON() should return proper default values", () => {
    const aoSettings = AmbientOcclusion.Settings.fromJSON();
    const defaults = AmbientOcclusion.Settings.defaults;
    expect(aoSettings.angleOffset).to.equal(defaults.angleOffset);
    expect(aoSettings.spacialOffset).to.equal(defaults.spacialOffset);
    expect(aoSettings.c1).to.equal(defaults.c1);
    expect(aoSettings.c2).to.equal(defaults.c2);
    expect(aoSettings.ssaoLimit).to.equal(defaults.ssaoLimit);
    expect(aoSettings.ssaoSamples).to.equal(defaults.ssaoSamples);
    expect(aoSettings.ssaoRadius).to.equal(defaults.ssaoRadius);
    expect(aoSettings.ssaoFalloff).to.equal(defaults.ssaoFalloff);
    expect(aoSettings.ssaoThicknessMix).to.equal(defaults.ssaoThicknessMix);
    expect(aoSettings.ssaoMaxStride).to.equal(defaults.ssaoMaxStride);
    expect(aoSettings.blurDelta).to.equal(defaults.blurDelta);
    expect(aoSettings.blurSigma).to.equal(defaults.blurSigma);
    expect(aoSettings.blurTexelStepSize).to.equal(defaults.blurTexelStepSize);
    expect(aoSettings.maxDistance).to.equal(defaults.maxDistance);
  });

  it("should round trip proper values", () => {
    const aoProps: AmbientOcclusion.Props = {
      angleOffset: 0.5,
      spacialOffset: 1.0,
      c1: 0.75,
      c2: 0.25,
      ssaoLimit: 150,
      ssaoSamples: 8,
      ssaoRadius: 3.0,
      ssaoFalloff: 2.0,
      ssaoThicknessMix: 0.3,
      ssaoMaxStride: 40,
      maxDistance: 5000,
      blurDelta: 1.5,
      blurSigma: 2.5,
      blurTexelStepSize: 2.0,
    };

    // check that settings values are set properly from the source props
    const aoSettings = AmbientOcclusion.Settings.fromJSON(aoProps);
    expect(aoSettings.angleOffset).to.equal(aoProps.angleOffset);
    expect(aoSettings.spacialOffset).to.equal(aoProps.spacialOffset);
    expect(aoSettings.c1).to.equal(aoProps.c1);
    expect(aoSettings.c2).to.equal(aoProps.c2);
    expect(aoSettings.ssaoLimit).to.equal(aoProps.ssaoLimit);
    expect(aoSettings.ssaoSamples).to.equal(aoProps.ssaoSamples);
    expect(aoSettings.ssaoRadius).to.equal(aoProps.ssaoRadius);
    expect(aoSettings.ssaoFalloff).to.equal(aoProps.ssaoFalloff);
    expect(aoSettings.ssaoThicknessMix).to.equal(aoProps.ssaoThicknessMix);
    expect(aoSettings.ssaoMaxStride).to.equal(aoProps.ssaoMaxStride);
    expect(aoSettings.blurDelta).to.equal(aoProps.blurDelta);
    expect(aoSettings.blurSigma).to.equal(aoProps.blurSigma);
    expect(aoSettings.blurTexelStepSize).to.equal(aoProps.blurTexelStepSize);
    expect(aoSettings.maxDistance).to.equal(aoProps.maxDistance);

    // check that round trip props match original props
    const aoProps1 = aoSettings.toJSON();
    expect(aoProps1.angleOffset).to.equal(aoProps.angleOffset);
    expect(aoProps1.spacialOffset).to.equal(aoProps.spacialOffset);
    expect(aoProps1.c1).to.equal(aoProps.c1);
    expect(aoProps1.c2).to.equal(aoProps.c2);
    expect(aoProps1.ssaoLimit).to.equal(aoProps.ssaoLimit);
    expect(aoProps1.ssaoSamples).to.equal(aoProps.ssaoSamples);
    expect(aoProps1.ssaoRadius).to.equal(aoProps.ssaoRadius);
    expect(aoProps1.ssaoFalloff).to.equal(aoProps.ssaoFalloff);
    expect(aoProps1.ssaoThicknessMix).to.equal(aoProps.ssaoThicknessMix);
    expect(aoProps1.ssaoMaxStride).to.equal(aoProps.ssaoMaxStride);
    expect(aoProps1.blurDelta).to.equal(aoProps.blurDelta);
    expect(aoProps1.blurSigma).to.equal(aoProps.blurSigma);
    expect(aoProps1.blurTexelStepSize).to.equal(aoProps.blurTexelStepSize);
    expect(aoProps1.maxDistance).to.equal(aoProps.maxDistance);
  });
});
