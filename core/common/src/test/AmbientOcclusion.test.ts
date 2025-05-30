/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { AmbientOcclusion } from "../AmbientOcclusion";

describe("AmbientOcclusion.Settings", () => {
  it("toJSON() should return defaults as undefined", () => {
    const aoSettings = AmbientOcclusion.Settings.fromJSON().toJSON();
    expect(aoSettings.bias).to.be.undefined;
    expect(aoSettings.blurDelta).to.be.undefined;
    expect(aoSettings.blurSigma).to.be.undefined;
    expect(aoSettings.blurTexelStepSize).to.be.undefined;
    expect(aoSettings.intensity).to.be.undefined;
    expect(aoSettings.maxDistance).to.be.undefined;
    expect(aoSettings.texelStepSize).to.be.undefined;
    expect(aoSettings.zLengthCap).to.be.undefined;
  });

  it("toJSON() should return proper default values", () => {
    const aoSettings = AmbientOcclusion.Settings.fromJSON();
    const defaults = AmbientOcclusion.Settings.defaults;
    expect(aoSettings.bias).to.equal(defaults.bias);
    expect(aoSettings.blurDelta).to.equal(defaults.blurDelta);
    expect(aoSettings.blurSigma).to.equal(defaults.blurSigma);
    expect(aoSettings.blurTexelStepSize).to.equal(defaults.blurTexelStepSize);
    expect(aoSettings.intensity).to.equal(defaults.intensity);
    expect(aoSettings.maxDistance).to.equal(defaults.maxDistance);
    expect(aoSettings.texelStepSize).to.equal(defaults.texelStepSize);
    expect(aoSettings.zLengthCap).to.equal(defaults.zLengthCap);
  });

  it("should round trip proper values", () => {
    const aoProps: AmbientOcclusion.Props = {
      bias: 0.1,
      zLengthCap: 0.1,
      maxDistance: 5000,
      intensity: 5.0,
      texelStepSize: 2.0,
      blurDelta: 1.5,
      blurSigma: 2.5,
      blurTexelStepSize: 2.0,
    };

    // check that settings values are set properly from the source props
    const aoSettings = AmbientOcclusion.Settings.fromJSON(aoProps);
    expect(aoSettings.bias).to.equal(aoProps.bias);
    expect(aoSettings.blurDelta).to.equal(aoProps.blurDelta);
    expect(aoSettings.blurSigma).to.equal(aoProps.blurSigma);
    expect(aoSettings.blurTexelStepSize).to.equal(aoProps.blurTexelStepSize);
    expect(aoSettings.intensity).to.equal(aoProps.intensity);
    expect(aoSettings.maxDistance).to.equal(aoProps.maxDistance);
    expect(aoSettings.texelStepSize).to.equal(aoProps.texelStepSize);
    expect(aoSettings.zLengthCap).to.equal(aoProps.zLengthCap);

    // check that round trip props match original props
    const aoProps1 = aoSettings.toJSON();
    expect(aoProps1.bias).to.equal(aoProps.bias);
    expect(aoProps1.blurDelta).to.equal(aoProps.blurDelta);
    expect(aoProps1.blurSigma).to.equal(aoProps.blurSigma);
    expect(aoProps1.blurTexelStepSize).to.equal(aoProps.blurTexelStepSize);
    expect(aoProps1.intensity).to.equal(aoProps.intensity);
    expect(aoProps1.maxDistance).to.equal(aoProps.maxDistance);
    expect(aoProps1.texelStepSize).to.equal(aoProps.texelStepSize);
    expect(aoProps1.zLengthCap).to.equal(aoProps.zLengthCap);
  });
});
