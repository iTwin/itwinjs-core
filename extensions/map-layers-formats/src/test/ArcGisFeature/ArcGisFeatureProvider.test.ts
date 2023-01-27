/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Base64EncodedString, Cartographic, ImageMapLayerSettings, ImageSourceFormat, ServerError } from "@itwin/core-common";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { ArcGisFeatureMapLayerFormat } from "../../ArcGisFeature/ArcGisFeatureFormat";
import { ArcGisFeatureProvider } from "../../map-layers-formats";
import * as sinon from "sinon";
import { ArcGISImageryProvider, ArcGisUtilities, ImageryMapTileTree, MapLayerFeatureInfo, MapLayerImageryProviderStatus, QuadId } from "@itwin/core-frontend";
import { NewYorkDataset } from "./NewYorkDataset";
import { base64StringToUint8Array, ByteStream, Logger } from "@itwin/core-bentley";
import { ArcGisExtent, ArcGisFeatureFormat, ArcGisGeometry } from "../../ArcGisFeature/ArcGisFeatureQuery";
import { PhillyLandmarksDataset } from "./PhillyLandmarksDataset";
import { ArcGisFeatureResponse } from "../../ArcGisFeature/ArcGisFeatureResponse";
import { Point3d, Transform } from "@itwin/core-geometry";
import { ArcGisFeaturePBF } from "../../ArcGisFeature/ArcGisFeaturePBF";
import { ArcGisFeatureJSON } from "../../ArcGisFeature/ArcGisFeatureJSON";

const expect = chai.expect;
chai.use(chaiAsPromised);

const esriFeatureSampleSource = {name: "dummyFeatureLayer", url: "https://dummy.com", formatId: ArcGisFeatureMapLayerFormat.formatId};
const pngTransparent1x1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

describe("ArcGisFeatureProvider", () => {
  const sandbox = sinon.createSandbox();

  afterEach(async () => {
    sandbox.restore();
  });

  it("should initialize with valid data", async () => {

    sandbox.stub(ArcGisUtilities, "getServiceJson").callsFake(async function _(_url: string, _formatId: string, _userName?: string, _password?: string, _ignoreCache?: boolean, _requireToken?: boolean) {
      return {accessTokenRequired: false, content:NewYorkDataset.serviceCapabilities};
    });

    sandbox.stub(ArcGisFeatureProvider.prototype, "getLayerMetadata" as any).callsFake(async function _(_layerId: number) {
      return NewYorkDataset.streetsLayerCapabilities;
    });

    const settings = ImageMapLayerSettings.fromJSON(esriFeatureSampleSource);
    const provider = new ArcGisFeatureProvider(settings);
    await provider.initialize();

    expect((provider as any)._minDepthFromLod).to.equals(11);
    expect((provider as any)._maxDepthFromLod).to.equals(22);
  });

  it("should not initialize with no service metadata", async () => {

    sandbox.stub(ArcGisUtilities, "getServiceJson").callsFake(async function _(_url: string, _formatId: string, _userName?: string, _password?: string, _ignoreCache?: boolean, _requireToken?: boolean) {
      return undefined;
    });

    const settings = ImageMapLayerSettings.fromJSON(esriFeatureSampleSource);
    const provider = new ArcGisFeatureProvider(settings);

    await expect(provider.initialize()).to.be.rejectedWith(ServerError);

  });

  it("should update status when invalid token error from service", async () => {

    sandbox.stub(ArcGisUtilities, "getServiceJson").callsFake(async function _(_url: string, _formatId: string, _userName?: string, _password?: string, _ignoreCache?: boolean, _requireToken?: boolean) {
      return {accessTokenRequired: false, content:{error: {code: 499}}};
    });

    const settings = ImageMapLayerSettings.fromJSON(esriFeatureSampleSource);
    const provider = new ArcGisFeatureProvider(settings);
    const raiseEventSpy = sandbox.spy(provider.onStatusChanged, "raiseEvent");
    await provider.initialize();

    expect(provider.status).to.equals(MapLayerImageryProviderStatus.RequireAuth);
    expect(raiseEventSpy.calledOnceWith(provider)).to.be.true;
  });

  it("should throw    query capability not supported", async () => {

    sandbox.stub(ArcGisUtilities, "getServiceJson").callsFake(async function _(_url: string, _formatId: string, _userName?: string, _password?: string, _ignoreCache?: boolean, _requireToken?: boolean) {
      return {accessTokenRequired: false, content:{capabilities: "Test"}};
    });

    const settings = ImageMapLayerSettings.fromJSON(esriFeatureSampleSource);
    const provider = new ArcGisFeatureProvider(settings);
    await expect(provider.initialize()).to.be.rejectedWith(ServerError);
  });

  it("should pick the first visible sub-layer when multiple visible sub-layers", async () => {

    sandbox.stub(ArcGisUtilities, "getServiceJson").callsFake(async function _(_url: string, _formatId: string, _userName?: string, _password?: string, _ignoreCache?: boolean, _requireToken?: boolean) {
      return {accessTokenRequired: false, content: {capabilities: "Query"}};
    });

    const settings = ImageMapLayerSettings.fromJSON({
      ...esriFeatureSampleSource,
      subLayers: [{id: 0, name: "layer1", visible:true}, {id:2, name: "layer2", visible:true}]}
    );
    const provider = new ArcGisFeatureProvider(settings);
    (provider as any)._format = "JSON";
    await provider.initialize();
    expect((provider as any)._layerId ).to.equals(settings.subLayers[0].id);
  });

  it("should pick sub-layers from service metadata if none provided on layer settings", async () => {

    sandbox.stub(ArcGisUtilities, "getServiceJson").callsFake(async function _(_url: string, _formatId: string, _userName?: string, _password?: string, _ignoreCache?: boolean, _requireToken?: boolean) {
      return {accessTokenRequired: false, content: {capabilities: "Query",
        layers: [
          {
            id : 0,

          },
          {
            id : 1,
          },
        ]},
      };
    });

    sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (id: number) {
      if (id === 1 ) {
        return {defaultVisibility:true};
      }
      return undefined;
    });

    const settings = ImageMapLayerSettings.fromJSON(esriFeatureSampleSource);
    const provider = new ArcGisFeatureProvider(settings);
    (provider as any)._format = "JSON";
    await provider.initialize();
    expect((provider as any)._layerId ).to.equals(1);
    expect((provider as any)._layerMetadata ).to.eql({defaultVisibility:true});
  });

  it("should throw error if no layers in capabilities", async () => {

    sandbox.stub(ArcGisUtilities, "getServiceJson").callsFake(async function _(_url: string, _formatId: string, _userName?: string, _password?: string, _ignoreCache?: boolean, _requireToken?: boolean) {
      return {accessTokenRequired: false, content: {capabilities: "Query", layers: []}};
    });

    const settings = ImageMapLayerSettings.fromJSON(esriFeatureSampleSource);
    const provider = new ArcGisFeatureProvider(settings);
    await expect(provider.initialize()).to.be.rejectedWith(ServerError);
  });

  it("should throw if no layer metadata from service", async () => {

    const settings = ImageMapLayerSettings.fromJSON({
      ...esriFeatureSampleSource,
      subLayers: [{id: 0, name: "layer1", visible:true}, {id:2, name: "layer2", visible:true}]}
    );

    sandbox.stub(ArcGisUtilities, "getServiceJson").callsFake(async function _(_url: string, _formatId: string, _userName?: string, _password?: string, _ignoreCache?: boolean, _requireToken?: boolean) {
      return {accessTokenRequired: false, content:{capabilities: "Query"}};
    });
    sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: number) {
      return undefined;
    });

    const provider = new ArcGisFeatureProvider(settings);
    await expect(provider.initialize()).to.be.rejectedWith(ServerError);
  });

  it("should read supported supported format", async () => {

    const settings = ImageMapLayerSettings.fromJSON({
      ...esriFeatureSampleSource,
      subLayers: [{id: 0, name: "layer1", visible:true}, {id:2, name: "layer2", visible:true}]}
    );

    let getLayerMetadataStub = sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: number) {
      return {defaultVisibility:true, supportedQueryFormats:"PBF, JSON"};
    });

    const getServiceJsonStub = sandbox.stub(ArcGisUtilities, "getServiceJson").callsFake(async function _(_url: string, _formatId: string, _userName?: string, _password?: string, _ignoreCache?: boolean, _requireToken?: boolean) {
      return {accessTokenRequired: false, content: {capabilities: "Query"}};
    });

    let provider = new ArcGisFeatureProvider(settings);
    await provider.initialize();
    expect(provider.format).to.equals("JSON");

    // PBF requires 'supportsCoordinatesQuantization'
    getServiceJsonStub.restore();
    sandbox.stub(ArcGisUtilities, "getServiceJson").callsFake(async function _(_url: string, _formatId: string, _userName?: string, _password?: string, _ignoreCache?: boolean, _requireToken?: boolean) {
      return {accessTokenRequired: false, content: { currentVersion: 11, capabilities: "Query"}};
    });
    getLayerMetadataStub.restore();
    getLayerMetadataStub = sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: number) {
      return {defaultVisibility:true, supportsCoordinatesQuantization:true, supportedQueryFormats:"PBF, JSON"};
    });

    provider = new ArcGisFeatureProvider(settings);
    await provider.initialize();
    expect(provider.format).to.equals("PBF");

    getLayerMetadataStub.restore();
    getLayerMetadataStub = sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: number) {
      return {defaultVisibility:true, supportedQueryFormats:"JSON"};
    });

    getServiceJsonStub.restore();
    sandbox.stub(ArcGisUtilities, "getServiceJson").callsFake(async function _(_url: string, _formatId: string, _userName?: string, _password?: string, _ignoreCache?: boolean, _requireToken?: boolean) {
      return {accessTokenRequired: false, content: { currentVersion: 10.91, capabilities: "Query", supportsCoordinatesQuantization:true}};
    });

    provider = new ArcGisFeatureProvider(settings);
    await provider.initialize();
    expect(provider.format).to.equals("JSON");

    getLayerMetadataStub.restore();
    getLayerMetadataStub = sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: number) {
      return {defaultVisibility:true, supportedQueryFormats:"JSON"};
    });

    provider = new ArcGisFeatureProvider(settings);
    await provider.initialize();
    expect(provider.format).to.equals("JSON");

    getLayerMetadataStub.restore();
    getLayerMetadataStub = sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: number) {
      return {defaultVisibility:true, supportedQueryFormats:""};
    });

    provider = new ArcGisFeatureProvider(settings);
    await expect(provider.initialize()).to.be.rejectedWith(ServerError);
  });

  it("should compute minLod/maxLod", async () => {

    const settings = ImageMapLayerSettings.fromJSON({
      ...esriFeatureSampleSource,
      subLayers: [{id: 0, name: "layer1", visible:true}, {id:2, name: "layer2", visible:true}]}
    );

    sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: number) {
      return {
        defaultVisibility:true,
        supportedQueryFormats:"PBF, JSON",
        minScale: 600000,
        maxScale: 5000,
      };
    });

    sandbox.stub(ArcGisUtilities, "getServiceJson").callsFake(async function _(_url: string, _formatId: string, _userName?: string, _password?: string, _ignoreCache?: boolean, _requireToken?: boolean) {
      return {accessTokenRequired: false, content:{capabilities: "Query"}};
    });

    const provider = new ArcGisFeatureProvider(settings);
    await provider.initialize();

    expect((provider as any)._minDepthFromLod ).to.equals(9);
    expect((provider as any)._maxDepthFromLod ).to.equals(15);
  });

  it("should construct empty url", async () => {

    const settings = ImageMapLayerSettings.fromJSON(esriFeatureSampleSource);
    const provider = new ArcGisFeatureProvider(settings);
    const url = await provider.constructUrl(0,0,0);
    expect(url).to.equals("");

  });

  it("should construct feature query url", async () => {
    const settings = ImageMapLayerSettings.fromJSON({
      ...esriFeatureSampleSource,
      subLayers: [{id: 0, name: "layer1", visible:true}, {id:2, name: "layer2", visible:true}]}
    );

    let getLayerMetadataStub = sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: number) {
      return {
        defaultVisibility: true,
        supportedQueryFormats:"PBF, JSON",
      };
    });

    sandbox.stub(ArcGisUtilities, "getServiceJson").callsFake(async function _(_url: string, _formatId: string, _userName?: string, _password?: string, _ignoreCache?: boolean, _requireToken?: boolean) {
      return {accessTokenRequired: false, content:{currentVersion: 11, capabilities: "Query"}};
    });

    const provider = new ArcGisFeatureProvider(settings);
    await provider.initialize();

    let url = provider.constructFeatureUrl(0,0,0, "PBF");
    const extent = {
      xmin: -20037508.34,
      ymin: -20037508.33,
      xmax: 20037508.34,
      ymax: 20037508.34,
      spatialReference: {
        wkid: 102100,
        latestWkid: 3857,
      },
    };
    expect(url?.url).to.equals(`https://dummy.com/0/query?f=PBF&resultType=tile&maxRecordCountFactor=3&returnExceededLimitFeatures=false&outSR=102100&geometryType=esriGeometryEnvelope&geometry=%7B%22xmin%22%3A-20037508.34%2C%22ymin%22%3A-20037508.339999996%2C%22xmax%22%3A20037508.34%2C%22ymax%22%3A20037508.340000004%2C%22spatialReference%22%3A%7B%22wkid%22%3A102100%2C%22latestWkid%22%3A3857%7D%7D&units=esriSRUnit_Meter&inSR=102100`);
    expect(url?.envelope?.xmin).to.be.closeTo(extent.xmin, 0.01);
    expect(url?.envelope?.ymin).to.be.closeTo(extent.ymin, 0.01);
    expect(url?.envelope?.xmax).to.be.closeTo(extent.xmax, 0.01);
    expect(url?.envelope?.ymax).to.be.closeTo(extent.ymax, 0.01);
    expect(url?.envelope?.spatialReference.wkid).to.be.equal(102100);
    expect(url?.envelope?.spatialReference.latestWkid).to.be.equal(3857);

    // Now turn ON 'supportsCoordinatesQuantization' to ON
    getLayerMetadataStub.restore();
    getLayerMetadataStub = sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: number) {
      return {
        defaultVisibility: true,
        supportedQueryFormats:"PBF, JSON",
        supportsCoordinatesQuantization: true,
      };
    });

    const provider2 = new ArcGisFeatureProvider(settings);
    await provider2.initialize();
    url = provider2.constructFeatureUrl(0,0,0, "PBF");
    expect(url?.url).to.equals(`https://dummy.com/0/query?f=PBF&resultType=tile&maxRecordCountFactor=3&returnExceededLimitFeatures=false&outSR=102100&geometryType=esriGeometryEnvelope&geometry=%7B%22xmin%22%3A-20037508.34%2C%22ymin%22%3A-20037508.339999996%2C%22xmax%22%3A20037508.34%2C%22ymax%22%3A20037508.340000004%2C%22spatialReference%22%3A%7B%22wkid%22%3A102100%2C%22latestWkid%22%3A3857%7D%7D&units=esriSRUnit_Meter&inSR=102100&quantizationParameters=%7B%22mode%22%3A%22view%22%2C%22originPosition%22%3A%22upperLeft%22%2C%22tolerance%22%3A78271.516953125%2C%22extent%22%3A%7B%22xmin%22%3A-20037508.34%2C%22ymin%22%3A-20037508.339999996%2C%22xmax%22%3A20037508.34%2C%22ymax%22%3A20037508.340000004%2C%22spatialReference%22%3A%7B%22wkid%22%3A102100%2C%22latestWkid%22%3A3857%7D%7D%7D`);
    expect(url?.envelope?.xmin).to.be.closeTo(extent.xmin, 0.01);
    expect(url?.envelope?.ymin).to.be.closeTo(extent.ymin, 0.01);
    expect(url?.envelope?.xmax).to.be.closeTo(extent.xmax, 0.01);
    expect(url?.envelope?.ymax).to.be.closeTo(extent.ymax, 0.01);
    expect(url?.envelope?.spatialReference.wkid).to.be.equal(extent.spatialReference.wkid);
    expect(url?.envelope?.spatialReference.latestWkid).to.be.equal(extent.spatialReference.latestWkid);

    // Test passing an override geometry
    const overrideGeom: ArcGisGeometry = {
      type: "esriGeometryEnvelope",
      geom: {
        xmin: -50,
        ymin: -50,
        xmax: 50,
        ymax: 50,
        spatialReference: {
          wkid: 102100,
          latestWkid: 3857,
        },
      },
    };
    const provider3 = new ArcGisFeatureProvider(settings);
    await provider3.initialize();
    url = provider3.constructFeatureUrl(0,0,0, "PBF", overrideGeom);
    expect(url?.url).to.equals(`https://dummy.com/0/query?f=PBF&resultType=tile&maxRecordCountFactor=3&returnExceededLimitFeatures=false&outSR=102100&geometryType=esriGeometryEnvelope&geometry=%7B%22xmin%22%3A-50%2C%22ymin%22%3A-50%2C%22xmax%22%3A50%2C%22ymax%22%3A50%2C%22spatialReference%22%3A%7B%22wkid%22%3A102100%2C%22latestWkid%22%3A3857%7D%7D&units=esriSRUnit_Meter&inSR=102100&quantizationParameters=%7B%22mode%22%3A%22view%22%2C%22originPosition%22%3A%22upperLeft%22%2C%22tolerance%22%3A78271.516953125%2C%22extent%22%3A%7B%22xmin%22%3A-20037508.34%2C%22ymin%22%3A-20037508.339999996%2C%22xmax%22%3A20037508.34%2C%22ymax%22%3A20037508.340000004%2C%22spatialReference%22%3A%7B%22wkid%22%3A102100%2C%22latestWkid%22%3A3857%7D%7D%7D`);
    expect(url?.envelope?.xmin).to.be.closeTo((overrideGeom.geom as ArcGisExtent).xmin, 0.01);
    expect(url?.envelope?.ymin).to.be.closeTo((overrideGeom.geom as ArcGisExtent).ymin, 0.01);
    expect(url?.envelope?.xmax).to.be.closeTo((overrideGeom.geom as ArcGisExtent).xmax, 0.01);
    expect(url?.envelope?.ymax).to.be.closeTo((overrideGeom.geom as ArcGisExtent).ymax, 0.01);
    expect(url?.envelope?.spatialReference.wkid).to.be.equal(overrideGeom.geom.spatialReference.wkid);
    expect(url?.envelope?.spatialReference.latestWkid).to.be.equal(overrideGeom.geom.spatialReference.latestWkid);

    // Now test with a different tolerance value
    url = provider3.constructFeatureUrl(0,0,0, "PBF", overrideGeom, undefined, 10);
    expect(url?.url).to.equals(`https://dummy.com/0/query?f=PBF&resultType=tile&maxRecordCountFactor=3&returnExceededLimitFeatures=false&outSR=102100&geometryType=esriGeometryEnvelope&geometry=%7B%22xmin%22%3A-50%2C%22ymin%22%3A-50%2C%22xmax%22%3A50%2C%22ymax%22%3A50%2C%22spatialReference%22%3A%7B%22wkid%22%3A102100%2C%22latestWkid%22%3A3857%7D%7D&units=esriSRUnit_Meter&inSR=102100&quantizationParameters=%7B%22mode%22%3A%22view%22%2C%22originPosition%22%3A%22upperLeft%22%2C%22tolerance%22%3A78271.516953125%2C%22extent%22%3A%7B%22xmin%22%3A-20037508.34%2C%22ymin%22%3A-20037508.339999996%2C%22xmax%22%3A20037508.34%2C%22ymax%22%3A20037508.340000004%2C%22spatialReference%22%3A%7B%22wkid%22%3A102100%2C%22latestWkid%22%3A3857%7D%7D%7D&distance=782715.16953125`);
    expect(url?.envelope?.xmin).to.be.closeTo((overrideGeom.geom as ArcGisExtent).xmin, 0.01);
    expect(url?.envelope?.ymin).to.be.closeTo((overrideGeom.geom as ArcGisExtent).ymin, 0.01);
    expect(url?.envelope?.xmax).to.be.closeTo((overrideGeom.geom as ArcGisExtent).xmax, 0.01);
    expect(url?.envelope?.ymax).to.be.closeTo((overrideGeom.geom as ArcGisExtent).ymax, 0.01);
    expect(url?.envelope?.spatialReference.wkid).to.be.equal(overrideGeom.geom.spatialReference.wkid);
    expect(url?.envelope?.spatialReference.latestWkid).to.be.equal(overrideGeom.geom.spatialReference.latestWkid);

  });

  it("should log error when getFeatureInfo cannot be performed", async () => {

    const settings = ImageMapLayerSettings.fromJSON({
      ...esriFeatureSampleSource,
      subLayers: [{id: 0, name: "layer1", visible:true}, {id:2, name: "layer2", visible:true}]}
    );

    sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: number) {
      return {
        defaultVisibility:true,
        supportedQueryFormats:"PBF, JSON",
        minScale: 600000,
        maxScale: 5000,
      };
    });

    sandbox.stub(ArcGisUtilities, "getServiceJson").callsFake(async function _(_url: string, _formatId: string, _userName?: string, _password?: string, _ignoreCache?: boolean, _requireToken?: boolean) {
      return {accessTokenRequired: false, content:{currentVersion: 11, capabilities: "Query"}};
    });
    sandbox.stub(ArcGisFeatureProvider.prototype, "constructFeatureUrl").callsFake(function _(_row: number, _column: number, _zoomLevel: number, _format: ArcGisFeatureFormat, _geomOverride?: ArcGisGeometry, _outFields?: string, _tolerance?: number, _returnGeometry?: boolean) {
      return undefined;
    });

    const provider = new ArcGisFeatureProvider(settings);
    await provider.initialize();
    const featureInfos: MapLayerFeatureInfo[] = [];
    const logErrorSpy = sandbox.spy(Logger, "logError");
    await provider.getFeatureInfo(featureInfos, new QuadId(0, 0, 0), Cartographic.fromDegrees({latitude: 46, longitude:-71}), (undefined as unknown) as ImageryMapTileTree);
    expect(featureInfos.length).to.equals(0);
    expect(logErrorSpy.called).to.be.true;

  });

  it("should process data in getFeatureInfo", async () => {

    const settings = ImageMapLayerSettings.fromJSON({
      ...esriFeatureSampleSource,
      subLayers: [{id: 0, name: "layer1", visible:true}, {id:2, name: "layer2", visible:true}]}
    );

    sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: number) {
      return {
        defaultVisibility:true,
        supportedQueryFormats:"PBF, JSON",
        supportsCoordinatesQuantization:true,
        minScale: 600000,
        maxScale: 5000,
      };
    });

    sandbox.stub(ArcGisUtilities, "getServiceJson").callsFake(async function _(_url: string, _formatId: string, _userName?: string, _password?: string, _ignoreCache?: boolean, _requireToken?: boolean) {
      return {accessTokenRequired: false, content:{currentVersion: 11, capabilities: "Query"}};
    });
    sandbox.stub((ArcGISImageryProvider.prototype as any), "fetch").callsFake(async  function _(_url: URL, _options?: RequestInit) {
      const test = {
        headers: { "content-type" : "pbf"},
        arrayBuffer: async () => {
          const byteArray = Base64EncodedString.toUint8Array(PhillyLandmarksDataset.phillyTransportationGetFeatureInfoQueryEncodedPbf);
          return Promise.resolve(byteArray ? ByteStream.fromUint8Array(byteArray).arrayBuffer : undefined);
        },
        status: 200,
      } as unknown;   // By using unknown type, I can define parts of Response I really need
      return (test as Response );
    });

    const provider = new ArcGisFeatureProvider(settings);
    await provider.initialize();
    const featureInfos: MapLayerFeatureInfo[] = [];
    const logErrorSpy = sandbox.spy(Logger, "logError");
    await provider.getFeatureInfo(featureInfos, new QuadId(0, 0, 0), Cartographic.fromDegrees({latitude: 46, longitude:-71}), (undefined as unknown) as ImageryMapTileTree);
    expect(featureInfos.length).to.equals(1);
    expect(logErrorSpy.calledOnce).to.be.false;

  });

  it("should log error when exceed transfert limit", async () => {

    const settings = ImageMapLayerSettings.fromJSON({
      ...esriFeatureSampleSource,
      subLayers: [{id: 0, name: "layer1", visible:true}, {id:2, name: "layer2", visible:true}]}
    );
    sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: number) {
      return {
        defaultVisibility:true,
        supportedQueryFormats:"PBF, JSON",
        minScale: 600000,
        maxScale: 5000,
      };
    });
    sandbox.stub(ArcGisUtilities, "getServiceJson").callsFake(async function _(_url: string, _formatId: string, _userName?: string, _password?: string, _ignoreCache?: boolean, _requireToken?: boolean) {
      return {accessTokenRequired: false, content:{capabilities: "Query"}};
    });

    sandbox.stub((ArcGisFeatureResponse.prototype as any), "getResponseData").callsFake(async  function _() {
      return {exceedTransferLimit: true, data:undefined};
    });

    const provider = new ArcGisFeatureProvider(settings);
    await provider.initialize();
    const featureInfos: MapLayerFeatureInfo[] = [];
    const logErrorSpy = sandbox.spy(Logger, "logError");
    await provider.getFeatureInfo(featureInfos, new QuadId(0, 0, 0), Cartographic.fromDegrees({latitude: 46, longitude:-71}), (undefined as unknown) as ImageryMapTileTree);
    expect(featureInfos.length).to.equals(0);
    expect(logErrorSpy.calledOnce).to.be.true;

  });

  it("should log error when exceed exception thrown limit", async () => {

    const settings = ImageMapLayerSettings.fromJSON({
      ...esriFeatureSampleSource,
      subLayers: [{id: 0, name: "layer1", visible:true}, {id:2, name: "layer2", visible:true}]}
    );
    sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: number) {
      return {
        defaultVisibility:true,
        supportedQueryFormats:"PBF, JSON",
        minScale: 600000,
        maxScale: 5000,
      };
    });
    sandbox.stub(ArcGisUtilities, "getServiceJson").callsFake(async function _(_url: string, _formatId: string, _userName?: string, _password?: string, _ignoreCache?: boolean, _requireToken?: boolean) {
      return {accessTokenRequired: false, content:{capabilities: "Query"}};
    });

    sandbox.stub((ArcGisFeatureResponse.prototype as any), "getResponseData").callsFake(async  function _() {
      throw new Error();
    });

    const provider = new ArcGisFeatureProvider(settings);
    await provider.initialize();
    const featureInfos: MapLayerFeatureInfo[] = [];
    const logErrorSpy = sandbox.spy(Logger, "logError");
    await provider.getFeatureInfo(featureInfos, new QuadId(0, 0, 0), Cartographic.fromDegrees({latitude: 46, longitude:-71}), (undefined as unknown) as ImageryMapTileTree);
    expect(featureInfos.length).to.equals(0);
    expect(logErrorSpy.calledOnce).to.be.true;

  });

  it("should debug Feature Geom", async () => {

    const settings = ImageMapLayerSettings.fromJSON({
      ...esriFeatureSampleSource,
      subLayers: [{id: 0, name: "layer1", visible:true}, {id:2, name: "layer2", visible:true}]}
    );
    sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: number) {
      return {
        defaultVisibility:true,
        supportedQueryFormats:"PBF, JSON",
        minScale: 600000,
        maxScale: 5000,
      };
    });
    sandbox.stub(ArcGisUtilities, "getServiceJson").callsFake(async function _(_url: string, _formatId: string, _userName?: string, _password?: string, _ignoreCache?: boolean, _requireToken?: boolean) {
      return {accessTokenRequired: false, content:{capabilities: "Query"}};
    });

    sandbox.stub((ArcGisFeatureResponse.prototype as any), "getResponseData").callsFake(async  function _() {
      return {data: {
        toObject: () => undefined,
      }};
    });

    const provider = new ArcGisFeatureProvider(settings);
    await provider.initialize();
    (provider as any)._debugFeatureGeom = true;
    const featureInfos: MapLayerFeatureInfo[] = [];
    const logInfoSpy = sandbox.spy(Logger, "logInfo");
    await provider.getFeatureInfo(featureInfos, new QuadId(0, 0, 0), Cartographic.fromDegrees({latitude: 46, longitude:-71}), (undefined as unknown) as ImageryMapTileTree);
    expect(featureInfos.length).to.equals(0);
    expect(logInfoSpy.callCount).to.equals(2);

  });

  it("should compute computeTileWorld2CanvasTransform", async () => {
    const settings = ImageMapLayerSettings.fromJSON({
      ...esriFeatureSampleSource,
      subLayers: [{id: 0, name: "layer1", visible:true}, {id:2, name: "layer2", visible:true}]}
    );
    const worldSize = 100;
    const canvasSize = 10;

    const provider = new ArcGisFeatureProvider(settings);
    const getEPSG3857ExtentStub = sandbox.stub(ArcGisFeatureProvider.prototype, "getEPSG3857Extent").callsFake(function (_row: number, _column: number, _zoomLevel: number) {
      return { left:0, right:worldSize, bottom:0, top:worldSize };
    });

    sandbox.stub(provider, "tileSize").get(function () {
      return canvasSize;  // return a size of 10 to simplicity
    });
    let transform = ((provider as any).computeTileWorld2CanvasTransform(0,0,0) as Transform | undefined);
    let worldPoint = Point3d.createFrom({x: worldSize*0.5, y:worldSize*0.5, z:0});
    let transformedPoint = transform?.multiplyPoint3d(worldPoint);

    // Make sure center point remains in the center
    expect(transformedPoint).to.not.undefined;
    expect(transformedPoint!.x).to.equals(canvasSize*0.5);
    expect(transformedPoint!.y).to.equals(canvasSize*0.5);
    expect(transformedPoint!.z).to.equals(0);

    // Check that y-axis get flipped
    worldPoint = Point3d.createFrom({x: 0, y:10, z:0});
    transformedPoint = transform?.multiplyPoint3d(worldPoint);
    expect(transformedPoint!.x).to.equals(0);
    expect(transformedPoint!.y).to.equals(9);
    expect(transformedPoint!.z).to.equals(0);

    // Now check translation has been applied (origin shift)
    getEPSG3857ExtentStub.restore();
    sandbox.stub(ArcGisFeatureProvider.prototype, "getEPSG3857Extent").callsFake(function (_row: number, _column: number, _zoomLevel: number) {
      return { left:worldSize, right:worldSize*2, bottom:worldSize, top:worldSize*2 };
    });
    worldPoint = Point3d.createFrom({x: worldSize, y:worldSize, z:0});
    transform = ((provider as any).computeTileWorld2CanvasTransform(0,0,0) as Transform | undefined);
    transformedPoint = transform?.multiplyPoint3d(worldPoint);
    expect(transformedPoint).to.not.undefined;
    expect(transformedPoint!.x).to.equals(0);
    expect(transformedPoint!.y).to.equals(10);
    expect(transformedPoint!.z).to.equals(0);

  });

  it("should loadTile from PBF request", async () => {
    const settings = ImageMapLayerSettings.fromJSON({
      ...esriFeatureSampleSource,
      subLayers: [{id: 0, name: "layer1", visible:true}, {id:2, name: "layer2", visible:true}]}
    );
    sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: number) {
      return {
        defaultVisibility:true,
        supportedQueryFormats:"PBF",
        supportsCoordinatesQuantization:true,
      };
    });
    sandbox.stub(ArcGisUtilities, "getServiceJson").callsFake(async function _(_url: string, _formatId: string, _userName?: string, _password?: string, _ignoreCache?: boolean, _requireToken?: boolean) {
      return {accessTokenRequired: false, content:{currentVersion: 11, capabilities: "Query"}};
    });
    sandbox.stub(HTMLCanvasElement.prototype, "getContext").callsFake( function _(_contextId: any, _options?: any) {
      return {} as RenderingContext;
    });

    sandbox.stub(HTMLCanvasElement.prototype, "toDataURL").callsFake( function _(_type?: string, _quality?: any) {
      return `data:image/png;base64,${pngTransparent1x1}`;
    });

    const providerStub = sandbox.stub((ArcGisFeatureProvider.prototype as any), "fetchTile").callsFake(async  function _() {
      return new ArcGisFeatureResponse("PBF", Promise.resolve({} as Response));
    });

    sandbox.stub((ArcGisFeatureResponse.prototype as any), "getResponseData").callsFake(async  function _() {
      return {
        exceedTransferLimit: false,
        data: {toObject: () => undefined},
      };
    });

    //    toDataURL string;
    const readAndRenderSpy = sandbox.spy(ArcGisFeaturePBF.prototype, "readAndRender");
    const computeTransfoSpy = sandbox.spy(ArcGisFeatureProvider.prototype as any, "computeTileWorld2CanvasTransform");
    const provider = new ArcGisFeatureProvider(settings);
    await provider.initialize();
    const tileData = await provider.loadTile(0,0,0);
    expect (tileData).to.not.undefined;
    expect (tileData?.data instanceof Uint8Array).to.be.true;
    expect(tileData?.data).to.eqls(base64StringToUint8Array(pngTransparent1x1));
    expect(tileData?.format).to.equals(ImageSourceFormat.Png);
    expect (providerStub.calledOnce).to.be.true;
    expect (readAndRenderSpy.calledOnce).to.be.true;
    expect (computeTransfoSpy.calledOnce).to.be.false; // Should not be called since we have supportsCoordinatesQuantization in layer metadata

  });

  it("should loadTile from JSON request", async () => {
    const settings = ImageMapLayerSettings.fromJSON({
      ...esriFeatureSampleSource,
      subLayers: [{id: 0, name: "layer1", visible:true}, {id:2, name: "layer2", visible:true}]}
    );
    sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: number) {
      return {
        defaultVisibility:true,
        supportedQueryFormats:"JSON",
      };
    });
    sandbox.stub(ArcGisUtilities, "getServiceJson").callsFake(async function _(_url: string, _formatId: string, _userName?: string, _password?: string, _ignoreCache?: boolean, _requireToken?: boolean) {
      return {accessTokenRequired: false, content:{capabilities: "Query"}};
    });
    sandbox.stub(HTMLCanvasElement.prototype, "getContext").callsFake( function _(_contextId: any, _options?: any) {
      return {} as RenderingContext;
    });

    sandbox.stub(HTMLCanvasElement.prototype, "toDataURL").callsFake( function _(_type?: string, _quality?: any) {
      return `data:image/png;base64,${pngTransparent1x1}`;
    });

    const providerStub = sandbox.stub((ArcGisFeatureProvider.prototype as any), "fetchTile").callsFake(async  function _() {
      return new ArcGisFeatureResponse("JSON", Promise.resolve({} as Response));
    });

    sandbox.stub((ArcGisFeatureResponse.prototype as any), "getResponseData").callsFake(async  function _() {
      return {
        exceedTransferLimit: false,
        data: {toObject: () => undefined},
      };
    });

    const readAndRenderSpy = sandbox.spy(ArcGisFeatureJSON.prototype, "readAndRender");
    const computeTransfoSpy = sandbox.spy(ArcGisFeatureProvider.prototype as any, "computeTileWorld2CanvasTransform");
    const provider = new ArcGisFeatureProvider(settings);
    await provider.initialize();
    const tileData = await provider.loadTile(0,0,0);
    expect (tileData).to.not.undefined;
    expect (tileData?.data instanceof Uint8Array).to.be.true;
    expect(tileData?.data).to.eqls(base64StringToUint8Array(pngTransparent1x1));
    expect(tileData?.format).to.equals(ImageSourceFormat.Png);
    expect (providerStub.calledOnce).to.be.true;
    expect (readAndRenderSpy.calledOnce).to.be.true;
    expect (computeTransfoSpy.calledOnce).to.be.true; // Should be called since we dont have _supportsCoordinatesQuantization in layer metadata
  });

  it("should make sub request if loadtile request return 'exceedTransferLimit'", async () => {
    const settings = ImageMapLayerSettings.fromJSON({
      ...esriFeatureSampleSource,
      subLayers: [{id: 0, name: "layer1", visible:true}, {id:2, name: "layer2", visible:true}]}
    );
    sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: number) {
      return {
        defaultVisibility:true,
        supportedQueryFormats:"JSON",
      };
    });
    sandbox.stub(ArcGisUtilities, "getServiceJson").callsFake(async function _(_url: string, _formatId: string, _userName?: string, _password?: string, _ignoreCache?: boolean, _requireToken?: boolean) {
      return {accessTokenRequired: false, content:{capabilities: "Query"}};
    });
    sandbox.stub(HTMLCanvasElement.prototype, "getContext").callsFake( function _(_contextId: any, _options?: any) {
      return {} as RenderingContext;
    });

    sandbox.stub(HTMLCanvasElement.prototype, "toDataURL").callsFake( function _(_type?: string, _quality?: any) {
      return `data:image/png;base64,${pngTransparent1x1}`;
    });

    const extentSize = 100;
    const fetchTileStub = sandbox.stub((ArcGisFeatureProvider.prototype as any), "fetchTile").callsFake(async  function _() {
      const envelope: ArcGisExtent = {
        xmin : 0,
        ymin : 0,
        xmax : extentSize,
        ymax : extentSize,
        spatialReference : {
          wkid : 102100,
          latestWkid : 3857,
        }};
      return new ArcGisFeatureResponse("JSON", Promise.resolve({} as Response), envelope);
    });

    let firstCall = true;
    sandbox.stub((ArcGisFeatureResponse.prototype as any), "getResponseData").callsFake(async  function _() {

      const exceed = firstCall === true;
      firstCall = false;
      return {
        exceedTransferLimit: exceed,
        data: {toObject: () => undefined},
      };
    });

    const readAndRenderSpy = sandbox.spy(ArcGisFeatureJSON.prototype, "readAndRender");
    const provider = new ArcGisFeatureProvider(settings);
    await provider.initialize();
    await provider.loadTile(0,0,0);

    // We should have 5 calls:
    // Call #1 : initial call for 0,0,0 and it returns 'exceedTransferLimit'
    // Calls #2-5: Four calls which represent a call for each sub-envelope (initial extent divided by 4)
    expect (fetchTileStub.getCalls().length).to.equals(5);
    expect (fetchTileStub.getCalls()[1].args[3]).to.eqls( {
      xmin : 0, ymin : 0, xmax : extentSize*0.5, ymax : extentSize*0.5,
      spatialReference : { wkid : 102100, latestWkid : 3857,
      }});
    expect (fetchTileStub.getCalls()[2].args[3]).to.eqls( {
      xmin : 0, ymin : extentSize*0.5, xmax : extentSize*0.5, ymax : extentSize,
      spatialReference : { wkid : 102100, latestWkid : 3857,
      }});
    expect (fetchTileStub.getCalls()[3].args[3]).to.eqls( {
      xmin : extentSize*0.5, ymin : 0, xmax : extentSize, ymax : extentSize*0.5,
      spatialReference : { wkid : 102100, latestWkid : 3857,
      }});
    expect (fetchTileStub.getCalls()[4].args[3]).to.eqls( {
      xmin : extentSize*0.5, ymin : extentSize*0.5, xmax : extentSize, ymax : extentSize,
      spatialReference : { wkid : 102100, latestWkid : 3857,
      }});
    expect (readAndRenderSpy.getCalls().length).to.equals(4);
  });

  it("fetchTile should return undefined when to format defined", async () => {

    const settings = ImageMapLayerSettings.fromJSON({
      ...esriFeatureSampleSource,
      subLayers: [{id: 0, name: "layer1", visible:true}, {id:2, name: "layer2", visible:true}]}
    );

    const provider = new ArcGisFeatureProvider(settings);
    // make a first request with init, should return undefined because of missing format
    const tileData = await (provider as any).fetchTile(0,0,0);
    expect(tileData).to.be.undefined;
  });

  it("fetchTile should call fetch with the proper URL", async () => {

    const settings = ImageMapLayerSettings.fromJSON({
      ...esriFeatureSampleSource,
      subLayers: [{id: 0, name: "layer1", visible:true}, {id:2, name: "layer2", visible:true}]}
    );

    sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: number) {
      return {
        defaultVisibility:true,
        supportedQueryFormats:"JSON",
      };
    });
    sandbox.stub(ArcGisUtilities, "getServiceJson").callsFake(async function _(_url: string, _formatId: string, _userName?: string, _password?: string, _ignoreCache?: boolean, _requireToken?: boolean) {
      return {accessTokenRequired: false, content:{capabilities: "Query"}};
    });
    const fetchStub = sandbox.stub((ArcGISImageryProvider.prototype as any), "fetch");

    sandbox.stub(ArcGisFeatureProvider.prototype, "constructFeatureUrl").callsFake(function _(_row: number, _column: number, _zoomLevel: number, _format: ArcGisFeatureFormat, _geomOverride?: ArcGisGeometry, _outFields?: string, _tolerance?: number, _returnGeometry?: boolean) {
      return {url: settings.url};
    });

    const provider = new ArcGisFeatureProvider(settings);
    await provider.initialize();
    const response = await (provider as any).fetchTile(0,0,0);
    expect(response).to.not.undefined;
    expect(fetchStub.calledOnce).to.be.true;
    const test1 = fetchStub.getCall(0).firstArg;
    expect(test1.toString()).to.equals(new URL(settings.url).toString());

  });

});
