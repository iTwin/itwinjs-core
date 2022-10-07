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
import { ArcGisFeatureRenderer } from "../../ArcGisFeature/ArcGisFeatureRenderer";
import { ArcGisSymbologyRenderer } from "../../ArcGisFeature/ArcGisSymbologyRenderer";
import { esriPBuffer } from "../../ArcGisFeature/esriPBuffer.gen";
import { fakeContext } from "./Mocks";
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

  it("should readAndRender single ring polygon feature", async () => {
    const settings = ImageMapLayerSettings.fromJSON(esriFeatureSampleSource);
    const featureJson = new ArcGisFeaturePBF(settings, {name: "SampleLayer"});

    const data = esriPBuffer.FeatureCollectionPBuffer.fromObject(PhillyLandmarksDataset.phillySimplePolyQueryPbf);
    const geomType = ArcGisFeaturePBF.getArcGisFeatureGeometryType(PhillyLandmarksDataset.phillySimplePolyQueryPbf.queryResult.featureResult.geometryType);
    const symbolRenderer = new ArcGisSymbologyRenderer(geomType, PhillyLandmarksDataset.phillySimplePolyDrawingInfo.drawingInfo.renderer);

    const featureRenderer = new ArcGisFeatureRenderer(fakeContext, symbolRenderer);
    const renderPathFeatureSpy = sinon.spy(featureRenderer, "renderPathFeature");
    featureJson.readAndRender({data, exceedTransferLimit: false}, featureRenderer);
    expect(renderPathFeatureSpy.calledOnce);

    const firstCall = renderPathFeatureSpy.getCalls()[0];
    expect(firstCall.args[0]).to.eql(PhillyLandmarksDataset.phillySimplePolyQueryPbf.queryResult.featureResult.features[0].geometry.lengths); // geometryLengths
    expect(firstCall.args[1]).to.eql(PhillyLandmarksDataset.phillySimplePolyQueryPbf.queryResult.featureResult.features[0].geometry.coords);              // geometryCoords
    expect(firstCall.args[2]).to.eql(true);           // fill
    expect(firstCall.args[3]).to.eql(2);              // stride
  });

  it("should readAndRender multiple ring polygon feature", async () => {
    const settings = ImageMapLayerSettings.fromJSON(esriFeatureSampleSource);
    const featureJson = new ArcGisFeaturePBF(settings, {name: "SampleLayer"});

    const geomType = ArcGisFeaturePBF.getArcGisFeatureGeometryType(PhillyLandmarksDataset.phillyDoubleRingPolyQueryPbf.queryResult.featureResult.geometryType);
    const data = esriPBuffer.FeatureCollectionPBuffer.fromObject(PhillyLandmarksDataset.phillyDoubleRingPolyQueryPbf);

    const symbolRenderer = new ArcGisSymbologyRenderer(geomType, PhillyLandmarksDataset.phillySimplePolyDrawingInfo.drawingInfo.renderer);

    const featureRenderer = new ArcGisFeatureRenderer(fakeContext, symbolRenderer);
    const renderPathFeatureSpy = sinon.spy(featureRenderer, "renderPathFeature");
    featureJson.readAndRender({data, exceedTransferLimit: false}, featureRenderer);
    expect(renderPathFeatureSpy.calledOnce);

    const firstCall = renderPathFeatureSpy.getCalls()[0];
    expect(firstCall.args[0]).to.eql(PhillyLandmarksDataset.phillyDoubleRingPolyQueryPbf.queryResult.featureResult.features[0].geometry.lengths); // geometryLengths
    expect(firstCall.args[1]).to.eql(PhillyLandmarksDataset.phillyDoubleRingPolyQueryPbf.queryResult.featureResult.features[0].geometry.coords);              // geometryCoords
    expect(firstCall.args[2]).to.eql(true);                        // fill
    expect(firstCall.args[3]).to.eql(2);              // stride
  });

  it("should readAndRender simple path", async () => {
    const settings = ImageMapLayerSettings.fromJSON(esriFeatureSampleSource);
    const feature = new ArcGisFeaturePBF(settings, {name: "SampleLayer"});
    const data = esriPBuffer.FeatureCollectionPBuffer.fromObject(PhillyLandmarksDataset.phillySimplePathQueryPbf);
    const symbolRenderer = new ArcGisSymbologyRenderer(
      ArcGisFeaturePBF.getArcGisFeatureGeometryType(PhillyLandmarksDataset.phillySimplePathQueryPbf.queryResult.featureResult.geometryType),
      PhillyLandmarksDataset.phillySimpleLineDrawingInfo.drawingInfo.renderer);

    const featureRenderer = new ArcGisFeatureRenderer(fakeContext, symbolRenderer);
    const renderPathFeatureSpy = sinon.spy(featureRenderer, "renderPathFeature");
    feature.readAndRender({data, exceedTransferLimit: false}, featureRenderer);
    expect(renderPathFeatureSpy.calledOnce);

    const firstCall = renderPathFeatureSpy.getCalls()[0];
    expect(firstCall).to.not.undefined;
    expect(firstCall.args[0]).to.eql(PhillyLandmarksDataset.phillySimplePathQueryPbf.queryResult.featureResult.features[0].geometry.lengths);          // geometryLengths
    expect(firstCall.args[1]).to.eql(PhillyLandmarksDataset.phillySimplePathQueryPbf.queryResult.featureResult.features[0].geometry.coords); // geometryCoords
    expect(firstCall.args[2]).to.eql(false);           // fill
    expect(firstCall.args[3]).to.eql(2);              // stride
  });

  it("should readAndRender multi path", async () => {
    const settings = ImageMapLayerSettings.fromJSON(esriFeatureSampleSource);
    const feature = new ArcGisFeaturePBF(settings, {name: "SampleLayer"});
    const data = esriPBuffer.FeatureCollectionPBuffer.fromObject(PhillyLandmarksDataset.phillyMultiPathQueryPbf);
    const geomType = ArcGisFeaturePBF.getArcGisFeatureGeometryType(PhillyLandmarksDataset.phillyMultiPathQueryPbf.queryResult.featureResult.geometryType);
    const symbolRenderer = new ArcGisSymbologyRenderer(geomType, PhillyLandmarksDataset.phillySimpleLineDrawingInfo.drawingInfo.renderer);
    const featureRenderer = new ArcGisFeatureRenderer(fakeContext, symbolRenderer);
    const renderPathFeatureSpy = sinon.spy(featureRenderer, "renderPathFeature");
    feature.readAndRender({data, exceedTransferLimit: false}, featureRenderer);
    expect(renderPathFeatureSpy.calledOnce);

    const firstCall = renderPathFeatureSpy.getCalls()[0];
    expect(firstCall.args[0]).to.eql(PhillyLandmarksDataset.phillyMultiPathQueryPbf.queryResult.featureResult.features[0].geometry.lengths);          // geometryLengths
    expect(firstCall.args[1]).to.eql(PhillyLandmarksDataset.phillyMultiPathQueryPbf.queryResult.featureResult.features[0].geometry.coords); // geometryCoords
    expect(firstCall.args[2]).to.eql(false);           // fill
    expect(firstCall.args[3]).to.eql(2);              // stride
  });

  it("should readAndRender simple point", async () => {
    const settings = ImageMapLayerSettings.fromJSON(esriFeatureSampleSource);
    const featureJson = new ArcGisFeaturePBF(settings, {name: "SampleLayer"});
    const data = esriPBuffer.FeatureCollectionPBuffer.fromObject(PhillyLandmarksDataset.phillySimplePointQueryPbf);
    const geomType = ArcGisFeaturePBF.getArcGisFeatureGeometryType(PhillyLandmarksDataset.phillyMultiPathQueryPbf.queryResult.featureResult.geometryType);
    const symbolRenderer = new ArcGisSymbologyRenderer(geomType, PhillyLandmarksDataset.phillySimplePointDrawingInfo.drawingInfo.renderer);

    const featureRenderer = new ArcGisFeatureRenderer(fakeContext, symbolRenderer);
    const spy = sinon.spy(featureRenderer, "renderPointFeature");
    featureJson.readAndRender({data, exceedTransferLimit: false}, featureRenderer);
    expect(spy.calledOnce);

    // Pbf contains already the right output format expect, lets rely on that.
    const geometryCoords = PhillyLandmarksDataset.phillySimplePointQueryPbf.queryResult.featureResult.features[0].geometry.coords;
    const firstCall = spy.getCalls()[0];
    expect(firstCall.args[0]).to.eql(PhillyLandmarksDataset.phillySimplePointQueryPbf.queryResult.featureResult.features[0].geometry.lengths);          // geometryLengths
    expect(firstCall.args[1]).to.eql(geometryCoords); // geometryCoords
    expect(firstCall.args[2]).to.eql(2);              // stride
  });

});
