/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Logger } from "@itwin/core-bentley";
import { ImageMapLayerSettings } from "@itwin/core-common";
import { ArcGisGeometryReaderJSON, MapLayerFeatureInfo } from "@itwin/core-frontend";
import { assert, expect } from "chai";
import * as sinon from "sinon";
import { ArcGisFeatureMapLayerFormat } from "../../ArcGisFeature/ArcGisFeatureFormat";
import { ArcGisJsonFeatureReader } from "../../ArcGisFeature/ArcGisJsonFeatureReader";
import { ArcGisFeatureGeometryType } from "../../ArcGisFeature/ArcGisFeatureQuery";
import { fakeContext } from "./Mocks";
import { PhillyLandmarksDataset } from "./PhillyLandmarksDataset";
import { ArcGisCanvasRenderer } from "../../ArcGisFeature/ArcGisCanvasRenderer";
import { NeptuneCoastlineDataset } from "./NeptuneCoastlineDataset";
import { EsriSFS } from "../../ArcGisFeature/EsriSymbology";
import { TestUtils } from "./TestUtils";
import { ArcGisUniqueValueSymbologyRenderer } from "../../ArcGisFeature/ArcGisSymbologyRenderer";

const esriFeatureSampleSource = { name: "dummyFeatureLayer", url: "https://dummy.com", formatId: ArcGisFeatureMapLayerFormat.formatId };

const createFeatureJSON = () => {
  const settings = ImageMapLayerSettings.fromJSON(esriFeatureSampleSource);
  const featurePbf = new ArcGisJsonFeatureReader(settings, { name: "SampleLayer" });

  // Locale configuration depends on the testing machine (i.e. linux vs windows),
  // so we need to force date display to Iso to get a consistent value.
  // In real scenario, we still want dates to be displayed in end-user's locale.
  featurePbf.forceDateDisplayValueToIso = true;
  return featurePbf;
};

describe("ArcGisJsonFeatureReader", () => {

  const sandbox = sinon.createSandbox();

  afterEach(async () => {
    sandbox.restore();
  });

  it("should read FeatureInfo in JSON (phillyTransportation)", async () => {
    const featureJson = createFeatureJSON();
    // In some cases, PBF gives more floating-point precision than JSON.
    // Since I want to use the same output reference for both formats, I force a max precision of 8.
    featureJson.floatPrecision = 8;
    const results: MapLayerFeatureInfo[] = [];
    await featureJson.readFeatureInfo({ data: PhillyLandmarksDataset.phillyTransportationGetFeatureInfoQueryJson, exceedTransferLimit: false }, results);
    assert.deepEqual(results, PhillyLandmarksDataset.phillyTansportationGetFeatureInfoResultRef);
  });

  it("should read FeatureInfo in JSON (phillyAirport)", async () => {
    const settings = ImageMapLayerSettings.fromJSON(esriFeatureSampleSource);
    const featureJson = new ArcGisJsonFeatureReader(settings, { name: "SampleLayer" });
    // In some cases, PBF gives more floating-point precision than JSON.
    // Since I want to use the same output reference for both formats, I force a max precision of 8.
    featureJson.floatPrecision = 8;
    const results: MapLayerFeatureInfo[] = [];
    const data = JSON.parse(PhillyLandmarksDataset.phillyAirportGetFeatureInfoQueryJson);
    await featureJson.readFeatureInfo({ data, exceedTransferLimit: false }, results);
    assert.deepEqual(results, PhillyLandmarksDataset.phillyAirportGetFeatureInfoResultRef);
  });

  it("should deflate coordinates array", async () => {
    // Simple deflate stride = 2
    let doubleArray = [[1, 2], [3, 4]];
    let deflated: number[] = [];
    let offset = (ArcGisGeometryReaderJSON as any).deflateCoordinates(doubleArray, deflated, 2, 0);
    expect(offset).to.equals(4);
    expect(deflated).to.eql([1, 2, 3, 4]);

    /// Check offset with stride = 2
    doubleArray = [[5, 6]];
    offset = (ArcGisGeometryReaderJSON as any).deflateCoordinates(doubleArray, deflated, 2, offset);
    expect(offset).to.equals(6);
    expect(deflated).to.eql([1, 2, 3, 4, 5, 6]);

    // Simple deflate stride = 3
    doubleArray = [[1, 2, 3], [4, 5, 6]];
    deflated = [];
    offset = (ArcGisGeometryReaderJSON as any).deflateCoordinates(doubleArray, deflated, 3, 0);
    expect(offset).to.equals(6);
    expect(deflated).to.eql([1, 2, 3, 4, 5, 6]);

    /// Check offset with stride = 3
    doubleArray = [[7, 8, 9]];
    offset = (ArcGisGeometryReaderJSON as any).deflateCoordinates(doubleArray, deflated, 3, offset);
    expect(offset).to.equals(9);
    expect(deflated).to.eql([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("should readAndRender single ring polygon feature", async () => {
    const featureJson = createFeatureJSON();

    const data = PhillyLandmarksDataset.phillySimplePolyQueryJson;

    const symbolRenderer = TestUtils.createSymbologyRenderer(data.geometryType as ArcGisFeatureGeometryType, PhillyLandmarksDataset.phillySimplePolyDrawingInfo.drawingInfo.renderer);

    const featureRenderer = new ArcGisCanvasRenderer(fakeContext, symbolRenderer);
    const renderPathSpy = sinon.spy(featureRenderer, "renderPath");
    await featureJson.readAndRender({ data, exceedTransferLimit: false }, featureRenderer);
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

    const symbolRenderer = TestUtils.createSymbologyRenderer(data.geometryType as ArcGisFeatureGeometryType, PhillyLandmarksDataset.phillySimplePolyDrawingInfo.drawingInfo.renderer);

    const featureRenderer = new ArcGisCanvasRenderer(fakeContext, symbolRenderer);
    const renderPathSpy = sinon.spy(featureRenderer, "renderPath");
    await featureJson.readAndRender({ data, exceedTransferLimit: false }, featureRenderer);
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
    const symbolRenderer = TestUtils.createSymbologyRenderer(data.geometryType as ArcGisFeatureGeometryType,
      PhillyLandmarksDataset.phillySimpleLineDrawingInfo.drawingInfo.renderer);

    const featureRenderer = new ArcGisCanvasRenderer(fakeContext, symbolRenderer);
    const renderPathSpy = sinon.spy(featureRenderer, "renderPath");
    await featureJson.readAndRender({ data, exceedTransferLimit: false }, featureRenderer);
    expect(renderPathSpy.calledOnce);

    const geometryCoords = [360, 491, -2, -1, -1, 0, -1, 0, -1, 0, -1, 1, -4, 1, -10, 2, -15, 3, -1, 0, -1, 0, -2, 0, -1, 0, -1, 0, -1, -1, -1, 0, -2, -1, 0, -1, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0];
    const firstCall = renderPathSpy.getCalls()[0];
    expect(firstCall.args[0]).to.eql([24]);          // geometryLengths
    expect(firstCall.args[1]).to.eql(geometryCoords); // geometryCoords
    expect(firstCall.args[2]).to.eql(false);           // fill
    expect(firstCall.args[3]).to.eql(2);              // stride
  });

  it("should readAndRender multi path", async () => {
    const featureJson = createFeatureJSON();
    const data = PhillyLandmarksDataset.phillyMultiPathQueryJson;
    const symbolRenderer = TestUtils.createSymbologyRenderer(data.geometryType as ArcGisFeatureGeometryType, PhillyLandmarksDataset.phillySimpleLineDrawingInfo.drawingInfo.renderer);

    const featureRenderer = new ArcGisCanvasRenderer(fakeContext, symbolRenderer);
    const renderPathSpy = sinon.spy(featureRenderer, "renderPath");
    await featureJson.readAndRender({ data, exceedTransferLimit: false }, featureRenderer);
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
    const symbolRenderer = TestUtils.createSymbologyRenderer(
      data.geometryType as ArcGisFeatureGeometryType,
      PhillyLandmarksDataset.phillySimplePointDrawingInfo.drawingInfo.renderer);

    const featureRenderer = new ArcGisCanvasRenderer(fakeContext, symbolRenderer);
    const spy = sinon.spy(featureRenderer, "renderPoint");
    await featureJson.readAndRender({ data, exceedTransferLimit: false }, featureRenderer);
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
    const symbolRenderer = TestUtils.createSymbologyRenderer("esriGeometryPoint", PhillyLandmarksDataset.phillySimplePointDrawingInfo.drawingInfo.renderer);

    const featureRenderer = new ArcGisCanvasRenderer(fakeContext, symbolRenderer);
    const logErrorSpy = sandbox.spy(Logger, "logError");
    await featureJson.readAndRender({ data: { test: "test" }, exceedTransferLimit: false }, featureRenderer);
    expect(logErrorSpy.calledOnce);

    logErrorSpy.resetHistory();
    await featureJson.readFeatureInfo({ data: { test: "test" }, exceedTransferLimit: false }, []);
    expect(logErrorSpy.calledOnce);

  });

  it("should call setActiveFeatureAttributes when attribute driven symbology", async () => {
    const featureJson = createFeatureJSON();
    const data = NeptuneCoastlineDataset.singlePolyJson;
    const symbolRenderer = TestUtils.createSymbologyRenderer(data.geometryType as ArcGisFeatureGeometryType, NeptuneCoastlineDataset.uniqueValueSFSDrawingInfo.drawingInfo.renderer);
    const featureRenderer = new ArcGisCanvasRenderer(fakeContext, symbolRenderer);
    const spy = sinon.spy(symbolRenderer as ArcGisUniqueValueSymbologyRenderer, "setActiveFeatureAttributes");
    await featureJson.readAndRender({ data, exceedTransferLimit: false }, featureRenderer);

    // Make sure 'setActiveFeatureAttributes' was called with the proper argument
    expect(spy.calledOnce);
    const firstCall = spy.getCalls()[0];
    expect(firstCall.args[0]).to.eql(data.features[0].attributes);
  });

  it("should apply attribute driven symbology before rendering", async () => {
    const featurePbf = createFeatureJSON();
    const data = NeptuneCoastlineDataset.singlePolyJson;
    const rendererDef = NeptuneCoastlineDataset.uniqueValueSFSDrawingInfo.drawingInfo.renderer;
    const symbolRenderer = TestUtils.createSymbologyRenderer(data.geometryType as ArcGisFeatureGeometryType, rendererDef);
    const context = fakeContext;
    const featureRenderer = new ArcGisCanvasRenderer(context, symbolRenderer);
    await featurePbf.readAndRender({ data, exceedTransferLimit: false }, featureRenderer);

    const refSymbol = EsriSFS.fromJSON(rendererDef.uniqueValueInfos[8].symbol as any);
    expect(context.fillStyle).to.eql(refSymbol.color?.toRgbaString());
  });
});
