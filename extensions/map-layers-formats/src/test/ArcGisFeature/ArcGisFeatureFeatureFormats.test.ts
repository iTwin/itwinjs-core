/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ImageMapLayerSettings } from "@itwin/core-common";
import {
  ArcGisUtilities,
  MapLayerSourceStatus,
} from "@itwin/core-frontend";
import { expect } from "chai";
import { ArcGisFeatureMapLayerFormat } from "../../ArcGisFeature/ArcGisFeatureFormat";
import { esriFeatureSampleSource } from "./Mocks";
import * as sinon from "sinon";

describe("ArcGisFeaturePBF", () => {

  const sandbox = sinon.createSandbox();

  afterEach(async () => {
    sandbox.restore();
  });

  it("should createImageryProvider", async () => {
    const provider = ArcGisFeatureMapLayerFormat.createImageryProvider(ImageMapLayerSettings.fromJSON(esriFeatureSampleSource));
    expect(provider).to.not.undefined;
  });

  it("should validateSource", async () => {

    const fakeMethod = async (_url: string, _formatId: string,_filter: string[], _userName?: string, _password?: string, _ignoreCache?: boolean) => {
      return {status: MapLayerSourceStatus.Valid};

    };
    const validateSourceStub = sinon.stub(ArcGisUtilities, "validateSource").callsFake(fakeMethod);

    await ArcGisFeatureMapLayerFormat.validateSource(esriFeatureSampleSource.url);

    expect(validateSourceStub.calledOnce).to.be.true;
    const firstCall = validateSourceStub.getCalls()[0];
    expect(firstCall.args[0]).to.equals(esriFeatureSampleSource.url);
    expect(firstCall.args[1]).to.equals(ArcGisFeatureMapLayerFormat.formatId);
    expect(firstCall.args[2]).to.eqls(["query"]);
  });

});
