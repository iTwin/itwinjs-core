/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Base64EncodedString, ImageMapLayerSettings } from "@itwin/core-common";
import { MapLayerFeatureInfo } from "@itwin/core-frontend";
import { expect } from "chai";
import * as sinon from "sinon";
import { ArcGisFeatureMapLayerFormat } from "../../ArcGisFeature/ArcGisFeatureFormat";
import { ArcGisFeaturePBF } from "../../ArcGisFeature/ArcGisFeaturePBF";
import { esriPBuffer } from "../../ArcGisFeature/esriPBuffer.gen";
import { PhillyLandmarksDataset } from "./PhillyLandmarksDataset";

const esriFeatureSampleSource = {name: "dummyFeatureLayer", url: "https://dummy.com", formatId: ArcGisFeatureMapLayerFormat.formatId};

describe("ArcGisFeaturePBF", () => {

  const sandbox = sinon.createSandbox();

  afterEach(async () => {
    sandbox.restore();
  });

  it("should read FeatureInfo in PBF", async () => {
    const byteArray = Base64EncodedString.toUint8Array(PhillyLandmarksDataset.phillyAirportGetFeatureInfoQueryPbf);
    const featureCollection = esriPBuffer.FeatureCollectionPBuffer.deserialize(byteArray);

    const settings = ImageMapLayerSettings.fromJSON(esriFeatureSampleSource);
    const featurePbf = new ArcGisFeaturePBF(settings, {name: "SampleLayer"});

    // In some cases, PBF gives more floating-point precision than JSON.
    // Since I want to use the same output reference for both formats, I force a max precision of 8.
    featurePbf.floatPrecision = 8;
    const results: MapLayerFeatureInfo[] = [];
    featurePbf.readFeatureInfo({data:featureCollection, exceedTransferLimit: false}, results);

    // Make deep comparison by using JSON.stringify
    expect(JSON.stringify(results)).equals(JSON.stringify(PhillyLandmarksDataset.phillyAirportGetFeatureInfoResultRef));

  });

  it("should read all data types from FeatureInfo ", async () => {

    // In this test we use a synthetic PBuffer object to initialize a feature collection object.
    // The is to ensure we cover correctly all possible attribute value types.
    const featureCollection = esriPBuffer.FeatureCollectionPBuffer.fromObject(PhillyLandmarksDataset.fieldsCoveragePbufferCollection);

    const settings = ImageMapLayerSettings.fromJSON(esriFeatureSampleSource);
    const featurePbf = new ArcGisFeaturePBF(settings, {name: "SampleLayer"});

    const results: MapLayerFeatureInfo[] = [];
    featurePbf.readFeatureInfo({data:featureCollection, exceedTransferLimit: false}, results);

    // Make deep comparison by using JSON.stringify
    expect(JSON.stringify(results)).equals(JSON.stringify(PhillyLandmarksDataset.fieldsCoverageGetFeatureInfoResultRef));
  });

});
