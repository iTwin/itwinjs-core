/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { EmptyLocalization, ImageMapLayerSettings } from "@itwin/core-common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArcGisUtilities, MapLayerAuthenticationFailedError, MapLayerFetchHandler, MapLayerImageryProvider, MapLayerImageryProviderStatus, MapLayerRequest, MapLayerSource, MapLayerSourceStatus, WmsUtilities } from "../../../tile/internal";
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

/** Returns a copy of `request` with the given header set. */
function withHeader(request: MapLayerRequest, name: string, value: string): MapLayerRequest {
  const headers = new Headers(request.headers);
  headers.set(name, value);
  return { ...request, headers };
}

/** Returns a copy of `request` with the given query parameter set. */
function withParam(request: MapLayerRequest, name: string, value: string): MapLayerRequest {
  const searchParams = new URLSearchParams(request.searchParams);
  searchParams.set(name, value);
  return { ...request, searchParams };
}

function addHandler(handler: MapLayerFetchHandler): () => void {
  return IModelApp.mapLayerFormatRegistry.addMapLayerFetchHandler(handler);
}

/** Registers a fetch handler injecting a header and a query parameter — the typical authenticating
 * handler. When `throwOnAuthStatus` is set, statuses 401/403 are reported as authentication failures,
 * transitioning layers to RequireAuth.
 */
function setCredentialedHandler(opts?: { throwOnAuthStatus?: boolean }): () => void {
  return addHandler(async (request, fetchRequest) => {
    const response = await fetchRequest(withHeader(withParam(request, "clientParam", "clientParamValue"), "Authorization", "Bearer secret-jwt"));
    if (opts?.throwOnAuthStatus && (response.status === 401 || response.status === 403))
      throw new MapLayerAuthenticationFailedError(request.url);
    return response;
  });
}

/** A handler that manages no request. */
const decliningHandler: MapLayerFetchHandler = async () => undefined;

function okResponse(): Response {
  return new Response(null, { status: 200 });
}

function ntlmChallengeResponse(): Response {
  return new Response(null, { status: 401, headers: { "WWW-Authenticate": "NTLM" } });
}

describe("map-layer fetch handler", () => {
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
  const getSentHeaderNames = (callIndex = 0): string[] => [...(getRequestHeaders(callIndex) ?? [])].map(([name]) => name);

  it("applies headers and query parameters from the handler to tile requests", async () => {
    setCredentialedHandler();
    const provider = createProvider();
    await provider.makeTileRequest(tileUrl);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getRequestHeaders()?.get("Authorization")).toEqual("Bearer secret-jwt");
    const requested = new URL(getRequestUrl());
    expect(requested.searchParams.get("clientParam")).toEqual("clientParamValue");
    expect(requested.origin).toEqual("https://maps.example.com");
  });

  it("provides the complete request URL, format and layer context to the handler", async () => {
    let seenUrl: string | undefined;
    let seenLayerUrl: string | undefined;
    let seenFormatId: string | undefined;
    addHandler(async (request, fetchRequest) => {
      seenUrl = request.url;
      seenLayerUrl = request.layerUrl;
      seenFormatId = request.formatId;
      return fetchRequest(request);
    });
    const provider = createProvider();
    await provider.makeRequest(`${tileUrl}?embedded=1`);

    expect(seenUrl).toEqual(`${tileUrl}?embedded=1`);
    expect(seenLayerUrl).toEqual(settingsUrl);
    expect(seenFormatId).toEqual("WMS");
  });

  it("sends the query parameters of the request copy passed to fetchRequest", async () => {
    addHandler(async (request, fetchRequest) =>
      fetchRequest(withParam(request, "clientParam", "clientParamValue")));
    const provider = createProvider();
    await provider.makeRequest(`${tileUrl}?f=json`);

    const requested = new URL(getRequestUrl());
    expect(requested.searchParams.get("f")).toEqual("json");
    expect(requested.searchParams.get("clientParam")).toEqual("clientParamValue");
  });

  it("passes the layer's settings URL as layerUrl on capabilities requests too", async () => {
    const seenLayerUrls: string[] = [];
    addHandler(async (request, fetchRequest) => {
      seenLayerUrls.push(request.layerUrl);
      return fetchRequest(request);
    });
    // A settings URL whose query is stripped from the GetCapabilities request URL.
    const urlWithQuery = `${settingsUrl}?embedded=1`;
    const provider = new WmsMapLayerImageryProvider(ImageMapLayerSettings.fromJSON({ formatId: "WMS", name: "TestLayer", url: urlWithQuery }));
    await provider.initialize();

    // The GetCapabilities request URL differs from the layer URL; per-layer credential lookups must still match.
    expect(seenLayerUrls).toEqual([urlWithQuery]);
  });

  it("applies handler headers on top of basic-auth credentials", async () => {
    setCredentialedHandler();
    const provider = createProvider({ userName: "user", password: "pwd" });
    await provider.makeRequest(tileUrl);

    // The handler has full control: its Authorization header wins over settings-derived basic auth.
    expect(getRequestHeaders()?.get("Authorization")).toEqual("Bearer secret-jwt");
  });

  it("refuses redirects on credentialed sends while the trusted-origins restriction is enabled", async () => {
    IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins = true;
    setCredentialedHandler();
    const provider = createProvider();
    await provider.makeRequest(tileUrl);

    expect(getRequestInit()?.redirect).toEqual("error");
  });

  it("follows redirects on credentialed sends while the restriction is disabled", async () => {
    setCredentialedHandler();
    const provider = createProvider();
    await provider.makeRequest(tileUrl);

    expect(getRequestInit()?.redirect).toBeUndefined();
  });

  it("treats every handler send as credentialed under the trusted-origins restriction", async () => {
    IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins = true;
    fetchMock.mockResolvedValue(ntlmChallengeResponse());
    // We cannot tell a secret from a benign value, so every send is protected.
    addHandler(async (request, fetchRequest) =>
      fetchRequest(withHeader(request, "X-Correlation-Id", "abc-123")));
    const provider = createProvider();
    const response = await provider.makeRequest(tileUrl);

    expect(getRequestHeaders()?.get("X-Correlation-Id")).toEqual("abc-123");
    expect(getRequestInit()?.redirect).toEqual("error");
    expect(fetchMock).toHaveBeenCalledTimes(1);   // no SSO retry either
    expect(response.status).toEqual(401);
  });

  it("treats a send of the unchanged request as credentialed too", async () => {
    IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins = true;
    addHandler(async (request, fetchRequest) => fetchRequest(request));
    const provider = createProvider();
    await provider.makeRequest(tileUrl);

    expect(getRequestInit()?.redirect).toEqual("error");
  });

  it("keeps the default redirect policy for requests the handler declines", async () => {
    IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins = true;
    // A handler serving one format must not degrade layers of the others.
    addHandler(async (request, fetchRequest) => {
      if (request.formatId !== "ArcGIS")
        return undefined;
      return fetchRequest(withHeader(request, "Authorization", "Bearer secret-jwt"));
    });
    const provider = createProvider();   // WMS
    await provider.makeRequest(tileUrl);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getRequestInit()?.redirect).toBeUndefined();
  });

  it("does not retry with SSO credentials after an NTLM challenge on a handled send", async () => {
    fetchMock.mockResolvedValue(ntlmChallengeResponse());
    setCredentialedHandler();
    const provider = createProvider();
    const response = await provider.makeRequest(tileUrl);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.status).toEqual(401);
  });

  it("still answers an NTLM challenge with SSO credentials for requests the handler declines", async () => {
    fetchMock.mockResolvedValueOnce(ntlmChallengeResponse());
    fetchMock.mockResolvedValueOnce(okResponse());
    addHandler(async (request, fetchRequest) => {
      if (request.formatId !== "ArcGIS")
        return undefined;
      return fetchRequest(withHeader(request, "Authorization", "Bearer secret-jwt"));
    });
    const provider = createProvider();   // WMS: Windows-Authentication layers keep working alongside the handler
    const response = await provider.makeRequest(tileUrl);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getRequestInit(1)?.credentials).toEqual("include");
    expect(response.status).toEqual(200);
  });

  it("protects each send of a handler, including a first anonymous attempt", async () => {
    IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins = true;
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    fetchMock.mockResolvedValueOnce(okResponse());
    addHandler(async (request, fetchRequest) => {
      let response = await fetchRequest(request);   // try anonymously first
      if (response.status === 401)
        response = await fetchRequest(withHeader(request, "Authorization", "Bearer secret-jwt"));
      return response;
    });
    const provider = createProvider();
    await provider.makeRequest(tileUrl);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getRequestInit(0)?.redirect).toEqual("error");
    expect(getRequestInit(1)?.redirect).toEqual("error");
  });

  it("honors the query parameters and headers of a request copy, but never its target", async () => {
    addHandler(async (request, fetchRequest) =>
      fetchRequest({ ...withHeader(withParam(request, "token", "abc"), "Authorization", "Bearer secret-jwt"), url: "https://evil.example.net/steal" }));
    const provider = createProvider();
    await provider.makeRequest(`${tileUrl}?f=json`);

    const requested = new URL(getRequestUrl());
    expect(requested.origin + requested.pathname).toEqual(tileUrl);
    expect(requested.searchParams.get("f")).toEqual("json");
    expect(requested.searchParams.get("token")).toEqual("abc");
    expect(getRequestHeaders()?.get("Authorization")).toEqual("Bearer secret-jwt");
  });

  it("transitions to RequireAuth when the handler throws MapLayerAuthenticationFailedError", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    setCredentialedHandler({ throwOnAuthStatus: true });
    const provider = createProvider();

    await expect(provider.makeRequest(tileUrl)).rejects.toBeInstanceOf(MapLayerAuthenticationFailedError);
    expect(provider.status).toEqual(MapLayerImageryProviderStatus.RequireAuth);
  });

  it("notifies the user once when the handler reports an authentication failure after tiles had loaded", async () => {
    const outputMessage = vi.spyOn(IModelApp.notifications, "outputMessage");
    let failing = false;
    addHandler(async (request, fetchRequest) => {
      if (failing)
        throw new MapLayerAuthenticationFailedError(request.url);
      return fetchRequest(request);
    });
    fetchMock.mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "image/png" } }));
    const provider = createProvider();
    expect(await provider.loadTile(0, 0, 0)).toBeDefined();

    failing = true;   // e.g. the token was revoked and the refresh failed
    const tiles = await Promise.all([provider.loadTile(0, 1, 1), provider.loadTile(1, 0, 1), provider.loadTile(1, 1, 1)]);

    expect(tiles).toEqual([undefined, undefined, undefined]);
    expect(provider.status).toEqual(MapLayerImageryProviderStatus.RequireAuth);
    expect(outputMessage).toHaveBeenCalledTimes(1);
  });

  it("does not notify the user when the handler fails before any tile loaded", async () => {
    // Validation already reported the failure; a second notification would be noise.
    const outputMessage = vi.spyOn(IModelApp.notifications, "outputMessage");
    addHandler(async (request) => {
      throw new MapLayerAuthenticationFailedError(request.url);
    });
    const provider = createProvider();

    expect(await provider.loadTile(0, 0, 0)).toBeUndefined();
    expect(provider.status).toEqual(MapLayerImageryProviderStatus.RequireAuth);
    expect(outputMessage).not.toHaveBeenCalled();
  });

  it("lets the handler recognize protocol-specific failures", async () => {
    // An HTTP 200 whose body carries an embedded error code (e.g. ArcGIS-style).
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: { code: 499 } }), { status: 200 }));
    addHandler(async (request, fetchRequest) => {
      const response = await fetchRequest(request);
      // Clone before reading the body so it remains available to the provider.
      const json = await response.clone().json().catch(() => undefined);
      if (json?.error?.code === 499)
        throw new MapLayerAuthenticationFailedError(request.url);
      return response;
    });
    const provider = createProvider();

    await expect(provider.makeRequest(tileUrl)).rejects.toBeInstanceOf(MapLayerAuthenticationFailedError);
    expect(provider.status).toEqual(MapLayerImageryProviderStatus.RequireAuth);
  });

  it("does not classify 401 responses the handler chooses to return", async () => {
    // Without a MapLayerAuthenticationFailedError, we apply no default classification.
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    setCredentialedHandler();
    const provider = createProvider();
    const response = await provider.makeRequest(tileUrl);

    expect(response.status).toEqual(401);
    expect(provider.status).toEqual(MapLayerImageryProviderStatus.Valid);
  });

  it("lets the handler retry transparently after refreshing a token", async () => {
    const sentAuth: Array<string | null> = [];
    fetchMock.mockImplementation(async (_url: unknown, init?: RequestInit) => {
      sentAuth.push((init?.headers as Headers | undefined)?.get("Authorization") ?? null);
      return sentAuth.length === 1 ? new Response(null, { status: 401 }) : okResponse();
    });
    let token = "expired-jwt";
    addHandler(async (request, fetchRequest) => {
      let rsp = await fetchRequest(withHeader(request, "Authorization", `Bearer ${token}`));
      if (rsp.status === 401) {
        token = "refreshed-jwt";   // refreshed through the application's own channels
        rsp = await fetchRequest(withHeader(request, "Authorization", `Bearer ${token}`));
      }
      return rsp;
    });
    const provider = createProvider();
    const response = await provider.makeRequest(tileUrl);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentAuth).toEqual(["Bearer expired-jwt", "Bearer refreshed-jwt"]);
    expect(response.status).toEqual(200);
    // The layer never went through RequireAuth.
    expect(provider.status).toEqual(MapLayerImageryProviderStatus.Valid);
  });

  it("sends the query parameters of each request copy passed between two sends", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    fetchMock.mockResolvedValueOnce(okResponse());
    addHandler(async (request, fetchRequest) => {
      let response = await fetchRequest(withParam(request, "sig", "first"));
      if (response.status === 401)
        response = await fetchRequest(withParam(request, "sig", "second"));
      return response;
    });
    const provider = createProvider();
    await provider.makeRequest(tileUrl);

    expect(new URL(getRequestUrl(0)).searchParams.get("sig")).toEqual("first");
    expect(new URL(getRequestUrl(1)).searchParams.get("sig")).toEqual("second");
  });

  it("lets the handler short-circuit without reaching the network", async () => {
    addHandler(async () => new Response("cached", { status: 200 }));
    const provider = createProvider();
    const response = await provider.makeRequest(tileUrl);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await response.text()).toEqual("cached");
  });

  it("does not alter requests when no handler is registered", async () => {
    const provider = createProvider();
    await provider.makeRequest(tileUrl);

    expect(getRequestUrl()).toEqual(tileUrl);
    expect(getSentHeaderNames()).toEqual([]);
  });

  it("restores the default behavior when the handler is removed", async () => {
    const remove = setCredentialedHandler();
    remove();
    const provider = createProvider();
    await provider.makeRequest(tileUrl);

    expect(getRequestUrl()).toEqual(tileUrl);
    expect(getSentHeaderNames()).toEqual([]);
  });

  it("removes only the handler whose remover is called", async () => {
    const remove = addHandler(async (request, fetchRequest) => fetchRequest(withHeader(request, "X-First", "1")));
    addHandler(async (request, fetchRequest) => fetchRequest(withHeader(request, "X-Second", "2")));
    remove();
    remove();   // idempotent
    const provider = createProvider();
    await provider.makeRequest(tileUrl);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getSentHeaderNames()).toEqual(["x-second"]);
  });

  it("runs handlers in registration order, the first registered being the outermost", async () => {
    const order: string[] = [];
    addHandler(async (request, fetchRequest) => {
      order.push("outer:before");
      const response = await fetchRequest(withHeader(request, "X-Outer", "1"));
      order.push("outer:after");
      return response;
    });
    addHandler(async (request, fetchRequest) => {
      order.push("inner");
      return fetchRequest(withHeader(request, "X-Inner", "2"));
    });
    const provider = createProvider();
    await provider.makeRequest(tileUrl);

    expect(order).toEqual(["outer:before", "inner", "outer:after"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getRequestHeaders()?.get("X-Outer")).toEqual("1");
    expect(getRequestHeaders()?.get("X-Inner")).toEqual("2");
  });

  it("lets several application layers register handlers without coordinating", async () => {
    // Layer 1 (e.g. a platform package) and layer 2 (the application) each manage their own concern.
    addHandler(async (request, fetchRequest) => fetchRequest(withHeader(request, "X-Platform", "layer1")));
    addHandler(async (request, fetchRequest) => fetchRequest(withHeader(request, "Authorization", "Bearer layer2-jwt")));
    const provider = createProvider();
    await provider.makeRequest(tileUrl);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getRequestHeaders()?.get("Authorization")).toEqual("Bearer layer2-jwt");
    expect(getRequestHeaders()?.get("X-Platform")).toEqual("layer1");
  });

  it("offers a declined request unchanged to the next handler", async () => {
    let seenByInner: MapLayerRequest | undefined;
    addHandler(decliningHandler);
    addHandler(async (request, fetchRequest) => {
      seenByInner = request;
      return fetchRequest(request);
    });
    const provider = createProvider();
    await provider.makeRequest(tileUrl);

    expect(seenByInner?.url).toEqual(tileUrl);
    expect(seenByInner?.formatId).toEqual("WMS");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("issues the original request with the default behavior when every handler declines", async () => {
    fetchMock.mockResolvedValueOnce(ntlmChallengeResponse());
    fetchMock.mockResolvedValueOnce(okResponse());
    addHandler(decliningHandler);
    addHandler(decliningHandler);
    const provider = createProvider();
    const response = await provider.makeRequest(tileUrl);

    // No headers added, and the SSO retry, exactly as without handlers.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getSentHeaderNames(0)).toEqual([]);
    expect(getRequestInit(1)?.credentials).toEqual("include");
    expect(response.status).toEqual(200);
  });

  it("keeps a request credentialed when the handlers downstream of its sender decline it", async () => {
    IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins = true;
    fetchMock.mockResolvedValue(ntlmChallengeResponse());
    // The outer handler injects a secret; the inner one does not manage WMS and declines.
    addHandler(async (request, fetchRequest) => fetchRequest(withHeader(request, "Authorization", "Bearer secret-jwt")));
    addHandler(async (request) => request.formatId === "ArcGIS" ? new Response(null, { status: 200 }) : undefined);
    const provider = createProvider();   // WMS
    await provider.makeRequest(tileUrl);

    // The inner decline must not downgrade the protection of the value the outer handler injected.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getRequestHeaders()?.get("Authorization")).toEqual("Bearer secret-jwt");
    expect(getRequestInit()?.redirect).toEqual("error");
  });

  it("sends a request credentialed when an inner handler manages it after the outer declined", async () => {
    IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins = true;
    addHandler(decliningHandler);
    addHandler(async (request, fetchRequest) => fetchRequest(withHeader(request, "Authorization", "Bearer secret-jwt")));
    const provider = createProvider();
    await provider.makeRequest(tileUrl);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getRequestHeaders()?.get("Authorization")).toEqual("Bearer secret-jwt");
    expect(getRequestInit()?.redirect).toEqual("error");
  });

  it("recomputes the URL offered to the next handler from the sender's query parameters", async () => {
    let seenByInner: MapLayerRequest | undefined;
    addHandler(async (request, fetchRequest) => fetchRequest(withParam(request, "token", "abc")));
    addHandler(async (request, fetchRequest) => {
      seenByInner = request;
      return fetchRequest(request);
    });
    const provider = createProvider();
    await provider.makeRequest(`${tileUrl}?f=json`);

    const seenUrl = new URL(seenByInner!.url);
    expect(seenUrl.searchParams.get("f")).toEqual("json");
    expect(seenUrl.searchParams.get("token")).toEqual("abc");
    expect(new URL(getRequestUrl()).searchParams.get("token")).toEqual("abc");
  });

  it("lets an inner handler short-circuit a request sent by the outer one", async () => {
    let outerGot: Response | undefined;
    addHandler(async (request, fetchRequest) => {
      outerGot = await fetchRequest(withHeader(request, "Authorization", "Bearer secret-jwt"));
      return outerGot;
    });
    addHandler(async () => new Response("cached", { status: 200 }));
    const provider = createProvider();
    const response = await provider.makeRequest(tileUrl);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response).toBe(outerGot);
    expect(await response.text()).toEqual("cached");
  });

  it("propagates an authentication failure reported by an inner handler", async () => {
    addHandler(async (request, fetchRequest) => fetchRequest(request));
    addHandler(async (request) => {
      throw new MapLayerAuthenticationFailedError(request.url);
    });
    const provider = createProvider();

    await expect(provider.makeRequest(tileUrl)).rejects.toBeInstanceOf(MapLayerAuthenticationFailedError);
    expect(provider.status).toEqual(MapLayerImageryProviderStatus.RequireAuth);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shapes tooltip requests too", async () => {
    fetchMock.mockResolvedValue(new Response("tooltip text", { status: 200 }));
    setCredentialedHandler();
    const provider = createProvider();
    const strings: string[] = [];
    await provider.testToolTipFromUrl(strings, `${settingsUrl}/getFeatureInfo`);

    expect(getRequestHeaders()?.get("Authorization")).toEqual("Bearer secret-jwt");
    expect(new URL(getRequestUrl()).searchParams.get("clientParam")).toEqual("clientParamValue");
  });

  it("skips the tooltip request when the handler fails", async () => {
    addHandler(async () => {
      throw new Error("token service unreachable");
    });
    const provider = createProvider();
    const strings: string[] = [];
    // Must neither reject (getToolTip callers do not catch) nor fall back to an unauthenticated request.
    await provider.testToolTipFromUrl(strings, `${settingsUrl}/getFeatureInfo`);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(strings).toHaveLength(0);
  });

  it("transitions to RequireAuth when the handler reports an authentication failure on a tooltip request", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    setCredentialedHandler({ throwOnAuthStatus: true });
    const provider = createProvider();
    const statusEvents: MapLayerImageryProviderStatus[] = [];
    provider.onStatusChanged.addListener((p) => statusEvents.push(p.status));
    const strings: string[] = [];

    await provider.testToolTipFromUrl(strings, `${settingsUrl}/getFeatureInfo`);   // still does not reject

    expect(strings).toHaveLength(0);
    expect(provider.status).toEqual(MapLayerImageryProviderStatus.RequireAuth);
    expect(statusEvents).toEqual([MapLayerImageryProviderStatus.RequireAuth]);
  });

  it("shapes WMS capabilities requests and transitions to RequireAuth on 401 during initialize", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    setCredentialedHandler({ throwOnAuthStatus: true });
    const settings = ImageMapLayerSettings.fromJSON({ formatId: "WMS", name: "TestLayer", url: settingsUrl });
    settings.unsavedQueryParams = { custom: "1" };
    const provider = new WmsMapLayerImageryProvider(settings);
    await provider.initialize();

    expect(getRequestHeaders()?.get("Authorization")).toEqual("Bearer secret-jwt");
    const requested = new URL(getRequestUrl());
    expect(requested.searchParams.get("clientParam")).toEqual("clientParamValue");
    // Settings custom params must reach the capabilities request made by initialize, like on the validate path.
    expect(requested.searchParams.get("custom")).toEqual("1");
    // Handler mutations must not disturb the protocol parameters of the capabilities request.
    expect(requested.searchParams.get("request")).toEqual("GetCapabilities");
    expect(requested.searchParams.get("service")).toEqual("WMS");
    expect(provider.status).toEqual(MapLayerImageryProviderStatus.RequireAuth);
  });

  it("keeps throwing on 403 during initialize when no handler is registered", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }));
    const provider = new WmsMapLayerImageryProvider(ImageMapLayerSettings.fromJSON({ formatId: "WMS", name: "TestLayer", url: settingsUrl }));
    await expect(provider.initialize()).rejects.toThrow();

    expect(provider.status).toEqual(MapLayerImageryProviderStatus.Valid);
  });

  it("does not classify a 401 capabilities response the handler returns as its own", async () => {
    // The handler is the authority on responses it returns: without a MapLayerAuthenticationFailedError the
    // 401 is a plain failure, not a RequireAuth transition.
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    setCredentialedHandler();
    const provider = new WmsMapLayerImageryProvider(ImageMapLayerSettings.fromJSON({ formatId: "WMS", name: "TestLayer", url: settingsUrl }));
    await expect(provider.initialize()).rejects.toThrow();

    expect(provider.status).toEqual(MapLayerImageryProviderStatus.Valid);
  });

  it("still classifies a 401 capabilities response when the handler declines the request", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    addHandler(decliningHandler);
    const provider = new WmsMapLayerImageryProvider(ImageMapLayerSettings.fromJSON({ formatId: "WMS", name: "TestLayer", url: settingsUrl }));
    await provider.initialize();

    expect(provider.status).toEqual(MapLayerImageryProviderStatus.RequireAuth);
  });

  it("treats a short-circuited response as the handler's own", async () => {
    addHandler(async () => new Response(null, { status: 401 }));
    const provider = new WmsMapLayerImageryProvider(ImageMapLayerSettings.fromJSON({ formatId: "WMS", name: "TestLayer", url: settingsUrl }));
    await expect(provider.initialize()).rejects.toThrow();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(provider.status).toEqual(MapLayerImageryProviderStatus.Valid);
  });

  it("does not blame settings credentials for a 401 the handler returns as its own during validation", async () => {
    // The handler replaced the basic-auth header; a 401 it returns says nothing about the settings credentials.
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    setCredentialedHandler();
    const source = MapLayerSource.fromJSON({ formatId: "WMS", name: "TestLayer", url: settingsUrl })!;
    source.userName = "user";
    source.password = "pwd";

    const validation = await IModelApp.mapLayerFormatRegistry.validateSource({ source, ignoreCache: true });

    expect(validation.status).toEqual(MapLayerSourceStatus.InvalidUrl);
  });

  it("transitions a WMTS layer to RequireAuth when its capabilities request fails authentication", async () => {
    // The initialize failure-conversion block is duplicated in the WMTS provider; guard it separately.
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }));
    setCredentialedHandler({ throwOnAuthStatus: true });
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
    setCredentialedHandler();

    await ArcGisUtilities.getServiceJson({ url: "https://arcgis.example.com/MapServer", formatId: "ArcGIS" });

    expect(getRequestHeaders()?.get("Authorization")).toEqual("Bearer secret-jwt");
    const requested = new URL(getRequestUrl());
    expect(requested.searchParams.get("clientParam")).toEqual("clientParamValue");
    expect(requested.searchParams.get("f")).toEqual("json");
  });

  it("uses the configured layer URL to identify ArcGIS sublayer metadata requests", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({}), { headers: { "content-type": "application/json" } }));
    let seenLayerUrl: string | undefined;
    addHandler(async (request, fetchRequest) => {
      seenLayerUrl = request.layerUrl;
      return fetchRequest(request);
    });

    await ArcGisUtilities.getServiceJson({
      url: "https://arcgis.example.com/MapServer/3",
      layerUrl: "https://arcgis.example.com/MapServer",
      formatId: "ArcGIS",
    });

    expect(seenLayerUrl).toEqual("https://arcgis.example.com/MapServer");
  });

  it("transitions an ArcGIS layer to RequireAuth when its metadata request fails authentication", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }));
    setCredentialedHandler({ throwOnAuthStatus: true });
    const provider = new ArcGISMapLayerImageryProvider(ImageMapLayerSettings.fromJSON({ formatId: "ArcGIS", name: "TestLayer", url: "https://arcgis.example.com/MapServer" }));

    // Must not throw: the tile tree is kept alive so the application can offer re-authentication.
    await provider.initialize();

    expect(provider.status).toEqual(MapLayerImageryProviderStatus.RequireAuth);
  });

  it("reports RequireAuth from ArcGIS source validation when the metadata request fails authentication", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }));
    setCredentialedHandler({ throwOnAuthStatus: true });
    const source = MapLayerSource.fromJSON({ formatId: "ArcGIS", name: "TestLayer", url: "https://arcgis.example.com/MapServer" })!;

    const validation = await ArcGisUtilities.validateSource({ source, capabilitiesFilter: ["Map"] });

    expect(validation.status).toEqual(MapLayerSourceStatus.RequireAuth);
  });

  it("does not classify an ArcGIS error body the handler returns as its own", async () => {
    const tokenRequired = () => new Response(JSON.stringify({ error: { code: 499 } }), { status: 200, headers: { "content-type": "application/json" } });
    fetchMock.mockImplementation(async () => tokenRequired());
    setCredentialedHandler();
    const source = MapLayerSource.fromJSON({ formatId: "ArcGIS", name: "TestLayer", url: "https://arcgis.example.com/MapServer" })!;

    const validation = await ArcGisUtilities.validateSource({ source, capabilitiesFilter: ["Map"] });
    // Not RequireAuth: the handler did not throw MapLayerAuthenticationFailedError, so the body is just an invalid service document.
    expect(validation.status).toEqual(MapLayerSourceStatus.InvalidFormat);

    const provider = new ArcGISMapLayerImageryProvider(ImageMapLayerSettings.fromJSON({ formatId: "ArcGIS", name: "TestLayer", url: "https://arcgis.example.com/MapServer" }));
    await provider.initialize();
    expect(provider.status).toEqual(MapLayerImageryProviderStatus.Valid);
  });

  it("still classifies an ArcGIS error body when the handler declines the request", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ error: { code: 499 } }), { status: 200, headers: { "content-type": "application/json" } }));
    addHandler(decliningHandler);
    const source = MapLayerSource.fromJSON({ formatId: "ArcGIS", name: "TestLayer", url: "https://arcgis.example.com/MapServer" })!;

    const validation = await ArcGisUtilities.validateSource({ source, capabilitiesFilter: ["Map"] });

    expect(validation.status).toEqual(MapLayerSourceStatus.RequireAuth);
  });

  it("shapes ArcGIS provider requests", async () => {
    fetchMock.mockResolvedValue(okResponse());
    setCredentialedHandler();
    const provider = new ArcGISMapLayerImageryProvider(ImageMapLayerSettings.fromJSON({ formatId: "ArcGIS", name: "TestLayer", url: "https://arcgis.example.com/MapServer" }));

    await (provider as any).fetch(new URL("https://arcgis.example.com/MapServer/tile/0/0/0"), { method: "GET" });

    expect(getRequestHeaders()?.get("Authorization")).toEqual("Bearer secret-jwt");
    expect(new URL(getRequestUrl()).searchParams.get("clientParam")).toEqual("clientParamValue");
  });

  it("preserves settings custom query parameters on handled tile requests", async () => {
    setCredentialedHandler();
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

  it("preserves settings custom query parameters on handled ArcGIS provider requests", async () => {
    fetchMock.mockResolvedValue(okResponse());
    setCredentialedHandler();
    const settings = ImageMapLayerSettings.fromJSON({ formatId: "ArcGIS", name: "TestLayer", url: "https://arcgis.example.com/MapServer" });
    settings.unsavedQueryParams = { custom: "1" };
    const provider = new ArcGISMapLayerImageryProvider(settings);

    await (provider as any).fetch(new URL("https://arcgis.example.com/MapServer/tile/0/0/0"), { method: "GET" });

    const requested = new URL(getRequestUrl());
    expect(requested.searchParams.get("custom")).toEqual("1");
    expect(requested.searchParams.get("clientParam")).toEqual("clientParamValue");
    expect(getRequestHeaders()?.get("Authorization")).toEqual("Bearer secret-jwt");
  });

  it("preserves custom query parameters on handled WMS capabilities validation requests", async () => {
    // MapLayerImageryFormats.validate passes source.collectQueryParams() to create().
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    setCredentialedHandler({ throwOnAuthStatus: true });

    await expect(WmsCapabilities.create(settingsUrl, { ignoreCache: true, queryParams: { custom: "1" } }))
      .rejects.toBeInstanceOf(MapLayerAuthenticationFailedError);

    const requested = new URL(getRequestUrl());
    expect(requested.searchParams.get("custom")).toEqual("1");
    expect(requested.searchParams.get("clientParam")).toEqual("clientParamValue");
    expect(requested.searchParams.get("request")).toEqual("GetCapabilities");
    expect(getRequestHeaders()?.get("Authorization")).toEqual("Bearer secret-jwt");
  });

  it("preserves custom query parameters on handled WMTS capabilities validation requests", async () => {
    // The queryParams merge is duplicated in WmtsCapabilities.create; guard it separately.
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    setCredentialedHandler({ throwOnAuthStatus: true });

    await expect(WmtsCapabilities.create(settingsUrl, { ignoreCache: true, queryParams: { custom: "1" } }))
      .rejects.toBeInstanceOf(MapLayerAuthenticationFailedError);

    const requested = new URL(getRequestUrl());
    expect(requested.searchParams.get("custom")).toEqual("1");
    expect(requested.searchParams.get("clientParam")).toEqual("clientParamValue");
    expect(requested.searchParams.get("request")).toEqual("GetCapabilities");
    expect(getRequestHeaders()?.get("Authorization")).toEqual("Bearer secret-jwt");
  });

  it("propagates handler failures instead of issuing the request unauthenticated", async () => {
    addHandler(async () => {
      throw new Error("token service unreachable");
    });
    const provider = createProvider();

    await expect(provider.makeRequest(tileUrl)).rejects.toThrow("token service unreachable");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("issues a non-absolute URL unhandled rather than failing", async () => {
    setCredentialedHandler();
    const provider = createProvider();
    await provider.makeRequest("relative/tile/0/0/0");

    expect(getRequestUrl()).toEqual("relative/tile/0/0/0");
    expect(getSentHeaderNames()).toEqual([]);
  });

  it("issues a non-absolute capabilities URL unhandled rather than failing", async () => {
    fetchMock.mockResolvedValue(new Response("<xml/>", { status: 200 }));
    setCredentialedHandler();
    await WmsUtilities.fetchXml("relative/wms?REQUEST=GetCapabilities");

    expect(getRequestUrl()).toEqual("relative/wms?REQUEST=GetCapabilities");
    expect(getSentHeaderNames()).toEqual([]);
  });

  it("re-invokes the handler for the ArcGIS HTML-fallback request and honors its failure", async () => {
    IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins = true;
    setCredentialedHandler({ throwOnAuthStatus: true });
    fetchMock.mockResolvedValueOnce(new Response("<html></html>", { status: 200, headers: { "content-type": "text/html" } }));
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    const provider = new ArcGISMapLayerImageryProvider(ImageMapLayerSettings.fromJSON({ formatId: "ArcGIS", name: "TestLayer", url: "https://arcgis.example.com/MapServer" }));

    await expect((provider as any).fetch(new URL("https://arcgis.example.com/MapServer/tile/0/0/0"), { method: "GET" }))
      .rejects.toBeInstanceOf(MapLayerAuthenticationFailedError);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const fallbackUrl = new URL(getRequestUrl(1));
    expect(fallbackUrl.searchParams.get("f")).toEqual("json");
    expect(fallbackUrl.searchParams.get("clientParam")).toEqual("clientParamValue");
    expect(getRequestHeaders(1)?.get("Authorization")).toEqual("Bearer secret-jwt");
    // The follow-up request must carry the same redirect policy as the initial credentialed send.
    expect(getRequestInit(1)?.redirect).toEqual("error");
    // The final (fallback) response is the one the handler classified.
    expect(provider.status).toEqual(MapLayerImageryProviderStatus.RequireAuth);
  });
});
