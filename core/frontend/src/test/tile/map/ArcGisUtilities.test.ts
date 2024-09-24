/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { afterEach, describe, expect, it, vi } from "vitest";
import { MapLayerSource, MapLayerSourceStatus } from "../../../core-frontend";
import { ArcGisGetServiceJsonArgs, ArcGisUtilities } from "../../../tile/map/ArcGisUtilities";
import { ArcGISMapLayerDataset } from "./ArcGISMapLayerDataset";
import { wsg84Lods256px, wsg84Lods512px } from "./Wgs84Lods";
import { indexedArrayFromUrlParams } from "./MapLayerTestUtilities";

function stubGetServiceJson(json: any) {
  return vi.spyOn(ArcGisUtilities, "getServiceJson").mockImplementation(async function _(_args: ArcGisGetServiceJsonArgs) {
    return json;
  });
}

const getSampleSource = () => {
  return MapLayerSource.fromJSON({
    name: "dummyFeatureLayer",
    url: "https://services7.arcgis.com/nZ2Vb4CUwdo9AIiQ/ArcGIS/rest/services/PhillyRailLines/MapServer",
    formatId: "Arcgis",
  });
};

const unsaved = new URLSearchParams([
  ["key1_1", "value1_1"],
  ["key1_2", "value1_2"],
  ["testParam", "BAD"],
]);
const saved = new URLSearchParams([
  ["key2_1", "value2_1"],
  ["key2_2", "value2_2"],
]);

const getSampleSourceWithQueryParams = () => {
  const source = getSampleSource();
  if (!source) {
    expect.fail();
  }

  source.unsavedQueryParams = indexedArrayFromUrlParams(unsaved);
  source.savedQueryParams = indexedArrayFromUrlParams(saved);
  return source;
};

const getSampleSourceWithQueryParamsAndCreds = () => {
  const source = getSampleSourceWithQueryParams();
  source.userName = "username1";
  source.password = "password1";
  return source;
};

describe("ArcGisUtilities", () => {
  const tolerance = 0.1;

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  it("should compute resolution and scale for LOD range", async () => {
    let scales = ArcGisUtilities.computeZoomLevelsScales(5, 10);
    expect(scales.length).toEqual(6);
    expect(scales[0].zoom).toEqual(5);
    expect(scales[5].zoom).toEqual(10);

    // Test scales for 256px tiles
    scales = ArcGisUtilities.computeZoomLevelsScales();
    expect(scales.length).toEqual(wsg84Lods256px.length);
    for (let i = 0; i < scales.length; i++) {
      expect(Math.abs(scales[i].resolution - wsg84Lods256px[i].resolution)).toBeLessThan(tolerance);
      expect(Math.abs(scales[i].scale - wsg84Lods256px[i].scale)).toBeLessThan(tolerance);
    }

    // Test scales for 512px tiles
    scales = ArcGisUtilities.computeZoomLevelsScales(0, 20, 0, 512);
    expect(scales.length).toEqual(wsg84Lods512px.length);
    for (let i = 0; i < scales.length; i++) {
      expect(Math.abs(scales[i].resolution - wsg84Lods512px[i].resolution)).toBeLessThan(tolerance);
      expect(Math.abs(scales[i].scale - wsg84Lods512px[i].scale)).toBeLessThan(tolerance);
    }

    // Make sure we can get zooms level one by one.
    for (let i = 0; i < wsg84Lods256px.length; i++) {
      scales = ArcGisUtilities.computeZoomLevelsScales(i, i, 0, 256);
      expect(scales.length).toEqual(1);
      expect(Math.abs(scales[0].resolution - wsg84Lods256px[i].resolution)).toBeLessThan(tolerance);
      expect(Math.abs(scales[0].scale - wsg84Lods256px[i].scale)).toBeLessThan(tolerance);
    }

    // Test parameters validation
    expect(ArcGisUtilities.computeZoomLevelsScales(-1, 20, 0, 0, 256).length).toEqual(0);
    expect(ArcGisUtilities.computeZoomLevelsScales(0, -20, 0, 0, 256).length).toEqual(0);
    expect(ArcGisUtilities.computeZoomLevelsScales(4, 1, 0, 256).length).toEqual(0);
    expect(ArcGisUtilities.computeZoomLevelsScales(0, 20, 0, -256).length).toEqual(0);
    expect(ArcGisUtilities.computeZoomLevelsScales(0, 20, 0, 256, 0).length).toEqual(0);
  });

  it("should match minScale/maxScale to corresponding LOD", async () => {
    let lods = ArcGisUtilities.getZoomLevelsScales(22, 256);
    expect(lods.minLod).toBeUndefined();
    expect(lods.maxLod).toBeUndefined();

    // We want the largest zoom level having a scale value smaller than minimum scale value
    // MinScale: 600 000
    // Zoom 9 has scale of 1155583, and Zoom 10 has scale value of 577791, so it should be zoom 9
    lods = ArcGisUtilities.getZoomLevelsScales(22, 256, 600000, undefined);
    expect(lods.minLod).toEqual(10);
    expect(lods.maxLod).toBeUndefined();

    // We want the smallest zoom level having a scale value greater than maximum scale value
    // Max Scale: 5000
    // Zoom 16 has scale of 9027, and Zoom 17 has scale value of 4513, so it should be zoom 16
    lods = ArcGisUtilities.getZoomLevelsScales(22, 256, undefined, 5000);
    expect(lods.minLod).toBeUndefined();
    expect(lods.maxLod).toEqual(16);
  });

  it("should validate by invoking getServiceJson with proper parameters ", async () => {
    const source = getSampleSourceWithQueryParamsAndCreds();
    const fetchStub = vi.spyOn(globalThis, "fetch").mockImplementation(async function (_input: RequestInfo | URL, _init?: RequestInit) {
      return Promise.resolve({
        status: 200,
        json: async () => {
          return {};
        },
      } as unknown as Response);
    });
    await ArcGisUtilities.getServiceJson({ url: source.url, formatId: source.formatId, userName: source.userName, password: source.password, queryParams: source.collectQueryParams() });

    expect(fetchStub).toHaveBeenCalledOnce();
    const firstCall = fetchStub.mock.calls[0];
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    expect(firstCall[0].toString()).toEqual(`${source.url}?f=json&${saved.toString()}&${unsaved.toString()}`);
  });

  it("should fetch service json with proper URL", async () => {
    const stub = stubGetServiceJson({ content: ArcGISMapLayerDataset.UsaTopoMaps, accessTokenRequired: false });
    const source = getSampleSourceWithQueryParamsAndCreds();

    await ArcGisUtilities.validateSource({ source, ignoreCache: true, capabilitiesFilter: [] });

    expect(stub).toHaveBeenCalledOnce();
    const firstCall = stub.mock.calls[0];
    const args = firstCall[0];
    expect(args.url).toEqual(source.url);
    expect(args.formatId).toEqual(source.formatId);
    expect(args.userName).toEqual(source.userName);
    expect(args.password).toEqual(source.password);
    expect(args.queryParams).toEqual(source.collectQueryParams());
  });

  it("should validate proper source", async () => {
    stubGetServiceJson({ content: ArcGISMapLayerDataset.UsaTopoMaps, accessTokenRequired: false });
    const result = ArcGisUtilities.validateSource({ source: getSampleSource()!, capabilitiesFilter: [] });
    expect((await result).status).toEqual(MapLayerSourceStatus.Valid);
  });

  it("validate should detect invalid coordinate system", async () => {
    stubGetServiceJson({ content: ArcGISMapLayerDataset.TilesOnlyDataset26918, accessTokenRequired: false });
    const result = ArcGisUtilities.validateSource({ source: getSampleSource()!, capabilitiesFilter: [] });
    expect((await result).status).toEqual(MapLayerSourceStatus.InvalidCoordinateSystem);
  });

  it("should validate url", async () => {
    let status = ArcGisUtilities.validateUrl("https://services7.arcgis.com/nZ2Vb4CUwdo9AIiQ/arcgis/rest/services/PhillyCityLandmarks/MapServer", "MapServer");
    expect(status).toEqual(MapLayerSourceStatus.Valid);

    status = ArcGisUtilities.validateUrl("https://services7.arcgis.com/nZ2Vb4CUwdo9AIiQ/arcgis/rest/services/PhillyCityLandmarks/MapServer", "mapserver");
    expect(status).toEqual(MapLayerSourceStatus.Valid);

    status = ArcGisUtilities.validateUrl("https://services7.arcgis.com/nZ2Vb4CUwdo9AIiQ/arcgis/rest/services/test/PhillyCityLandmarks/MapServer", "mapserver");
    expect(status).toEqual(MapLayerSourceStatus.Valid);

    status = ArcGisUtilities.validateUrl("https://services7.arcgis.com/nZ2Vb4CUwdo9AIiQ/arcgis/rest/services/PhillyCityLandmarks/MapServer", "FeatureServer");
    expect(status).toEqual(MapLayerSourceStatus.IncompatibleFormat);

    status = ArcGisUtilities.validateUrl("https://services7.arcgis.com/nZ2Vb4CUwdo9AIiQ/arcgis/restXYZ/services/PhillyCityLandmarks/MapServer", "FeatureServer");
    expect(status).toEqual(MapLayerSourceStatus.InvalidUrl);
  });
});
