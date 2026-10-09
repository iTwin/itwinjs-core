/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterEach, beforeEach, describe, expect, it, MockInstance, vi } from "vitest";
import { RealityDataProvider } from "@itwin/core-common";
import { MockRender } from "../internal/render/MockRender";
import { RealityDataSource } from "../RealityDataSource";
import { RealityDataSourceCesiumIonAssetImpl } from "../RealityDataSourceCesiumIonAssetImpl";
import { getCesiumAssetUrl } from "../tile/internal";

describe("Cesium ion external resources", () => {
  let source: RealityDataSource;
  let fetchStub: MockInstance<typeof fetch>;
  beforeEach(async () => {
    await MockRender.App.startup({ tileAdmin: { cesiumAccess: { getAssetEndpoint: async () => ({ url: "https://assets.example/123/tileset.json", accessToken: "fixture-token" }) } } });
    fetchStub = vi.spyOn(window, "fetch").mockImplementation(async () => new Response("{}"));
    source = (await RealityDataSourceCesiumIonAssetImpl.createFromKey({ provider: RealityDataProvider.CesiumIonAsset, format: "", id: getCesiumAssetUrl(123, "") }, undefined))!;
    await source.getRootDocument(undefined);
    fetchStub.mockClear();
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await MockRender.App.shutdown();
  });

  const cases = [
    { uri: "sub/splats.bin", url: "https://assets.example/123/sub/splats.bin", authorized: true },
    { uri: "https://assets.example/123/splats.bin", url: "https://assets.example/123/splats.bin", authorized: true },
    { uri: "../124/splats.bin", url: "https://assets.example/124/splats.bin", authorized: false },
    { uri: "https://assets.example/1234/splats.bin", url: "https://assets.example/1234/splats.bin", authorized: false },
    { uri: "https://external.example/splats.bin", url: "https://external.example/splats.bin", authorized: false },
  ];
  for (const fixture of cases) {
    it(`resolves buffers and external tilesets at ${fixture.uri} with scoped authorization`, async () => {
      await source.getTileContent(fixture.uri);
      await source.getTileJson(fixture.uri);
      for (const [url, options] of fetchStub.mock.calls) {
        expect(url).toBe(fixture.url);
        expect((options?.headers as Record<string, string>)?.authorization).toBe(fixture.authorized ? "Bearer fixture-token" : undefined);
      }
      expect(fetchStub).toHaveBeenCalledTimes(2);
    });
  }

  it("recognizes external tileset JSON with a query or fragment", () => {
    expect(source.getTileContentType("sub/tileset.JSON?version=2#root")).toBe("tileset");
    expect(source.getTileContentType("tile.glb?name=tileset.json")).toBe("tile");
  });
});
