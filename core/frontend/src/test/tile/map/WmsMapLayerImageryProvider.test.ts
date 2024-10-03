/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Cartographic, EmptyLocalization, ImageMapLayerSettings, MapLayerProps, MapSubLayerSettings, ServerError } from "@itwin/core-common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImageryMapTileTree, MapCartoRectangle, MapLayerImageryProvider, MapLayerImageryProviderStatus, QuadId, WmsCapabilities, WmsMapLayerImageryProvider, WmtsCapabilities, WmtsMapLayerImageryProvider } from "../../../tile/internal";
import { IModelApp } from "../../../IModelApp";
import { RequestBasicCredentials } from "../../../request/Request";
import { Point2d } from "@itwin/core-geometry";
import { createFakeTileResponse, fakeTextFetch } from "./MapLayerTestUtilities";

const wmsSampleSource = { formatId: "WMS", url: "https://localhost/wms", name: "Test WMS" };

describe("WmsMapLayerImageryProvider", () => {

  beforeEach(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (IModelApp.initialized)
      await IModelApp.shutdown();
  });

  it("construct proper tile url", async () => {
    vi.spyOn(WmsMapLayerImageryProvider.prototype, "getCrsSupport" as any).mockImplementation(() => {
      return { support3857: true, support4326: false };
    });
    vi.spyOn(WmsMapLayerImageryProvider.prototype, "getVisibleLayers" as any).mockImplementation(() => {
      return [MapSubLayerSettings.fromJSON({ name: "sublayer" })];
    });

    // stub BBOX to avoid any floating point related issues
    vi.spyOn(WmsMapLayerImageryProvider.prototype, "getEPSG3857ExtentString" as any).mockImplementation(() => {
      return "1,2,3,4";
    });

    vi.spyOn(WmsCapabilities, "create").mockImplementation(async (_url: string, _credentials?: RequestBasicCredentials, _ignoreCache?: boolean) => {
      return {} as WmsCapabilities;
    });

    const settings = ImageMapLayerSettings.fromJSON({ formatId: "WMS", name: "", url: "https://sub.service.com/service" });
    let provider = new WmsMapLayerImageryProvider(settings);
    await provider.initialize();
    let url = await provider.constructUrl(0, 0, 0);
    const refUrl = "https://sub.service.com/service?SERVICE=WMS&VERSION=undefined&REQUEST=GetMap&FORMAT=image%2Fpng&TRANSPARENT=TRUE&LAYERS=sublayer&WIDTH=256&HEIGHT=256&SRS=EPSG%3A3857&STYLES=&BBOX=1,2,3,4";
    expect(url).toEqual(refUrl);

    const param1 = new URLSearchParams([
      ["key1_1", "value1_1"],
      ["key1_2", "value1_2"],
    ]);
    const param2 = new URLSearchParams([
      ["key2_1", "value2_2"],
      ["key2_2", "value2_2"],
    ]);
    settings.savedQueryParams = {};
    settings.unsavedQueryParams = {};
    param1.forEach((value: string, key: string) => (settings.savedQueryParams![key] = value));
    param2.forEach((value: string, key: string) => (settings.unsavedQueryParams![key] = value));
    provider = new WmsMapLayerImageryProvider(settings);
    await provider.initialize();
    url = await provider.constructUrl(0, 0, 0);
    expect(url).toEqual(`${refUrl}&${param1.toString()}&${param2.toString()}`);

    settings.savedQueryParams = {};
    settings.unsavedQueryParams = {};
    settings.unsavedQueryParams.SERVICE = "BAD";
    provider = new WmsMapLayerImageryProvider(settings);
    await provider.initialize();
    url = await provider.constructUrl(0, 0, 0);
    expect(url).toEqual(refUrl);
  });

  it("construct proper tooltip url", async () => {
    vi.spyOn(WmsMapLayerImageryProvider.prototype, "getCrsSupport" as any).mockImplementation(() => {
      return { support3857: true, support4326: false };
    });
    vi.spyOn(WmsMapLayerImageryProvider.prototype, "getVisibleLayers" as any).mockImplementation(() => {
      return [MapSubLayerSettings.fromJSON({ name: "sublayer" })];
    });

    vi.spyOn(WmsMapLayerImageryProvider.prototype, "getQueryableLayers" as any).mockImplementation(() => {
      return ["sublayer"];
    });

    // stub BBOX to avoid any floating point related issues
    vi.spyOn(WmsMapLayerImageryProvider.prototype, "getEPSG3857ExtentString" as any).mockImplementation(() => {
      return "1,2,3,4";
    });

    vi.spyOn(MapCartoRectangle.prototype, "worldToLocal").mockImplementation((point: Point2d, _result?: Point2d) => {
      return point;
    });

    vi.spyOn(WmsCapabilities, "create").mockImplementation(async (_url: string, _credentials?: RequestBasicCredentials, _ignoreCache?: boolean) => {
      return { featureInfoFormats: ["text/html"] } as WmsCapabilities;
    });

    const stub = vi.spyOn(WmsMapLayerImageryProvider.prototype, "toolTipFromUrl" as any).mockImplementation(async () => {});
    const settings = ImageMapLayerSettings.fromJSON({ formatId: "WMS", name: "", url: "https://sub.service.com/service" });
    const provider = new WmsMapLayerImageryProvider(settings);
    await provider.initialize();
    await provider.getToolTip([], new QuadId(0, 0, 0), Cartographic.createZero(), { getTileRectangle: () => MapCartoRectangle.createZero() } as unknown as ImageryMapTileTree);
    const refUrl = "https://sub.service.com/service?SERVICE=WMS&VERSION=undefined&REQUEST=GetFeatureInfo&LAYERS=sublayer&WIDTH=256&HEIGHT=256&SRS=EPSG%3A3857&BBOX=1,2,3,4&QUERY_LAYERS=sublayer&x=0&y=256&info_format=text/html";
    expect(stub).toHaveBeenCalled();
    expect(stub.mock.calls[0][1]).toEqual(refUrl);

    const param1 = new URLSearchParams([
      ["key1_1", "value1_1"],
      ["key1_2", "value1_2"],
    ]);
    const param2 = new URLSearchParams([
      ["key2_1", "value2_2"],
      ["key2_2", "value2_2"],
    ]);
    settings.savedQueryParams = {};
    settings.unsavedQueryParams = {};
    param1.forEach((value: string, key: string) => (settings.savedQueryParams![key] = value));
    param2.forEach((value: string, key: string) => (settings.unsavedQueryParams![key] = value));

    await provider.getToolTip([], new QuadId(0, 0, 0), Cartographic.createZero(), { getTileRectangle: () => MapCartoRectangle.createZero() } as unknown as ImageryMapTileTree);

    expect(stub).toHaveBeenCalled();
    expect(stub.mock.calls[1][1]).toEqual(`${refUrl}&${param1.toString()}&${param2.toString()}`);
  });

  it("initialize() should handle 401 error from WmsCapabilities", async () => {
    const settings = ImageMapLayerSettings.fromJSON(wmsSampleSource);
    if (!settings)
      expect.fail("Could not create settings");

    const createSub = vi.spyOn(WmsCapabilities, "create").mockImplementation(async (_url: string, _credentials?: RequestBasicCredentials, _ignoreCache?: boolean) => {
      // eslint-disable-next-line no-throw-literal
      throw { status: 401 };
    });
    const provider = new WmsMapLayerImageryProvider(settings);
    await provider.initialize();
    expect(createSub).toHaveBeenCalledOnce();
    expect(provider.status).toEqual(MapLayerImageryProviderStatus.RequireAuth);
  });

  it("initialize() should handle 401 error from WmtsCapabilities", async () => {
    const settings = ImageMapLayerSettings.fromJSON(wmsSampleSource);
    if (!settings)
      expect.fail("Could not create settings");

    const createSub = vi.spyOn(WmtsCapabilities, "create").mockImplementation(async (_url: string, _credentials?: RequestBasicCredentials, _ignoreCache?: boolean) => {
      // eslint-disable-next-line no-throw-literal
      throw { status: 401 };
    });
    const provider = new WmtsMapLayerImageryProvider(settings);
    await provider.initialize();
    expect(createSub).toHaveBeenCalledOnce();
    expect(provider.status).toEqual(MapLayerImageryProviderStatus.RequireAuth);
  });

  it("initialize() should handle unknown exception from WmsCapabilities", async () => {
    const settings = ImageMapLayerSettings.fromJSON(wmsSampleSource);
    if (!settings)
      expect.fail("Could not create settings");

    vi.spyOn(WmsCapabilities, "create").mockImplementation(async (_url: string, _credentials?: RequestBasicCredentials, _ignoreCache?: boolean) => {
      throw { someError: "error" }; // eslint-disable-line no-throw-literal
    });
    const provider = new WmsMapLayerImageryProvider(settings);
    await expect(provider.initialize()).rejects.toThrow(ServerError);
  });

  it("initialize() should handle unknown exception from WmtsCapabilities", async () => {
    const settings = ImageMapLayerSettings.fromJSON(wmsSampleSource);
    if (!settings)
      expect.fail("Could not create settings");

    vi.spyOn(WmtsCapabilities, "create").mockImplementation(async (_url: string, _credentials?: RequestBasicCredentials, _ignoreCache?: boolean) => {
      throw { someError: "error" }; // eslint-disable-line no-throw-literal
    });
    const provider = new WmtsMapLayerImageryProvider(settings);
    await expect(provider.initialize()).rejects.toThrow(ServerError);
  });

  it("loadTile should not throw and return appropriate object", async () => {
    const settings = ImageMapLayerSettings.fromJSON(wmsSampleSource);
    if (!settings)
      expect.fail("Could not create settings");

    vi.spyOn(WmsMapLayerImageryProvider.prototype, "constructUrl").mockImplementation(async (_row: number, _column: number, _zoomLevel: number) => {
      return "https://fake/url";
    });

    // Test with empty body
    let makeTileRequestStub = vi.spyOn(MapLayerImageryProvider.prototype, "makeTileRequest").mockImplementation(async (_url: string) => {
      return Promise.resolve(createFakeTileResponse("image/png", undefined));
    });
    const provider = new WmsMapLayerImageryProvider(settings);
    let tileData = await provider.loadTile(0, 0, 0);
    expect(tileData).toBeUndefined();

    // test fake png
    makeTileRequestStub.mockRestore();
    makeTileRequestStub = vi.spyOn(MapLayerImageryProvider.prototype, "makeTileRequest").mockImplementation(async (_url: string) => {
      return Promise.resolve(createFakeTileResponse("image/png", Uint8Array.from([0, 0, 0])));
    });
    tileData = await provider.loadTile(0, 0, 0);
    expect(tileData).toBeDefined();

    // test fake jpg
    makeTileRequestStub.mockRestore();
    makeTileRequestStub = vi.spyOn(MapLayerImageryProvider.prototype, "makeTileRequest").mockImplementation(async (_url: string) => {
      return Promise.resolve(createFakeTileResponse("image/jpeg", Uint8Array.from([0, 0, 0])));
    });

    tileData = await provider.loadTile(0, 0, 0);
    expect(tileData).toBeDefined();

    // test invalid content type
    makeTileRequestStub.mockRestore();
    vi.spyOn(MapLayerImageryProvider.prototype, "makeTileRequest").mockImplementation(async (_url: string) => {
      return Promise.resolve(createFakeTileResponse("image/strangeFormat", Uint8Array.from([0, 0, 0])));
    });
    tileData = await provider.loadTile(0, 0, 0);
    expect(tileData).toBeUndefined();
  });

  it("should create a GetMap requests URL using the right 'CRS'", async () => {
    const layerPros: MapLayerProps = {
      formatId: "WMS",
      url: "https://localhost/wms",
      name: "Test WMS",
      subLayers: [
        { name: "continents", id: 0, visible: true },
        { name: "continents2", id: 1, visible: false },
      ],
    };
    let settings = ImageMapLayerSettings.fromJSON(layerPros);
    if (!settings)
      expect.fail("Could not create settings");

    const response = await fetch(`/assets/wms_capabilities/continents.xml`);
    const text = await response.text();
    fakeTextFetch(text);

    let provider = new WmsMapLayerImageryProvider(settings);
    await provider.initialize();
    let url = await provider.constructUrl(0, 0, 0);
    let urlObj = new URL(url);
    expect(urlObj.searchParams.get("CRS")).toEqual("EPSG:4326");

    // Mark 'continents' and 'continents2' visible, in that case the request
    // should still be in EPSG:4326 because continents is only available in in EPSG:4326
    layerPros.subLayers![1].visible = true;
    settings = ImageMapLayerSettings.fromJSON(layerPros);
    provider = new WmsMapLayerImageryProvider(settings);
    await provider.initialize();
    url = await provider.constructUrl(0, 0, 0);
    urlObj = new URL(url);
    expect(urlObj.searchParams.get("CRS")).toEqual("EPSG:4326");

    // Mark 'continents' non visible.
    // URL should now be in EPSG:3857 because continents2 can be displayed in [4326,3857],
    // and 3857 is our favorite CRS.
    layerPros.subLayers![0].visible = false;
    settings = ImageMapLayerSettings.fromJSON(layerPros);
    provider = new WmsMapLayerImageryProvider(settings);
    await provider.initialize();
    url = await provider.constructUrl(0, 0, 0);
    urlObj = new URL(url);
    expect(urlObj.searchParams.get("CRS")).toEqual("EPSG:3857");

    // Mark 'continents' and 'continents2' non-visible... leaving nothing to display.
    // An empty URL should be created in that case
    layerPros.subLayers![1].visible = false;
    settings = ImageMapLayerSettings.fromJSON(layerPros);
    provider = new WmsMapLayerImageryProvider(settings);
    await provider.initialize();
    url = await provider.constructUrl(0, 0, 0);
    expect(url).toBe("");
  });

  it("should create a GetMap requests URL in WMS 1.1.1", async () => {
    const layerPros: MapLayerProps = {
      formatId: "WMS",
      url: "https://localhost/wms2",
      name: "Test WMS",
      subLayers: [{ name: "Default", id: 0, visible: true }],
    };
    const settings = ImageMapLayerSettings.fromJSON(layerPros);
    if (!settings)
      expect.fail("Could not create settings");

    const response = await fetch(`/assets/wms_capabilities/mapproxy_111.xml`);
    const text = await response.text();
    fakeTextFetch(text);

    const provider = new WmsMapLayerImageryProvider(settings);
    await provider.initialize();
    const url = await provider.constructUrl(0, 0, 0);
    const urlObj = new URL(url);
    expect(urlObj.searchParams.get("SRS")).toEqual("EPSG:4326");
    const bbox = urlObj.searchParams.get("BBOX");
    expect(bbox).not.toBeNull();
    if (!bbox)
      return;
    const bboxArray = bbox.split(",").map((value) => Number(value));

    // check x/y axis is in the right order
    const p1 = Point2d.create(bboxArray[0], bboxArray[1]);
    const refPoint1 = Point2d.create(-180, -85.05112878);
    const p2 = Point2d.create(bboxArray[2], bboxArray[3]);
    const refPoint2 = Point2d.create(180, 85.05112878);
    expect(p1.isAlmostEqual(refPoint1)).toBe(true);
    expect(p2.isAlmostEqual(refPoint2)).toBe(true);
  });

  it("should create a GetMap requests URL in WMS 1.3.0", async () => {
    const layerPros: MapLayerProps = {
      formatId: "WMS",
      url: "https://localhost/wms3",
      name: "Test WMS",
      subLayers: [{ name: "Default", id: 0, visible: true }],
    };
    const settings = ImageMapLayerSettings.fromJSON(layerPros);
    if (!settings)
      expect.fail("Could not create settings");

    const response = await fetch(`/assets/wms_capabilities/mapproxy_130.xml`);
    const text = await response.text();
    fakeTextFetch(text);

    const provider = new WmsMapLayerImageryProvider(settings);
    await provider.initialize();
    const url = await provider.constructUrl(0, 0, 0);
    const urlObj = new URL(url);
    // 1.3.0 uses CRS instead of SRS
    expect(urlObj.searchParams.get("CRS")).toEqual("EPSG:4326");

    // check x/y axis is in the right order
    const bbox = urlObj.searchParams.get("BBOX");
    expect(bbox).not.toBeNull();
    if (!bbox)
      return;
    const bboxArray = bbox.split(",").map((value) => Number(value));
    const p1 = Point2d.create(bboxArray[0], bboxArray[1]);
    const refPoint1 = Point2d.create(-85.05112878, -180);
    const p2 = Point2d.create(bboxArray[2], bboxArray[3]);
    const refPoint2 = Point2d.create(85.05112878, 180);
    expect(p1.isAlmostEqual(refPoint1)).toBe(true);
    expect(p2.isAlmostEqual(refPoint2)).toBe(true);
  });

  it("loadTile() should call IModelApp.notifications.outputMessage", async () => {
    const settings = ImageMapLayerSettings.fromJSON(wmsSampleSource);
    if (!settings)
      expect.fail("Could not create settings");
    const provider = new WmsMapLayerImageryProvider(settings);
    const outputMessageSpy = vi.spyOn(IModelApp.notifications, "outputMessage");

    vi.spyOn(WmsMapLayerImageryProvider.prototype, "constructUrl").mockImplementation(async (_row: number, _column: number, _zoomLevel: number) => {
      return "https://fake/url";
    });

    // Make the tile fetch fails with error 401
    let makeTileRequestStub = vi.spyOn(MapLayerImageryProvider.prototype, "makeTileRequest").mockImplementation(async (_url: string) => {
      // eslint-disable-next-line no-throw-literal
      throw { status: 401 };
    });

    const raiseEventSpy = vi.spyOn(provider.onStatusChanged, "raiseEvent");

    await provider.loadTile(0, 0, 0);

    // 'outputMessage' should not be called because no successful tile request occurred.
    expect(outputMessageSpy).not.toHaveBeenCalled();
    // Status should have changed
    expect(provider.status).toEqual(MapLayerImageryProviderStatus.RequireAuth);
    // Event should have been triggered
    expect(raiseEventSpy).toHaveBeenCalledTimes(1);

    // Now lets have a successful tile request
    makeTileRequestStub.mockRestore();
    makeTileRequestStub = vi.spyOn(MapLayerImageryProvider.prototype, "makeTileRequest").mockImplementation(async (_url: string) => {
      return Promise.resolve(createFakeTileResponse("image/png"));
    });
    await provider.loadTile(0, 0, 0);
    // Event should not have been triggered again
    expect(raiseEventSpy).toHaveBeenCalledTimes(1);

    // .. and now a 401 failure
    makeTileRequestStub.mockRestore();
    makeTileRequestStub = vi.spyOn(MapLayerImageryProvider.prototype, "makeTileRequest").mockImplementation(async (_url: string) => {
      // eslint-disable-next-line no-throw-literal
      throw { status: 401 };
    });
    await provider.loadTile(0, 0, 0);
    // Output message should have been called that time (because we had a previous successful request)
    expect(outputMessageSpy).toHaveBeenCalledOnce();
    // Status should remains to 'RequireAuth'
    expect(provider.status).toEqual(MapLayerImageryProviderStatus.RequireAuth);
    // Event should not have been triggered again
    expect(raiseEventSpy).toHaveBeenCalledTimes(1);
  });
});
