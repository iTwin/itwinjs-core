/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ImageMapLayerSettings, MapLayerUrlParam } from "@itwin/core-common";
import {
  ArcGisUtilities,
  MapLayerSource,
  MapLayerSourceStatus,
} from "@itwin/core-frontend";
import { expect } from "chai";
import { ArcGisFeatureMapLayerFormat } from "../../ArcGisFeature/ArcGisFeatureFormat";
import { esriFeatureSampleSource } from "./Mocks";
import * as sinon from "sinon";

describe("ArcGisFeatureFormats", () => {

  const sandbox = sinon.createSandbox();

  afterEach(async () => {
    sandbox.restore();
  });

  it("should createImageryProvider", async () => {
    const provider = ArcGisFeatureMapLayerFormat.createImageryProvider(ImageMapLayerSettings.fromJSON(esriFeatureSampleSource));
    expect(provider).to.not.undefined;
  });

  it("should validateSource", async () => {

    const fakeMethod = async (_url: string, _formatId: string,_filter: string[], _userName?: string, _password?: string, _customParams?: MapLayerUrlParam[], _ignoreCache?: boolean) => {
      return {status: MapLayerSourceStatus.Valid};

    };
    const validateSourceStub = sinon.stub(ArcGisUtilities, "validateSource").callsFake(fakeMethod);

    const source = MapLayerSource.fromJSON({
      name: "dummyFeatureLayer",
      url: "https://services7.arcgis.com/nZ2Vb4CUwdo9AIiQ/ArcGIS/rest/services/PhillyRailLines/FeatureServer",
      formatId: ArcGisFeatureMapLayerFormat.formatId});

    if (!source) {
      chai.assert.fail();
    }

    source.customParameters = [{key: "key1", value:"value1"}];
    source.userName = "username1";
    source.password = "password1";

    await ArcGisFeatureMapLayerFormat.validateSourceObj(source);

    expect(validateSourceStub.calledOnce).to.be.true;
    const firstCall = validateSourceStub.getCalls()[0];
    expect(firstCall.args[0]).to.equals(esriFeatureSampleSource.url);
    expect(firstCall.args[1]).to.equals(ArcGisFeatureMapLayerFormat.formatId);
    expect(firstCall.args[2]).to.eqls(["query"]);
    expect(firstCall.args[3]).to.eqls(source.userName);
    expect(firstCall.args[4]).to.eqls(source.password);
    expect(firstCall.args[5]).to.eqls(source.customParameters);
  });

});
