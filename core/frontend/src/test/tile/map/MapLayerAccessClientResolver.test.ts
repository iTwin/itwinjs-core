/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { EmptyLocalization, ImageMapLayerSettings, MapLayerProviderProperties } from "@itwin/core-common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MapLayerAccessClient, MapLayerAccessClientResolverArgs, MapLayerImageryProvider } from "../../../tile/internal";
import { IModelApp } from "../../../IModelApp";

class TestImageryProvider extends MapLayerImageryProvider {
  public async constructUrl(row: number, column: number, zoomLevel: number) {
    return this.appendCustomParams(`${this._settings.url}/tile/${zoomLevel}/${row}/${column}`);
  }
}

const settingsUrl = "https://maps.example.com/wms";
const tileUrl = "https://maps.example.com/wms/tile/0/0/0";

function createProvider(props?: { url?: string, name?: string, properties?: MapLayerProviderProperties }): TestImageryProvider {
  const settings = ImageMapLayerSettings.fromJSON({
    formatId: "WMS",
    name: props?.name ?? "TestLayer",
    url: props?.url ?? settingsUrl,
    properties: props?.properties,
  });
  return new TestImageryProvider(settings, false);
}

function makeAccessClient(authorization: string): MapLayerAccessClient {
  return {
    getAccessToken: async () => undefined,
    applyToRequest: ({ headers }) => {
      headers.set("Authorization", authorization);
    },
  };
}

describe("MapLayerFormatRegistry access-client resolver", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
    fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (IModelApp.initialized)
      await IModelApp.shutdown();
  });

  const getRequestHeaders = (callIndex = 0): Headers | undefined => (fetchMock.mock.calls[callIndex][1] as RequestInit | undefined)?.headers as Headers | undefined;

  it("setAccessClientResolver returns false for an unregistered format", () => {
    expect(IModelApp.mapLayerFormatRegistry.setAccessClientResolver("NotAFormat", () => undefined)).toBe(false);
    expect(IModelApp.mapLayerFormatRegistry.setAccessClientResolver("WMS", () => undefined)).toBe(true);
  });

  it("getAccessClient without layer args returns the static client even when a resolver is registered", () => {
    const staticClient = makeAccessClient("Bearer static");
    const resolvedClient = makeAccessClient("Bearer resolved");
    IModelApp.mapLayerFormatRegistry.setAccessClient("WMS", staticClient);
    IModelApp.mapLayerFormatRegistry.setAccessClientResolver("WMS", () => resolvedClient);

    expect(IModelApp.mapLayerFormatRegistry.getAccessClient("WMS")).toBe(staticClient);
    expect(IModelApp.mapLayerFormatRegistry.getAccessClient("WMS", { layerUrl: settingsUrl })).toBe(resolvedClient);
  });

  it("resolver is authoritative for layer-identified lookups, including returning undefined", () => {
    IModelApp.mapLayerFormatRegistry.setAccessClient("WMS", makeAccessClient("Bearer static"));
    IModelApp.mapLayerFormatRegistry.setAccessClientResolver("WMS", () => undefined);

    expect(IModelApp.mapLayerFormatRegistry.getAccessClient("WMS", { layerUrl: settingsUrl })).toBeUndefined();
  });

  it("without a resolver, layer-identified lookups fall back to the static client", () => {
    const staticClient = makeAccessClient("Bearer static");
    IModelApp.mapLayerFormatRegistry.setAccessClient("WMS", staticClient);

    expect(IModelApp.mapLayerFormatRegistry.getAccessClient("WMS", { layerUrl: settingsUrl })).toBe(staticClient);
  });

  it("passes the layer's serializable identity to the resolver on tile requests", async () => {
    const resolver = vi.fn((_args: MapLayerAccessClientResolverArgs) => undefined);
    IModelApp.mapLayerFormatRegistry.setAccessClientResolver("WMS", resolver);

    const provider = createProvider({ name: "MyLayer", properties: { authClientId: "corpProxy" } });
    await provider.makeTileRequest(tileUrl);

    expect(resolver).toHaveBeenCalled();
    const args = resolver.mock.calls[0][0];
    expect(args.layerUrl).toEqual(settingsUrl);
    expect(args.name).toEqual("MyLayer");
    expect(args.properties).toEqual({ authClientId: "corpProxy" });
  });

  it("dispatches different access clients to different layers of the same format", async () => {
    const clients = new Map<string, MapLayerAccessClient>([
      ["corpProxy", makeAccessClient("Bearer corp-jwt")],
      ["publicOAuth", makeAccessClient("Bearer oauth-jwt")],
    ]);
    IModelApp.mapLayerFormatRegistry.setAccessClientResolver("WMS", (args) =>
      clients.get(args.properties?.authClientId as string));

    const corpProvider = createProvider({ properties: { authClientId: "corpProxy" } });
    const oauthProvider = createProvider({ url: "https://other.example.com/wms", properties: { authClientId: "publicOAuth" } });
    const plainProvider = createProvider();

    await corpProvider.makeTileRequest(tileUrl);
    await oauthProvider.makeTileRequest("https://other.example.com/wms/tile/0/0/0");
    await plainProvider.makeTileRequest(tileUrl);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(getRequestHeaders(0)?.get("Authorization")).toEqual("Bearer corp-jwt");
    expect(getRequestHeaders(1)?.get("Authorization")).toEqual("Bearer oauth-jwt");
    // No client resolved for the plain layer: its request is not shaped.
    expect(getRequestHeaders(2)?.get("Authorization") ?? null).toBeNull();
  });

  it("resolver dispatch survives serialization of the layer settings", async () => {
    const clients = new Map<string, MapLayerAccessClient>([["corpProxy", makeAccessClient("Bearer corp-jwt")]]);
    IModelApp.mapLayerFormatRegistry.setAccessClientResolver("WMS", (args) =>
      clients.get(args.properties?.authClientId as string));

    // Round-trip the settings through JSON, as happens when a view is saved and restored.
    const original = ImageMapLayerSettings.fromJSON({
      formatId: "WMS",
      name: "TestLayer",
      url: settingsUrl,
      properties: { authClientId: "corpProxy" },
    });
    const restored = ImageMapLayerSettings.fromJSON(JSON.parse(JSON.stringify(original.toJSON())));
    const provider = new TestImageryProvider(restored, false);
    await provider.makeTileRequest(tileUrl);

    expect(getRequestHeaders(0)?.get("Authorization")).toEqual("Bearer corp-jwt");
  });
});
