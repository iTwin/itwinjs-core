/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { EmptyLocalization, ImageMapLayerSettings, ServerError } from "@itwin/core-common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuadId, WmtsCapabilities, WmtsCapability, WmtsMapLayerImageryProvider } from "../../../tile/internal";
import { IModelApp } from "../../../IModelApp";
import { RequestBasicCredentials } from "../../../request/Request";
import { fakeTextFetch } from "./MapLayerTestUtilities";
import { Range2d } from "@itwin/core-geometry";

const wmtsSampleSource = { formatId: "WMTS", url: "https://localhost/wmts", name: "Test WMTS" };
describe("WmtsMapLayerImageryProvider", () => {
  beforeEach(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (IModelApp.initialized)
      await IModelApp.shutdown();
  });

  it("initialize() should handle unknown exception from WmtsCapabilities", async () => {
    const settings =ImageMapLayerSettings.fromJSON(wmtsSampleSource);
    if (!settings)
      expect.fail("Could not create settings");

    vi.spyOn(WmtsCapabilities, "create").mockImplementation(async function _(_url: string, _credentials?: RequestBasicCredentials, _ignoreCache?: boolean) {
      throw { someError: "error" }; // eslint-disable-line no-throw-literal, @typescript-eslint/only-throw-error
    });
    const provider = new WmtsMapLayerImageryProvider(settings);
    await expect(provider.initialize()).rejects.toThrow(ServerError);
  });

  it("initialize() should handle unknown exception from WmtsCapabilities", async () => {
    const settings =ImageMapLayerSettings.fromJSON(wmtsSampleSource);
    if (!settings)
      expect.fail("Could not create settings");

    vi.spyOn(WmtsCapabilities, "create").mockImplementation(async function _(_url: string, _credentials?: RequestBasicCredentials, _ignoreCache?: boolean) {
      throw { someError: "error" }; // eslint-disable-line no-throw-literal, @typescript-eslint/only-throw-error
    });
    const provider = new WmtsMapLayerImageryProvider(settings);
    await expect(provider.initialize()).rejects.toThrow(ServerError);
  });

  it("construct proper tile url", async () => {
    const tileMatrixLevel0Identifier = "0";
    const tileMatrixSetIdentifier = "default";
    vi.spyOn(WmtsMapLayerImageryProvider.prototype, "getDisplayedTileMatrixSetAndLimits" as any).mockImplementation(() => {
      const  tileMatrixSet = {
        tileMatrix: [{identifier: tileMatrixLevel0Identifier}],
        identifier: tileMatrixSetIdentifier,
      };
      return  {tileMatrixSet};
    });

    const settings = ImageMapLayerSettings.fromJSON({formatId:"WMS", name: "", url: "https://sub.service.com/service"});
    let provider = new WmtsMapLayerImageryProvider(settings);
    let url = await provider.constructUrl(0,0,0);
    const refUrl = `https://sub.service.com/service?Service=WMTS&Version=1.0.0&Request=GetTile&Format=image%2Fpng&layer=&TileMatrixSet=${tileMatrixSetIdentifier}&TileMatrix=${tileMatrixLevel0Identifier}&TileCol=0&TileRow=0`;
    expect(url).toEqual(refUrl);

    const param1 = new URLSearchParams([["key1_1", "value1_1"], ["key1_2", "value1_2"]]);
    const param2 = new URLSearchParams([["key2_1", "value2_2"], ["key2_2", "value2_2"]]);
    settings.savedQueryParams = {};
    settings.unsavedQueryParams = {};
    param1.forEach((value: string, key: string) =>  settings.savedQueryParams![key] = value);
    param2.forEach((value: string, key: string) =>  settings.unsavedQueryParams![key] = value);

    provider = new WmtsMapLayerImageryProvider(settings);
    url = await provider.constructUrl(0,0,0);
    expect(url).toEqual(`${refUrl}&${param1.toString()}&${param2.toString()}`);
  });

  it("initialize() should handle unknown exception from WmtsCapabilities", async () => {
    const settings =ImageMapLayerSettings.fromJSON(wmtsSampleSource);
    if (!settings)
      expect.fail("Could not create settings");

    vi.spyOn(WmtsCapabilities, "create").mockRejectedValue(new Error('error'))

    const provider = new WmtsMapLayerImageryProvider(settings);
    await expect(provider.initialize()).rejects.toThrow(ServerError);
  });

  it("initialize() should handle unknown exception from WmtsCapabilities", async () => {
    const settings =ImageMapLayerSettings.fromJSON(wmtsSampleSource);
    if (!settings)
      expect.fail("Could not create settings");

    vi.spyOn(WmtsCapabilities, "create").mockImplementation(async function _(_url: string, _credentials?: RequestBasicCredentials, _ignoreCache?: boolean) {
      throw { someError: "error" }; // eslint-disable-line no-throw-literal, @typescript-eslint/only-throw-error
    });
    const provider = new WmtsMapLayerImageryProvider(settings);
    await expect(provider.initialize()).rejects.toThrow(ServerError);
  });

  it("construct proper tile url", async () => {
    const tileMatrixLevel0Identifier = "0";
    const tileMatrixSetIdentifier = "default";
    vi.spyOn(WmtsMapLayerImageryProvider.prototype, "getDisplayedTileMatrixSetAndLimits" as any).mockImplementation(() => {
      const  tileMatrixSet = {
        tileMatrix: [{identifier: tileMatrixLevel0Identifier}],
        identifier: tileMatrixSetIdentifier,
      };
      return  {tileMatrixSet};
    });

    const settings = ImageMapLayerSettings.fromJSON({formatId:"WMS", name: "", url: "https://sub.service.com/service"});
    let provider = new WmtsMapLayerImageryProvider(settings);
    let url = await provider.constructUrl(0,0,0);
    const refUrl = `https://sub.service.com/service?Service=WMTS&Version=1.0.0&Request=GetTile&Format=image%2Fpng&layer=&TileMatrixSet=${tileMatrixSetIdentifier}&TileMatrix=${tileMatrixLevel0Identifier}&TileCol=0&TileRow=0`;
    expect(url).toEqual(refUrl);

    const param1 = new URLSearchParams([["key1_1", "value1_1"], ["key1_2", "value1_2"]]);
    const param2 = new URLSearchParams([["key2_1", "value2_2"], ["key2_2", "value2_2"]]);
    settings.savedQueryParams = {};
    settings.unsavedQueryParams = {};
    param1.forEach((value: string, key: string) =>  settings.savedQueryParams![key] = value);
    param2.forEach((value: string, key: string) =>  settings.unsavedQueryParams![key] = value);

    provider = new WmtsMapLayerImageryProvider(settings);
    url = await provider.constructUrl(0,0,0);
    expect(url).toEqual(`${refUrl}&${param1.toString()}&${param2.toString()}`);
  });

  it("_generateChildIds should filter children by TileMatrixSetLimits", async () => {
    // Set up a mock that returns limits restricting which tiles are valid.
    // At level 1, only tile (col=1, row=1) is valid (matching great-artesian-basin level 1 limits).
    const tileMatrixSet: Partial<WmtsCapability.TileMatrixSet> = {
      tileMatrix: [
        { identifier: "0" } as WmtsCapability.TileMatrix,
        { identifier: "1" } as WmtsCapability.TileMatrix,
      ],
      identifier: "TestTMS",
    };

    // Level 1 limits: only col 1, row 1 is valid
    const limitsLevel1: Partial<WmtsCapability.TileMatrixSetLimits> = {
      tileMatrix: "1",
      limits: Range2d.createXYXY(1, 1, 1, 1), // MinTileCol=1, MinTileRow=1, MaxTileCol=1, MaxTileRow=1
    };

    vi.spyOn(WmtsMapLayerImageryProvider.prototype, "getDisplayedTileMatrixSetAndLimits" as any).mockImplementation(() => {
      return {
        tileMatrixSet,
        limits: [limitsLevel1 as WmtsCapability.TileMatrixSetLimits],
      };
    });

    const settings = ImageMapLayerSettings.fromJSON({ formatId: "WMTS", name: "test", url: "https://fake/wmts" });
    const provider = new WmtsMapLayerImageryProvider(settings);

    // Parent is at level 0, col 0, row 0. Children at level 1 are:
    // (col=0,row=0), (col=1,row=0), (col=0,row=1), (col=1,row=1)
    // Only (col=1,row=1) should be returned since limits restrict to col=1,row=1.
    const parentQuadId = new QuadId(0, 0, 0);
    let resolvedChildIds: QuadId[] = [];
    (provider as any)._generateChildIds(parentQuadId, (childIds: QuadId[]) => {
      resolvedChildIds = childIds;
    });

    // Limits are matched by tileMatrix identifier, so only tiles within col=1,row=1 are returned.
    expect(resolvedChildIds.length).toEqual(1);
    expect(resolvedChildIds[0].column).toEqual(1);
    expect(resolvedChildIds[0].row).toEqual(1);
  });

  it("construct tile url using resource url", async () => {
    const response = await fetch(`/assets/wmts_capabilities/wmts_resource_url.xml`);
    const text = await response.text();
    fakeTextFetch(text);

    const settings = ImageMapLayerSettings.fromJSON({formatId:"WMS", name: "", url: "https://sub.service.com/service"});
    let provider = new WmtsMapLayerImageryProvider(settings);
    await provider.initialize();
    const level = 2;
    const tileMatrixSet = "PropellerAeroTileMatrix"
    const row = 1;
    const column = 0;
    let url = await provider.constructUrl(row, column, level);
    const refUrl = `https://xyz.com/z4Q8VO7RRaAd9Lcao7Aa_9BrezD2tYwqkOVGHSX96Sc/${tileMatrixSet}/${level}/${column}/${row}.png`;
    expect(url).toEqual(refUrl);

    // Now test with custom parameters
    const param1 = new URLSearchParams([["key1_1", "value1_1"], ["key1_2", "value1_2"]]);
    const param2 = new URLSearchParams([["key2_1", "value2_2"], ["key2_2", "value2_2"]]);
    settings.savedQueryParams = {};
    settings.unsavedQueryParams = {};
    param1.forEach((value: string, key: string) =>  settings.savedQueryParams![key] = value);
    param2.forEach((value: string, key: string) =>  settings.unsavedQueryParams![key] = value);

    provider = new WmtsMapLayerImageryProvider(settings);
    await provider.initialize();
    url = url = await provider.constructUrl(row, column, level);
    expect(url).toEqual(`${refUrl}?${param1.toString()}&${param2.toString()}`);
  });
});
