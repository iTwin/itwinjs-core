/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ImageMapLayerSettings } from "@itwin/core-common";
import { MapLayerFeatureInfo } from "@itwin/core-frontend";
import { expect } from "chai";
import * as sinon from "sinon";
import { ArcGisFeatureMapLayerFormat } from "../../ArcGisFeature/ArcGisFeatureFormat";
import { ArcGisFeatureJSON } from "../../ArcGisFeature/ArcGisFeatureJSON";
import { PhillyLandmarksDataset } from "./PhillyLandmarksDataset";

const esriFeatureSampleSource = {name: "dummyFeatureLayer", url: "https://dummy.com", formatId: ArcGisFeatureMapLayerFormat.formatId};

describe("ArcGisFeatureJSON", () => {

  const sandbox = sinon.createSandbox();

  afterEach(async () => {
    sandbox.restore();
  });

  it("should read FeatureInfo in JSON", async () => {
    const settings = ImageMapLayerSettings.fromJSON(esriFeatureSampleSource);
    const featureJson = new ArcGisFeatureJSON(settings, {name: "SampleLayer"});
    // In some cases, PBF gives more floating-point precision than JSON.
    // Since I want to use the same output reference for both formats, I force a max precision of 8.
    featureJson.floatPrecision = 8;
    const results: MapLayerFeatureInfo[] = [];
    const data = JSON.parse(PhillyLandmarksDataset.phillyAirportGetFeatureInfoQueryJson);
    featureJson.readFeatureInfo({data, exceedTransferLimit: false}, results);
    const _test = JSON.stringify(results);
    expect(_test).equals(JSON.stringify(PhillyLandmarksDataset.phillyAirportGetFeatureInfoResultRef));
  });

});
