/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Logger } from "@itwin/core-bentley";
import { ImageMapLayerSettings } from "@itwin/core-common";
import { MapLayerFeatureInfo } from "@itwin/core-frontend";
import { expect } from "chai";
import * as sinon from "sinon";
import { ArcGisFeatureMapLayerFormat } from "../../ArcGisFeature/ArcGisFeatureFormat";
import { ArcGisFeatureJSON } from "../../ArcGisFeature/ArcGisFeatureJSON";
import { ArcGisFeatureGeometryType } from "../../ArcGisFeature/ArcGisFeatureQuery";
import { ArcGisFeatureRenderer } from "../../ArcGisFeature/ArcGisFeatureRenderer";
import { ArcGisSymbologyRenderer } from "../../ArcGisFeature/ArcGisSymbologyRenderer";
import { fakeContext } from "./Mocks";
import { PhillyLandmarksDataset } from "./PhillyLandmarksDataset";

const esriFeatureSampleSource = {name: "dummyFeatureLayer", url: "https://dummy.com", formatId: ArcGisFeatureMapLayerFormat.formatId};

const createFeatureJSON =  () => {
  const settings = ImageMapLayerSettings.fromJSON(esriFeatureSampleSource);
  const featurePbf = new ArcGisFeatureJSON(settings, {name: "SampleLayer"});

  // Locale configuration depends on the testing machine (i.e. linux vs windows),
  // so we need to force date display to Iso to get a consistent value.
  // In real scenario, we still want dates to be displayed in end-user's locale.
  featurePbf.forceDateDisplayValueToIso = true;
  return featurePbf;
};

describe("ArcGisFeatureJSON", () => {

  const sandbox = sinon.createSandbox();

  afterEach(async () => {
    sandbox.restore();
  });

  it("should read FeatureInfo in JSON (phillyTansportation)", async () => {
    const settings = ImageMapLayerSettings.fromJSON(esriFeatureSampleSource);
    const featureJson = new ArcGisFeatureJSON(settings, {name: "SampleLayer"});
    // In some cases, PBF gives more floating-point precision than JSON.
    // Since I want to use the same output reference for both formats, I force a max precision of 8.
    featureJson.floatPrecision = 8;
    const results: MapLayerFeatureInfo[] = [];
    featureJson.readFeatureInfo({data: PhillyLandmarksDataset.phillyTransportationGetFeatureInfoQueryJson, exceedTransferLimit: false}, results);
    expect(JSON.stringify(results)).equals(JSON.stringify(PhillyLandmarksDataset.phillyTansportationGetFeatureInfoResultRef));
  });

  it("should read FeatureInfo in JSON (phillyAirport)", async () => {
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

  it("should deflate coordinates array", async () => {
    // Simple deflate stride = 2
    let doubleArray = [[1,2], [3,4]];
    let deflated: number[] = [];
    let offset = (ArcGisFeatureJSON as any).deflateCoordinates(doubleArray, deflated, 2, 0);
    expect(offset).to.equals(4);
    expect(deflated).to.eql([1,2,3,4]);

    /// Check offset with stride = 2
    doubleArray = [[5,6]];
    offset = (ArcGisFeatureJSON as any).deflateCoordinates(doubleArray, deflated, 2, offset);
    expect(offset).to.equals(6);
    expect(deflated).to.eql([1,2,3,4,5,6]);

    // Simple deflate stride = 3
    doubleArray = [[1,2,3], [4,5,6]];
    deflated = [];
    offset = (ArcGisFeatureJSON as any).deflateCoordinates(doubleArray, deflated, 3, 0);
    expect(offset).to.equals(6);
    expect(deflated).to.eql([1,2,3,4,5,6]);

    /// Check offset with stride = 3
    doubleArray = [[7,8,9]];
    offset = (ArcGisFeatureJSON as any).deflateCoordinates(doubleArray, deflated, 3, offset);
    expect(offset).to.equals(9);
    expect(deflated).to.eql([1,2,3,4,5,6,7,8,9]);
  });

  it("should readAndRender single ring polygon feature", async () => {
    const featureJson = createFeatureJSON();

    const data = PhillyLandmarksDataset.phillySimplePolyQueryJson;

    const symbolRenderer = new ArcGisSymbologyRenderer(data.geometryType as ArcGisFeatureGeometryType, PhillyLandmarksDataset.phillySimplePolyDrawingInfo.drawingInfo.renderer);

    const featureRenderer = new ArcGisFeatureRenderer(fakeContext, symbolRenderer);
    const renderPathSpy = sinon.spy(featureRenderer, "renderPath");
    featureJson.readAndRender({data, exceedTransferLimit: false}, featureRenderer);
    expect(renderPathSpy.calledOnce);

    const firstCall = renderPathSpy.getCalls()[0];
    expect(firstCall.args[0]).to.eql(PhillyLandmarksDataset.phillySimplePolyQueryPbf.queryResult.featureResult.features[0].geometry.lengths); // geometryLengths
    expect(firstCall.args[1]).to.eql(PhillyLandmarksDataset.phillySimplePolyQueryPbf.queryResult.featureResult.features[0].geometry.coords);              // geometryCoords
    expect(firstCall.args[2]).to.eql(true);           // fill
    expect(firstCall.args[3]).to.eql(2);              // stride
  });

  it("should readAndRender multiple ring polygon feature", async () => {
    const featureJson = createFeatureJSON();

    const data = PhillyLandmarksDataset.phillyDoubleRingPolyQueryJson;

    const symbolRenderer = new ArcGisSymbologyRenderer(data.geometryType as ArcGisFeatureGeometryType, PhillyLandmarksDataset.phillySimplePolyDrawingInfo.drawingInfo.renderer);

    const featureRenderer = new ArcGisFeatureRenderer(fakeContext, symbolRenderer);
    const renderPathSpy = sinon.spy(featureRenderer, "renderPath");
    featureJson.readAndRender({data, exceedTransferLimit: false}, featureRenderer);
    expect(renderPathSpy.calledOnce);

    const firstCall = renderPathSpy.getCalls()[0];
    expect(firstCall.args[0]).to.eql(PhillyLandmarksDataset.phillyDoubleRingPolyQueryPbf.queryResult.featureResult.features[0].geometry.lengths); // geometryLengths
    expect(firstCall.args[1]).to.eql(PhillyLandmarksDataset.phillyDoubleRingPolyQueryPbf.queryResult.featureResult.features[0].geometry.coords);              // geometryCoords
    expect(firstCall.args[2]).to.eql(true);                        // fill
    expect(firstCall.args[3]).to.eql(2);              // stride
  });

  it("should readAndRender simple path", async () => {
    const featureJson = createFeatureJSON();
    const data = PhillyLandmarksDataset.phillySimplePathQueryJson;
    const symbolRenderer = new ArcGisSymbologyRenderer(data.geometryType as ArcGisFeatureGeometryType,
      PhillyLandmarksDataset.phillySimpleLineDrawingInfo.drawingInfo.renderer);

    const featureRenderer = new ArcGisFeatureRenderer(fakeContext, symbolRenderer);
    const renderPathSpy = sinon.spy(featureRenderer, "renderPath");
    featureJson.readAndRender({data, exceedTransferLimit: false}, featureRenderer);
    expect(renderPathSpy.calledOnce);

    const geometryCoords = [360,491,-2,-1,-1,0,-1,0,-1,0,-1,1,-4,1,-10,2,-15,3,-1,0,-1,0,-2,0,-1,0,-1,0,-1,-1,-1,0,-2,-1,0,-1,-1,0,-1,0,-1,0,-1,0,-1,0,-1,0];
    const firstCall = renderPathSpy.getCalls()[0];
    expect(firstCall.args[0]).to.eql([24]);          // geometryLengths
    expect(firstCall.args[1]).to.eql(geometryCoords); // geometryCoords
    expect(firstCall.args[2]).to.eql(false);           // fill
    expect(firstCall.args[3]).to.eql(2);              // stride
  });

  it("should readAndRender multi path", async () => {
    const featureJson = createFeatureJSON();
    const data = PhillyLandmarksDataset.phillyMultiPathQueryJson;
    const symbolRenderer = new ArcGisSymbologyRenderer(data.geometryType as ArcGisFeatureGeometryType, PhillyLandmarksDataset.phillySimpleLineDrawingInfo.drawingInfo.renderer);

    const featureRenderer = new ArcGisFeatureRenderer(fakeContext, symbolRenderer);
    const renderPathSpy = sinon.spy(featureRenderer, "renderPath");
    featureJson.readAndRender({data, exceedTransferLimit: false}, featureRenderer);
    expect(renderPathSpy.calledOnce);

    // Pbf contains already the right output format expect, lets rely on that.
    const firstCall = renderPathSpy.getCalls()[0];
    expect(firstCall.args[0]).to.eql(PhillyLandmarksDataset.phillyMultiPathQueryPbf.queryResult.featureResult.features[0].geometry.lengths);
    expect(firstCall.args[1]).to.eql(PhillyLandmarksDataset.phillyMultiPathQueryPbf.queryResult.featureResult.features[0].geometry.coords);
    expect(firstCall.args[2]).to.eql(false);           // fill
    expect(firstCall.args[3]).to.eql(2);              // stride
  });

  it("should readAndRender simple point", async () => {
    const featureJson = createFeatureJSON();
    const data = PhillyLandmarksDataset.phillySimplePointQueryJson;
    const symbolRenderer = new ArcGisSymbologyRenderer(
      data.geometryType as ArcGisFeatureGeometryType,
      PhillyLandmarksDataset.phillySimplePointDrawingInfo.drawingInfo.renderer);

    const featureRenderer = new ArcGisFeatureRenderer(fakeContext, symbolRenderer);
    const spy = sinon.spy(featureRenderer, "renderPoint");
    featureJson.readAndRender({data, exceedTransferLimit: false}, featureRenderer);
    expect(spy.calledOnce);

    // Pbf contains already the right output format expect, lets rely on that.
    const geometryCoords = PhillyLandmarksDataset.phillySimplePointQueryPbf.queryResult.featureResult.features[0].geometry.coords;
    const firstCall = spy.getCalls()[0];
    expect(firstCall.args[0]).to.eql(PhillyLandmarksDataset.phillySimplePointQueryPbf.queryResult.featureResult.features[0].geometry.lengths);          // geometryLengths
    expect(firstCall.args[1]).to.eql(geometryCoords); // geometryCoords
    expect(firstCall.args[2]).to.eql(2);              // stride
  });

  it("should log error when readAndRender /  readFeatureInfo is called invalid response Data", async () => {
    const featureJson = createFeatureJSON();
    const symbolRenderer = new ArcGisSymbologyRenderer(
      "esriGeometryAny",
      PhillyLandmarksDataset.phillySimplePointDrawingInfo.drawingInfo.renderer);

    const featureRenderer = new ArcGisFeatureRenderer(fakeContext, symbolRenderer);
    const logErrorSpy = sandbox.spy(Logger, "logError");
    featureJson.readAndRender({data: {test:"test"}, exceedTransferLimit: false}, featureRenderer);
    expect(logErrorSpy.calledOnce);

    logErrorSpy.resetHistory();
    featureJson.readFeatureInfo({data: {test:"test"}, exceedTransferLimit: false}, []);
    expect(logErrorSpy.calledOnce);

  });
});
