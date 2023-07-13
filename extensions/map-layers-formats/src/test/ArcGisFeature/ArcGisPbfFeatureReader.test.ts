/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Base64EncodedString, ImageMapLayerSettings } from "@itwin/core-common";
import { MapLayerFeatureInfo } from "@itwin/core-frontend";
import { assert, expect } from "chai";
import * as sinon from "sinon";
import { ArcGisPbfFeatureReader } from "../../ArcGisFeature/ArcGisPbfFeatureReader";
import { ArcGisCanvasRenderer } from "../../ArcGisFeature/ArcGisCanvasRenderer";
import { esriPBuffer } from "../../ArcGisFeature/esriPBuffer.gen";
import { esriFeatureSampleSource, fakeContext } from "./Mocks";
import { PhillyLandmarksDataset } from "./PhillyLandmarksDataset";
import { NeptuneCoastlineDataset } from "./NeptuneCoastlineDataset";
import { EsriSFS } from "../../ArcGisFeature/EsriSymbology";
import { TestUtils } from "./TestUtils";
import { ArcGisUniqueValueSymbologyRenderer } from "../../ArcGisFeature/ArcGisSymbologyRenderer";

const createFeaturePBF = () => {
  const settings = ImageMapLayerSettings.fromJSON(esriFeatureSampleSource);
  const featurePbf = new ArcGisPbfFeatureReader(settings, { name: "SampleLayer" });

  // Locale configuration depends on the testing machine (i.e. linux vs windows),
  // so we need to force date display to Iso to get a consistent value.
  // In real scenario, we still want dates to be displayed in end-user's locale.
  featurePbf.forceDateDisplayValueToIso = true;
  return featurePbf;
};

describe("ArcGisPbfFeatureReader", () => {

  const sandbox = sinon.createSandbox();

  afterEach(async () => {
    sandbox.restore();
  });

  it("should convert pbf geometry type to Esri types", async () => {

    expect(
      ArcGisPbfFeatureReader.getArcGisFeatureGeometryType(esriPBuffer.FeatureCollectionPBuffer.GeometryType.esriGeometryTypeMultipatch))
      .to.equals("esriGeometryMultiPatch");

    expect(
      ArcGisPbfFeatureReader.getArcGisFeatureGeometryType(esriPBuffer.FeatureCollectionPBuffer.GeometryType.esriGeometryTypeMultipoint))
      .to.equals("esriGeometryMultipoint");

    expect(
      ArcGisPbfFeatureReader.getArcGisFeatureGeometryType(esriPBuffer.FeatureCollectionPBuffer.GeometryType.esriGeometryTypePoint))
      .to.equals("esriGeometryPoint");

    expect(
      ArcGisPbfFeatureReader.getArcGisFeatureGeometryType(esriPBuffer.FeatureCollectionPBuffer.GeometryType.esriGeometryTypePolygon))
      .to.equals("esriGeometryPolygon");

    expect(
      ArcGisPbfFeatureReader.getArcGisFeatureGeometryType(esriPBuffer.FeatureCollectionPBuffer.GeometryType.esriGeometryTypePolyline))
      .to.equals("esriGeometryPolyline");

    expect(
      ArcGisPbfFeatureReader.getArcGisFeatureGeometryType("" as unknown as esriPBuffer.FeatureCollectionPBuffer.GeometryType))
      .to.equals("esriGeometryNull");

  });

  it("should read FeatureInfo in PBF", async () => {
    const byteArray = Base64EncodedString.toUint8Array(PhillyLandmarksDataset.phillyAirportGetFeatureInfoQueryPbf);
    const featureCollection = esriPBuffer.FeatureCollectionPBuffer.deserialize(byteArray);

    const settings = ImageMapLayerSettings.fromJSON(esriFeatureSampleSource);
    const featurePbf = new ArcGisPbfFeatureReader(settings, { name: "SampleLayer" });

    // In some cases, PBF gives more floating-point precision than JSON.
    // Since I want to use the same output reference for both formats, I force a max precision of 8.
    featurePbf.floatPrecision = 8;
    const results: MapLayerFeatureInfo[] = [];
    await featurePbf.readFeatureInfo({ data: featureCollection, exceedTransferLimit: false }, results);
    assert.deepEqual(results, PhillyLandmarksDataset.phillyAirportGetFeatureInfoResultRef);

  });

  it("should read FeatureInfo from PBF (philly transportation)", async () => {

    const byteArray = Base64EncodedString.toUint8Array(PhillyLandmarksDataset.phillyTransportationGetFeatureInfoQueryEncodedPbf);
    const featureCollection = esriPBuffer.FeatureCollectionPBuffer.deserialize(byteArray);
    const featurePbf = createFeaturePBF();

    // In some cases, PBF gives more floating-point precision than JSON.
    // Since I want to use the same output reference for both formats, I force a max precision.
    featurePbf.floatPrecision = 2;
    const results: MapLayerFeatureInfo[] = [];
    await featurePbf.readFeatureInfo({ data: featureCollection, exceedTransferLimit: false }, results);
    assert.deepEqual(results, PhillyLandmarksDataset.phillyTansportationGetFeatureInfoResultRef);

  });

  it("should read all data types from FeatureInfo ", async () => {

    // In this test we use a synthetic PBuffer object to initialize a feature collection object.
    // The is to ensure we cover correctly all possible attribute value types.
    const featureCollection = esriPBuffer.FeatureCollectionPBuffer.fromObject(PhillyLandmarksDataset.fieldsCoveragePbufferCollection);

    const featurePbf = createFeaturePBF();

    const results: MapLayerFeatureInfo[] = [];
    await featurePbf.readFeatureInfo({ data: featureCollection, exceedTransferLimit: false }, results);

    assert.deepEqual(results, PhillyLandmarksDataset.fieldsCoverageGetFeatureInfoResultRef);
  });

  it("should readAndRender single ring polygon feature", async () => {
    const featurePbf = createFeaturePBF();

    const data = esriPBuffer.FeatureCollectionPBuffer.fromObject(PhillyLandmarksDataset.phillySimplePolyQueryPbf);
    const geomType = ArcGisPbfFeatureReader.getArcGisFeatureGeometryType(PhillyLandmarksDataset.phillySimplePolyQueryPbf.queryResult.featureResult.geometryType);
    const symbolRenderer = TestUtils.createSymbologyRenderer(geomType, PhillyLandmarksDataset.phillySimplePolyDrawingInfo.drawingInfo.renderer);

    const featureRenderer = new ArcGisCanvasRenderer(fakeContext, symbolRenderer);
    const renderPathSpy = sinon.spy(featureRenderer, "renderPath");
    await featurePbf.readAndRender({ data, exceedTransferLimit: false }, featureRenderer);
    expect(renderPathSpy.calledOnce);

    const firstCall = renderPathSpy.getCalls()[0];
    expect(firstCall.args[0]).to.eql(PhillyLandmarksDataset.phillySimplePolyQueryPbf.queryResult.featureResult.features[0].geometry.lengths); // geometryLengths
    expect(firstCall.args[1]).to.eql(PhillyLandmarksDataset.phillySimplePolyQueryPbf.queryResult.featureResult.features[0].geometry.coords);              // geometryCoords
    expect(firstCall.args[2]).to.eql(true);           // fill
    expect(firstCall.args[3]).to.eql(2);              // stride
  });

  it("should readAndRender multiple ring polygon feature", async () => {
    const featurePbf = createFeaturePBF();

    const geomType = ArcGisPbfFeatureReader.getArcGisFeatureGeometryType(PhillyLandmarksDataset.phillyDoubleRingPolyQueryPbf.queryResult.featureResult.geometryType);
    const data = esriPBuffer.FeatureCollectionPBuffer.fromObject(PhillyLandmarksDataset.phillyDoubleRingPolyQueryPbf);

    const symbolRenderer = TestUtils.createSymbologyRenderer(geomType, PhillyLandmarksDataset.phillySimplePolyDrawingInfo.drawingInfo.renderer);

    const featureRenderer = new ArcGisCanvasRenderer(fakeContext, symbolRenderer);
    const renderPathSpy = sinon.spy(featureRenderer, "renderPath");
    await featurePbf.readAndRender({ data, exceedTransferLimit: false }, featureRenderer);
    expect(renderPathSpy.calledOnce);

    const firstCall = renderPathSpy.getCalls()[0];
    expect(firstCall.args[0]).to.eql(PhillyLandmarksDataset.phillyDoubleRingPolyQueryPbf.queryResult.featureResult.features[0].geometry.lengths); // geometryLengths
    expect(firstCall.args[1]).to.eql(PhillyLandmarksDataset.phillyDoubleRingPolyQueryPbf.queryResult.featureResult.features[0].geometry.coords);              // geometryCoords
    expect(firstCall.args[2]).to.eql(true);                        // fill
    expect(firstCall.args[3]).to.eql(2);              // stride
  });

  it("should readAndRender simple path", async () => {
    const featurePbf = createFeaturePBF();
    const data = esriPBuffer.FeatureCollectionPBuffer.fromObject(PhillyLandmarksDataset.phillySimplePathQueryPbf);
    const symbolRenderer = TestUtils.createSymbologyRenderer(
      ArcGisPbfFeatureReader.getArcGisFeatureGeometryType(PhillyLandmarksDataset.phillySimplePathQueryPbf.queryResult.featureResult.geometryType),
      PhillyLandmarksDataset.phillySimpleLineDrawingInfo.drawingInfo.renderer);

    const featureRenderer = new ArcGisCanvasRenderer(fakeContext, symbolRenderer);
    const renderPathSpy = sinon.spy(featureRenderer, "renderPath");
    await featurePbf.readAndRender({ data, exceedTransferLimit: false }, featureRenderer);
    expect(renderPathSpy.calledOnce);

    const firstCall = renderPathSpy.getCalls()[0];
    expect(firstCall).to.not.undefined;
    expect(firstCall.args[0]).to.eql(PhillyLandmarksDataset.phillySimplePathQueryPbf.queryResult.featureResult.features[0].geometry.lengths);          // geometryLengths
    expect(firstCall.args[1]).to.eql(PhillyLandmarksDataset.phillySimplePathQueryPbf.queryResult.featureResult.features[0].geometry.coords); // geometryCoords
    expect(firstCall.args[2]).to.eql(false);           // fill
    expect(firstCall.args[3]).to.eql(2);              // stride
  });

  it("should readAndRender multi path", async () => {
    const featurePbf = createFeaturePBF();
    const data = esriPBuffer.FeatureCollectionPBuffer.fromObject(PhillyLandmarksDataset.phillyMultiPathQueryPbf);
    const geomType = ArcGisPbfFeatureReader.getArcGisFeatureGeometryType(PhillyLandmarksDataset.phillyMultiPathQueryPbf.queryResult.featureResult.geometryType);
    const symbolRenderer = TestUtils.createSymbologyRenderer(geomType, PhillyLandmarksDataset.phillySimpleLineDrawingInfo.drawingInfo.renderer);
    const featureRenderer = new ArcGisCanvasRenderer(fakeContext, symbolRenderer);
    const renderPathSpy = sinon.spy(featureRenderer, "renderPath");
    await featurePbf.readAndRender({ data, exceedTransferLimit: false }, featureRenderer);
    expect(renderPathSpy.calledOnce);

    const firstCall = renderPathSpy.getCalls()[0];
    expect(firstCall.args[0]).to.eql(PhillyLandmarksDataset.phillyMultiPathQueryPbf.queryResult.featureResult.features[0].geometry.lengths);          // geometryLengths
    expect(firstCall.args[1]).to.eql(PhillyLandmarksDataset.phillyMultiPathQueryPbf.queryResult.featureResult.features[0].geometry.coords); // geometryCoords
    expect(firstCall.args[2]).to.eql(false);           // fill
    expect(firstCall.args[3]).to.eql(2);              // stride
  });

  it("should readAndRender simple point", async () => {
    const featurePbf = createFeaturePBF();
    const data = esriPBuffer.FeatureCollectionPBuffer.fromObject(PhillyLandmarksDataset.phillySimplePointQueryPbf);
    const geomType = ArcGisPbfFeatureReader.getArcGisFeatureGeometryType(PhillyLandmarksDataset.phillyMultiPathQueryPbf.queryResult.featureResult.geometryType);
    const symbolRenderer = TestUtils.createSymbologyRenderer(geomType, PhillyLandmarksDataset.phillySimplePointDrawingInfo.drawingInfo.renderer);

    const featureRenderer = new ArcGisCanvasRenderer(fakeContext, symbolRenderer);
    const spy = sinon.spy(featureRenderer, "renderPoint");
    await featurePbf.readAndRender({ data, exceedTransferLimit: false }, featureRenderer);
    expect(spy.calledOnce);

    // Pbf contains already the right output format expect, lets rely on that.
    const geometryCoords = PhillyLandmarksDataset.phillySimplePointQueryPbf.queryResult.featureResult.features[0].geometry.coords;
    const firstCall = spy.getCalls()[0];
    expect(firstCall.args[0]).to.eql(PhillyLandmarksDataset.phillySimplePointQueryPbf.queryResult.featureResult.features[0].geometry.lengths);          // geometryLengths
    expect(firstCall.args[1]).to.eql(geometryCoords); // geometryCoords
    expect(firstCall.args[2]).to.eql(2);              // stride
  });

  it("should call setActiveFeatureAttributes when attribute driven symbology", async () => {
    const featurePbf = createFeaturePBF();
    const dataset = NeptuneCoastlineDataset.singlePolyPbf;
    const data = esriPBuffer.FeatureCollectionPBuffer.fromObject(dataset);
    const geomType = ArcGisPbfFeatureReader.getArcGisFeatureGeometryType(NeptuneCoastlineDataset.singlePolyPbf.queryResult.featureResult.geometryType);
    const symbolRenderer = TestUtils.createSymbologyRenderer(geomType, NeptuneCoastlineDataset.uniqueValueSFSDrawingInfo.drawingInfo.renderer) as ArcGisUniqueValueSymbologyRenderer;

    const featureRenderer = new ArcGisCanvasRenderer(fakeContext, symbolRenderer);
    const spy = sinon.spy(symbolRenderer , "setActiveFeatureAttributes");
    await featurePbf.readAndRender({ data, exceedTransferLimit: false }, featureRenderer);

    // Make sure 'setActiveFeatureAttributes' was called with the proper argument
    expect(spy.calledOnce);
    const firstCall = spy.getCalls()[0];
    const featureAttr: {[key: string]: any} = {};
    featureAttr.LU_2014 = "Open Countryside";
    expect(firstCall.args[0]).to.eql(featureAttr);
  });

  it("should apply attribute driven symbology before rendering", async () => {
    const featurePbf = createFeaturePBF();
    const dataset = NeptuneCoastlineDataset.singlePolyPbf;
    const rendererDef = NeptuneCoastlineDataset.uniqueValueSFSDrawingInfo.drawingInfo.renderer;
    const data = esriPBuffer.FeatureCollectionPBuffer.fromObject(dataset);
    const geomType = ArcGisPbfFeatureReader.getArcGisFeatureGeometryType(NeptuneCoastlineDataset.singlePolyPbf.queryResult.featureResult.geometryType);
    const symbolRenderer = TestUtils.createSymbologyRenderer(geomType, rendererDef);

    const context = fakeContext;
    const featureRenderer = new ArcGisCanvasRenderer(context, symbolRenderer);
    await featurePbf.readAndRender({ data, exceedTransferLimit: false }, featureRenderer);

    const refSymbol = EsriSFS.fromJSON(rendererDef.uniqueValueInfos[8].symbol as any);
    expect(context.fillStyle).to.eql(refSymbol.color?.toRgbaString());
  });

});
