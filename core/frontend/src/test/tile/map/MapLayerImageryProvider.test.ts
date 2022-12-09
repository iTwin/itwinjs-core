/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { RequestBasicCredentials } from "../../../request/Request";
import { ImageMapLayerSettings, MapLayerProps, ServerError } from "@itwin/core-common";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon from "sinon";
import { IModelApp } from "../../../IModelApp";
import {
  MapLayerImageryProvider,
  MapLayerImageryProviderStatus,
  WmsCapabilities,
  WmsMapLayerImageryProvider,
  WmtsCapabilities,
  WmtsMapLayerImageryProvider,
} from "../../../tile/internal";
import { Point2d } from "@itwin/core-geometry";
import { ByteStream } from "@itwin/core-bentley";

chai.use(chaiAsPromised);

const wmsSampleSource = { formatId: "WMS", url: "https://localhost/wms", name: "Test WMS" };

const createFakeTileResponse = (contentType: string, data?: Uint8Array) => {
  const test = {
    headers: new Headers( { "content-type" : contentType}),
    arrayBuffer: async () => {
      return Promise.resolve(data ? ByteStream.fromUint8Array(data).arrayBuffer : undefined);
    },
    status: 200,
  } as unknown;   // By using unknown type, I can define parts of Response I really need
  return (test as Response );
};

describe("WmsMapLayerImageryProvider", () => {
  const sandbox = sinon.createSandbox();

  afterEach(async () => {
    sandbox.restore();
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

    const fakeCapabilities = await WmsCapabilities.create("assets/wms_capabilities/continents.xml");
    sandbox.stub(WmsCapabilities, "create").callsFake(async function _(_url: string, _credentials?: RequestBasicCredentials, _ignoreCache?: boolean) {
      return  fakeCapabilities;
    });

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
      url: "https://localhost/wms",
      name: "Test WMS",
      subLayers: [
        {name: "Default", id:0, visible:true},
      ]};
    const settings =ImageMapLayerSettings.fromJSON(layerPros);
    if (!settings)
      chai.assert.fail("Could not create settings");

    const fakeCapabilities = await WmsCapabilities.create("assets/wms_capabilities/mapproxy_111.xml");
    sandbox.stub(WmsCapabilities, "create").callsFake(async function _(_url: string, _credentials?: RequestBasicCredentials, _ignoreCache?: boolean) {
      return  fakeCapabilities;
    });

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
      url: "https://localhost/wms",
      name: "Test WMS",
      subLayers: [
        {name: "Default", id:0, visible:true},
      ]};
    const settings =ImageMapLayerSettings.fromJSON(layerPros);
    if (!settings)
      chai.assert.fail("Could not create settings");

    const fakeCapabilities = await WmsCapabilities.create("assets/wms_capabilities/mapproxy_130.xml");
    sandbox.stub(WmsCapabilities, "create").callsFake(async function _(_url: string, _credentials?: RequestBasicCredentials, _ignoreCache?: boolean) {
      return  fakeCapabilities;
    });

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
});
//
// This suite depends on IModelApp
describe("MapLayerImageryProvider with IModelApp", () => {
  const sandbox = sinon.createSandbox();
  beforeEach(async () => {
    await IModelApp.startup();
  });

  afterEach(async () => {
    sandbox.restore();
    await IModelApp.shutdown();
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

const wmtsSampleSource = { formatId: "WMTS", url: "https://localhost/wmts", name: "Test WMTS" };
describe("WmtsMapLayerImageryProvider", () => {
  const sandbox = sinon.createSandbox();

  afterEach(async () => {
    sandbox.restore();
  });

  it("initialize() should handle unknown exception from WmsCapabilities", async () => {
    const settings =ImageMapLayerSettings.fromJSON(wmtsSampleSource);
    if (!settings)
      chai.assert.fail("Could not create settings");

    sandbox.stub(WmsCapabilities, "create").callsFake(async function _(_url: string, _credentials?: RequestBasicCredentials, _ignoreCache?: boolean) {
      throw { someError: "error" }; // eslint-disable-line no-throw-literal
    });
    const provider = new WmsMapLayerImageryProvider(settings);
    await chai.expect(provider.initialize()).to.be.rejectedWith(ServerError);
  });

  it("initialize() should handle unknown exception from WmtsCapabilities", async () => {
    const settings =ImageMapLayerSettings.fromJSON(wmtsSampleSource);
    if (!settings)
      chai.assert.fail("Could not create settings");

    sandbox.stub(WmtsCapabilities, "create").callsFake(async function _(_url: string, _credentials?: RequestBasicCredentials, _ignoreCache?: boolean) {
      throw { someError: "error" }; // eslint-disable-line no-throw-literal
    });
    const provider = new WmtsMapLayerImageryProvider(settings);
    await chai.expect(provider.initialize()).to.be.rejectedWith(ServerError);
  });

});
