/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Cartographic, EmptyLocalization, ImageMapLayerSettings, ServerError } from "@itwin/core-common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IModelApp } from "../../../IModelApp";
import { ArcGisGetServiceJsonArgs, ArcGISIdentifyRequestUrl, ArcGISIdentifyRequestUrlProps, ArcGISImageryProvider, ArcGISMapLayerImageryProvider, ArcGisUtilities, MapLayerImageryProvider, QuadId } from "../../../tile/internal";
import { ArcGISMapLayerDataset } from "./ArcGISMapLayerDataset";
import { Range2dProps } from "@itwin/core-geometry";
import { indexedArrayFromUrlParams } from "./MapLayerTestUtilities";

const sampleSource = { formatId: "ArcGIS", url: "https://localhost/Mapserver", name: "Test" };

function stubJsonFetch(json: string) {
  return vi.spyOn(ArcGISImageryProvider.prototype as any, "fetch").mockImplementation(async function _(_url: unknown, _options?: unknown) {
    const test = {
      headers: { "content-type": "application/json" },
      json: async () => {
        return JSON.parse(json);
      },
      status: 200,
    } as unknown; // By using unknown type, I can define parts of Response I really need
    return test as Response;
  });
}

function stubGetServiceJson(json: any) {
  return vi.spyOn(ArcGisUtilities, "getServiceJson").mockImplementation(async function _(_args: ArcGisGetServiceJsonArgs) {
    return json;
  });
}

describe("ArcGISMapLayerImageryProvider", () => {
  beforeEach(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    if (IModelApp.initialized)
      await IModelApp.shutdown();
  });

  it("initialize() should throw coordinate system error", async () => {
    const settings = ImageMapLayerSettings.fromJSON(sampleSource);
    if (!settings)
      expect.fail("Could not create settings");

    stubGetServiceJson({ content: ArcGISMapLayerDataset.TilesOnlyDataset26918, accessTokenRequired: false });

    const provider = new ArcGISMapLayerImageryProvider(settings);
    await expect(provider.initialize()).rejects.toThrow(ServerError);
  });

  it("initialize() should turn ON use of tiles", async () => {
    const settings = ImageMapLayerSettings.fromJSON(sampleSource);
    if (!settings)
      expect.fail("Could not create settings");

    stubGetServiceJson({ content: ArcGISMapLayerDataset.UsaTopoMaps, accessTokenRequired: false });

    const provider = new ArcGISMapLayerImageryProvider(settings);
    await provider.initialize();
    expect((provider as any)._tilesOnly).toEqual(false);
    expect((provider as any)._mapSupported).toEqual(true);
    expect((provider as any)._tileMapSupported).toEqual(true);
    expect((provider as any)._tileMap).to.be.not.undefined;
    expect((provider as any)._usesCachedTiles).toBe(true);
  });

  it("initialize() should fallback to 'Export' queries instead of tiles when invalid CS ", async () => {
    const settings = ImageMapLayerSettings.fromJSON(sampleSource);
    if (!settings)
      expect.fail("Could not create settings");

    const dataset = JSON.parse(JSON.stringify(ArcGISMapLayerDataset.UsaTopoMaps));
    // Fake an unknown CS
    dataset.tileInfo.spatialReference.latestWkid = 1234;
    const responseJson = { content: dataset, accessTokenRequired: false };
    stubGetServiceJson(responseJson);

    const provider = new ArcGISMapLayerImageryProvider(settings);
    await provider.initialize();
    expect((provider as any)._tilesOnly).toEqual(false);
    expect((provider as any)._mapSupported).toEqual(true);
    expect((provider as any)._tileMapSupported).toEqual(true);
    expect((provider as any)._tileMap).toBeUndefined();
    expect((provider as any)._usesCachedTiles).toBe(false);
  });

  it("ArcGISIdentifyRequestUrl should create proper extent string ", async () => {
    const range: Range2dProps = { low: { x: 1, y: 2 }, high: { x: 3, y: 4 } };
    let extentStr = ArcGISIdentifyRequestUrl.getExtentString(range, 2);
    expect(extentStr).toEqual("1.00,2.00,3.00,4.00");
    extentStr = ArcGISIdentifyRequestUrl.getExtentString(range, 3);
    expect(extentStr).toEqual("1.000,2.000,3.000,4.000");
  });

  it("ArcGISIdentifyRequestUrl should create proper identify request ", async () => {
    const range: Range2dProps = { low: { x: 1, y: 2 }, high: { x: 3, y: 4 } };
    const props: ArcGISIdentifyRequestUrlProps = {
      geometry: { x: 1.0, y: 2.0 },
      geometryType: "esriGeometryPoint",
      tolerance: 1.0,
      mapExtent: range,
      imageDisplay: { width: 256, height: 256, dpi: 96 },
    };

    const baseUrl = "https://services7.arcgis.com/nZ2Vb4CUwdo9AIiQ/ArcGIS/rest/services/PhillyRailLines/MapServer";
    let url = ArcGISIdentifyRequestUrl.fromJSON(baseUrl, props);
    expect(url.toString()).toEqual(
      "https://services7.arcgis.com/nZ2Vb4CUwdo9AIiQ/ArcGIS/rest/services/PhillyRailLines/MapServer/identify?geometry=1%2C2&geometryType=esriGeometryPoint&tolerance=1&mapExtent=1%2C2%2C3%2C4&imageDisplay=256%2C256%2C96",
    );

    // exercise srFractionDigits
    url = ArcGISIdentifyRequestUrl.fromJSON(baseUrl, props, 2);
    expect(url.toString()).toEqual(
      "https://services7.arcgis.com/nZ2Vb4CUwdo9AIiQ/ArcGIS/rest/services/PhillyRailLines/MapServer/identify?geometry=1.00%2C2.00&geometryType=esriGeometryPoint&tolerance=1&mapExtent=1.00%2C2.00%2C3.00%2C4.00&imageDisplay=256%2C256%2C96",
    );

    // optional parameters
    url = ArcGISIdentifyRequestUrl.fromJSON(baseUrl, { ...props, f: "json", layers: { prefix: "visible", layerIds: ["2", "3"] }, maxAllowableOffset: 2.0, returnGeometry: true }, 2);
    expect(url.toString()).toEqual(
      "https://services7.arcgis.com/nZ2Vb4CUwdo9AIiQ/ArcGIS/rest/services/PhillyRailLines/MapServer/identify?f=json&geometry=1.00%2C2.00&geometryType=esriGeometryPoint&layers=visible%3A+2%2C3&tolerance=1&mapExtent=1.00%2C2.00%2C3.00%2C4.00&imageDisplay=256%2C256%2C96&returnGeometry=true&maxAllowableOffset=2.00",
    );
  });

  it("getIdentifyData should create proper identify request", async () => {
    const settings = ImageMapLayerSettings.fromJSON({
      ...sampleSource,
      subLayers: [
        { name: "layer1", id: "1", visible: false },
        { name: "layer2", id: "2", visible: true },
        { name: "layer3", id: "3", visible: true },
      ],
    });
    if (!settings)
      expect.fail("Could not create settings");

    const provider = new ArcGISMapLayerImageryProvider(settings);

    stubJsonFetch(JSON.stringify({}));

    const fromJSONSpy = vi.spyOn(ArcGISIdentifyRequestUrl, "fromJSON");

    // Fake those methods to avoid precision issues
    let i = 1;
    vi.spyOn(MapLayerImageryProvider.prototype, "getEPSG3857X").mockImplementation((_longitude: number) => i++);
    vi.spyOn(MapLayerImageryProvider.prototype, "getEPSG3857Y").mockImplementation((_longitude: number) => i++);
    const maxAllowableOffset = 2.0;
    (provider as any).getIdentifyData(new QuadId(3, 2, 1), Cartographic.fromRadians({ longitude: 0.1, latitude: 0.2, height: 0.3 }), 0.1, true, maxAllowableOffset);

    expect(fromJSONSpy).toHaveBeenCalled();
    const firstCall = fromJSONSpy.mock.calls[0];
    expect(firstCall[0]).toEqual(sampleSource.url);
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
      layers: { prefix: "top", layerIds: ["2", "3"] },
      returnGeometry: true,
      maxAllowableOffset,
    };

    expect(firstCall[1]).toEqual(reference);
    expect(firstCall[2]).toEqual(3);
  });

  it("should pass fetch function to ArcGISTileMap object", async () => {
    const settings = ImageMapLayerSettings.fromJSON(sampleSource);
    const unsaved = new URLSearchParams([
      ["key1_1", "value1_1"],
      ["key1_2", "value1_2"],
      ["testParam", "BAD"],
    ]);
    const saved = new URLSearchParams([
      ["key2_1", "value2_1"],
      ["key2_2", "value2_"],
    ]);
    settings.unsavedQueryParams = indexedArrayFromUrlParams(unsaved);
    settings.savedQueryParams = indexedArrayFromUrlParams(saved);
    if (!settings)
      expect.fail("Could not create settings");

    stubGetServiceJson({ content: ArcGISMapLayerDataset.UsaTopoMaps, accessTokenRequired: false });

    const provider = new ArcGISMapLayerImageryProvider(settings);
    await provider.initialize();
    const resolveChildren = (_childIds: QuadId[]) => {};

    const fetchStub = vi.spyOn(globalThis, "fetch").mockImplementation(async function (_input: RequestInfo | URL, _init?: RequestInit) {
      return Promise.resolve({
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => {},
      } as unknown as Response);
    });

    await (provider as any)._generateChildIds(QuadId.createFromContentId("1_0_0"), resolveChildren);
    expect(fetchStub).toHaveBeenCalledOnce();
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    expect(fetchStub.mock.calls[0][0].toString()).toContain(unsaved.toString());
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    expect(fetchStub.mock.calls[0][0].toString()).toContain(saved.toString());
  });
});
