/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { EmptyLocalization, ImageMapLayerSettings } from "@itwin/core-common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArcGisUtilities, MapLayerAuthenticationFailedError, MapLayerImageryProvider, MapLayerImageryProviderStatus, MapLayerSource, MapLayerSourceStatus } from "../../../tile/internal";
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

/** Registers a request listener injecting a header and a query parameter, declared as injecting
 * credentials — the typical authenticating listener.
 */
function addCredentialedListener(): void {
  IModelApp.mapLayerFormatRegistry.addMapLayerRequestListener((request) => {
    request.searchParams.set("clientParam", "clientParamValue");
    request.headers.set("Authorization", "Bearer secret-jwt");
  }, { injectsCredentials: true });
}

function okResponse(): Response {
  return new Response(null, { status: 200 });
}

function ntlmChallengeResponse(): Response {
  return new Response(null, { status: 401, headers: { "WWW-Authenticate": "NTLM" } });
}

describe("map-layer request/response events", () => {
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

  it("applies headers and query parameters from request listeners to tile requests", async () => {
    addCredentialedListener();
    const provider = createProvider();
    await provider.makeTileRequest(tileUrl);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getRequestHeaders()?.get("Authorization")).toEqual("Bearer secret-jwt");
    const requested = new URL(getRequestUrl());
    expect(requested.searchParams.get("clientParam")).toEqual("clientParamValue");
    expect(requested.origin).toEqual("https://maps.example.com");
  });

  it("supports paired request and response listeners, like a delegating message handler", async () => {
    // A proxy that requires a per-request signature and reports failures with its own status code.
    const registry = IModelApp.mapLayerFormatRegistry;
    registry.addMapLayerRequestListener((request) => {
      request.headers.set("Authorization", "Bearer proxy-jwt");
      request.headers.set("X-Correlation-Id", "abc-123");
      request.searchParams.set("sig", `signed(${new URL(request.url).pathname})`);
    }, { injectsCredentials: true });
    registry.addMapLayerResponseListener((rsp) => {
      rsp.failure = (rsp.response.status === 407 || rsp.response.status === 401) ? "authentication" : undefined;
    });

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

  it("awaits listeners in registration order", async () => {
    const registry = IModelApp.mapLayerFormatRegistry;
    registry.addMapLayerRequestListener(async (request) => {
      await Promise.resolve();  // asynchronous listeners must complete before the next one runs
      request.headers.set("Authorization", "Bearer first");
    }, { injectsCredentials: false });
    registry.addMapLayerRequestListener((request) => {
      // The second listener observes the first one's mutation.
      expect(request.headers.get("Authorization")).toEqual("Bearer first");
      request.headers.set("Authorization", "Bearer second");
    }, { injectsCredentials: false });
    const provider = createProvider();
    await provider.makeRequest(tileUrl);

    expect(getRequestHeaders()?.get("Authorization")).toEqual("Bearer second");
  });

  it("provides the complete request URL, format and layer context to listeners", async () => {
    let seenUrl: string | undefined;
    let seenLayerUrl: string | undefined;
    let seenFormatId: string | undefined;
    IModelApp.mapLayerFormatRegistry.addMapLayerRequestListener(({ url, layerUrl, formatId }) => {
      seenUrl = url;
      seenLayerUrl = layerUrl;
      seenFormatId = formatId;
    }, { injectsCredentials: false });
    const provider = createProvider();
    await provider.makeRequest(`${tileUrl}?embedded=1`);

    expect(seenUrl).toEqual(`${tileUrl}?embedded=1`);
    expect(seenLayerUrl).toEqual(settingsUrl);
    expect(seenFormatId).toEqual("WMS");
  });

  it("passes the layer's settings URL as layerUrl on capabilities requests too", async () => {
    const seenLayerUrls: string[] = [];
    IModelApp.mapLayerFormatRegistry.addMapLayerRequestListener(({ layerUrl }) => { seenLayerUrls.push(layerUrl); }, { injectsCredentials: false });
    // A settings URL whose query is stripped from the GetCapabilities request URL.
    const urlWithQuery = `${settingsUrl}?embedded=1`;
    const provider = new WmsMapLayerImageryProvider(ImageMapLayerSettings.fromJSON({ formatId: "WMS", name: "TestLayer", url: urlWithQuery }));
    await provider.initialize();

    // The GetCapabilities request URL differs from the layer URL; per-layer credential lookups must still match.
    expect(seenLayerUrls).toEqual([urlWithQuery]);
  });

  it("applies listener headers on top of basic-auth credentials", async () => {
    addCredentialedListener();
    const provider = createProvider({ userName: "user", password: "pwd" });
    await provider.makeRequest(tileUrl);

    // Listeners have full control: their Authorization header wins over settings-derived basic auth.
    expect(getRequestHeaders()?.get("Authorization")).toEqual("Bearer secret-jwt");
  });

  it("refuses redirects on credentialed shaped requests while the trusted-origins restriction is enabled", async () => {
    IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins = true;
    addCredentialedListener();
    const provider = createProvider();
    await provider.makeRequest(tileUrl);

    expect(getRequestInit()?.redirect).toEqual("error");
  });

  it("follows redirects on credentialed shaped requests while the restriction is disabled", async () => {
    addCredentialedListener();
    const provider = createProvider();
    await provider.makeRequest(tileUrl);

    expect(getRequestInit()?.redirect).toBeUndefined();
  });

  it("does not restrict redirects when no credentialed listener is registered", async () => {
    IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins = true;
    // A listener injecting only non-secret values registers with injectsCredentials: false.
    IModelApp.mapLayerFormatRegistry.addMapLayerRequestListener(({ headers }) => headers.set("X-Correlation-Id", "abc-123"), { injectsCredentials: false });
    const provider = createProvider();
    await provider.makeRequest(tileUrl);

    expect(getRequestHeaders()?.get("X-Correlation-Id")).toEqual("abc-123");
    expect(getRequestInit()?.redirect).toBeUndefined();
  });

  it("does not retry with SSO credentials after an NTLM challenge on a credentialed shaped request", async () => {
    fetchMock.mockResolvedValue(ntlmChallengeResponse());
    addCredentialedListener();
    const provider = createProvider();
    const response = await provider.makeRequest(tileUrl);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.status).toEqual(401);
  });

  it("still retries with SSO credentials when no credentialed listener is registered", async () => {
    fetchMock.mockResolvedValue(ntlmChallengeResponse());
    IModelApp.mapLayerFormatRegistry.addMapLayerRequestListener(({ headers }) => headers.set("X-Correlation-Id", "abc-123"), { injectsCredentials: false });
    const provider = createProvider();
    await provider.makeRequest(tileUrl);

    // The 401 NTLM challenge is answered with a browser-credentials retry, as without listeners.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getRequestInit(1)?.credentials).toEqual("include");
  });

  it("transitions to RequireAuth on 401/403 for credentialed shaped requests by default", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    addCredentialedListener();
    const provider = createProvider();
    await provider.makeRequest(tileUrl);

    expect(provider.status).toEqual(MapLayerImageryProviderStatus.RequireAuth);
  });

  it("lets response listeners recognize protocol-specific failures", async () => {
    // An HTTP 200 whose body carries an embedded error code (e.g. ArcGIS-style).
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: { code: 499 } }), { status: 200 }));
    IModelApp.mapLayerFormatRegistry.addMapLayerResponseListener(async (rsp) => {
      const json = await rsp.response.clone().json();
      if (json?.error?.code === 499)
        rsp.failure = "authentication";
    });
    const provider = createProvider();
    const tileResponse = await provider.makeRequest(tileUrl);

    expect(provider.status).toEqual(MapLayerImageryProviderStatus.RequireAuth);
    // The response body must remain readable by the caller.
    expect((await tileResponse.json())?.error?.code).toEqual(499);
  });

  it("prefills failure with the default classification and lets listeners clear it", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    addCredentialedListener();
    const seenFailures: Array<string | undefined> = [];
    IModelApp.mapLayerFormatRegistry.addMapLayerResponseListener((rsp) => {
      seenFailures.push(rsp.failure);
      rsp.failure = undefined;    // suppress the default 401 classification
    });
    const provider = createProvider();
    await provider.makeRequest(tileUrl);

    expect(seenFailures).toEqual(["authentication"]);
    expect(provider.status).toEqual(MapLayerImageryProviderStatus.Valid);
  });

  it("lets response listeners classify responses to unshaped requests", async () => {
    // Response listeners see every map-layer response, even without any request listener.
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    IModelApp.mapLayerFormatRegistry.addMapLayerResponseListener((rsp) => {
      if (rsp.response.status === 401)
        rsp.failure = "authentication";
    });
    const provider = createProvider();
    await provider.makeRequest(tileUrl);

    expect(provider.status).toEqual(MapLayerImageryProviderStatus.RequireAuth);
  });

  it("does not apply the default 401 classification when no credentialed listener is registered", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    IModelApp.mapLayerFormatRegistry.addMapLayerRequestListener(({ headers }) => headers.set("X-Correlation-Id", "abc-123"), { injectsCredentials: false });
    const provider = createProvider();
    await provider.makeRequest(tileUrl);

    expect(provider.status).toEqual(MapLayerImageryProviderStatus.Valid);
  });

  it("stops shaping requests once a listener is removed", async () => {
    const removeListener = IModelApp.mapLayerFormatRegistry.addMapLayerRequestListener(({ headers }) => headers.set("Authorization", "Bearer secret-jwt"), { injectsCredentials: true });
    removeListener();
    const provider = createProvider();
    await provider.makeRequest(tileUrl);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getRequestUrl()).toEqual(tileUrl);
    expect(getRequestHeaders()).toBeUndefined();
  });

  it("does not alter requests when no listener is registered", async () => {
    const provider = createProvider();
    await provider.makeRequest(tileUrl);

    expect(getRequestUrl()).toEqual(tileUrl);
    expect(getRequestHeaders()).toBeUndefined();
  });

  it("shapes tooltip requests too", async () => {
    fetchMock.mockResolvedValue(new Response("tooltip text", { status: 200 }));
    addCredentialedListener();
    const provider = createProvider();
    const strings: string[] = [];
    await provider.testToolTipFromUrl(strings, `${settingsUrl}/getFeatureInfo`);

    expect(getRequestHeaders()?.get("Authorization")).toEqual("Bearer secret-jwt");
    expect(new URL(getRequestUrl()).searchParams.get("clientParam")).toEqual("clientParamValue");
  });

  it("shapes WMS capabilities requests and transitions to RequireAuth on 401 during initialize", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    addCredentialedListener();
    const settings = ImageMapLayerSettings.fromJSON({ formatId: "WMS", name: "TestLayer", url: settingsUrl });
    settings.unsavedQueryParams = { custom: "1" };
    const provider = new WmsMapLayerImageryProvider(settings);
    await provider.initialize();

    expect(getRequestHeaders()?.get("Authorization")).toEqual("Bearer secret-jwt");
    const requested = new URL(getRequestUrl());
    expect(requested.searchParams.get("clientParam")).toEqual("clientParamValue");
    // Settings custom params must reach the capabilities request made by initialize, like on the validate path.
    expect(requested.searchParams.get("custom")).toEqual("1");
    // Listener shaping must not disturb the protocol parameters of the capabilities request.
    expect(requested.searchParams.get("request")).toEqual("GetCapabilities");
    expect(requested.searchParams.get("service")).toEqual("WMS");
    expect(provider.status).toEqual(MapLayerImageryProviderStatus.RequireAuth);
  });

  it("transitions to RequireAuth on 403 during initialize when requests are shaped with credentials", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }));
    addCredentialedListener();
    const provider = new WmsMapLayerImageryProvider(ImageMapLayerSettings.fromJSON({ formatId: "WMS", name: "TestLayer", url: settingsUrl }));
    await provider.initialize();

    expect(provider.status).toEqual(MapLayerImageryProviderStatus.RequireAuth);
  });

  it("consults response listeners for capabilities requests during initialize", async () => {
    // A failure convention the default 401/403 rule cannot see: HTTP 200 with an error body.
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: "TOKEN_EXPIRED" }), { status: 200 }));
    IModelApp.mapLayerFormatRegistry.addMapLayerResponseListener(async (rsp) => {
      const json = await rsp.response.clone().json().catch(() => undefined);
      if (json?.error === "TOKEN_EXPIRED")
        rsp.failure = "authentication";
    });
    const provider = new WmsMapLayerImageryProvider(ImageMapLayerSettings.fromJSON({ formatId: "WMS", name: "TestLayer", url: settingsUrl }));
    await provider.initialize();

    expect(provider.status).toEqual(MapLayerImageryProviderStatus.RequireAuth);
  });

  it("keeps throwing on 403 during initialize when no listener is registered", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }));
    const provider = new WmsMapLayerImageryProvider(ImageMapLayerSettings.fromJSON({ formatId: "WMS", name: "TestLayer", url: settingsUrl }));
    await expect(provider.initialize()).rejects.toThrow();

    expect(provider.status).toEqual(MapLayerImageryProviderStatus.Valid);
  });

  it("transitions a WMTS layer to RequireAuth when its shaped capabilities request fails", async () => {
    // The initialize failure-conversion block is duplicated in the WMTS provider; guard it separately.
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }));
    addCredentialedListener();
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

  it("shapes ArcGIS service metadata requests", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { headers: { "content-type": "application/json" } }));
    addCredentialedListener();

    await ArcGisUtilities.getServiceJson({ url: "https://arcgis.example.com/MapServer", formatId: "ArcGIS" });

    expect(getRequestHeaders()?.get("Authorization")).toEqual("Bearer secret-jwt");
    const requested = new URL(getRequestUrl());
    expect(requested.searchParams.get("clientParam")).toEqual("clientParamValue");
    expect(requested.searchParams.get("f")).toEqual("json");
  });

  it("transitions an ArcGIS layer to RequireAuth when its shaped service metadata request fails", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }));
    addCredentialedListener();
    const provider = new ArcGISMapLayerImageryProvider(ImageMapLayerSettings.fromJSON({ formatId: "ArcGIS", name: "TestLayer", url: "https://arcgis.example.com/MapServer" }));

    // Must not throw: the tile tree is kept alive so the application can offer re-authentication.
    await provider.initialize();

    expect(provider.status).toEqual(MapLayerImageryProviderStatus.RequireAuth);
  });

  it("reports RequireAuth from ArcGIS source validation when the shaped metadata request fails", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }));
    addCredentialedListener();
    const source = MapLayerSource.fromJSON({ formatId: "ArcGIS", name: "TestLayer", url: "https://arcgis.example.com/MapServer" })!;

    const validation = await ArcGisUtilities.validateSource({ source, capabilitiesFilter: ["Map"] });

    expect(validation.status).toEqual(MapLayerSourceStatus.RequireAuth);
  });

  it("uses response listeners to classify ArcGIS provider responses", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 407 }));
    IModelApp.mapLayerFormatRegistry.addMapLayerResponseListener((rsp) => {
      if (rsp.response.status === 407)
        rsp.failure = "authentication";
    });
    const provider = new ArcGISMapLayerImageryProvider(ImageMapLayerSettings.fromJSON({ formatId: "ArcGIS", name: "TestLayer", url: "https://arcgis.example.com/MapServer" }));

    await (provider as any).fetch(new URL("https://arcgis.example.com/MapServer/tile/0/0/0"), { method: "GET" });

    expect(provider.status).toEqual(MapLayerImageryProviderStatus.RequireAuth);
  });

  it("shapes ArcGIS provider requests", async () => {
    fetchMock.mockResolvedValue(okResponse());
    addCredentialedListener();
    const provider = new ArcGISMapLayerImageryProvider(ImageMapLayerSettings.fromJSON({ formatId: "ArcGIS", name: "TestLayer", url: "https://arcgis.example.com/MapServer" }));

    await (provider as any).fetch(new URL("https://arcgis.example.com/MapServer/tile/0/0/0"), { method: "GET" });

    expect(getRequestHeaders()?.get("Authorization")).toEqual("Bearer secret-jwt");
    expect(new URL(getRequestUrl()).searchParams.get("clientParam")).toEqual("clientParamValue");
  });

  it("preserves settings custom query parameters on shaped tile requests", async () => {
    addCredentialedListener();
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
    addCredentialedListener();
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
    addCredentialedListener();

    await expect(WmsCapabilities.create(settingsUrl, { ignoreCache: true, queryParams: { custom: "1" } }))
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
    addCredentialedListener();

    await expect(WmtsCapabilities.create(settingsUrl, { ignoreCache: true, queryParams: { custom: "1" } }))
      .rejects.toBeInstanceOf(MapLayerAuthenticationFailedError);

    const requested = new URL(getRequestUrl());
    expect(requested.searchParams.get("custom")).toEqual("1");
    expect(requested.searchParams.get("clientParam")).toEqual("clientParamValue");
    expect(requested.searchParams.get("request")).toEqual("GetCapabilities");
    expect(getRequestHeaders()?.get("Authorization")).toEqual("Bearer secret-jwt");
  });

  it("propagates listener failures instead of issuing the request unshaped", async () => {
    IModelApp.mapLayerFormatRegistry.addMapLayerRequestListener(({ headers }) => {
      headers.set("Authorization", "Bearer partial");
      throw new Error("token service unreachable");
    }, { injectsCredentials: true });
    const provider = createProvider();

    await expect(provider.makeRequest(tileUrl)).rejects.toThrow("token service unreachable");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips the tooltip request when a listener fails", async () => {
    IModelApp.mapLayerFormatRegistry.addMapLayerRequestListener(() => {
      throw new Error("token service unreachable");
    }, { injectsCredentials: true });
    const provider = createProvider();
    const strings: string[] = [];
    // Must neither reject (getToolTip callers do not catch) nor fall back to an unshaped request.
    await provider.testToolTipFromUrl(strings, `${settingsUrl}/getFeatureInfo`);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(strings).toHaveLength(0);
  });

  it("issues a non-absolute URL unshaped rather than failing", async () => {
    addCredentialedListener();
    const provider = createProvider();
    await provider.makeRequest("relative/tile/0/0/0");

    expect(getRequestUrl()).toEqual("relative/tile/0/0/0");
    expect(getRequestHeaders()).toBeUndefined();
  });

  it("re-shapes and protects the ArcGIS HTML-fallback request and classifies its response", async () => {
    IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins = true;
    addCredentialedListener();
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
