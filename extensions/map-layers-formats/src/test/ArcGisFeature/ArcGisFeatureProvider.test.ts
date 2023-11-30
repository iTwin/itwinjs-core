/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Cartographic, ImageMapLayerSettings, ImageSourceFormat, ServerError } from "@itwin/core-common";
import * as chai from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { ArcGisFeatureMapLayerFormat } from "../../ArcGisFeature/ArcGisFeatureFormat";
import { ArcGisFeatureProvider } from "../../map-layers-formats";
import * as sinon from "sinon";
import { ArcGisGetServiceJsonArgs, ArcGisGraphicsRenderer, ArcGISImageryProvider, ArcGisUtilities, HitDetail, ImageryMapTileTree, IModelConnection, MapLayerFeatureInfo, MapLayerImageryProviderStatus, QuadId, ScreenViewport, ViewState3d } from "@itwin/core-frontend";
import { NewYorkDataset } from "./NewYorkDataset";
import { base64StringToUint8Array, Logger } from "@itwin/core-bentley";
import { ArcGisExtent, ArcGisFeatureFormat, ArcGisFeatureResultType, ArcGisGeometry } from "../../ArcGisFeature/ArcGisFeatureQuery";
import { PhillyLandmarksDataset } from "./PhillyLandmarksDataset";
import { ArcGisFeatureResponse } from "../../ArcGisFeature/ArcGisFeatureResponse";
import { Angle, Point3d, Transform, XYZProps } from "@itwin/core-geometry";
import { ArcGisPbfFeatureReader } from "../../ArcGisFeature/ArcGisPbfFeatureReader";
import { ArcGisJsonFeatureReader } from "../../ArcGisFeature/ArcGisJsonFeatureReader";
import { EsriPMS, EsriSFS, EsriSLS } from "../../ArcGisFeature/EsriSymbology";
import * as moq from "typemoq";

const expect = chai.expect;
chai.use(chaiAsPromised);

const esriFeatureSampleSource = {name: "dummyFeatureLayer", url: "https://dummy.com/SomeGuid/ArcGIS/rest/services/SomeService/FeatureServer", formatId: ArcGisFeatureMapLayerFormat.formatId};
const pngTransparent1x1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const createImodelConnection = () => {
  return {
    noGcsDefined: false,
    cartographicToSpatialFromEcef: (cartographic: Cartographic, _result?: Point3d) => {
      return Point3d.create(cartographic.longitude, cartographic.latitude, cartographic.height);
    },
    toSpatialFromGcs: async (geoPoints: XYZProps[], _datumOrGCRS?: any) => {
      return geoPoints;
    },
  } as unknown;
};
export class ViewportMock {
  public viewportMock = moq.Mock.ofType<ScreenViewport>();
  public viewMock = moq.Mock.ofType<ViewState3d>();

  public imodel = createImodelConnection();

  public get object() {
    return this.viewportMock.object;
  }

  public setup() {
    //
    this.viewMock.setup((view) => view.iModel).returns(() => this.imodel as IModelConnection);
    this.viewportMock.setup((viewport) => viewport.iModel).returns(() => this.viewMock.object.iModel);
    // this.viewportMock.setup((viewport) => viewport.displayStyle).returns(() => this.displayStyle);
  }

  public reset() {
    this.viewMock.reset();
    this.viewportMock.reset();
  }
}

function makeHitDetail(iModel: IModelConnection, viewport: ScreenViewport) {
  const hit = {
    iModel,
    viewport,
  } as unknown;

  return hit as HitDetail;
}

function stubJsonFetch(sandbox: sinon.SinonSandbox, json: string) {

  sandbox.stub((ArcGISImageryProvider.prototype as any), "fetch").callsFake(async function _(_url: unknown, _options?: unknown) {
    const test = {
      headers: { "content-type": "application/json" },
      json: async () => {
        return JSON.parse(json);
      },
      status: 200,
    } as unknown;   // By using unknown type, I can define parts of Response I really need
    return (test as Response);
  });
}

function stubGetLayerMetadata(sandbox: sinon.SinonSandbox) {
  sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: unknown) {
    return {
      defaultVisibility: true,
      supportedQueryFormats: "PBF, JSON",
      supportsCoordinatesQuantization: true,
      minScale: 600000,
      maxScale: 5000,
      geometryType : "esriGeometryPolygon",
      drawingInfo: PhillyLandmarksDataset.phillySimplePolyDrawingInfo.drawingInfo,
    };
  });
}

function stubGetServiceJson(sandbox: sinon.SinonSandbox, json: any ) {
  return sandbox.stub(ArcGisUtilities, "getServiceJson").callsFake(async function _(_args: ArcGisGetServiceJsonArgs) {
    return json;
  });
}

function getDefaultLayerMetadata() {
  return {
    defaultVisibility: true,
    supportedQueryFormats: "PBF, JSON",
    supportsCoordinatesQuantization: true,
    minScale: 600000,
    maxScale: 5000,
    geometryType : "esriGeometryPolygon",
    drawingInfo: PhillyLandmarksDataset.phillySimplePolyDrawingInfo.drawingInfo,
  };
}

async function testGetFeatureInfoGeom(sandbox: sinon.SinonSandbox, fetchStub: any, expectedPrimitiveType: string, hit: HitDetail, dataset: any, nbGraphics: number = 1) {

  const settings = ImageMapLayerSettings.fromJSON({
    ...esriFeatureSampleSource,
    subLayers: [{ id: 0, name: "layer1", visible: true }, { id: 2, name: "layer2", visible: true }],
  });

  // sandbox.resetBehavior();    // Reset default stub made by 'beforeEach'
  fetchStub.restore();  // fetch is always stubbed by default, restore and provide our own stub

  stubGetLayerMetadata(sandbox);
  stubGetServiceJson(sandbox, { accessTokenRequired: false, content: { currentVersion: 11, capabilities: "Query" } });
  stubJsonFetch(sandbox, JSON.stringify(dataset));
  const provider = new ArcGisFeatureProvider(settings);
  await provider.initialize();
  const featureInfos: MapLayerFeatureInfo[] = [];
  const logErrorSpy = sandbox.spy(Logger, "logError");
  const toSpatialfSpy = sandbox.stub((ArcGisGraphicsRenderer.prototype as any), "toSpatial").callsFake(function _(geoPoints: unknown) {
    return geoPoints;
  });

  await provider.getFeatureInfo(featureInfos, new QuadId(0, 0, 0),
    Cartographic.fromDegrees({ latitude: 46, longitude: -71 }),
    (undefined as unknown) as ImageryMapTileTree, hit);
  expect(featureInfos.length).to.equals(1);
  const info = featureInfos[0].subLayerInfos;
  if (info) {
    expect(info.length).to.equals(1);
    const features = info[0].features;
    expect(features.length).to.equals(1);
    const geometries = features[0].geometries;
    expect(geometries).to.not.undefined;
    if (geometries) {
      expect(geometries.length).to.equals(nbGraphics);
      expect(geometries[0].graphic.type).to.equals(expectedPrimitiveType);
    }

  }
  expect(logErrorSpy.calledOnce).to.be.false;
  expect(toSpatialfSpy.called).to.equals(true);
}

describe("ArcGisFeatureProvider", () => {
  const sandbox = sinon.createSandbox();
  let fetchStub: any;
  const viewportMock = new ViewportMock();

  beforeEach(async () => {
    // Make sure no call to fetch is made, other it creates leaks
    fetchStub = sandbox.stub((ArcGISImageryProvider.prototype as any), "fetch");
  });

  afterEach(async () => {
    sandbox.restore();
    viewportMock.reset();
  });

  it("should initialize with valid service metadata", async () => {

    stubGetServiceJson(sandbox, { accessTokenRequired: false, content: NewYorkDataset.serviceCapabilities });

    sandbox.stub(ArcGisFeatureProvider.prototype, "getLayerMetadata" as any).callsFake(async function _(_layerId: unknown) {
      return NewYorkDataset.streetsLayerCapabilities;
    });

    const settings = ImageMapLayerSettings.fromJSON(esriFeatureSampleSource);
    const provider = new ArcGisFeatureProvider(settings);
    await provider.initialize();

    expect((provider as any)._minDepthFromLod).to.equals(11);
    expect((provider as any)._maxDepthFromLod).to.equals(22);
  });

  it("should initialize and set cartoRange without making extra extent request", async () => {

    stubGetServiceJson(sandbox, {accessTokenRequired: false, content:NewYorkDataset.serviceCapabilities});

    sandbox.stub(ArcGisFeatureProvider.prototype, "getLayerMetadata" as any).callsFake(async function _(_layerId: unknown) {
      return NewYorkDataset.streetsLayerCapabilities;
    });

    const setCartoSpy = sandbox.spy(ArcGisFeatureProvider.prototype, "setCartoRangeFromExtentJson" as any);
    const fetchLayerExtentSpy = sandbox.spy(ArcGisFeatureProvider.prototype, "fetchLayerExtent" as any);

    const settings = ImageMapLayerSettings.fromJSON(esriFeatureSampleSource);
    const provider = new ArcGisFeatureProvider(settings);
    await provider.initialize();

    expect(setCartoSpy.called).to.be.true;

    expect(setCartoSpy.args[0][0]).to.be.equals(NewYorkDataset.streetsLayerCapabilities.extent);
    expect(fetchLayerExtentSpy.called).to.be.false;
  });

  it("should make an extra extent request when none available in layer metadata", async () => {

    stubGetServiceJson(sandbox, {accessTokenRequired: false, content:NewYorkDataset.serviceCapabilities});
    const setCartoSpy = sandbox.spy(ArcGisFeatureProvider.prototype, "setCartoRangeFromExtentJson" as any);

    const layerExtent = {...NewYorkDataset.streetsLayerCapabilities.extent};
    const fetchLayerExtentStub = sandbox.stub(ArcGisFeatureProvider.prototype, "fetchLayerExtent" as any).callsFake(async function _(_layerId: unknown) {
      return layerExtent;
    });

    const layerCapabilitiesNoExtent = {...NewYorkDataset.streetsLayerCapabilities, extent:null};
    sandbox.stub(ArcGisFeatureProvider.prototype, "getLayerMetadata" as any).callsFake(async function _(_layerId: unknown) {
      return layerCapabilitiesNoExtent;
    });

    const settings = ImageMapLayerSettings.fromJSON(esriFeatureSampleSource);
    const provider = new ArcGisFeatureProvider(settings);
    await provider.initialize();

    expect(fetchLayerExtentStub.called).to.be.true;
    expect(setCartoSpy.called).to.be.true;
    expect(setCartoSpy.args[0][0]).to.be.equals(layerExtent);
  });

  it("should make an extra extent request when none available in layer metadata", async () => {

    stubGetServiceJson(sandbox, {accessTokenRequired: false, content:NewYorkDataset.serviceCapabilities});

    const setCartoSpy = sandbox.spy(ArcGisFeatureProvider.prototype, "setCartoRangeFromExtentJson" as any);

    const layerExtent = {...NewYorkDataset.streetsLayerCapabilities.extent};
    const fetchLayerExtentStub = sandbox.stub(ArcGisFeatureProvider.prototype, "fetchLayerExtent" as any).callsFake(async function _(_layerId: unknown) {
      return layerExtent;
    });

    const layerExtentBadSrs = {...NewYorkDataset.streetsLayerCapabilities};
    layerExtentBadSrs.extent.spatialReference.wkid = 1234;
    layerExtentBadSrs.extent.spatialReference.latestWkid = 1234;
    sandbox.stub(ArcGisFeatureProvider.prototype, "getLayerMetadata" as any).callsFake(async function _(_layerId: unknown) {
      return layerExtentBadSrs;
    });

    const settings = ImageMapLayerSettings.fromJSON(esriFeatureSampleSource);
    const provider = new ArcGisFeatureProvider(settings);
    await provider.initialize();

    expect(fetchLayerExtentStub.called).to.be.true;
    expect(setCartoSpy.called).to.be.true;
    expect(setCartoSpy.args[0][0]).to.be.equals(layerExtent);
  });

  it("should set cartoRange from Extent json", async () => {

    const newYorkLayerExtent = NewYorkDataset.streetsLayerCapabilities.extent;
    const settings = ImageMapLayerSettings.fromJSON(esriFeatureSampleSource);
    const provider = new ArcGisFeatureProvider(settings);

    const west = provider.getEPSG4326Lon(newYorkLayerExtent.xmin);
    const south = provider.getEPSG4326Lat(newYorkLayerExtent.ymin);
    const east = provider.getEPSG4326Lon(newYorkLayerExtent.xmax);
    const north = provider.getEPSG4326Lat(newYorkLayerExtent.ymax);

    (provider as any).setCartoRangeFromExtentJson(newYorkLayerExtent);

    expect(provider.cartoRange).to.be.not.undefined;
    const delta = 0.0000001;
    expect(provider.cartoRange!.west * Angle.degreesPerRadian).to.approximately(west, delta);
    expect(provider.cartoRange!.south * Angle.degreesPerRadian).to.approximately(south, delta);
    expect(provider.cartoRange!.east * Angle.degreesPerRadian).to.approximately(east, delta);
    expect(provider.cartoRange!.north * Angle.degreesPerRadian).to.approximately(north, delta);

  });

  it("should compose proper request to get extent", async () => {

    fetchStub.restore();  // fetch is always stubbed by default, restore and provide our own stub
    stubGetServiceJson(sandbox, {accessTokenRequired: false, content:NewYorkDataset.serviceCapabilities});

    const layerCapabilitiesNoExtent = {...NewYorkDataset.streetsLayerCapabilities};
    sandbox.stub(ArcGisFeatureProvider.prototype, "getLayerMetadata" as any).callsFake(async function _(_layerId: unknown) {
      return layerCapabilitiesNoExtent;
    });

    const referenceExtent = {extent: NewYorkDataset.streetsLayerCapabilities.extent};
    const stub = sandbox.stub((ArcGISImageryProvider.prototype as any), "fetch").callsFake(async  function _(_url: unknown, _options?: unknown) {
      const test = {
        headers: { "content-type" : "json"},
        json: async () => {
          return referenceExtent;
        },
        status: 200,
      } as unknown;   // By using unknown type, I can define parts of Response I really need
      return (test as Response );
    });

    let layerId = 0;
    let expectedUrl = `https://dummy.com/SomeGuid/ArcGIS/rest/services/SomeService/FeatureServer/${layerId}/query?where=1%3D1&outSR=3857&returnExtentOnly=true&f=json`;
    let cachedExtent = (ArcGisFeatureProvider as any)._extentCache.get(expectedUrl);
    expect(cachedExtent).to.be.undefined;

    const settings = ImageMapLayerSettings.fromJSON(esriFeatureSampleSource);
    const provider = new ArcGisFeatureProvider(settings);
    await provider.initialize();

    let fetchExtent = await (provider as any).fetchLayerExtent();
    expect(fetchExtent).to.equals(referenceExtent.extent);
    expect(stub.getCalls().length).to.equals(1);
    expect(stub.args[0][0].toString()).to.be.equals(expectedUrl);

    // Check if entry has been created in cache
    cachedExtent = (ArcGisFeatureProvider as any)._extentCache.get(expectedUrl);
    expect(cachedExtent).to.be.not.undefined;
    expect(cachedExtent).to.equals(referenceExtent);

    // Make sure cache is used
    await (provider as any).fetchLayerExtent();
    expect(stub.getCalls().length).to.equals(1);

    // Force a different layerId, and check a new request has been made
    layerId = 2;
    expectedUrl = `https://dummy.com/SomeGuid/ArcGIS/rest/services/SomeService/FeatureServer/${layerId}/query?where=1%3D1&outSR=3857&returnExtentOnly=true&f=json`;
    cachedExtent = (ArcGisFeatureProvider as any)._extentCache.get(expectedUrl);
    expect(cachedExtent).to.be.undefined;
    (provider as any)._layerId = layerId;
    fetchExtent = await (provider as any).fetchLayerExtent();
    expect(fetchExtent).to.equals(referenceExtent.extent);
    expect(stub.getCalls().length).to.equals(2);
    expect(stub.args[1][0].toString()).to.be.equals(expectedUrl);

    // check cache has been updated with a new entry
    cachedExtent = (ArcGisFeatureProvider as any)._extentCache.get(expectedUrl);
    expect(cachedExtent).to.be.not.undefined;
    expect(cachedExtent).to.equals(referenceExtent);

  });

  it("should not initialize with no service metadata", async () => {
    stubGetServiceJson(sandbox, undefined);
    const settings = ImageMapLayerSettings.fromJSON(esriFeatureSampleSource);
    const provider = new ArcGisFeatureProvider(settings);

    await expect(provider.initialize()).to.be.rejectedWith(ServerError);

  });

  it("should update status when invalid token error from service", async () => {

    stubGetServiceJson(sandbox, { accessTokenRequired: false, content: { error: { code: 499 } } });
    const settings = ImageMapLayerSettings.fromJSON(esriFeatureSampleSource);
    const provider = new ArcGisFeatureProvider(settings);
    const raiseEventSpy = sandbox.spy(provider.onStatusChanged, "raiseEvent");
    await provider.initialize();

    expect(provider.status).to.equals(MapLayerImageryProviderStatus.RequireAuth);
    expect(raiseEventSpy.calledOnceWith(provider)).to.be.true;
  });

  it("should throw    query capability not supported", async () => {
    stubGetServiceJson(sandbox, { accessTokenRequired: false, content: { capabilities: "Test" } });

    const settings = ImageMapLayerSettings.fromJSON(esriFeatureSampleSource);
    const provider = new ArcGisFeatureProvider(settings);
    await expect(provider.initialize()).to.be.rejectedWith(ServerError);
  });

  it("should pick the first visible sub-layer when multiple visible sub-layers", async () => {
    stubGetServiceJson(sandbox, { accessTokenRequired: false, content: { capabilities: "Query" } });

    sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: unknown) {
      return getDefaultLayerMetadata();
    });

    const settings = ImageMapLayerSettings.fromJSON({
      ...esriFeatureSampleSource,
      subLayers: [{ id: 0, name: "layer1", visible: true }, { id: 2, name: "layer2", visible: true }],
    },
    );
    const provider = new ArcGisFeatureProvider(settings);
    (provider as any)._format = "JSON";
    await provider.initialize();
    expect((provider as any)._layerId).to.equals(settings.subLayers[0].id);
  });

  it("should pick sub-layers from service metadata if none provided on layer settings", async () => {

    stubGetServiceJson(sandbox, {
      accessTokenRequired: false, content: {
        capabilities: "Query",
        layers: [
          {
            id: 0,

          },
          {
            id: 1,
          },
        ],
      },
    });

    sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (id: unknown) {
      if (id === 1) {
        return getDefaultLayerMetadata();
      }
      return undefined;
    });

    const settings = ImageMapLayerSettings.fromJSON(esriFeatureSampleSource);
    const provider = new ArcGisFeatureProvider(settings);
    (provider as any)._format = "JSON";
    await provider.initialize();
    expect((provider as any)._layerId).to.equals(1);
    expect((provider as any)._layerMetadata).to.eql(getDefaultLayerMetadata());
  });

  it("should throw error if no layers in capabilities", async () => {
    stubGetServiceJson(sandbox, { accessTokenRequired: false, content: { capabilities: "Query", layers: [] } });

    const settings = ImageMapLayerSettings.fromJSON(esriFeatureSampleSource);
    const provider = new ArcGisFeatureProvider(settings);
    await expect(provider.initialize()).to.be.rejectedWith(ServerError);
  });

  it("should throw if no layer metadata from service", async () => {

    const settings = ImageMapLayerSettings.fromJSON({
      ...esriFeatureSampleSource,
      subLayers: [{ id: 0, name: "layer1", visible: true }, { id: 2, name: "layer2", visible: true }],
    },
    );

    stubGetServiceJson(sandbox, { accessTokenRequired: false, content: { capabilities: "Query" } });

    sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: unknown) {
      return undefined;
    });

    const provider = new ArcGisFeatureProvider(settings);
    await expect(provider.initialize()).to.be.rejectedWith(ServerError);
  });

  it("should read supported supported format", async () => {

    const settings = ImageMapLayerSettings.fromJSON({
      ...esriFeatureSampleSource,
      subLayers: [{ id: 0, name: "layer1", visible: true }, { id: 2, name: "layer2", visible: true }],
    },
    );

    let getLayerMetadataStub = sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: unknown) {
      return getDefaultLayerMetadata();
    });

    let getServiceJsonStub = stubGetServiceJson(sandbox, { accessTokenRequired: false, content: { capabilities: "Query" } });

    let provider = new ArcGisFeatureProvider(settings);
    await provider.initialize();
    expect(provider.format).to.equals("JSON");

    // PBF requires 'supportsCoordinatesQuantization'
    getServiceJsonStub.restore();
    getServiceJsonStub = stubGetServiceJson(sandbox, { accessTokenRequired: false, content: { currentVersion: 11, capabilities: "Query" } });

    getLayerMetadataStub.restore();
    getLayerMetadataStub = sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: unknown) {
      return getDefaultLayerMetadata();
    });

    provider = new ArcGisFeatureProvider(settings);
    await provider.initialize();
    expect(provider.format).to.equals("PBF");

    const layerMetadata = {
      defaultVisibility: true,
      geometryType : "esriGeometryPolygon",
      drawingInfo: PhillyLandmarksDataset.phillySimplePolyDrawingInfo.drawingInfo};

    getLayerMetadataStub.restore();
    getLayerMetadataStub = sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: unknown) {
      return {...layerMetadata, supportedQueryFormats: "JSON"};
    });

    getServiceJsonStub.restore();
    getServiceJsonStub = stubGetServiceJson(sandbox, { accessTokenRequired: false, content: { currentVersion: 10.91, capabilities: "Query", supportsCoordinatesQuantization: true } });

    provider = new ArcGisFeatureProvider(settings);
    await provider.initialize();
    expect(provider.format).to.equals("JSON");

    getLayerMetadataStub.restore();
    getLayerMetadataStub = sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: unknown) {
      return {...layerMetadata, supportedQueryFormats: ""};
    });

    provider = new ArcGisFeatureProvider(settings);
    await expect(provider.initialize()).to.be.rejectedWith(ServerError);
  });

  it("should compute minLod/maxLod", async () => {

    const settings = ImageMapLayerSettings.fromJSON({
      ...esriFeatureSampleSource,
      subLayers: [{ id: 0, name: "layer1", visible: true }, { id: 2, name: "layer2", visible: true }],
    },
    );

    sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: unknown) {
      return getDefaultLayerMetadata();
    });

    stubGetServiceJson(sandbox, { accessTokenRequired: false, content: { capabilities: "Query" } });

    const provider = new ArcGisFeatureProvider(settings);
    await provider.initialize();

    expect((provider as any)._minDepthFromLod).to.equals(9);
    expect((provider as any)._maxDepthFromLod).to.equals(15);
  });

  it("should construct empty url", async () => {

    const settings = ImageMapLayerSettings.fromJSON(esriFeatureSampleSource);
    const provider = new ArcGisFeatureProvider(settings);
    const url = await provider.constructUrl(0, 0, 0);
    expect(url).to.equals("");

  });

  it("should construct feature query url", async () => {
    const settings = ImageMapLayerSettings.fromJSON({
      ...esriFeatureSampleSource,
      subLayers: [{ id: 0, name: "layer1", visible: true }, { id: 2, name: "layer2", visible: true }],
    },
    );

    let getLayerMetadataStub = sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: unknown) {
      return {
        defaultVisibility: true,
        supportedQueryFormats: "PBF, JSON",
        geometryType : "esriGeometryPolygon",
        drawingInfo: PhillyLandmarksDataset.phillySimplePolyDrawingInfo.drawingInfo,
      };
    });

    stubGetServiceJson(sandbox, { accessTokenRequired: false, content: { currentVersion: 11, capabilities: "Query" } });

    const provider = new ArcGisFeatureProvider(settings);
    await provider.initialize();

    let url = provider.constructFeatureUrl(0, 0, 0, "PBF", "tile");
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
    expect(url?.url).to.equals("https://dummy.com/SomeGuid/ArcGIS/rest/services/SomeService/FeatureServer/0/query?f=PBF&resultType=tile&maxRecordCountFactor=3&returnExceededLimitFeatures=false&outSR=102100&geometryType=esriGeometryEnvelope&geometry=%7B%22xmin%22%3A-20037508.34%2C%22ymin%22%3A-20037508.339999996%2C%22xmax%22%3A20037508.34%2C%22ymax%22%3A20037508.340000004%2C%22spatialReference%22%3A%7B%22wkid%22%3A102100%2C%22latestWkid%22%3A3857%7D%7D&units=esriSRUnit_Meter&inSR=102100");
    expect(url?.envelope?.xmin).to.be.closeTo(extent.xmin, 0.01);
    expect(url?.envelope?.ymin).to.be.closeTo(extent.ymin, 0.01);
    expect(url?.envelope?.xmax).to.be.closeTo(extent.xmax, 0.01);
    expect(url?.envelope?.ymax).to.be.closeTo(extent.ymax, 0.01);
    expect(url?.envelope?.spatialReference.wkid).to.be.equal(102100);
    expect(url?.envelope?.spatialReference.latestWkid).to.be.equal(3857);

    // Now turn ON 'supportsCoordinatesQuantization' to ON
    getLayerMetadataStub.restore();
    getLayerMetadataStub = sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: unknown) {
      return getDefaultLayerMetadata();
    });

    const provider2 = new ArcGisFeatureProvider(settings);
    await provider2.initialize();
    url = provider2.constructFeatureUrl(0, 0, 0, "PBF", "tile");
    expect(url?.url).to.equals("https://dummy.com/SomeGuid/ArcGIS/rest/services/SomeService/FeatureServer/0/query?f=PBF&resultType=tile&maxRecordCountFactor=3&returnExceededLimitFeatures=false&outSR=102100&geometryType=esriGeometryEnvelope&geometry=%7B%22xmin%22%3A-20037508.34%2C%22ymin%22%3A-20037508.339999996%2C%22xmax%22%3A20037508.34%2C%22ymax%22%3A20037508.340000004%2C%22spatialReference%22%3A%7B%22wkid%22%3A102100%2C%22latestWkid%22%3A3857%7D%7D&units=esriSRUnit_Meter&inSR=102100&quantizationParameters=%7B%22mode%22%3A%22view%22%2C%22originPosition%22%3A%22upperLeft%22%2C%22tolerance%22%3A78271.516953125%2C%22extent%22%3A%7B%22xmin%22%3A-20037508.34%2C%22ymin%22%3A-20037508.339999996%2C%22xmax%22%3A20037508.34%2C%22ymax%22%3A20037508.340000004%2C%22spatialReference%22%3A%7B%22wkid%22%3A102100%2C%22latestWkid%22%3A3857%7D%7D%7D");
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
    url = provider3.constructFeatureUrl(0, 0, 0, "PBF", "tile", overrideGeom);
    expect(url?.url).to.equals("https://dummy.com/SomeGuid/ArcGIS/rest/services/SomeService/FeatureServer/0/query?f=PBF&resultType=tile&maxRecordCountFactor=3&returnExceededLimitFeatures=false&outSR=102100&geometryType=esriGeometryEnvelope&geometry=%7B%22xmin%22%3A-50%2C%22ymin%22%3A-50%2C%22xmax%22%3A50%2C%22ymax%22%3A50%2C%22spatialReference%22%3A%7B%22wkid%22%3A102100%2C%22latestWkid%22%3A3857%7D%7D&units=esriSRUnit_Meter&inSR=102100&quantizationParameters=%7B%22mode%22%3A%22view%22%2C%22originPosition%22%3A%22upperLeft%22%2C%22tolerance%22%3A78271.516953125%2C%22extent%22%3A%7B%22xmin%22%3A-20037508.34%2C%22ymin%22%3A-20037508.339999996%2C%22xmax%22%3A20037508.34%2C%22ymax%22%3A20037508.340000004%2C%22spatialReference%22%3A%7B%22wkid%22%3A102100%2C%22latestWkid%22%3A3857%7D%7D%7D");
    expect(url?.envelope?.xmin).to.be.closeTo((overrideGeom.geom as ArcGisExtent).xmin, 0.01);
    expect(url?.envelope?.ymin).to.be.closeTo((overrideGeom.geom as ArcGisExtent).ymin, 0.01);
    expect(url?.envelope?.xmax).to.be.closeTo((overrideGeom.geom as ArcGisExtent).xmax, 0.01);
    expect(url?.envelope?.ymax).to.be.closeTo((overrideGeom.geom as ArcGisExtent).ymax, 0.01);
    expect(url?.envelope?.spatialReference.wkid).to.be.equal(overrideGeom.geom.spatialReference.wkid);
    expect(url?.envelope?.spatialReference.latestWkid).to.be.equal(overrideGeom.geom.spatialReference.latestWkid);

    // Now test with a different tolerance value
    url = provider3.constructFeatureUrl(0, 0, 0, "PBF", "tile", overrideGeom, undefined, 10);
    expect(url?.url).to.equals("https://dummy.com/SomeGuid/ArcGIS/rest/services/SomeService/FeatureServer/0/query?f=PBF&resultType=tile&maxRecordCountFactor=3&returnExceededLimitFeatures=false&outSR=102100&geometryType=esriGeometryEnvelope&geometry=%7B%22xmin%22%3A-50%2C%22ymin%22%3A-50%2C%22xmax%22%3A50%2C%22ymax%22%3A50%2C%22spatialReference%22%3A%7B%22wkid%22%3A102100%2C%22latestWkid%22%3A3857%7D%7D&units=esriSRUnit_Meter&inSR=102100&quantizationParameters=%7B%22mode%22%3A%22view%22%2C%22originPosition%22%3A%22upperLeft%22%2C%22tolerance%22%3A78271.516953125%2C%22extent%22%3A%7B%22xmin%22%3A-20037508.34%2C%22ymin%22%3A-20037508.339999996%2C%22xmax%22%3A20037508.34%2C%22ymax%22%3A20037508.340000004%2C%22spatialReference%22%3A%7B%22wkid%22%3A102100%2C%22latestWkid%22%3A3857%7D%7D%7D&distance=782715.16953125");
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
      subLayers: [{ id: 0, name: "layer1", visible: true }, { id: 2, name: "layer2", visible: true }],
    },
    );

    sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: unknown) {
      return getDefaultLayerMetadata();
    });

    stubGetServiceJson(sandbox, { accessTokenRequired: false, content: { currentVersion: 11, capabilities: "Query" } });

    sandbox.stub(ArcGisFeatureProvider.prototype, "constructFeatureUrl").callsFake(function _(_row: number, _column: number, _zoomLevel: number, _format: ArcGisFeatureFormat, _resultType: ArcGisFeatureResultType, _geomOverride?: ArcGisGeometry, _outFields?: string, _tolerance?: number, _returnGeometry?: boolean) {
      return undefined;
    });

    const provider = new ArcGisFeatureProvider(settings);
    await provider.initialize();
    const featureInfos: MapLayerFeatureInfo[] = [];
    const logErrorSpy = sandbox.spy(Logger, "logError");
    await provider.getFeatureInfo(featureInfos, new QuadId(0, 0, 0), Cartographic.fromDegrees({ latitude: 46, longitude: -71 }),
      (undefined as unknown) as ImageryMapTileTree, makeHitDetail(viewportMock.imodel as IModelConnection, viewportMock.object));
    expect(featureInfos.length).to.equals(0);
    expect(logErrorSpy.called).to.be.true;

  });

  it("should process data in getFeatureInfo", async () => {

    const settings = ImageMapLayerSettings.fromJSON({
      ...esriFeatureSampleSource,
      subLayers: [{ id: 0, name: "layer1", visible: true }, { id: 2, name: "layer2", visible: true }],
    },
    );

    sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: unknown) {
      return {
        defaultVisibility: true,
        supportedQueryFormats: "PBF, JSON",
        supportsCoordinatesQuantization: true,
        minScale: 600000,
        maxScale: 5000,
        geometryType : "esriGeometryPolygon",
        drawingInfo: PhillyLandmarksDataset.phillySimplePolyDrawingInfo.drawingInfo,
      };
    });

    stubGetServiceJson(sandbox, { accessTokenRequired: false, content: { currentVersion: 11, capabilities: "Query" } });

    fetchStub.restore();  // fetch is always stubbed by default, restore and provide our own stub
    sandbox.stub((ArcGISImageryProvider.prototype as any), "fetch").callsFake(async function _(_url: unknown, _options?: unknown) {
      const test = {
        headers: { "content-type": "application/json" },
        json: async () => {
          return JSON.parse(PhillyLandmarksDataset.phillyAirportGetFeatureInfoQueryJson);
        },
        status: 200,
      } as unknown;   // By using unknown type, I can define parts of Response I really need
      return (test as Response);
    });

    const provider = new ArcGisFeatureProvider(settings);
    await provider.initialize();
    const featureInfos: MapLayerFeatureInfo[] = [];
    const logErrorSpy = sandbox.spy(Logger, "logError");
    await provider.getFeatureInfo(featureInfos, new QuadId(0, 0, 0), Cartographic.fromDegrees({ latitude: 46, longitude: -71 }),
      (undefined as unknown) as ImageryMapTileTree, makeHitDetail(viewportMock.imodel as IModelConnection, viewportMock.object));
    expect(featureInfos.length).to.equals(1);
    expect(logErrorSpy.calledOnce).to.be.false;

  });

  it("should process polygon data in getFeatureInfo (GCS)", async () => {
    await testGetFeatureInfoGeom(sandbox, fetchStub, "loop", makeHitDetail(viewportMock.imodel as IModelConnection, viewportMock.object), PhillyLandmarksDataset.phillyDoubleRingPolyQueryJson);
  });

  it("should process multi path data in getFeatureInfo (GCS)", async () => {
    await testGetFeatureInfoGeom(sandbox, fetchStub, "linestring", makeHitDetail(viewportMock.imodel as IModelConnection, viewportMock.object), PhillyLandmarksDataset.phillyMultiPathQueryJson, 2);
  });

  it("should process linestring data in getFeatureInfo (GCS)", async () => {
    await testGetFeatureInfoGeom(sandbox, fetchStub, "linestring", makeHitDetail(viewportMock.imodel as IModelConnection, viewportMock.object), PhillyLandmarksDataset.phillySimplePathQueryJson);
  });

  it("should process pointstring data in getFeatureInfo (GCS)", async () => {
    await testGetFeatureInfoGeom(sandbox, fetchStub, "pointstring", makeHitDetail(viewportMock.imodel as IModelConnection, viewportMock.object), PhillyLandmarksDataset.phillySimplePointQueryJson);
  });

  it("should log error when exceed transfer limit", async () => {

    const settings = ImageMapLayerSettings.fromJSON({
      ...esriFeatureSampleSource,
      subLayers: [{ id: 0, name: "layer1", visible: true }, { id: 2, name: "layer2", visible: true }],
    },
    );
    sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: unknown) {
      return getDefaultLayerMetadata();
    });
    stubGetServiceJson(sandbox, { accessTokenRequired: false, content: { capabilities: "Query" } });
    sandbox.stub((ArcGisFeatureResponse.prototype as any), "getResponseData").callsFake(async function _() {
      return { exceedTransferLimit: true, data: undefined };
    });

    const provider = new ArcGisFeatureProvider(settings);
    await provider.initialize();
    const featureInfos: MapLayerFeatureInfo[] = [];
    const logErrorSpy = sandbox.spy(Logger, "logError");

    await provider.getFeatureInfo(featureInfos, new QuadId(0, 0, 0), Cartographic.fromDegrees({ latitude: 46, longitude: -71 }),
      (undefined as unknown) as ImageryMapTileTree, makeHitDetail(viewportMock.imodel as IModelConnection, viewportMock.object));
    expect(featureInfos.length).to.equals(0);
    expect(logErrorSpy.calledOnce).to.be.true;

  });

  it("should log error when exceed exception thrown limit", async () => {

    const settings = ImageMapLayerSettings.fromJSON({
      ...esriFeatureSampleSource,
      subLayers: [{ id: 0, name: "layer1", visible: true }, { id: 2, name: "layer2", visible: true }],
    },
    );
    sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: unknown) {
      return getDefaultLayerMetadata();
    });
    stubGetServiceJson(sandbox, { accessTokenRequired: false, content: { capabilities: "Query" } });

    sandbox.stub((ArcGisFeatureResponse.prototype as any), "getResponseData").callsFake(async function _() {
      throw new Error();
    });

    const provider = new ArcGisFeatureProvider(settings);
    await provider.initialize();
    const featureInfos: MapLayerFeatureInfo[] = [];
    const logErrorSpy = sandbox.spy(Logger, "logError");

    await provider.getFeatureInfo(featureInfos, new QuadId(0, 0, 0), Cartographic.fromDegrees({ latitude: 46, longitude: -71 }),
      (undefined as unknown) as ImageryMapTileTree, makeHitDetail(viewportMock.imodel as IModelConnection, viewportMock.object));
    expect(featureInfos.length).to.equals(0);
    expect(logErrorSpy.calledOnce).to.be.true;
  });

  it("should debug Feature Geom", async () => {

    const settings = ImageMapLayerSettings.fromJSON({
      ...esriFeatureSampleSource,
      subLayers: [{ id: 0, name: "layer1", visible: true }, { id: 2, name: "layer2", visible: true }],
    },
    );
    sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: unknown) {
      return getDefaultLayerMetadata();
    });
    stubGetServiceJson(sandbox, { accessTokenRequired: false, content: { capabilities: "Query" } });

    sandbox.stub((ArcGisFeatureResponse.prototype as any), "getResponseData").callsFake(async function _() {
      return {
        data: {
          toObject: () => undefined,
        },
      };
    });

    const provider = new ArcGisFeatureProvider(settings);
    await provider.initialize();
    (provider as any)._debugFeatureGeom = true;
    const featureInfos: MapLayerFeatureInfo[] = [];
    const logInfoSpy = sandbox.spy(Logger, "logInfo");

    await provider.getFeatureInfo(featureInfos, new QuadId(0, 0, 0), Cartographic.fromDegrees({ latitude: 46, longitude: -71 }),
      (undefined as unknown) as ImageryMapTileTree, makeHitDetail(viewportMock.imodel as IModelConnection, viewportMock.object));
    expect(featureInfos.length).to.equals(0);
    expect(logInfoSpy.callCount).to.equals(2);
  });

  it("should compute computeTileWorld2CanvasTransform", async () => {
    const settings = ImageMapLayerSettings.fromJSON({
      ...esriFeatureSampleSource,
      subLayers: [{ id: 0, name: "layer1", visible: true }, { id: 2, name: "layer2", visible: true }],
    },
    );
    const worldSize = 100;
    const canvasSize = 10;

    const provider = new ArcGisFeatureProvider(settings);
    const getEPSG3857ExtentStub = sandbox.stub(ArcGisFeatureProvider.prototype, "getEPSG3857Extent").callsFake(function (_row: number, _column: number, _zoomLevel: number) {
      return { left: 0, right: worldSize, bottom: 0, top: worldSize };
    });

    sandbox.stub(provider, "tileSize").get(function () {
      return canvasSize;  // return a size of 10 to simplicity
    });
    let transform = ((provider as any).computeTileWorld2CanvasTransform(0, 0, 0) as Transform | undefined);
    let worldPoint = Point3d.createFrom({ x: worldSize * 0.5, y: worldSize * 0.5, z: 0 });
    let transformedPoint = transform?.multiplyPoint3d(worldPoint);

    // Make sure center point remains in the center
    expect(transformedPoint).to.not.undefined;
    expect(transformedPoint!.x).to.equals(canvasSize * 0.5);
    expect(transformedPoint!.y).to.equals(canvasSize * 0.5);
    expect(transformedPoint!.z).to.equals(0);

    // Check that y-axis get flipped
    worldPoint = Point3d.createFrom({ x: 0, y: 10, z: 0 });
    transformedPoint = transform?.multiplyPoint3d(worldPoint);
    expect(transformedPoint!.x).to.equals(0);
    expect(transformedPoint!.y).to.equals(9);
    expect(transformedPoint!.z).to.equals(0);

    // Now check translation has been applied (origin shift)
    getEPSG3857ExtentStub.restore();
    sandbox.stub(ArcGisFeatureProvider.prototype, "getEPSG3857Extent").callsFake(function (_row: number, _column: number, _zoomLevel: number) {
      return { left: worldSize, right: worldSize * 2, bottom: worldSize, top: worldSize * 2 };
    });
    worldPoint = Point3d.createFrom({ x: worldSize, y: worldSize, z: 0 });
    transform = ((provider as any).computeTileWorld2CanvasTransform(0, 0, 0) as Transform | undefined);
    transformedPoint = transform?.multiplyPoint3d(worldPoint);
    expect(transformedPoint).to.not.undefined;
    expect(transformedPoint!.x).to.equals(0);
    expect(transformedPoint!.y).to.equals(10);
    expect(transformedPoint!.z).to.equals(0);

  });

  it("should loadTile from PBF request", async () => {
    const settings = ImageMapLayerSettings.fromJSON({
      ...esriFeatureSampleSource,
      subLayers: [{ id: 0, name: "layer1", visible: true }, { id: 2, name: "layer2", visible: true }],
    },
    );
    sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: unknown) {
      return {
        defaultVisibility: true,
        supportedQueryFormats: "PBF",
        supportsCoordinatesQuantization: true,
        geometryType : "esriGeometryPolygon",
        drawingInfo: PhillyLandmarksDataset.phillySimplePolyDrawingInfo.drawingInfo,
      };
    });
    stubGetServiceJson(sandbox, { accessTokenRequired: false, content: { currentVersion: 11, capabilities: "Query" } });

    sandbox.stub(HTMLCanvasElement.prototype, "getContext").callsFake(function _(_contextId: any, _options?: any) {
      return {} as RenderingContext;
    });

    sandbox.stub(HTMLCanvasElement.prototype, "toDataURL").callsFake(function _(_type?: string, _quality?: any) {
      return `data:image/png;base64,${pngTransparent1x1}`;
    });

    const providerStub = sandbox.stub((ArcGisFeatureProvider.prototype as any), "fetchTile").callsFake(async function _() {
      return new ArcGisFeatureResponse("PBF", Promise.resolve({} as Response));
    });

    sandbox.stub((ArcGisFeatureResponse.prototype as any), "getResponseData").callsFake(async function _() {
      return {
        exceedTransferLimit: false,
        data: { toObject: () => undefined },
      };
    });

    //    toDataURL string;
    const readAndRenderSpy = sandbox.spy(ArcGisPbfFeatureReader.prototype, "readAndRender");
    const computeTransfoSpy = sandbox.spy(ArcGisFeatureProvider.prototype as any, "computeTileWorld2CanvasTransform");
    const provider = new ArcGisFeatureProvider(settings);
    await provider.initialize();
    const tileData = await provider.loadTile(0, 0, 0);
    expect(tileData).to.not.undefined;
    expect(tileData?.data instanceof Uint8Array).to.be.true;
    expect(tileData?.data).to.eqls(base64StringToUint8Array(pngTransparent1x1));
    expect(tileData?.format).to.equals(ImageSourceFormat.Png);
    expect(providerStub.calledOnce).to.be.true;
    expect(readAndRenderSpy.calledOnce).to.be.true;
    expect(computeTransfoSpy.calledOnce).to.be.false; // Should not be called since we have supportsCoordinatesQuantization in layer metadata

  });

  it("should loadTile from JSON request", async () => {
    const settings = ImageMapLayerSettings.fromJSON({
      ...esriFeatureSampleSource,
      subLayers: [{ id: 0, name: "layer1", visible: true }, { id: 2, name: "layer2", visible: true }],
    },
    );
    sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: unknown) {
      return getDefaultLayerMetadata();
    });
    stubGetServiceJson(sandbox, { accessTokenRequired: false, content: { capabilities: "Query" } });

    sandbox.stub(HTMLCanvasElement.prototype, "getContext").callsFake(function _(_contextId: any, _options?: any) {
      return {} as RenderingContext;
    });

    sandbox.stub(HTMLCanvasElement.prototype, "toDataURL").callsFake(function _(_type?: string, _quality?: any) {
      return `data:image/png;base64,${pngTransparent1x1}`;
    });

    const providerStub = sandbox.stub((ArcGisFeatureProvider.prototype as any), "fetchTile").callsFake(async function _() {
      return new ArcGisFeatureResponse("JSON", Promise.resolve({} as Response));
    });

    sandbox.stub((ArcGisFeatureResponse.prototype as any), "getResponseData").callsFake(async function _() {
      return {
        exceedTransferLimit: false,
        data: { toObject: () => undefined },
      };
    });

    const readAndRenderSpy = sandbox.spy(ArcGisJsonFeatureReader.prototype, "readAndRender");
    const computeTransfoSpy = sandbox.spy(ArcGisFeatureProvider.prototype as any, "computeTileWorld2CanvasTransform");
    const provider = new ArcGisFeatureProvider(settings);
    await provider.initialize();
    const tileData = await provider.loadTile(0, 0, 0);
    expect(tileData).to.not.undefined;
    expect(tileData?.data instanceof Uint8Array).to.be.true;
    expect(tileData?.data).to.eqls(base64StringToUint8Array(pngTransparent1x1));
    expect(tileData?.format).to.equals(ImageSourceFormat.Png);
    expect(providerStub.calledOnce).to.be.true;
    expect(readAndRenderSpy.calledOnce).to.be.true;
    expect(computeTransfoSpy.calledOnce).to.be.true; // Should be called since we dont have _supportsCoordinatesQuantization in layer metadata
  });

  it("should make sub request if loadtile request return 'exceedTransferLimit'", async () => {
    const settings = ImageMapLayerSettings.fromJSON({
      ...esriFeatureSampleSource,
      subLayers: [{ id: 0, name: "layer1", visible: true }, { id: 2, name: "layer2", visible: true }],
    },
    );
    sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: unknown) {
      return {
        defaultVisibility: true,
        supportedQueryFormats: "JSON",
        geometryType : "esriGeometryPolygon",
        drawingInfo: PhillyLandmarksDataset.phillySimplePolyDrawingInfo.drawingInfo,
      };
    });
    stubGetServiceJson(sandbox, { accessTokenRequired: false, content: { capabilities: "Query" } });

    sandbox.stub(HTMLCanvasElement.prototype, "getContext").callsFake(function _(_contextId: any, _options?: any) {
      return {} as RenderingContext;
    });

    sandbox.stub(HTMLCanvasElement.prototype, "toDataURL").callsFake(function _(_type?: string, _quality?: any) {
      return `data:image/png;base64,${pngTransparent1x1}`;
    });

    const extentSize = 100;
    const fetchTileStub = sandbox.stub((ArcGisFeatureProvider.prototype as any), "fetchTile").callsFake(async function _() {
      const envelope: ArcGisExtent = {
        xmin: 0,
        ymin: 0,
        xmax: extentSize,
        ymax: extentSize,
        spatialReference: {
          wkid: 102100,
          latestWkid: 3857,
        },
      };
      return new ArcGisFeatureResponse("JSON", Promise.resolve({} as Response), envelope);
    });

    let firstCall = true;
    sandbox.stub((ArcGisFeatureResponse.prototype as any), "getResponseData").callsFake(async function _() {

      const exceed = firstCall === true;
      firstCall = false;
      return {
        exceedTransferLimit: exceed,
        data: { toObject: () => undefined },
      };
    });

    const readAndRenderSpy = sandbox.spy(ArcGisJsonFeatureReader.prototype, "readAndRender");
    const provider = new ArcGisFeatureProvider(settings);

    await provider.initialize();
    await provider.loadTile(0, 0, 0);

    // We should have 5 calls:
    // Call #1 : initial call for 0,0,0 and it returns 'exceedTransferLimit'
    // Calls #2-5: Four calls which represent a call for each sub-envelope (initial extent divided by 4)
    expect(fetchTileStub.getCalls().length).to.equals(5);
    expect(fetchTileStub.getCalls()[1].args[3]).to.eqls({
      xmin: 0, ymin: 0, xmax: extentSize * 0.5, ymax: extentSize * 0.5,
      spatialReference: {
        wkid: 102100, latestWkid: 3857,
      },
    });
    expect(fetchTileStub.getCalls()[2].args[3]).to.eqls({
      xmin: 0, ymin: extentSize * 0.5, xmax: extentSize * 0.5, ymax: extentSize,
      spatialReference: {
        wkid: 102100, latestWkid: 3857,
      },
    });
    expect(fetchTileStub.getCalls()[3].args[3]).to.eqls({
      xmin: extentSize * 0.5, ymin: 0, xmax: extentSize, ymax: extentSize * 0.5,
      spatialReference: {
        wkid: 102100, latestWkid: 3857,
      },
    });
    expect(fetchTileStub.getCalls()[4].args[3]).to.eqls({
      xmin: extentSize * 0.5, ymin: extentSize * 0.5, xmax: extentSize, ymax: extentSize,
      spatialReference: {
        wkid: 102100, latestWkid: 3857,
      },
    });
    expect(readAndRenderSpy.getCalls().length).to.equals(4);
  });

  it("fetchTile should return undefined when to format defined", async () => {

    const settings = ImageMapLayerSettings.fromJSON({
      ...esriFeatureSampleSource,
      subLayers: [{ id: 0, name: "layer1", visible: true }, { id: 2, name: "layer2", visible: true }],
    },
    );

    const provider = new ArcGisFeatureProvider(settings);
    // make a first request with init, should return undefined because of missing format
    const tileData = await (provider as any).fetchTile(0, 0, 0);
    expect(tileData).to.be.undefined;
  });

  it("fetchTile should call fetch with the proper URL", async () => {

    const settings = ImageMapLayerSettings.fromJSON({
      ...esriFeatureSampleSource,
      subLayers: [{ id: 0, name: "layer1", visible: true }, { id: 2, name: "layer2", visible: true }],
    },
    );

    sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: unknown) {
      return {
        defaultVisibility: true,
        supportedQueryFormats: "JSON",
        geometryType : "esriGeometryPolygon",
        drawingInfo: PhillyLandmarksDataset.phillySimpleLineDrawingInfo.drawingInfo,
      };
    });
    stubGetServiceJson(sandbox, { accessTokenRequired: false, content: { capabilities: "Query" } });

    sandbox.stub(ArcGisFeatureProvider.prototype, "constructFeatureUrl").callsFake(function _(_row: number, _column: number, _zoomLevel: number, _format: ArcGisFeatureFormat, _resultType: ArcGisFeatureResultType, _geomOverride?: ArcGisGeometry, _outFields?: string, _tolerance?: number, _returnGeometry?: boolean) {
      return { url: settings.url };
    });

    const provider = new ArcGisFeatureProvider(settings);
    await provider.initialize();
    const response = await (provider as any).fetchTile(0, 0, 0);
    expect(response).to.not.undefined;
    expect(fetchStub.calledOnce).to.be.true;
    const test1 = fetchStub.getCall(0).firstArg;
    expect(test1.toString()).to.equals(new URL(settings.url).toString());

  });

  it("should throw when initializing with invalid geometry type", async () => {
    const settings = ImageMapLayerSettings.fromJSON({
      ...esriFeatureSampleSource,
      subLayers: [{ id: 0, name: "layer1", visible: true }, { id: 2, name: "layer2", visible: true }],
    },
    );

    sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: unknown) {
      return {
        defaultVisibility: true,
        supportedQueryFormats: "JSON",
        geometryType : "esriGeometryAny",
        drawingInfo: PhillyLandmarksDataset.phillySimpleLineDrawingInfo.drawingInfo,
      };
    });
    stubGetServiceJson(sandbox, { accessTokenRequired: false, content: { capabilities: "Query" } });

    sandbox.stub(ArcGisFeatureProvider.prototype, "constructFeatureUrl").callsFake(function _(_row: number, _column: number, _zoomLevel: number, _format: ArcGisFeatureFormat, _resultType: ArcGisFeatureResultType, _geomOverride?: ArcGisGeometry, _outFields?: string, _tolerance?: number, _returnGeometry?: boolean) {
      return { url: settings.url };
    });

    const provider = new ArcGisFeatureProvider(settings);

    await expect(provider.initialize()).to.be.rejectedWith( Error, "Could not determine default symbology: geometry type not supported");

  });

  it("should construct renderer from incomplete drawing info", async () => {

    const settings = ImageMapLayerSettings.fromJSON({
      ...esriFeatureSampleSource,
      subLayers: [{ id: 0, name: "layer1", visible: true }, { id: 2, name: "layer2", visible: true }],
    },
    );

    const layerMetadata = {
      defaultVisibility: true,
      supportedQueryFormats: "JSON",
      geometryType : "esriGeometryPoint",
      drawingInfo: PhillyLandmarksDataset.phillySimpleLineDrawingInfo.drawingInfo,
    };
    let getLayerMetadataStub = sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: unknown) {
      return {...layerMetadata, geometryType : "esriGeometryPoint" };
    });
    stubGetServiceJson(sandbox, { accessTokenRequired: false, content: { capabilities: "Query" } });

    sandbox.stub(ArcGisFeatureProvider.prototype, "constructFeatureUrl").callsFake(function _(_row: number, _column: number, _zoomLevel: number, _format: ArcGisFeatureFormat, _resultType: ArcGisFeatureResultType, _geomOverride?: ArcGisGeometry, _outFields?: string, _tolerance?: number, _returnGeometry?: boolean) {
      return { url: settings.url };
    });

    // Make sure we dont get stuck on the loadImage call
    sandbox.stub(EsriPMS.prototype, "loadImage").callsFake(async function  _() {
      return;
    });

    let provider = new ArcGisFeatureProvider(settings);
    await provider.initialize();
    let pms = EsriPMS.fromJSON((ArcGisFeatureProvider as any).defaultPMS);
    expect((provider as any)._defaultSymbol).to.deep.equals(pms);

    getLayerMetadataStub.restore();
    getLayerMetadataStub = sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: unknown) {
      return {...layerMetadata, geometryType : "esriGeometryMultipoint" };
    });
    provider = new ArcGisFeatureProvider(settings);
    await provider.initialize();
    pms = EsriPMS.fromJSON((ArcGisFeatureProvider as any).defaultPMS);
    expect((provider as any)._defaultSymbol).to.deep.equals(pms);

    getLayerMetadataStub.restore();
    getLayerMetadataStub = sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: unknown) {
      return {...layerMetadata, geometryType : "esriGeometryPolyline" };
    });
    provider = new ArcGisFeatureProvider(settings);
    await provider.initialize();
    let sls = EsriSLS.fromJSON((ArcGisFeatureProvider as any).defaultSLS);
    expect((provider as any)._defaultSymbol).to.deep.equals(sls);

    getLayerMetadataStub.restore();
    getLayerMetadataStub = sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: unknown) {
      return {...layerMetadata, geometryType : "esriGeometryLine" };
    });
    provider = new ArcGisFeatureProvider(settings);
    await provider.initialize();
    sls = EsriSLS.fromJSON((ArcGisFeatureProvider as any).defaultSLS);
    expect((provider as any)._defaultSymbol).to.deep.equals(sls);

    getLayerMetadataStub.restore();
    getLayerMetadataStub = sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: unknown) {
      return {...layerMetadata, geometryType : "esriGeometryPolygon" };
    });
    provider = new ArcGisFeatureProvider(settings);
    await provider.initialize();
    const sfs = EsriSFS.fromJSON((ArcGisFeatureProvider as any).defaultSFS);
    expect((provider as any)._defaultSymbol).to.deep.equals(sfs);

  });

  it("should apply our own default symbol when no default symbol in metadata", async () => {

    const settings = ImageMapLayerSettings.fromJSON({
      ...esriFeatureSampleSource,
      subLayers: [{ id: 0, name: "layer1", visible: true }, { id: 2, name: "layer2", visible: true }],
    });

    const drawingInfo = structuredClone(NewYorkDataset.uniqueValueDrawingInfo.drawingInfo);
    const layerMetadata = {
      defaultVisibility: true,
      supportedQueryFormats: "JSON",
      geometryType : "esriGeometryPoint",
      drawingInfo,
    };

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    (drawingInfo.renderer.defaultSymbol as any) = null;  // Force no default symbology

    sandbox.stub((ArcGisFeatureProvider.prototype as any), "getLayerMetadata").callsFake(async function (_id: unknown) {
      return {...layerMetadata, geometryType : "esriGeometryPoint" };
    });
    stubGetServiceJson(sandbox, { accessTokenRequired: false, content: { capabilities: "Query" } });

    sandbox.stub(ArcGisFeatureProvider.prototype, "constructFeatureUrl").callsFake(function _(_row: number, _column: number, _zoomLevel: number, _format: ArcGisFeatureFormat, _resultType: ArcGisFeatureResultType, _geomOverride?: ArcGisGeometry, _outFields?: string, _tolerance?: number, _returnGeometry?: boolean) {
      return { url: settings.url };
    });

    sandbox.stub(HTMLImageElement.prototype, "addEventListener").callsFake(function _(_type: string, listener: EventListenerOrEventListenerObject, _options?: boolean | AddEventListenerOptions) {
      (listener as any)();
    });

    const loadImageSpy =  sandbox.spy(EsriPMS.prototype, "loadImage");

    const provider = new ArcGisFeatureProvider(settings);
    await provider.initialize();
    const nbMarkerToLoad = layerMetadata.drawingInfo.renderer.uniqueValueInfos.length + 1; // +1 for provider's default symbol
    expect (loadImageSpy.getCalls().length).to.equals(nbMarkerToLoad);
  });

});
