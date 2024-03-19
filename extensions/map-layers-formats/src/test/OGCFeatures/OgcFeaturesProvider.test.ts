/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as sinon from "sinon";
import { OgcFeaturesProvider } from "../../OgcFeatures/OgcFeaturesProvider";
import { ImageMapLayerSettings } from "@itwin/core-common";
import { expect } from "chai";

describe("OgcFeaturesProvider", () => {
  const sandbox = sinon.createSandbox();

  afterEach(async () => {
    sandbox.restore();
  });

  it("should read polygon geometry", async () => {
    const settings = ImageMapLayerSettings.fromJSON({
      name: "test",
      url: "test",
      formatId: "test",
    });
    const provider = new OgcFeaturesProvider(settings);
    const transfo = provider.computeTileWorld2CanvasTransform(0,0,0);
    expect(transfo).to.not.be.undefined;
  });

});
