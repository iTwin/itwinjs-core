/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { EmptyLocalization, ImageMapLayerSettings } from "@itwin/core-common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MapLayerImageryProvider } from "../../../tile/internal";
import { IModelApp } from "../../../IModelApp";

class TestImageryProvider extends MapLayerImageryProvider {
  public async constructUrl(row: number, column: number, zoomLevel: number) {
    return `${this._settings.url}/tile/${zoomLevel}/${row}/${column}`;
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

  it("normalizes whitelist entries to their origin and ignores invalid ones", () => {
    IModelApp.mapLayerFormatRegistry.trustedCredentialsOrigins = [
      "https://tiles.example.com/some/path?query=1",
      "not a valid origin",
    ];

    expect(IModelApp.mapLayerFormatRegistry.trustedCredentialsOrigins).toEqual(["https://tiles.example.com"]);
  });
});
