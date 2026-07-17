/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { EmptyLocalization, ImageMapLayerSettings } from "@itwin/core-common";
import { Logger } from "@itwin/core-bentley";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MapLayerImageryProvider, MapLayerImageryProviderStatus, MapLayerSource, MapLayerSourceStatus, MapLayerUntrustedOriginError } from "../../../tile/internal";
import { IModelApp } from "../../../IModelApp";
import { WmsUtilities } from "../../../internal/tile/map/WmsUtilities";
import { ArcGisUtilities } from "../../../internal/tile/map/ArcGisUtilities";
import { WmsMapLayerImageryProvider } from "../../../internal/tile/map/ImageryProviders/WmsMapLayerImageryProvider";
import { ArcGISMapLayerImageryProvider } from "../../../internal/tile/map/ImageryProviders/ArcGISMapLayerImageryProvider";

class TestImageryProvider extends MapLayerImageryProvider {
  public async constructUrl(row: number, column: number, zoomLevel: number) {
    return `${this._settings.url}/tile/${zoomLevel}/${row}/${column}`;
  }

  public async testToolTipFromUrl(strings: string[], url: string): Promise<void> {
    return this.toolTipFromUrl(strings, url);
  }
}

const settingsUrl = "https://maps.example.com/wms";
const sameOriginUrl = "https://maps.example.com/wms/tile/0/0/0";
const crossOriginUrl = "https://other.example.org/tile/0/0/0";

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

function okResponse(): Response {
  return new Response(null, { status: 200 });
}

function ntlmChallengeResponse(): Response {
  return new Response(null, { status: 401, headers: { "WWW-Authenticate": "NTLM" } });
}

/** Simulates a response obtained after fetch transparently followed a redirect: `response.url`
 * reports the final URL, which may differ in origin from the URL that was requested.
 */
function redirectedTo(response: Response, finalUrl: string): Response {
  Object.defineProperty(response, "url", { value: finalUrl });
  return response;
}

describe("MapLayerImageryProvider authorization", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
    IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins = true;
    fetchMock = vi.fn(async () => okResponse());
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (IModelApp.initialized)
      await IModelApp.shutdown();
  });

  const getRequestHeaders = (callIndex = 0): Headers | undefined => {
    const opts = fetchMock.mock.calls[callIndex][1] as RequestInit | undefined;
    return opts?.headers as Headers | undefined;
  };

  it("attaches basic-auth credentials for same-origin requests", async () => {
    const provider = createProvider({ userName: "user", password: "pwd" });
    await provider.makeRequest(sameOriginUrl);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getRequestHeaders()?.get("Authorization")).toMatch(/^Basic /);
  });

  it("withholds basic-auth credentials for cross-origin requests", async () => {
    const provider = createProvider({ userName: "user", password: "pwd" });
    await provider.makeRequest(crossOriginUrl);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getRequestHeaders()).toBeUndefined();
  });

  it("withholds basic-auth credentials for malformed request URLs", async () => {
    const provider = createProvider({ userName: "user", password: "pwd" });
    await provider.makeRequest("not a valid url");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getRequestHeaders()).toBeUndefined();
  });

  it("does not retry with SSO credentials for the settings origin unless whitelisted", async () => {
    fetchMock.mockResolvedValue(ntlmChallengeResponse());

    const provider = createProvider();
    const response = await provider.makeRequest(sameOriginUrl);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.status).toEqual(401);
  });

  it("retries with SSO credentials for the whitelisted settings origin after NTLM challenge", async () => {
    IModelApp.mapLayerFormatRegistry.trustedCredentialsOrigins = ["https://maps.example.com"];
    fetchMock.mockResolvedValueOnce(ntlmChallengeResponse()).mockResolvedValueOnce(okResponse());

    const provider = createProvider();
    const response = await provider.makeRequest(sameOriginUrl);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryOpts = fetchMock.mock.calls[1][1] as RequestInit;
    expect(retryOpts.credentials).toEqual("include");
    expect(response.status).toEqual(200);
  });

  it("does not retry with SSO credentials for a non-whitelisted origin", async () => {
    fetchMock.mockResolvedValue(ntlmChallengeResponse());

    const provider = createProvider();
    const response = await provider.makeRequest(crossOriginUrl);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.status).toEqual(401);
  });

  it("retries with SSO credentials for a whitelisted origin", async () => {
    IModelApp.mapLayerFormatRegistry.trustedCredentialsOrigins = ["https://other.example.org"];
    fetchMock.mockResolvedValueOnce(ntlmChallengeResponse()).mockResolvedValueOnce(okResponse());

    const provider = createProvider();
    const response = await provider.makeRequest(crossOriginUrl);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryOpts = fetchMock.mock.calls[1][1] as RequestInit;
    expect(retryOpts.credentials).toEqual("include");
    expect(response.status).toEqual(200);
  });

  it("attaches basic-auth credentials for cross-origin requests when restriction is disabled (legacy default)", async () => {
    IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins = false;
    const provider = createProvider({ userName: "user", password: "pwd" });
    await provider.makeRequest(crossOriginUrl);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getRequestHeaders()?.get("Authorization")).toMatch(/^Basic /);
  });

  it("retries with SSO credentials for any origin when restriction is disabled (legacy default)", async () => {
    IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins = false;
    fetchMock.mockResolvedValueOnce(ntlmChallengeResponse()).mockResolvedValueOnce(okResponse());

    const provider = createProvider();
    const response = await provider.makeRequest(crossOriginUrl);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(response.status).toEqual(200);
  });

  it("attaches basic-auth credentials for a whitelisted cross-origin request", async () => {
    IModelApp.mapLayerFormatRegistry.trustedCredentialsOrigins = ["https://other.example.org"];
    const provider = createProvider({ userName: "user", password: "pwd" });
    await provider.makeRequest(crossOriginUrl);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getRequestHeaders()?.get("Authorization")).toMatch(/^Basic /);
  });

  it("reports UntrustedOrigin status with blocked origin when SSO retry is suppressed", async () => {
    fetchMock.mockResolvedValue(ntlmChallengeResponse());

    const provider = createProvider();
    const statusEvents: MapLayerImageryProviderStatus[] = [];
    provider.onStatusChanged.addListener((p) => statusEvents.push(p.status));

    await provider.makeRequest(crossOriginUrl);

    expect(provider.status).toEqual(MapLayerImageryProviderStatus.UntrustedOrigin);
    expect(provider.blockedOrigins).toEqual(["https://other.example.org"]);
    expect(statusEvents).toEqual([MapLayerImageryProviderStatus.UntrustedOrigin]);
  });

  it("accumulates multiple blocked origins and re-raises the event for each new one", async () => {
    fetchMock.mockResolvedValue(ntlmChallengeResponse());

    const provider = createProvider();
    let eventCount = 0;
    provider.onStatusChanged.addListener(() => eventCount++);

    await provider.makeRequest(crossOriginUrl);
    await provider.makeRequest("https://third.example.net/tile/0/0/0");
    await provider.makeRequest(crossOriginUrl);   // duplicate origin, no new event

    expect(provider.blockedOrigins).toEqual(["https://other.example.org", "https://third.example.net"]);
    expect(eventCount).toEqual(2);
  });

  it("reports UntrustedOrigin status when withheld basic-auth credentials lead to a 401", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 401, headers: { "WWW-Authenticate": "Basic" } }));

    const provider = createProvider({ userName: "user", password: "pwd" });
    await provider.makeRequest(crossOriginUrl);

    expect(provider.status).toEqual(MapLayerImageryProviderStatus.UntrustedOrigin);
    expect(provider.blockedOrigins).toEqual(["https://other.example.org"]);
  });

  it("does not report UntrustedOrigin when a gate-blocked request succeeds anonymously", async () => {
    const provider = createProvider({ userName: "user", password: "pwd" });
    await provider.makeRequest(crossOriginUrl);

    expect(provider.status).toEqual(MapLayerImageryProviderStatus.Valid);
    expect(provider.blockedOrigins).toEqual([]);
  });

  it("resetStatus clears the blocked origins", async () => {
    fetchMock.mockResolvedValue(ntlmChallengeResponse());

    const provider = createProvider();
    await provider.makeRequest(crossOriginUrl);
    expect(provider.blockedOrigins).toHaveLength(1);

    provider.resetStatus();
    expect(provider.status).toEqual(MapLayerImageryProviderStatus.Valid);
    expect(provider.blockedOrigins).toEqual([]);
  });

  it("escapes html in tooltip text from untrusted origins", async () => {
    fetchMock.mockResolvedValue(new Response(`<img src="x" onerror="1">`, { status: 200 }));

    const provider = createProvider();
    const strings: string[] = [];
    await provider.testToolTipFromUrl(strings, crossOriginUrl);

    expect(strings).toHaveLength(1);
    expect(strings[0]).not.toContain("<img");
    // Escaped text renders literally when later assigned to innerHTML.
    const div = document.createElement("div");
    div.innerHTML = strings[0];
    expect(div.querySelector("img")).toBeNull();
    expect(div.textContent).toEqual(`<img src="x" onerror="1">`);
  });

  it("preserves html in tooltip text from the settings origin", async () => {
    fetchMock.mockResolvedValue(new Response("<b>feature info</b>", { status: 200 }));

    const provider = createProvider();
    const strings: string[] = [];
    await provider.testToolTipFromUrl(strings, sameOriginUrl);

    expect(strings).toEqual(["<b>feature info</b>"]);
  });

  it("preserves html in tooltip text when restriction is disabled (legacy default)", async () => {
    IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins = false;
    fetchMock.mockResolvedValue(new Response("<b>feature info</b>", { status: 200 }));

    const provider = createProvider();
    const strings: string[] = [];
    await provider.testToolTipFromUrl(strings, crossOriginUrl);

    expect(strings).toEqual(["<b>feature info</b>"]);
  });

  it("scopes SSO credentials per origin after a successful handshake", async () => {
    IModelApp.mapLayerFormatRegistry.trustedCredentialsOrigins = ["https://maps.example.com", "https://other.example.org"];
    fetchMock.mockResolvedValueOnce(ntlmChallengeResponse()).mockResolvedValue(okResponse());

    const provider = createProvider();
    await provider.makeRequest(sameOriginUrl);   // 401 challenge -> validated SSO retry succeeds for this origin

    // Subsequent request to the handshaken origin includes browser credentials up front...
    await provider.makeRequest(sameOriginUrl);
    const sameOriginOpts = fetchMock.mock.calls[2][1] as RequestInit;
    expect(sameOriginOpts.credentials).toEqual("include");

    // ...but a different origin gets none, even though it is whitelisted — it never completed
    // its own validated handshake. The latch must be per-origin, not per-provider.
    await provider.makeRequest(crossOriginUrl);
    const crossOriginOpts = fetchMock.mock.calls[3][1] as RequestInit;
    expect(crossOriginOpts.credentials).toBeUndefined();
  });

  it("stops including SSO credentials when enforcement is enabled after a legacy handshake", async () => {
    // Handshake succeeds while enforcement is off — latch is recorded for the origin.
    IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins = false;
    fetchMock.mockResolvedValueOnce(ntlmChallengeResponse()).mockResolvedValue(okResponse());

    const provider = createProvider();
    await provider.makeRequest(crossOriginUrl);
    expect((fetchMock.mock.calls[1][1] as RequestInit).credentials).toEqual("include");

    // Enabling enforcement (origin not whitelisted) must invalidate the latch: the current
    // policy is re-checked on every request, not only at handshake time.
    IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins = true;
    await provider.makeRequest(crossOriginUrl);
    const opts = fetchMock.mock.calls[2][1] as RequestInit;
    expect(opts.credentials).toBeUndefined();
  });

  it("stops including SSO credentials when the origin is removed from the whitelist after a handshake", async () => {
    IModelApp.mapLayerFormatRegistry.trustedCredentialsOrigins = ["https://other.example.org"];
    fetchMock.mockResolvedValueOnce(ntlmChallengeResponse()).mockResolvedValue(okResponse());

    const provider = createProvider();
    await provider.makeRequest(crossOriginUrl);   // validated handshake latches the origin
    expect((fetchMock.mock.calls[1][1] as RequestInit).credentials).toEqual("include");

    // Revoking trust must take effect immediately despite the recorded handshake.
    IModelApp.mapLayerFormatRegistry.trustedCredentialsOrigins = [];
    await provider.makeRequest(crossOriginUrl);
    const opts = fetchMock.mock.calls[2][1] as RequestInit;
    expect(opts.credentials).toBeUndefined();
  });

  it("normalizes whitelist entries to their origin and ignores invalid ones", () => {
    IModelApp.mapLayerFormatRegistry.trustedCredentialsOrigins = [
      "https://tiles.example.com/some/path?query=1",
      "not a valid origin",
    ];

    expect(IModelApp.mapLayerFormatRegistry.trustedCredentialsOrigins).toEqual(["https://tiles.example.com"]);
  });

  it("gates the SSO retry on the origin that issued the challenge after a redirect", async () => {
    // The requested origin is whitelisted, but the challenge comes from a redirect destination that is not.
    IModelApp.mapLayerFormatRegistry.trustedCredentialsOrigins = ["https://maps.example.com"];
    fetchMock.mockResolvedValue(redirectedTo(ntlmChallengeResponse(), "https://redirect.example.net/wms/tile/0/0/0"));

    const provider = createProvider();
    const response = await provider.makeRequest(sameOriginUrl);

    expect(fetchMock).toHaveBeenCalledTimes(1);   // no credentialed retry
    expect(response.status).toEqual(401);
    expect(provider.status).toEqual(MapLayerImageryProviderStatus.UntrustedOrigin);
    expect(provider.blockedOrigins).toEqual(["https://redirect.example.net"]);
  });

  it("retries the challenged post-redirect URL directly, refusing further redirects", async () => {
    // Only the redirect destination is whitelisted; the retry must target it, not the requested URL.
    const finalUrl = "https://redirect.example.net/wms/tile/0/0/0";
    IModelApp.mapLayerFormatRegistry.trustedCredentialsOrigins = ["https://redirect.example.net"];
    fetchMock.mockResolvedValueOnce(redirectedTo(ntlmChallengeResponse(), finalUrl)).mockResolvedValue(okResponse());

    const provider = createProvider();
    const response = await provider.makeRequest(sameOriginUrl);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toEqual(finalUrl);
    const retryOpts = fetchMock.mock.calls[1][1] as RequestInit;
    expect(retryOpts.credentials).toEqual("include");
    expect(retryOpts.redirect).toEqual("error");
    expect(response.status).toEqual(200);

    // The latch records the challenged origin, not the requested one.
    await provider.makeRequest(finalUrl);
    expect((fetchMock.mock.calls[2][1] as RequestInit).credentials).toEqual("include");
    await provider.makeRequest(sameOriginUrl);
    expect((fetchMock.mock.calls[3][1] as RequestInit).credentials).toBeUndefined();
  });

  it("reports a credentialed request that was transparently redirected to an untrusted origin", async () => {
    IModelApp.mapLayerFormatRegistry.trustedCredentialsOrigins = ["https://other.example.org"];
    fetchMock.mockResolvedValueOnce(ntlmChallengeResponse()).mockResolvedValue(okResponse());

    const provider = createProvider();
    await provider.makeRequest(crossOriginUrl);   // validated handshake latches the origin

    // A later latched (credential-bearing) request is transparently redirected cross-origin: the
    // destination must be detected and reported, and must never become latched itself.
    fetchMock.mockResolvedValue(redirectedTo(okResponse(), "https://evil.example.net/steal"));
    await provider.makeRequest(crossOriginUrl);

    expect(provider.status).toEqual(MapLayerImageryProviderStatus.UntrustedOrigin);
    expect(provider.blockedOrigins).toEqual(["https://evil.example.net"]);
  });

  it("logs the discovery warning when a credentialed request is redirected cross-origin (legacy default)", async () => {
    IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins = false;
    const logWarning = vi.spyOn(Logger, "logWarning");
    fetchMock.mockResolvedValueOnce(ntlmChallengeResponse()).mockResolvedValue(okResponse());

    const provider = createProvider();
    await provider.makeRequest(crossOriginUrl);   // legacy handshake latches the origin

    fetchMock.mockResolvedValue(redirectedTo(okResponse(), "https://evil.example.net/steal"));
    await provider.makeRequest(crossOriginUrl);

    const warnings = logWarning.mock.calls.filter((call) => String(call[1]).includes("https://evil.example.net"));
    expect(warnings).toHaveLength(1);
  });
});

describe("WmsUtilities.fetchXml SSO origin restriction", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const wmsUrl = "https://maps.example.com/wms?request=GetCapabilities&service=WMS";

  beforeEach(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
    IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins = true;
    fetchMock = vi.fn(async () => ntlmChallengeResponse());
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (IModelApp.initialized)
      await IModelApp.shutdown();
  });

  it("does not retry with SSO credentials for a non-whitelisted origin", async () => {
    await expect(WmsUtilities.fetchXml(wmsUrl)).rejects.toBeInstanceOf(MapLayerUntrustedOriginError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries with SSO credentials for a whitelisted origin", async () => {
    IModelApp.mapLayerFormatRegistry.trustedCredentialsOrigins = ["https://maps.example.com"];
    fetchMock.mockResolvedValueOnce(ntlmChallengeResponse()).mockResolvedValueOnce(new Response("<xml/>", { status: 200 }));

    const xml = await WmsUtilities.fetchXml(wmsUrl);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryOpts = fetchMock.mock.calls[1][1] as RequestInit;
    expect(retryOpts.credentials).toEqual("include");
    expect(xml).toEqual("<xml/>");
  });

  it("retries with SSO credentials for any origin when restriction is disabled (legacy default)", async () => {
    IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins = false;
    fetchMock.mockResolvedValueOnce(ntlmChallengeResponse()).mockResolvedValueOnce(new Response("<xml/>", { status: 200 }));

    await WmsUtilities.fetchXml(wmsUrl);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("logs the discovery warning once per origin when restriction is disabled (legacy default)", async () => {
    IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins = false;
    const logWarning = vi.spyOn(Logger, "logWarning");
    fetchMock.mockImplementation(async (_input: RequestInfo | URL, opts?: RequestInit) =>
      opts?.credentials === "include" ? new Response("<xml/>", { status: 200 }) : ntlmChallengeResponse());

    const discoveryUrl = "https://discovery.example.net/wms?request=GetCapabilities&service=WMS";
    await WmsUtilities.fetchXml(discoveryUrl);
    await WmsUtilities.fetchXml(discoveryUrl);

    const warnings = logWarning.mock.calls.filter((call) => String(call[1]).includes("https://discovery.example.net"));
    expect(warnings).toHaveLength(1);
  });

  it("gates the SSO retry on the origin that issued the challenge after a redirect", async () => {
    IModelApp.mapLayerFormatRegistry.trustedCredentialsOrigins = ["https://maps.example.com"];
    const finalUrl = "https://redirect.example.net/wms?request=GetCapabilities&service=WMS";
    fetchMock.mockResolvedValue(redirectedTo(ntlmChallengeResponse(), finalUrl));

    const err = await WmsUtilities.fetchXml(wmsUrl).catch((e) => e);
    expect(err).toBeInstanceOf(MapLayerUntrustedOriginError);
    expect((err as MapLayerUntrustedOriginError).url).toEqual(finalUrl);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries the challenged post-redirect URL directly, refusing further redirects", async () => {
    const finalUrl = "https://redirect.example.net/wms?request=GetCapabilities&service=WMS";
    IModelApp.mapLayerFormatRegistry.trustedCredentialsOrigins = ["https://redirect.example.net"];
    fetchMock.mockResolvedValueOnce(redirectedTo(ntlmChallengeResponse(), finalUrl)).mockResolvedValueOnce(new Response("<xml/>", { status: 200 }));

    const xml = await WmsUtilities.fetchXml(wmsUrl);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toEqual(finalUrl);
    const retryOpts = fetchMock.mock.calls[1][1] as RequestInit;
    expect(retryOpts.credentials).toEqual("include");
    expect(retryOpts.redirect).toEqual("error");
    expect(xml).toEqual("<xml/>");
  });
});

describe("WMS/WMTS source validation and provider initialization origin restriction", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
    IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins = true;
    fetchMock = vi.fn(async () => ntlmChallengeResponse());
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (IModelApp.initialized)
      await IModelApp.shutdown();
  });

  it("validateSource reports UntrustedOrigin when the SSO retry is suppressed", async () => {
    const validation = await IModelApp.mapLayerFormatRegistry.validateSource("WMS", "https://validate-wms.example.net/wms");
    expect(validation.status).toEqual(MapLayerSourceStatus.UntrustedOrigin);
  });

  it("WMS provider initialization reports UntrustedOrigin with the blocked origin", async () => {
    const settings = ImageMapLayerSettings.fromJSON({ formatId: "WMS", name: "Test", url: "https://init-wms.example.net/wms" });
    const provider = new WmsMapLayerImageryProvider(settings);

    await provider.initialize();   // must not throw; the tile tree stays alive to report status

    expect(provider.status).toEqual(MapLayerImageryProviderStatus.UntrustedOrigin);
    expect(provider.blockedOrigins).toEqual(["https://init-wms.example.net"]);
  });
});

describe("ArcGisUtilities.getServiceJson SSO origin restriction", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const serviceUrl = "https://maps.example.com/arcgis/rest/services/test/MapServer";

  function jsonResponse(): Response {
    return new Response(JSON.stringify({ currentVersion: 11 }), { status: 200, headers: { "content-type": "application/json" } });
  }

  beforeEach(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
    IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins = true;
    fetchMock = vi.fn(async () => ntlmChallengeResponse());
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    if (IModelApp.initialized)
      await IModelApp.shutdown();
  });

  it("does not retry with SSO credentials for a non-whitelisted origin", async () => {
    await expect(ArcGisUtilities.getServiceJson({ url: serviceUrl, formatId: "ArcGIS", ignoreCache: true })).rejects.toBeInstanceOf(MapLayerUntrustedOriginError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries with SSO credentials for a whitelisted origin", async () => {
    IModelApp.mapLayerFormatRegistry.trustedCredentialsOrigins = ["https://maps.example.com"];
    fetchMock.mockResolvedValueOnce(ntlmChallengeResponse()).mockResolvedValueOnce(jsonResponse());

    const json = await ArcGisUtilities.getServiceJson({ url: serviceUrl, formatId: "ArcGIS", ignoreCache: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryOpts = fetchMock.mock.calls[1][1] as RequestInit;
    expect(retryOpts.credentials).toEqual("include");
    expect(json?.content.currentVersion).toEqual(11);
  });

  it("retries with SSO credentials for any origin when restriction is disabled (legacy default)", async () => {
    IModelApp.mapLayerFormatRegistry.restrictCredentialsToTrustedOrigins = false;
    fetchMock.mockResolvedValueOnce(ntlmChallengeResponse()).mockResolvedValueOnce(jsonResponse());

    await ArcGisUtilities.getServiceJson({ url: serviceUrl, formatId: "ArcGIS", ignoreCache: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("validateSource reports UntrustedOrigin when the SSO retry is suppressed", async () => {
    const source = MapLayerSource.fromJSON({ name: "", formatId: "ArcGIS", url: "https://validate-arcgis.example.net/arcgis/rest/services/test/MapServer" });
    if (!source)
      expect.fail("Could not create source");

    const validation = await ArcGisUtilities.validateSource({ source, ignoreCache: true, capabilitiesFilter: [] });
    expect(validation.status).toEqual(MapLayerSourceStatus.UntrustedOrigin);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("provider initialization reports UntrustedOrigin with the blocked origin", async () => {
    const settings = ImageMapLayerSettings.fromJSON({ formatId: "ArcGIS", name: "Test", url: "https://init-arcgis.example.net/arcgis/rest/services/test/MapServer" });
    const provider = new ArcGISMapLayerImageryProvider(settings);

    await provider.initialize();   // must not throw; the tile tree stays alive to report status

    expect(provider.status).toEqual(MapLayerImageryProviderStatus.UntrustedOrigin);
    expect(provider.blockedOrigins).toEqual(["https://init-arcgis.example.net"]);
  });

  it("gates the SSO retry on the origin that issued the challenge after a redirect", async () => {
    IModelApp.mapLayerFormatRegistry.trustedCredentialsOrigins = ["https://maps.example.com"];
    const finalUrl = "https://redirect.example.net/arcgis/rest/services/test/MapServer?f=json";
    fetchMock.mockResolvedValue(redirectedTo(ntlmChallengeResponse(), finalUrl));

    const err = await ArcGisUtilities.getServiceJson({ url: serviceUrl, formatId: "ArcGIS", ignoreCache: true }).catch((e) => e);
    expect(err).toBeInstanceOf(MapLayerUntrustedOriginError);
    expect((err as MapLayerUntrustedOriginError).url).toEqual(finalUrl);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries the challenged post-redirect URL directly, refusing further redirects", async () => {
    const finalUrl = "https://redirect.example.net/arcgis/rest/services/test/MapServer?f=json";
    IModelApp.mapLayerFormatRegistry.trustedCredentialsOrigins = ["https://redirect.example.net"];
    fetchMock.mockResolvedValueOnce(redirectedTo(ntlmChallengeResponse(), finalUrl)).mockResolvedValueOnce(jsonResponse());

    const json = await ArcGisUtilities.getServiceJson({ url: serviceUrl, formatId: "ArcGIS", ignoreCache: true });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toEqual(finalUrl);
    const retryOpts = fetchMock.mock.calls[1][1] as RequestInit;
    expect(retryOpts.credentials).toEqual("include");
    expect(retryOpts.redirect).toEqual("error");
    expect(json?.content.currentVersion).toEqual(11);
  });

  it("ArcGIS provider fetch gates the SSO retry on the post-redirect origin", async () => {
    IModelApp.mapLayerFormatRegistry.trustedCredentialsOrigins = ["https://maps.example.com"];
    const finalUrl = "https://redirect.example.net/arcgis/rest/services/test/MapServer/tile/0/0/0";
    fetchMock.mockResolvedValue(redirectedTo(ntlmChallengeResponse(), finalUrl));

    const settings = ImageMapLayerSettings.fromJSON({ formatId: "ArcGIS", name: "Test", url: serviceUrl });
    const provider = new ArcGISMapLayerImageryProvider(settings);
    const response = await (provider as any).fetch(new URL(`${serviceUrl}/tile/0/0/0`), { method: "GET" });

    expect(fetchMock).toHaveBeenCalledTimes(1);   // no credentialed retry
    expect(response.status).toEqual(401);
    expect(provider.status).toEqual(MapLayerImageryProviderStatus.UntrustedOrigin);
    expect(provider.blockedOrigins).toEqual(["https://redirect.example.net"]);
  });

  it("ArcGIS provider fetch retries the challenged post-redirect URL directly, refusing further redirects", async () => {
    const finalUrl = "https://redirect.example.net/arcgis/rest/services/test/MapServer/tile/0/0/0";
    IModelApp.mapLayerFormatRegistry.trustedCredentialsOrigins = ["https://redirect.example.net"];
    fetchMock.mockResolvedValueOnce(redirectedTo(ntlmChallengeResponse(), finalUrl)).mockResolvedValue(okResponse());

    const settings = ImageMapLayerSettings.fromJSON({ formatId: "ArcGIS", name: "Test", url: serviceUrl });
    const provider = new ArcGISMapLayerImageryProvider(settings);
    const response = await (provider as any).fetch(new URL(`${serviceUrl}/tile/0/0/0`), { method: "GET" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toEqual(finalUrl);
    const retryOpts = fetchMock.mock.calls[1][1] as RequestInit;
    expect(retryOpts.credentials).toEqual("include");
    expect(retryOpts.redirect).toEqual("error");
    expect(response.status).toEqual(200);
  });
});
