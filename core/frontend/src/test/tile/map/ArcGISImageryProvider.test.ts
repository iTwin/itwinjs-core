/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ImageMapLayerSettings } from "@itwin/core-common";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArcGisErrorCode, ArcGISImageryProvider, MapLayerAccessClient, MapLayerImageryProviderStatus } from "../../../tile/internal";
import { indexedArrayFromUrlParams } from "./MapLayerTestUtilities";
import { headersIncludeAuthMethod } from "../../../request/utils";

const sampleSource = { formatId: "ArcGIS", url: "https://sub.service.com/service", name: "Test" };

class TestArcGISProvider extends  ArcGISImageryProvider {
  public override async  constructUrl(_row: number, _column: number, _zoomLevel: number): Promise<string> {
    return "";
  }

  public override async fetch(url: URL, options?: RequestInit): Promise<Response> {
    return super.fetch(url, options);
  }

  public useAccessClient(accessClient: MapLayerAccessClient): void {
    this._accessClient = accessClient;
    this._accessTokenRequired = true;
  }
}

describe("ArcGISImageryProvider", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
  });

  it("retries a legacy-token request with a fresh token on the complete request URL", async () => {
    const settings = ImageMapLayerSettings.fromJSON(sampleSource);
    settings.setCredentials("user", "pwd");
    settings.savedQueryParams = { custom: "1" };
    const provider = new TestArcGISProvider(settings, true);

    const tokens = ["expired-token", "fresh-token"];
    const invalidateToken = vi.fn();
    provider.useAccessClient({
      getAccessToken: async () => ({ token: tokens.shift() ?? "unexpected" }),
      invalidateToken,
    });

    const jsonResponse = (body: object) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    const fetchStub = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ error: { code: ArcGisErrorCode.InvalidToken } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    await provider.fetch(new URL(`${settings.url}?f=json`), { method: "GET" });

    expect(fetchStub).toHaveBeenCalledTimes(2);
    expect(invalidateToken).toHaveBeenCalledWith({ token: "expired-token" });
    const retried = new URL(fetchStub.mock.calls[1][0] as string);
    expect(retried.searchParams.getAll("token")).toEqual(["fresh-token"]);
    expect(retried.searchParams.get("custom")).toEqual("1");
    expect(retried.searchParams.get("f")).toEqual("json");
    expect(provider.status).toEqual(MapLayerImageryProviderStatus.Valid);
  });

  it("should inject custom parameters before fetch call", async () => {
    const settings = ImageMapLayerSettings.fromJSON({...sampleSource, subLayers: [{name:"layer1", id: "1", visible:false}, {name:"layer2", id: "2", visible:true}, {name:"layer3", id: "3", visible:true}]});
    if (!settings)
      expect.fail("Could not create settings");

    const provider = new TestArcGISProvider(settings, true);

    const fetchStub = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response());;

    const testUrl = `${settings.url}?testParam=test`;
    await provider.fetch(new URL(testUrl), { method: "GET" });
    expect(fetchStub).toHaveBeenCalled();

    let urlObj = fetchStub.mock.calls[0][0];
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    expect(urlObj.toString()).toEqual(testUrl);

    const unsaved = new URLSearchParams([
      ["key1_1", "value1_1"],
      ["key1_2", "value1_2"],
      ["testParam", "BAD"],
    ]);
    const saved = new URLSearchParams([
      ["key2_1", "value2_1"],
      ["key2_2", "value2_2"],
    ]);
    settings.unsavedQueryParams = indexedArrayFromUrlParams(unsaved);
    settings.savedQueryParams = indexedArrayFromUrlParams(saved);

    unsaved.delete("testParam");    // check that test'
    await provider.fetch(new URL(testUrl), { method: "GET" });
    expect(fetchStub).toHaveBeenCalledTimes(2);
    urlObj = fetchStub.mock.calls[1][0];
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    expect(urlObj.toString()).toEqual(`${testUrl}&${saved.toString()}&${unsaved.toString()}`);
  });

  it("headersIncludeAuthMethod", async () => {
    const headers1 = new Headers([["WWW-authenticate", "ntlm"]]);
    expect(headersIncludeAuthMethod(headers1, ["ntlm", "negotiate"])).toBe(true);
    const headers2 = new Headers([["www-authenticate", "ntlm"]]);
    expect(headersIncludeAuthMethod(headers2, ["ntlm", "negotiate"])).toBe(true);
  });
});
