/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ImageMapLayerSettings } from "@itwin/core-common";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TileUrlImageryProvider } from "../../../tile/internal";
import { createFakeTileResponse } from "./MapLayerTestUtilities";

describe("MapLayerImageryProvider request headers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const getRequestHeaders = (fetchStub: ReturnType<typeof vi.spyOn>): Headers | undefined => {
    const init = fetchStub.mock.calls[0][1] as RequestInit | undefined;
    return init?.headers as Headers | undefined;
  };

  it("applies an API key header from unsavedHeaders", async () => {
    const settings = ImageMapLayerSettings.fromJSON({ formatId: "TileUrl", name: "", url: "https://sub.service.com/service/{level}/{column}/{row}" });
    settings.unsavedHeaders = { "X-Api-Key": "secretApiKey" };

    const fetchStub = vi.spyOn(globalThis, "fetch").mockResolvedValue(createFakeTileResponse("image/png"));
    const provider = new TileUrlImageryProvider(settings);
    await provider.makeTileRequest(await provider.constructUrl(0, 0, 0));

    expect(fetchStub).toHaveBeenCalledTimes(1);
    const headers = getRequestHeaders(fetchStub);
    expect(headers?.get("X-Api-Key")).toEqual("secretApiKey");
  });

  it("applies both basic credentials and custom headers", async () => {
    const settings = ImageMapLayerSettings.fromJSON({ formatId: "TileUrl", name: "", url: "https://sub.service.com/service/{level}/{column}/{row}" });
    settings.setCredentials("user", "password");
    settings.savedHeaders = { "X-Custom": "customValue" };

    const fetchStub = vi.spyOn(globalThis, "fetch").mockResolvedValue(createFakeTileResponse("image/png"));
    const provider = new TileUrlImageryProvider(settings);
    await provider.makeTileRequest(await provider.constructUrl(0, 0, 0));

    const headers = getRequestHeaders(fetchStub);
    expect(headers?.get("X-Custom")).toEqual("customValue");
    expect(headers?.get("Authorization")).toContain("Basic ");
  });

  it("does not add auth headers when none are configured", async () => {
    const settings = ImageMapLayerSettings.fromJSON({ formatId: "TileUrl", name: "", url: "https://sub.service.com/service/{level}/{column}/{row}" });

    const fetchStub = vi.spyOn(globalThis, "fetch").mockResolvedValue(createFakeTileResponse("image/png"));
    const provider = new TileUrlImageryProvider(settings);
    await provider.makeTileRequest(await provider.constructUrl(0, 0, 0));

    const headers = getRequestHeaders(fetchStub);
    expect(headers?.get("Authorization")).toBeNull();
  });
});
