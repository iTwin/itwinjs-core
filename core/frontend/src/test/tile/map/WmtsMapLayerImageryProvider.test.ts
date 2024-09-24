/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { EmptyLocalization, ImageMapLayerSettings, ServerError } from "@itwin/core-common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WmtsCapabilities, WmtsMapLayerImageryProvider } from "../../../tile/internal";
import { IModelApp } from "../../../IModelApp";
import { RequestBasicCredentials } from "../../../request/Request";

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
    const settings = ImageMapLayerSettings.fromJSON(wmtsSampleSource);
    if (!settings)
      expect.fail("Could not create settings");

    vi.spyOn(WmtsCapabilities, "create").mockImplementation(async function _(_url: string, _credentials?: RequestBasicCredentials, _ignoreCache?: boolean) {
      throw { someError: "error" }; // eslint-disable-line no-throw-literal
    });
    const provider = new WmtsMapLayerImageryProvider(settings);
    await expect(provider.initialize()).rejects.toThrow(ServerError);
  });

  it("initialize() should handle unknown exception from WmtsCapabilities", async () => {
    const settings = ImageMapLayerSettings.fromJSON(wmtsSampleSource);
    if (!settings)
      expect.fail("Could not create settings");

    vi.spyOn(WmtsCapabilities, "create").mockImplementation(async function _(_url: string, _credentials?: RequestBasicCredentials, _ignoreCache?: boolean) {
      throw { someError: "error" }; // eslint-disable-line no-throw-literal
    });
    const provider = new WmtsMapLayerImageryProvider(settings);
    await expect(provider.initialize()).rejects.toThrow(ServerError);
  });

  it("construct proper tile url", async () => {
    const tileMatrixLevel0Identifier = "0";
    const tileMatrixSetIdentifier = "default";
    vi.spyOn(WmtsMapLayerImageryProvider.prototype, "getDisplayedTileMatrixSetAndLimits" as any).mockImplementation(() => {
      const tileMatrixSet = {
        tileMatrix: [{ identifier: tileMatrixLevel0Identifier }],
        identifier: tileMatrixSetIdentifier,
      };
      return { tileMatrixSet };
    });

    const settings = ImageMapLayerSettings.fromJSON({ formatId: "WMS", name: "", url: "https://sub.service.com/service" });
    let provider = new WmtsMapLayerImageryProvider(settings);
    let url = await provider.constructUrl(0, 0, 0);
    const refUrl = `https://sub.service.com/service?Service=WMTS&Version=1.0.0&Request=GetTile&Format=image%2Fpng&layer=&TileMatrixSet=${tileMatrixSetIdentifier}&TileMatrix=${tileMatrixLevel0Identifier}&TileCol=0&TileRow=0`;
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

    provider = new WmtsMapLayerImageryProvider(settings);
    url = await provider.constructUrl(0, 0, 0);
    expect(url).toEqual(`${refUrl}&${param1.toString()}&${param2.toString()}`);
  });
});
