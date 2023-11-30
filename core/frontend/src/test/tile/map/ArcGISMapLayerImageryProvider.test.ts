/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Cartographic, EmptyLocalization, ImageMapLayerSettings, ServerError } from "@itwin/core-common";
import chai, { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon from "sinon";
import { IModelApp } from "../../../IModelApp";
import {
  ArcGisGetServiceJsonArgs,
  ArcGISIdentifyRequestUrl,
  ArcGISIdentifyRequestUrlProps,
  ArcGISImageryProvider,
  ArcGISMapLayerImageryProvider,
  ArcGisUtilities,
  MapLayerImageryProvider,
  QuadId,

} from "../../../tile/internal";
import { ArcGISMapLayerDataset } from "./ArcGISMapLayerDataset";
import { Range2dProps } from "@itwin/core-geometry";
import { indexedArrayFromUrlParams } from "./MapLayerTestUtilities";

chai.use(chaiAsPromised);

const sampleSource = { formatId: "ArcGIS", url: "https://localhost/Mapserver", name: "Test" };

function stubJsonFetch(sandbox: sinon.SinonSandbox, json: string) {

  return sandbox.stub((ArcGISImageryProvider.prototype as any), "fetch").callsFake(async function _(_url: unknown, _options?: unknown) {
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

function stubGetServiceJson(sandbox: sinon.SinonSandbox, json: any) {
  return sandbox.stub(ArcGisUtilities, "getServiceJson").callsFake(async function _(_args: ArcGisGetServiceJsonArgs) {
    return json;
  });
}

describe("ArcGISMapLayerImageryProvider", () => {
  const sandbox = sinon.createSandbox();
  beforeEach(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
  });
  afterEach(async () => {
    sandbox.restore();
    if (IModelApp.initialized)
      await IModelApp.shutdown();
  });

  it("initialize() should throw coordinate system error", async () => {
    const settings = ImageMapLayerSettings.fromJSON(sampleSource);
    if (!settings)
      chai.assert.fail("Could not create settings");

    stubGetServiceJson(sandbox, {content: ArcGISMapLayerDataset.TilesOnlyDataset26918, accessTokenRequired:false});

    const provider = new ArcGISMapLayerImageryProvider(settings);
    await chai.expect(provider.initialize()).to.be.rejectedWith(ServerError, "Invalid coordinate system");
  });

  it("initialize() should turn ON use of tiles", async () => {
    const settings = ImageMapLayerSettings.fromJSON(sampleSource);
    if (!settings)
      chai.assert.fail("Could not create settings");

    stubGetServiceJson(sandbox, {content: ArcGISMapLayerDataset.UsaTopoMaps, accessTokenRequired:false});

    const provider = new ArcGISMapLayerImageryProvider(settings);
    await provider.initialize();
    chai.expect((provider as any)._tilesOnly).to.equals(false);
    chai.expect((provider as any)._mapSupported).to.equals(true);
    chai.expect((provider as any)._tileMapSupported).to.equals(true);
    chai.expect((provider as any)._tileMap).to.be.not.undefined;
    chai.expect((provider as any)._usesCachedTiles).to.be.true;
  });

  it("initialize() should fallback to 'Export' queries instead of tiles when invalid CS ", async () => {
    const settings = ImageMapLayerSettings.fromJSON(sampleSource);
    if (!settings)
      chai.assert.fail("Could not create settings");

    const dataset = JSON.parse(JSON.stringify(ArcGISMapLayerDataset.UsaTopoMaps));
    // Fake an unknown CS
    dataset.tileInfo.spatialReference.latestWkid = 1234;
    const responseJson = {content: dataset, accessTokenRequired:false};
    stubGetServiceJson(sandbox, responseJson);

    const provider = new ArcGISMapLayerImageryProvider(settings);
    await provider.initialize();
    chai.expect((provider as any)._tilesOnly).to.equals(false);
    chai.expect((provider as any)._mapSupported).to.equals(true);
    chai.expect((provider as any)._tileMapSupported).to.equals(true);
    chai.expect((provider as any)._tileMap).to.be.undefined;
    chai.expect((provider as any)._usesCachedTiles).to.be.false;
  });

  it("ArcGISIdentifyRequestUrl should create proper extent string ", async () => {
    const range: Range2dProps = {low: {x:1, y:2}, high:{x:3, y:4}};
    let extentStr = ArcGISIdentifyRequestUrl.getExtentString(range, 2);
    chai.expect(extentStr).to.equals("1.00,2.00,3.00,4.00");
    extentStr = ArcGISIdentifyRequestUrl.getExtentString(range, 3);
    chai.expect(extentStr).to.equals("1.000,2.000,3.000,4.000");
  });

  it("ArcGISIdentifyRequestUrl should create proper identify request ", async () => {
    const range: Range2dProps = {low: {x:1, y:2}, high:{x:3, y:4}};
    const props: ArcGISIdentifyRequestUrlProps = {
      geometry: {x: 1.00000000, y: 2.0000000000},
      geometryType: "esriGeometryPoint",
      tolerance: 1.0,
      mapExtent: range,
      imageDisplay: {width: 256, height: 256, dpi: 96} };

    const baseUrl = "https://services7.arcgis.com/nZ2Vb4CUwdo9AIiQ/ArcGIS/rest/services/PhillyRailLines/MapServer";
    let url = ArcGISIdentifyRequestUrl.fromJSON(baseUrl, props);
    chai.expect(url.toString()).to.equals("https://services7.arcgis.com/nZ2Vb4CUwdo9AIiQ/ArcGIS/rest/services/PhillyRailLines/MapServer/identify?geometry=1%2C2&geometryType=esriGeometryPoint&tolerance=1&mapExtent=1%2C2%2C3%2C4&imageDisplay=256%2C256%2C96");

    // exercise srFractionDigits
    url = ArcGISIdentifyRequestUrl.fromJSON(baseUrl, props, 2);
    chai.expect(url.toString()).to.equals("https://services7.arcgis.com/nZ2Vb4CUwdo9AIiQ/ArcGIS/rest/services/PhillyRailLines/MapServer/identify?geometry=1.00%2C2.00&geometryType=esriGeometryPoint&tolerance=1&mapExtent=1.00%2C2.00%2C3.00%2C4.00&imageDisplay=256%2C256%2C96");

    // optional parameters
    url = ArcGISIdentifyRequestUrl.fromJSON(baseUrl, {...props,
      f: "json",
      layers: { prefix: "visible", layerIds: [ "2", "3" ] },
      maxAllowableOffset: 2.00000000,
      returnGeometry: true}, 2);
    chai.expect(url.toString()).to.equals("https://services7.arcgis.com/nZ2Vb4CUwdo9AIiQ/ArcGIS/rest/services/PhillyRailLines/MapServer/identify?f=json&geometry=1.00%2C2.00&geometryType=esriGeometryPoint&layers=visible%3A+2%2C3&tolerance=1&mapExtent=1.00%2C2.00%2C3.00%2C4.00&imageDisplay=256%2C256%2C96&returnGeometry=true&maxAllowableOffset=2.00");
  });

  it("getIdentifyData should create proper identify request", async () => {
    const settings = ImageMapLayerSettings.fromJSON({...sampleSource, subLayers: [{name:"layer1", id: "1", visible:false}, {name:"layer2", id: "2", visible:true}, {name:"layer3", id: "3", visible:true}]});
    if (!settings)
      chai.assert.fail("Could not create settings");

    const provider = new ArcGISMapLayerImageryProvider(settings);

    stubJsonFetch(sandbox, JSON.stringify({}));

    const fromJSONSpy = sinon.spy(ArcGISIdentifyRequestUrl, "fromJSON");

    // Fake those methods to avoid precision issues
    let i = 1;
    sinon.stub(MapLayerImageryProvider.prototype, "getEPSG3857X").callsFake((_longitude: number) => i++);
    sinon.stub(MapLayerImageryProvider.prototype, "getEPSG3857Y").callsFake((_longitude: number) => i++);
    const maxAllowableOffset = 2.0;
    (provider as any).getIdentifyData(new QuadId(3, 2, 1), Cartographic.fromRadians({longitude: 0.1, latitude: 0.2, height: 0.3}), 0.1, true, maxAllowableOffset);

    chai.expect(fromJSONSpy.called).to.be.true;
    const firstCall = fromJSONSpy.getCalls()[0];
    expect(firstCall.args[0]).to.equals(sampleSource.url);
    const reference = {
      f: "json",
      geometry: { x: 5, y: 6 },
      geometryType: "esriGeometryPoint",
      tolerance: 0.1,
      sr: 3857,
      mapExtent: {
        low: { x: 1, y: 3 },
        high: { x: 2, y: 4 },
      },
      imageDisplay: { width: 256, height: 256, dpi: 96 },
      layers: { prefix: "top", layerIds: [ "2", "3" ] },
      returnGeometry: true,
      maxAllowableOffset,
    };

    expect(firstCall.args[1]).to.deep.equal(reference);
    expect(firstCall.args[2]).to.equals(3);
  });

  it("should pass fetch function to ArcGISTileMap object", async () => {
    const settings = ImageMapLayerSettings.fromJSON(sampleSource);
    const unsaved = new URLSearchParams([["key1_1", "value1_1"], ["key1_2", "value1_2"], ["testParam", "BAD"]]);
    const saved = new URLSearchParams([["key2_1", "value2_1"], ["key2_2", "value2_"] ]);
    settings.unsavedQueryParams = indexedArrayFromUrlParams(unsaved);
    settings.savedQueryParams = indexedArrayFromUrlParams(saved);
    if (!settings)
      chai.assert.fail("Could not create settings");

    stubGetServiceJson(sandbox, {content: ArcGISMapLayerDataset.UsaTopoMaps, accessTokenRequired:false});

    const provider = new ArcGISMapLayerImageryProvider(settings);
    await provider.initialize();
    const resolveChildren = (_childIds: QuadId[]) => {};

    const fetchStub = sandbox.stub(global, "fetch").callsFake(async function (_input: RequestInfo | URL, _init?: RequestInit) {

      return Promise.resolve((({
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => {},
      } as unknown) as Response));
    });

    await (provider as any)._generateChildIds(QuadId.createFromContentId("1_0_0"), resolveChildren);
    chai.expect(fetchStub.calledOnce).to.be.true;
    chai.expect(fetchStub.getCall(0).args[0].toString()).to.contains(unsaved.toString());
    chai.expect(fetchStub.getCall(0).args[0].toString()).to.contains(saved.toString());
  });
});
