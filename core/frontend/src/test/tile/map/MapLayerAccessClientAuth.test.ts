/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { EmptyLocalization, ImageMapLayerSettings } from "@itwin/core-common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArcGisUtilities, MapLayerAccessClient, MapLayerAuthenticationFailedError, MapLayerImageryProvider, MapLayerImageryProviderStatus, MapLayerRequestAuthenticator, MapLayerSource, MapLayerSourceStatus } from "../../../tile/internal";
import { IModelApp } from "../../../IModelApp";
import { WmsMapLayerImageryProvider } from "../../../internal/tile/map/ImageryProviders/WmsMapLayerImageryProvider";
import { WmtsMapLayerImageryProvider } from "../../../internal/tile/map/ImageryProviders/WmtsMapLayerImageryProvider";
import { ArcGISMapLayerImageryProvider } from "../../../internal/tile/map/ImageryProviders/ArcGISMapLayerImageryProvider";
import { WmsCapabilities } from "../../../internal/tile/map/WmsCapabilities";
import { WmtsCapabilities } from "../../../internal/tile/map/WmtsCapabilities";

class TestImageryProvider extends MapLayerImageryProvider {
  public async constructUrl(row: number, column: number, zoomLevel: number) {
    return this.appendCustomParams(`${this._settings.url}/tile/${zoomLevel}/${row}/${column}`);
  }

  public async testToolTipFromUrl(strings: string[], url: string): Promise<void> {
    return this.toolTipFromUrl(strings, url);
  }
}

const settingsUrl = "https://maps.example.com/wms";
const tileUrl = "https://maps.example.com/wms/tile/0/0/0";

function createProvider(props?: { userName?: string, password?: string }): TestImageryProvider {
  const settings = ImageMapLayerSettings.fromJSON({
    formatId: "WMS",
    name: "TestLayer",
    url: settingsUrl,
  });
  if (props)
    settings.setCredentials(props.userName, props.password);
  return new TestImageryProvider(settings, false);
}

function makeAccessClient(overrides?: Partial<MapLayerAccessClient>): MapLayerAccessClient {
  return {
    getAccessToken: async () => undefined,
    applyToRequest: ({ searchParams, headers }) => {
      searchParams.set("clientParam", "clientParamValue");
      headers.set("Authorization", "Bearer secret-jwt");
    },
    ...overrides,
  };
}

function okResponse(): Response {
  return new Response(null, { status: 200 });
}

function ntlmChallengeResponse(): Response {
  return new Response(null, { status: 401, headers: { "WWW-Authenticate": "NTLM" } });
}

describe("MapLayerAccessClient request shaping", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
    fetchMock = vi.fn(async () => okResponse());
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (IModelApp.initialized)
      await IModelApp.shutdown();
  });

  const getRequestUrl = (callIndex = 0): string => String(fetchMock.mock.calls[callIndex][0]);
  const getRequestInit = (callIndex = 0): RequestInit | undefined => fetchMock.mock.calls[callIndex][1] as RequestInit | undefined;
  const getRequestHeaders = (callIndex = 0): Headers | undefined => getRequestInit(callIndex)?.headers as Headers | undefined;

  it("applies headers and query parameters from applyToRequest to tile requests", async () => {
    IModelApp.mapLayerFormatRegistry.setAccessClient("WMS", makeAccessClient());
    const provider = createProvider();
    await provider.makeTileRequest(tileUrl);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getRequestHeaders()?.get("Authorization")).toEqual("Bearer secret-jwt");
    const requested = new URL(getRequestUrl());
    expect(requested.searchParams.get("clientParam")).toEqual("clientParamValue");
    expect(requested.origin).toEqual("https://maps.example.com");
  });

  it("supports a standalone MapLayerRequestAuthenticator implementation composed into an access client", async () => {
    // A hosting application can author the request-shaping contract on its own, then compose it
    // into the client it registers - e.g. a proxy that requires a per-request signature.
    const proxyAuthenticator: MapLayerRequestAuthenticator = {
      applyToRequest: ({ url, searchParams, headers }) => {
        headers.set("Authorization", "Bearer proxy-jwt");
        headers.set("X-Correlation-Id", "abc-123");
        searchParams.set("sig", `signed(${new URL(url).pathname})`);
      },
      isAuthenticationError: ({ response }) => response.status === 407 || response.status === 401,
    };
    IModelApp.mapLayerFormatRegistry.setAccessClient("WMS", { getAccessToken: async () => undefined, ...proxyAuthenticator });

    const provider = createProvider();
    await provider.makeTileRequest(tileUrl);

    // Validate the exact request handed to fetch.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requested = new URL(getRequestUrl());
    expect(requested.origin).toEqual("https://maps.example.com");
    expect(requested.pathname).toEqual("/wms/tile/0/0/0");
    expect(requested.searchParams.get("sig")).toEqual("signed(/wms/tile/0/0/0)");
    const sentHeaders = getRequestHeaders();
    expect(sentHeaders?.get("Authorization")).toEqual("Bearer proxy-jwt");
    expect(sentHeaders?.get("X-Correlation-Id")).toEqual("abc-123");
    expect(getRequestInit()?.method).toEqual("GET");

    // And its custom failure classification.
    fetchMock.mockResolvedValue(new Response(null, { status: 407 }));
    await provider.makeRequest(tileUrl);
    expect(provider.status).toEqual(MapLayerImageryProviderStatus.RequireAuth);
  });

  it("provides the complete request URL and layer context to applyToRequest", async () => {
    let seenUrl: string | undefined;
    let seenLayerUrl: string | undefined;
    IModelApp.mapLayerFormatRegistry.setAccessClient("WMS", makeAccessClient({
      applyToRequest: ({ url, context }) => {
        seenUrl = url;
        seenLayerUrl = context.mapLayerUrl.toString();
      },
    }));
    const provider = createProvider();
    await provider.makeRequest(`${tileUrl}?embedded=1`);

    expect(seenUrl).toEqual(`${tileUrl}?embedded=1`);
    expect(seenLayerUrl).toEqual(settingsUrl);
  });

  it("applies client headers on top of basic-auth credentials", async () => {
    IModelApp.mapLayerFormatRegistry.setAccessClient("WMS", makeAccessClient());
    const provider = createProvider({ userName: "user", password: "pwd" });
    await provider.makeRequest(tileUrl);

    // The client has full control: its Authorization header wins over settings-derived basic auth.
    expect(getRequestHeaders()?.get("Authorization")).toEqual("Bearer secret-jwt");
  });

  it("refuses redirects on client-shaped requests while the trusted-origins restriction is enabled", async () => {
    IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins = true;
    IModelApp.mapLayerFormatRegistry.setAccessClient("WMS", makeAccessClient());
    const provider = createProvider();
    await provider.makeRequest(tileUrl);

    expect(getRequestInit()?.redirect).toEqual("error");
  });

  it("follows redirects on client-shaped requests while the restriction is disabled", async () => {
    IModelApp.mapLayerFormatRegistry.setAccessClient("WMS", makeAccessClient());
    const provider = createProvider();
    await provider.makeRequest(tileUrl);

    expect(getRequestInit()?.redirect).toBeUndefined();
  });

  it("does not retry with SSO credentials after an NTLM challenge on a client-shaped request", async () => {
    fetchMock.mockResolvedValue(ntlmChallengeResponse());
    IModelApp.mapLayerFormatRegistry.setAccessClient("WMS", makeAccessClient());
    const provider = createProvider();
    const response = await provider.makeRequest(tileUrl);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.status).toEqual(401);
  });

  it("transitions to RequireAuth on 401/403 for client-shaped requests by default", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    IModelApp.mapLayerFormatRegistry.setAccessClient("WMS", makeAccessClient());
    const provider = createProvider();
    await provider.makeRequest(tileUrl);

    expect(provider.status).toEqual(MapLayerImageryProviderStatus.RequireAuth);
  });

  it("lets isAuthenticationError classify protocol-specific failures", async () => {
    // An HTTP 200 whose body carries an embedded error code (e.g. ArcGIS-style).
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: { code: 499 } }), { status: 200 }));
    IModelApp.mapLayerFormatRegistry.setAccessClient("WMS", makeAccessClient({
      isAuthenticationError: async ({ response }) => {
        const json = await response.clone().json();
        return json?.error?.code === 499;
      },
    }));
    const provider = createProvider();
    const tileResponse = await provider.makeRequest(tileUrl);

    expect(provider.status).toEqual(MapLayerImageryProviderStatus.RequireAuth);
    // The response body must remain readable by the caller.
    expect((await tileResponse.json())?.error?.code).toEqual(499);
  });

  it("lets isAuthenticationError override the default 401 classification", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    IModelApp.mapLayerFormatRegistry.setAccessClient("WMS", makeAccessClient({
      isAuthenticationError: () => false,
    }));
    const provider = createProvider();
    await provider.makeRequest(tileUrl);

    expect(provider.status).toEqual(MapLayerImageryProviderStatus.Valid);
  });

  it("does not classify failures for requests that were not client-shaped", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    // Client without applyToRequest: legacy behavior, no classification.
    IModelApp.mapLayerFormatRegistry.setAccessClient("WMS", makeAccessClient({ applyToRequest: undefined }));
    const provider = createProvider();
    await provider.makeRequest(tileUrl);

    expect(provider.status).toEqual(MapLayerImageryProviderStatus.Valid);
  });

  it("does not alter requests when the registered client has no applyToRequest (backward compatibility)", async () => {
    IModelApp.mapLayerFormatRegistry.setAccessClient("WMS", makeAccessClient({ applyToRequest: undefined }));
    const provider = createProvider();
    await provider.makeRequest(tileUrl);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getRequestUrl()).toEqual(tileUrl);
    expect(getRequestHeaders()).toBeUndefined();
  });

  it("does not alter requests when no access client is registered for the format", async () => {
    const provider = createProvider();
    await provider.makeRequest(tileUrl);

    expect(getRequestUrl()).toEqual(tileUrl);
    expect(getRequestHeaders()).toBeUndefined();
  });

  it("shapes tooltip requests too", async () => {
    fetchMock.mockResolvedValue(new Response("tooltip text", { status: 200 }));
    IModelApp.mapLayerFormatRegistry.setAccessClient("WMS", makeAccessClient());
    const provider = createProvider();
    const strings: string[] = [];
    await provider.testToolTipFromUrl(strings, `${settingsUrl}/getFeatureInfo`);

    expect(getRequestHeaders()?.get("Authorization")).toEqual("Bearer secret-jwt");
    expect(new URL(getRequestUrl()).searchParams.get("clientParam")).toEqual("clientParamValue");
  });

  it("shapes WMS capabilities requests and transitions to RequireAuth on 401 during initialize", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    IModelApp.mapLayerFormatRegistry.setAccessClient("WMS", makeAccessClient());
    const settings = ImageMapLayerSettings.fromJSON({ formatId: "WMS", name: "TestLayer", url: settingsUrl });
    settings.unsavedQueryParams = { custom: "1" };
    const provider = new WmsMapLayerImageryProvider(settings);
    await provider.initialize();

    expect(getRequestHeaders()?.get("Authorization")).toEqual("Bearer secret-jwt");
    const requested = new URL(getRequestUrl());
    expect(requested.searchParams.get("clientParam")).toEqual("clientParamValue");
    // Settings custom params must reach the capabilities request made by initialize, like on the validate path.
    expect(requested.searchParams.get("custom")).toEqual("1");
    // Client shaping must not disturb the protocol parameters of the capabilities request.
    expect(requested.searchParams.get("request")).toEqual("GetCapabilities");
    expect(requested.searchParams.get("service")).toEqual("WMS");
    expect(provider.status).toEqual(MapLayerImageryProviderStatus.RequireAuth);
  });

  it("transitions to RequireAuth on 403 during initialize when requests are client-shaped", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }));
    IModelApp.mapLayerFormatRegistry.setAccessClient("WMS", makeAccessClient());
    const provider = new WmsMapLayerImageryProvider(ImageMapLayerSettings.fromJSON({ formatId: "WMS", name: "TestLayer", url: settingsUrl }));
    await provider.initialize();

    expect(provider.status).toEqual(MapLayerImageryProviderStatus.RequireAuth);
  });

  it("consults isAuthenticationError for capabilities requests during initialize", async () => {
    // A failure convention the default 401/403 rule cannot see: HTTP 200 with an error body.
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "TOKEN_EXPIRED" }), { status: 200 }));
    IModelApp.mapLayerFormatRegistry.setAccessClient("WMS", makeAccessClient({
      isAuthenticationError: async ({ response }) => {
        const json = await response.clone().json().catch(() => undefined);
        return json?.error === "TOKEN_EXPIRED";
      },
    }));
    const provider = new WmsMapLayerImageryProvider(ImageMapLayerSettings.fromJSON({ formatId: "WMS", name: "TestLayer", url: settingsUrl }));
    await provider.initialize();

    expect(provider.status).toEqual(MapLayerImageryProviderStatus.RequireAuth);
  });

  it("keeps throwing on 403 during initialize when no client shapes requests", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }));
    const provider = new WmsMapLayerImageryProvider(ImageMapLayerSettings.fromJSON({ formatId: "WMS", name: "TestLayer", url: settingsUrl }));
    await expect(provider.initialize()).rejects.toThrow();

    expect(provider.status).toEqual(MapLayerImageryProviderStatus.Valid);
  });

  it("transitions a WMTS layer to RequireAuth when its shaped capabilities request fails", async () => {
    // The initialize failure-conversion block is duplicated in the WMTS provider; guard it separately.
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }));
    IModelApp.mapLayerFormatRegistry.setAccessClient("WMTS", makeAccessClient());
    const settings = ImageMapLayerSettings.fromJSON({ formatId: "WMTS", name: "TestLayer", url: settingsUrl });
    settings.unsavedQueryParams = { custom: "1" };
    const provider = new WmtsMapLayerImageryProvider(settings);
    await provider.initialize();

    expect(getRequestHeaders()?.get("Authorization")).toEqual("Bearer secret-jwt");
    const requested = new URL(getRequestUrl());
    expect(requested.searchParams.get("clientParam")).toEqual("clientParamValue");
    expect(requested.searchParams.get("custom")).toEqual("1");
    expect(requested.searchParams.get("request")).toEqual("GetCapabilities");
    expect(requested.searchParams.get("service")).toEqual("WMTS");
    expect(provider.status).toEqual(MapLayerImageryProviderStatus.RequireAuth);
  });

  it("applies access client auth to ArcGIS service metadata requests", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { headers: { "content-type": "application/json" } }));
    IModelApp.mapLayerFormatRegistry.setAccessClient("ArcGIS", makeAccessClient());

    await ArcGisUtilities.getServiceJson({ url: "https://arcgis.example.com/MapServer", formatId: "ArcGIS" });

    expect(getRequestHeaders()?.get("Authorization")).toEqual("Bearer secret-jwt");
    const requested = new URL(getRequestUrl());
    expect(requested.searchParams.get("clientParam")).toEqual("clientParamValue");
    expect(requested.searchParams.get("f")).toEqual("json");
  });

  it("transitions an ArcGIS layer to RequireAuth when its shaped service metadata request fails", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }));
    IModelApp.mapLayerFormatRegistry.setAccessClient("ArcGIS", makeAccessClient());
    const provider = new ArcGISMapLayerImageryProvider(ImageMapLayerSettings.fromJSON({ formatId: "ArcGIS", name: "TestLayer", url: "https://arcgis.example.com/MapServer" }));

    // Must not throw: the tile tree is kept alive so the application can offer re-authentication.
    await provider.initialize();

    expect(provider.status).toEqual(MapLayerImageryProviderStatus.RequireAuth);
  });

  it("reports RequireAuth from ArcGIS source validation when the shaped metadata request fails", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }));
    IModelApp.mapLayerFormatRegistry.setAccessClient("ArcGIS", makeAccessClient());
    const source = MapLayerSource.fromJSON({ formatId: "ArcGIS", name: "TestLayer", url: "https://arcgis.example.com/MapServer" })!;

    const validation = await ArcGisUtilities.validateSource({ source, capabilitiesFilter: ["Map"] });

    expect(validation.status).toEqual(MapLayerSourceStatus.RequireAuth);
  });

  it("uses the client's isAuthenticationError to classify shaped ArcGIS provider responses", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 407 }));
    IModelApp.mapLayerFormatRegistry.setAccessClient("ArcGIS", makeAccessClient({
      isAuthenticationError: ({ response }) => response.status === 407,
    }));
    const provider = new ArcGISMapLayerImageryProvider(ImageMapLayerSettings.fromJSON({ formatId: "ArcGIS", name: "TestLayer", url: "https://arcgis.example.com/MapServer" }));

    await (provider as any).fetch(new URL("https://arcgis.example.com/MapServer/tile/0/0/0"), { method: "GET" });

    expect(provider.status).toEqual(MapLayerImageryProviderStatus.RequireAuth);
  });

  it("applies access client auth to ArcGIS provider requests", async () => {
    fetchMock.mockResolvedValue(okResponse());
    IModelApp.mapLayerFormatRegistry.setAccessClient("ArcGIS", makeAccessClient());
    const provider = new ArcGISMapLayerImageryProvider(ImageMapLayerSettings.fromJSON({ formatId: "ArcGIS", name: "TestLayer", url: "https://arcgis.example.com/MapServer" }));

    await (provider as any).fetch(new URL("https://arcgis.example.com/MapServer/tile/0/0/0"), { method: "GET" });

    expect(getRequestHeaders()?.get("Authorization")).toEqual("Bearer secret-jwt");
    expect(new URL(getRequestUrl()).searchParams.get("clientParam")).toEqual("clientParamValue");
  });

  it("preserves settings custom query parameters on shaped tile requests", async () => {
    IModelApp.mapLayerFormatRegistry.setAccessClient("WMS", makeAccessClient());
    const settings = ImageMapLayerSettings.fromJSON({ formatId: "WMS", name: "TestLayer", url: settingsUrl });
    settings.savedQueryParams = { saved: "1" };
    settings.unsavedQueryParams = { unsaved: "2" };
    const provider = new TestImageryProvider(settings, false);

    // Mirror the real tile flow: loadTile constructs the URL (custom params included) then requests it.
    await provider.makeTileRequest(await provider.constructUrl(0, 0, 0));

    const requested = new URL(getRequestUrl());
    expect(requested.searchParams.get("saved")).toEqual("1");
    expect(requested.searchParams.get("unsaved")).toEqual("2");
    expect(requested.searchParams.get("clientParam")).toEqual("clientParamValue");
    expect(getRequestHeaders()?.get("Authorization")).toEqual("Bearer secret-jwt");
  });

  it("preserves settings custom query parameters on shaped ArcGIS provider requests", async () => {
    fetchMock.mockResolvedValue(okResponse());
    IModelApp.mapLayerFormatRegistry.setAccessClient("ArcGIS", makeAccessClient());
    const settings = ImageMapLayerSettings.fromJSON({ formatId: "ArcGIS", name: "TestLayer", url: "https://arcgis.example.com/MapServer" });
    settings.unsavedQueryParams = { custom: "1" };
    const provider = new ArcGISMapLayerImageryProvider(settings);

    await (provider as any).fetch(new URL("https://arcgis.example.com/MapServer/tile/0/0/0"), { method: "GET" });

    const requested = new URL(getRequestUrl());
    expect(requested.searchParams.get("custom")).toEqual("1");
    expect(requested.searchParams.get("clientParam")).toEqual("clientParamValue");
    expect(getRequestHeaders()?.get("Authorization")).toEqual("Bearer secret-jwt");
  });

  it("preserves custom query parameters on shaped WMS capabilities validation requests", async () => {
    // MapLayerImageryFormats.validate passes source.collectQueryParams() to create().
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));

    await expect(WmsCapabilities.create(settingsUrl, undefined, true, { custom: "1" }, makeAccessClient()))
      .rejects.toBeInstanceOf(MapLayerAuthenticationFailedError);

    const requested = new URL(getRequestUrl());
    expect(requested.searchParams.get("custom")).toEqual("1");
    expect(requested.searchParams.get("clientParam")).toEqual("clientParamValue");
    expect(requested.searchParams.get("request")).toEqual("GetCapabilities");
    expect(getRequestHeaders()?.get("Authorization")).toEqual("Bearer secret-jwt");
  });

  it("preserves custom query parameters on shaped WMTS capabilities validation requests", async () => {
    // The queryParams merge is duplicated in WmtsCapabilities.create; guard it separately.
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));

    await expect(WmtsCapabilities.create(settingsUrl, undefined, true, { custom: "1" }, makeAccessClient()))
      .rejects.toBeInstanceOf(MapLayerAuthenticationFailedError);

    const requested = new URL(getRequestUrl());
    expect(requested.searchParams.get("custom")).toEqual("1");
    expect(requested.searchParams.get("clientParam")).toEqual("clientParamValue");
    expect(requested.searchParams.get("request")).toEqual("GetCapabilities");
    expect(getRequestHeaders()?.get("Authorization")).toEqual("Bearer secret-jwt");
  });

  it("propagates applyToRequest failures instead of issuing the request unshaped", async () => {
    IModelApp.mapLayerFormatRegistry.setAccessClient("WMS", makeAccessClient({
      applyToRequest: ({ headers }) => {
        headers.set("Authorization", "Bearer partial");
        throw new Error("token service unreachable");
      },
    }));
    const provider = createProvider();

    await expect(provider.makeRequest(tileUrl)).rejects.toThrow("token service unreachable");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips the tooltip request when applyToRequest fails", async () => {
    IModelApp.mapLayerFormatRegistry.setAccessClient("WMS", makeAccessClient({
      applyToRequest: () => {
        throw new Error("token service unreachable");
      },
    }));
    const provider = createProvider();
    const strings: string[] = [];
    // Must neither reject (getToolTip callers do not catch) nor fall back to an unshaped request.
    await provider.testToolTipFromUrl(strings, `${settingsUrl}/getFeatureInfo`);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(strings).toHaveLength(0);
  });

  it("issues a non-absolute URL unshaped rather than failing", async () => {
    IModelApp.mapLayerFormatRegistry.setAccessClient("WMS", makeAccessClient());
    const provider = createProvider();
    await provider.makeRequest("relative/tile/0/0/0");

    expect(getRequestUrl()).toEqual("relative/tile/0/0/0");
    expect(getRequestHeaders()).toBeUndefined();
  });

  it("re-shapes and protects the ArcGIS HTML-fallback request and classifies its response", async () => {
    IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins = true;
    IModelApp.mapLayerFormatRegistry.setAccessClient("ArcGIS", makeAccessClient());
    fetchMock.mockResolvedValueOnce(new Response("<html></html>", { status: 200, headers: { "content-type": "text/html" } }));
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    const provider = new ArcGISMapLayerImageryProvider(ImageMapLayerSettings.fromJSON({ formatId: "ArcGIS", name: "TestLayer", url: "https://arcgis.example.com/MapServer" }));

    await (provider as any).fetch(new URL("https://arcgis.example.com/MapServer/tile/0/0/0"), { method: "GET" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const fallbackUrl = new URL(getRequestUrl(1));
    expect(fallbackUrl.searchParams.get("f")).toEqual("json");
    expect(fallbackUrl.searchParams.get("clientParam")).toEqual("clientParamValue");
    expect(getRequestHeaders(1)?.get("Authorization")).toEqual("Bearer secret-jwt");
    // The follow-up request must carry the same redirect policy as the initial shaped request.
    expect(getRequestInit(1)?.redirect).toEqual("error");
    // The final (fallback) response is the one classified.
    expect(provider.status).toEqual(MapLayerImageryProviderStatus.RequireAuth);
  });
});
