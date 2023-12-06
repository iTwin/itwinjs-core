/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Cartographic, EmptyLocalization, ImageMapLayerSettings, MapLayerProps, MapSubLayerSettings, ServerError } from "@itwin/core-common";
import * as sinon from "sinon";
import * as chai from "chai";
import {
  ImageryMapTileTree,
  MapCartoRectangle,
  MapLayerImageryProvider,
  MapLayerImageryProviderStatus,
  QuadId,
  WmsCapabilities,
  WmsMapLayerImageryProvider,
  WmtsCapabilities,
  WmtsMapLayerImageryProvider,
} from "../../../tile/internal";
import { IModelApp } from "../../../IModelApp";
import { RequestBasicCredentials } from "../../../request/Request";
import { Point2d } from "@itwin/core-geometry";
import { createFakeTileResponse, fakeTextFetch } from "./MapLayerTestUtilities";

const wmsSampleSource = { formatId: "WMS", url: "https://localhost/wms", name: "Test WMS" };

describe("WmsMapLayerImageryProvider", () => {
  const sandbox = sinon.createSandbox();

  beforeEach(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
  });

  afterEach(async () => {
    sandbox.restore();
    if (IModelApp.initialized)
      await IModelApp.shutdown();
  });

  it("construct proper tile url", async () => {

    sandbox.stub(WmsMapLayerImageryProvider.prototype, "getCrsSupport" as any).callsFake(() => {
      return {support3857: true, support4326: false};
    });
    sandbox.stub(WmsMapLayerImageryProvider.prototype, "getVisibleLayers" as any).callsFake(() => {
      return [MapSubLayerSettings.fromJSON({name: "sublayer"})];
    });

    // stub BBOX to avoid any floating point related issues
    sandbox.stub(WmsMapLayerImageryProvider.prototype, "getEPSG3857ExtentString" as any).callsFake(() => {
      return "1,2,3,4";
    });

    sandbox.stub(WmsCapabilities, "create").callsFake(async (_url: string, _credentials?: RequestBasicCredentials, _ignoreCache?: boolean) => {
      return {} as WmsCapabilities;
    });

    const settings = ImageMapLayerSettings.fromJSON({formatId:"WMS", name: "", url: "https://sub.service.com/service"});
    let  provider = new WmsMapLayerImageryProvider(settings);
    await provider.initialize();
    let url = await provider.constructUrl(0,0,0);
    const refUrl = "https://sub.service.com/service?SERVICE=WMS&VERSION=undefined&REQUEST=GetMap&FORMAT=image%2Fpng&TRANSPARENT=TRUE&LAYERS=sublayer&WIDTH=256&HEIGHT=256&SRS=EPSG%3A3857&STYLES=&BBOX=1,2,3,4";
    chai.expect(url).to.equals(refUrl);

    const param1 = new URLSearchParams([["key1_1", "value1_1"], ["key1_2", "value1_2"]]);
    const param2 = new URLSearchParams([["key2_1", "value2_2"], ["key2_2", "value2_2"]]);
    settings.savedQueryParams = {};
    settings.unsavedQueryParams = {};
    param1.forEach((value: string, key: string) =>  settings.savedQueryParams![key] = value);
    param2.forEach((value: string, key: string) =>  settings.unsavedQueryParams![key] = value);
    provider = new WmsMapLayerImageryProvider(settings);
    await provider.initialize();
    url = await provider.constructUrl(0,0,0);
    chai.expect(url).to.equals(`${refUrl}&${param1.toString()}&${param2.toString()}`);

    settings.savedQueryParams = {};
    settings.unsavedQueryParams = {};
    settings.unsavedQueryParams.SERVICE = "BAD";
    provider = new WmsMapLayerImageryProvider(settings);
    await provider.initialize();
    url = await provider.constructUrl(0,0,0);
    chai.expect(url).to.equals(refUrl);
  });

  it("construct proper tooltip url", async () => {

    sandbox.stub(WmsMapLayerImageryProvider.prototype, "getCrsSupport" as any).callsFake(() => {
      return {support3857: true, support4326: false};
    });
    sandbox.stub(WmsMapLayerImageryProvider.prototype, "getVisibleLayers" as any).callsFake(() => {
      return [MapSubLayerSettings.fromJSON({name: "sublayer"})];
    });

    sandbox.stub(WmsMapLayerImageryProvider.prototype, "getQueryableLayers" as any).callsFake(() => {
      return ["sublayer"];
    });

    // stub BBOX to avoid any floating point related issues
    sandbox.stub(WmsMapLayerImageryProvider.prototype, "getEPSG3857ExtentString" as any).callsFake(() => {
      return "1,2,3,4";
    });

    sandbox.stub(MapCartoRectangle.prototype, "worldToLocal" ).callsFake((point: Point2d, _result?: Point2d) => {
      return point;
    });

    sandbox.stub(WmsCapabilities, "create").callsFake(async (_url: string, _credentials?: RequestBasicCredentials, _ignoreCache?: boolean) => {
      return {featureInfoFormats: ["text/html"] } as WmsCapabilities;
    });

    const stub = sandbox.stub(WmsMapLayerImageryProvider.prototype, "toolTipFromUrl" as any).callsFake(async () => {
    });
    const settings = ImageMapLayerSettings.fromJSON({formatId:"WMS", name: "", url: "https://sub.service.com/service"});
    const  provider = new WmsMapLayerImageryProvider(settings);
    await provider.initialize();
    await provider.getToolTip([], new QuadId(0,0,0),  Cartographic.createZero(), ({getTileRectangle: ()=> MapCartoRectangle.createZero()} as unknown) as ImageryMapTileTree);
    const refUrl = "https://sub.service.com/service?SERVICE=WMS&VERSION=undefined&REQUEST=GetFeatureInfo&LAYERS=sublayer&WIDTH=256&HEIGHT=256&SRS=EPSG%3A3857&BBOX=1,2,3,4&QUERY_LAYERS=sublayer&x=0&y=256&info_format=text/html";
    chai.expect(stub.called).to.be.true;
    chai.expect(stub.getCall(0).args[1]).to.equals(refUrl);

    const param1 = new URLSearchParams([["key1_1", "value1_1"], ["key1_2", "value1_2"]]);
    const param2 = new URLSearchParams([["key2_1", "value2_2"], ["key2_2", "value2_2"]]);
    settings.savedQueryParams = {};
    settings.unsavedQueryParams = {};
    param1.forEach((value: string, key: string) =>  settings.savedQueryParams![key] = value);
    param2.forEach((value: string, key: string) =>  settings.unsavedQueryParams![key] = value);

    await provider.getToolTip([], new QuadId(0,0,0),  Cartographic.createZero(), ({getTileRectangle: ()=> MapCartoRectangle.createZero()} as unknown)as  ImageryMapTileTree);

    chai.expect(stub.called).to.be.true;
    chai.expect(stub.getCall(1).args[1]).to.equals(`${refUrl}&${param1.toString()}&${param2.toString()}`);
  });

  it("initialize() should handle 401 error from WmsCapabilities", async () => {
    const settings = ImageMapLayerSettings.fromJSON(wmsSampleSource);
    if (!settings)
      chai.assert.fail("Could not create settings");

    const createSub = sandbox.stub(WmsCapabilities, "create").callsFake(async function _(_url: string, _credentials?: RequestBasicCredentials, _ignoreCache?: boolean) {
      // eslint-disable-next-line no-throw-literal
      throw { status: 401 };
    });
    const provider = new WmsMapLayerImageryProvider(settings);
    await provider.initialize();
    chai.expect(createSub.calledOnce).to.true;
    chai.expect(provider.status).to.equals(MapLayerImageryProviderStatus.RequireAuth);
  });

  it("initialize() should handle 401 error from WmtsCapabilities", async () => {
    const settings =ImageMapLayerSettings.fromJSON(wmsSampleSource);
    if (!settings)
      chai.assert.fail("Could not create settings");

    const createSub = sandbox.stub(WmtsCapabilities, "create").callsFake(async function _(_url: string, _credentials?: RequestBasicCredentials, _ignoreCache?: boolean) {
      // eslint-disable-next-line no-throw-literal
      throw { status: 401 };
    });
    const provider = new WmtsMapLayerImageryProvider(settings);
    await provider.initialize();
    chai.expect(createSub.calledOnce).to.true;
    chai.expect(provider.status).to.equals(MapLayerImageryProviderStatus.RequireAuth);
  });

  it("initialize() should handle unknown exception from WmsCapabilities", async () => {
    const settings = ImageMapLayerSettings.fromJSON(wmsSampleSource);
    if (!settings)
      chai.assert.fail("Could not create settings");

    sandbox.stub(WmsCapabilities, "create").callsFake(async function _(_url: string, _credentials?: RequestBasicCredentials, _ignoreCache?: boolean) {
      throw { someError: "error" }; // eslint-disable-line no-throw-literal
    });
    const provider = new WmsMapLayerImageryProvider(settings);
    await chai.expect(provider.initialize()).to.be.rejectedWith(ServerError);
  });

  it("initialize() should handle unknown exception from WmtsCapabilities", async () => {
    const settings = ImageMapLayerSettings.fromJSON(wmsSampleSource);
    if (!settings)
      chai.assert.fail("Could not create settings");

    sandbox.stub(WmtsCapabilities, "create").callsFake(async function _(_url: string, _credentials?: RequestBasicCredentials, _ignoreCache?: boolean) {
      throw { someError: "error" }; // eslint-disable-line no-throw-literal
    });
    const provider = new WmtsMapLayerImageryProvider(settings);
    await chai.expect(provider.initialize()).to.be.rejectedWith(ServerError);
  });

  it("loadTile should not throw and return appropriate object", async () => {
    const settings =ImageMapLayerSettings.fromJSON(wmsSampleSource);
    if (!settings)
      chai.assert.fail("Could not create settings");

    sandbox.stub(WmsMapLayerImageryProvider.prototype, "constructUrl").callsFake(async function (_row: number, _column: number, _zoomLevel: number) {
      return "https://fake/url";
    });

    // Test with empty body
    let makeTileRequestStub = sandbox.stub(MapLayerImageryProvider.prototype, "makeTileRequest").callsFake(async function (_url: string) {
      return Promise.resolve(createFakeTileResponse("image/png", undefined));
    });
    const provider = new WmsMapLayerImageryProvider(settings);
    let tileData = await provider.loadTile(0, 0, 0);
    chai.expect(tileData).to.undefined;

    // test fake png
    makeTileRequestStub.restore();
    makeTileRequestStub = sandbox.stub(MapLayerImageryProvider.prototype, "makeTileRequest").callsFake(async function (_url: string) {
      return Promise.resolve(createFakeTileResponse("image/png", Uint8Array.from([0, 0, 0])));
    });
    tileData = await provider.loadTile(0, 0, 0);
    chai.expect(tileData).to.not.undefined;

    // test fake jpg
    makeTileRequestStub.restore();
    makeTileRequestStub = sandbox.stub(MapLayerImageryProvider.prototype, "makeTileRequest").callsFake(async function (_url: string) {
      return Promise.resolve(createFakeTileResponse("image/jpeg", Uint8Array.from([0, 0, 0])));
    });

    tileData = await provider.loadTile(0, 0, 0);
    chai.expect(tileData).to.not.undefined;

    // test invalid content type
    makeTileRequestStub.restore();
    sandbox.stub(MapLayerImageryProvider.prototype, "makeTileRequest").callsFake(async function (_url: string) {
      return Promise.resolve(createFakeTileResponse("image/strangeFormat", Uint8Array.from([0, 0, 0])));
    });
    tileData = await provider.loadTile(0, 0, 0);
    chai.expect(tileData).to.undefined;

  });

  it("should create a GetMap requests URL using the right 'CRS'", async () => {
    const layerPros: MapLayerProps = {
      formatId: "WMS",
      url: "https://localhost/wms",
      name: "Test WMS",
      subLayers: [
        {name: "continents", id:0, visible:true},
        {name: "continents2", id:1, visible:false},
      ]};
    let settings =ImageMapLayerSettings.fromJSON(layerPros);
    if (!settings)
      chai.assert.fail("Could not create settings");

    const response = await fetch("assets/wms_capabilities/continents.xml");
    const text = await response.text();
    fakeTextFetch(sandbox, text);

    let provider = new WmsMapLayerImageryProvider(settings);
    await provider.initialize();
    let url = await provider.constructUrl(0,0,0);
    let urlObj = new URL(url);
    chai.expect(urlObj.searchParams.get("CRS")).to.equals("EPSG:4326");

    // Mark 'continents' and 'continents2' visible, in that case the request
    // should still be in EPSG:4326 because continents is only available in in EPSG:4326
    layerPros.subLayers![1].visible = true;
    settings =ImageMapLayerSettings.fromJSON(layerPros);
    provider = new WmsMapLayerImageryProvider(settings);
    await provider.initialize();
    url = await provider.constructUrl(0,0,0);
    urlObj = new URL(url);
    chai.expect(urlObj.searchParams.get("CRS")).to.equals("EPSG:4326");

    // Mark 'continents' non visible.
    // URL should now be in EPSG:3857 because continents2 can be displayed in [4326,3857],
    // and 3857 is our favorite CRS.
    layerPros.subLayers![0].visible = false;
    settings =ImageMapLayerSettings.fromJSON(layerPros);
    provider = new WmsMapLayerImageryProvider(settings);
    await provider.initialize();
    url = await provider.constructUrl(0,0,0);
    urlObj = new URL(url);
    chai.expect(urlObj.searchParams.get("CRS")).to.equals("EPSG:3857");

    // Mark 'continents' and 'continents2' non-visible... leaving nothing to display.
    // An empty URL should be created in that case
    layerPros.subLayers![1].visible = false;
    settings =ImageMapLayerSettings.fromJSON(layerPros);
    provider = new WmsMapLayerImageryProvider(settings);
    await provider.initialize();
    url = await provider.constructUrl(0,0,0);
    chai.expect(url).to.be.empty;
  });

  it("should create a GetMap requests URL in WMS 1.1.1", async () => {
    const layerPros: MapLayerProps = {
      formatId: "WMS",
      url: "https://localhost/wms2",
      name: "Test WMS",
      subLayers: [
        {name: "Default", id:0, visible:true},
      ]};
    const settings = ImageMapLayerSettings.fromJSON(layerPros);
    if (!settings)
      chai.assert.fail("Could not create settings");

    const response = await fetch("assets/wms_capabilities/mapproxy_111.xml");
    const text = await response.text();
    fakeTextFetch(sandbox, text);

    const provider = new WmsMapLayerImageryProvider(settings);
    await provider.initialize();
    const url = await provider.constructUrl(0,0,0);
    const urlObj = new URL(url);
    chai.expect(urlObj.searchParams.get("SRS")).to.equals("EPSG:4326");
    const bbox = urlObj.searchParams.get("BBOX");
    chai.expect(bbox).to.not.null;
    if (!bbox)
      return;
    const bboxArray = bbox?.split(",").map((value)=>Number(value));

    // check x/y axis is in the right order
    const p1 = Point2d.create(bboxArray[0], bboxArray[1]);
    const refPoint1 = Point2d.create(-180, -85.05112878);
    const p2 = Point2d.create(bboxArray[2], bboxArray[3]);
    const refPoint2 = Point2d.create(180, 85.05112878);
    chai.expect(p1.isAlmostEqual(refPoint1)).to.be.true;
    chai.expect(p2.isAlmostEqual(refPoint2)).to.be.true;
  });

  it("should create a GetMap requests URL in WMS 1.3.0", async () => {
    const layerPros: MapLayerProps = {
      formatId: "WMS",
      url: "https://localhost/wms3",
      name: "Test WMS",
      subLayers: [
        {name: "Default", id:0, visible:true},
      ]};
    const settings =ImageMapLayerSettings.fromJSON(layerPros);
    if (!settings)
      chai.assert.fail("Could not create settings");

    const response = await fetch("assets/wms_capabilities/mapproxy_130.xml");
    const text = await response.text();
    fakeTextFetch(sandbox, text);

    const provider = new WmsMapLayerImageryProvider(settings);
    await provider.initialize();
    const url = await provider.constructUrl(0,0,0);
    const urlObj = new URL(url);
    // 1.3.0 uses CRS instead of SRS
    chai.expect(urlObj.searchParams.get("CRS")).to.equals("EPSG:4326");

    // check x/y axis is in the right order
    const bbox = urlObj.searchParams.get("BBOX");
    chai.expect(bbox).to.not.null;
    if (!bbox)
      return;
    const bboxArray = bbox?.split(",").map((value)=>Number(value));
    const p1 = Point2d.create(bboxArray[0], bboxArray[1]);
    const refPoint1 = Point2d.create(-85.05112878, -180);
    const p2 = Point2d.create(bboxArray[2], bboxArray[3]);
    const refPoint2 = Point2d.create(85.05112878, 180);
    chai.expect(p1.isAlmostEqual(refPoint1)).to.be.true;
    chai.expect(p2.isAlmostEqual(refPoint2)).to.be.true;
  });

  it("loadTile() should call IModelApp.notifications.outputMessage", async () => {
    const settings =ImageMapLayerSettings.fromJSON(wmsSampleSource);
    if (!settings)
      chai.assert.fail("Could not create settings");
    const provider = new WmsMapLayerImageryProvider(settings);
    const outputMessageSpy = sinon.spy(IModelApp.notifications, "outputMessage");

    sandbox.stub(WmsMapLayerImageryProvider.prototype, "constructUrl").callsFake(async function (_row: number, _column: number, _zoomLevel: number) {
      return "https://fake/url";
    });

    // Make the tile fetch fails with error 401
    let makeTileRequestStub = sandbox.stub(MapLayerImageryProvider.prototype, "makeTileRequest").callsFake(async function (_url: string) {
      // eslint-disable-next-line no-throw-literal
      throw { status: 401 };
    });

    const raiseEventSpy = sinon.spy(provider.onStatusChanged, "raiseEvent");

    await provider.loadTile(0, 0, 0);

    // 'outputMessage' should not be called because no successful tile request occurred.
    chai.expect(outputMessageSpy.calledOnce).to.false;
    // Status should have changed
    chai.expect(provider.status).to.be.equals(MapLayerImageryProviderStatus.RequireAuth);
    // Event should have been triggered
    chai.expect(raiseEventSpy.getCalls().length).to.equals(1);

    // Now lets have a successful tile request
    makeTileRequestStub.restore();
    makeTileRequestStub = sandbox.stub(MapLayerImageryProvider.prototype, "makeTileRequest").callsFake(async function (_url: string) {
      return Promise.resolve(createFakeTileResponse("image/png"));
    });
    await provider.loadTile(0, 0, 0);
    // Event should not have been triggered again
    chai.expect(raiseEventSpy.getCalls().length).to.equals(1);

    // .. and now a 401 failure
    makeTileRequestStub.restore();
    makeTileRequestStub = sandbox.stub(MapLayerImageryProvider.prototype, "makeTileRequest").callsFake(async function (_url: string) {
      // eslint-disable-next-line no-throw-literal
      throw { status: 401 };
    });
    await provider.loadTile(0, 0, 0);
    // Output message should have been called that time (because we had a previous successful request)
    chai.expect(outputMessageSpy.calledOnce).to.true;
    // Status should remains to 'RequireAuth'
    chai.expect(provider.status).to.be.equals(MapLayerImageryProviderStatus.RequireAuth);
    // Event should not have been triggered again
    chai.expect(raiseEventSpy.getCalls().length).to.equals(1);
  });
});
