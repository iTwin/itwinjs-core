/* eslint-disable @typescript-eslint/naming-convention */
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ImageMapLayerSettings } from "@itwin/core-common";
import {
  ArcGisUtilities,
  ArcGisValidateSourceOptions,
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

    const fakeMethod = async (_source: MapLayerSource, _opts?: ArcGisValidateSourceOptions) => {
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

    source.unsavedQueryParams = {key1_1: "value1_1", key1_2: "value1_2"};
    source.savedQueryParams = { key2_1: "value2_1", key2_2: "value2_2"};
    source.userName = "username1";
    source.password = "password1";

    await ArcGisFeatureMapLayerFormat.validateSourceObj(source, {ignoreCache: true});

    expect(validateSourceStub.calledOnce).to.be.true;
    const firstCall = validateSourceStub.getCalls()[0];
    const actualSource = firstCall.args[0];
    expect(JSON.stringify(actualSource.toJSON())).to.equals(JSON.stringify(source.toJSON()));
    expect(actualSource.userName).to.equals(source.userName);
    expect(actualSource.password).to.equals(source.password);
    expect(firstCall.args[1]).to.eqls({capabilitiesFilter: ["query"], ignoreCache: true} );
  });

});
