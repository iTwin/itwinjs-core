/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ImageMapLayerSettings } from "@itwin/core-common";
import { expect } from "chai";
import { ArcGisFeatureMapLayerFormat } from "../../ArcGisFeature/ArcGisFeatureFormat";
import { ArcGisFeatureProvider } from "../../map-layers-formats";
import * as sinon from "sinon";
import { ArcGisUtilities } from "@itwin/core-frontend";
import { NewYorkDataset } from "./NewYorkDataset";

const esriFeatureSampleSource = {name: "dummyFeatureLayer", url: "https://dummy.com", formatId: ArcGisFeatureMapLayerFormat.formatId};
describe("ArcGisFeatureProvider", () => {

  const sandbox = sinon.createSandbox();

  afterEach(async () => {
    sandbox.restore();
  });

  it("should initialize", async () => {

    sandbox.stub(ArcGisUtilities, "getServiceJson").callsFake(async function _(_url: string, _formatId: string, _userName?: string, _password?: string, _ignoreCache?: boolean) {
      return NewYorkDataset.serviceCapabilities;
    });

    sandbox.stub(ArcGisFeatureProvider.prototype, "getLayerMetadata" as any).callsFake(async function _(_layerId: number) {
      return NewYorkDataset.streetsLayerCapabilities;
    });

    const settings = ImageMapLayerSettings.fromJSON(esriFeatureSampleSource);
    const provider = new ArcGisFeatureProvider(settings);
    await provider.initialize();

    expect((provider as any)._minDepthFromLod).to.equals(11);
    expect((provider as any)._maxDepthFromLod).to.equals(0);
  });

});
