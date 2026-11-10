/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it, vi } from "vitest";
import { RealityDataSourceKey, RealityDataSourceProps } from "@itwin/core-common";
import { RealityDataSourceGoogle3dTilesImpl } from "../internal/RealityDataSourceGoogle3dTilesImpl";
import { getGoogle3dTilesUrl, Google3dTilesProvider } from "../RealityDataSource";

describe("RealityDataSourceGoogle3dTilesImpl", async () => {
  const provider = new Google3dTilesProvider({ apiKey: "testApiKey" });
  const rdSourceKey = {
    provider: "Test Google 3D Tiles provider",
    format: "ThreeDTile",
    id: getGoogle3dTilesUrl()
  }
  const rdSource = await provider.createRealityDataSource(rdSourceKey, undefined);

  it("handle content type of relative urls", async () => {
    expect(rdSource).toBeDefined();
    expect(rdSource?.getTileContentType("tileset.json")).toEqual("tileset");
    expect(rdSource?.getTileContentType("tile.glb")).toEqual("tile");
    expect(rdSource?.getTileContentType("./tileset.json")).toEqual("tileset");
    expect(rdSource?.getTileContentType("./tile.glb")).toEqual("tile");
    expect(rdSource?.getTileContentType("../tilesets/tileset.json")).toEqual("tileset");
    expect(rdSource?.getTileContentType("../models/tile.glb")).toEqual("tile");
    expect(rdSource?.getTileContentType("tilesets/tileset.json")).toEqual("tileset");
    expect(rdSource?.getTileContentType("models/tile.glb")).toEqual("tile");

    expect(rdSource?.getTileContentType("tileset.json?a=b&c=d")).toEqual("tileset");
    expect(rdSource?.getTileContentType("tile.glb?a=b&c=d")).toEqual("tile");
    expect(rdSource?.getTileContentType("./tileset.json?a=b&c=d")).toEqual("tileset");
    expect(rdSource?.getTileContentType("./tile.glb?a=b&c=d")).toEqual("tile");
    expect(rdSource?.getTileContentType("../tilesets/tileset.json?a=b&c=d")).toEqual("tileset");
    expect(rdSource?.getTileContentType("../models/tile.glb?a=b&c=d")).toEqual("tile");
    expect(rdSource?.getTileContentType("tilesets/tileset.json?a=b&c=d")).toEqual("tileset");
    expect(rdSource?.getTileContentType("models/tile.glb?a=b&c=d")).toEqual("tile");

    expect(rdSource?.getTileContentType("tileset.json?a=b&c=d#fragment")).toEqual("tileset");
    expect(rdSource?.getTileContentType("tile.glb?a=b&c=d#fragment")).toEqual("tile");
    expect(rdSource?.getTileContentType("./tileset.json?a=b&c=d#fragment")).toEqual("tileset");
    expect(rdSource?.getTileContentType("./tile.glb?a=b&c=d#fragment")).toEqual("tile");
    expect(rdSource?.getTileContentType("../tilesets/tileset.json?a=b&c=d#fragment")).toEqual("tileset");
    expect(rdSource?.getTileContentType("../models/tile.glb?a=b&c=d#fragment")).toEqual("tile");
    expect(rdSource?.getTileContentType("tilesets/tileset.json?a=b&c=d#fragment")).toEqual("tileset");
    expect(rdSource?.getTileContentType("models/tile.glb?a=b&c=d#fragment")).toEqual("tile");

    expect(rdSource?.getTileContentType("tileset.json#fragment")).toEqual("tileset");
    expect(rdSource?.getTileContentType("tile.glb#fragment")).toEqual("tile");
    expect(rdSource?.getTileContentType("./tileset.json#fragment")).toEqual("tileset");
    expect(rdSource?.getTileContentType("./tile.glb#fragment")).toEqual("tile");
    expect(rdSource?.getTileContentType("../tilesets/tileset.json#fragment")).toEqual("tileset");
    expect(rdSource?.getTileContentType("../models/tile.glb#fragment")).toEqual("tile");
    expect(rdSource?.getTileContentType("tilesets/tileset.json#fragment")).toEqual("tileset");
    expect(rdSource?.getTileContentType("models/tile.glb#fragment")).toEqual("tile");
  });
  it("handle content type of absolute urls", async () => {
    expect(rdSource).toBeDefined();
    expect(rdSource?.getTileContentType("https://localhost/tilesets/tileset.json")).toEqual("tileset");
    expect(rdSource?.getTileContentType("https://localhost/models/tile.glb")).toEqual("tile");
    expect(rdSource?.getTileContentType("https://localhost/tilesets/tileset.json?a=b&c=d")).toEqual("tileset");
    expect(rdSource?.getTileContentType("https://localhost/models/tile.glb?a=b&c=d")).toEqual("tile");
    expect(rdSource?.getTileContentType("https://localhost/tilesets/tileset.json?a=b&c=d#fragment")).toEqual("tileset");
    expect(rdSource?.getTileContentType("https://localhost/models/tile.glb?a=b&c=d#fragment")).toEqual("tile");
    expect(rdSource?.getTileContentType("https://localhost/tilesets/tileset.json#fragment")).toEqual("tileset");
    expect(rdSource?.getTileContentType("https://localhost/models/tile.glb#fragment")).toEqual("tile");
  });
  it("handle content type of other cases", async () => {
    expect(rdSource).toBeDefined();
    expect(rdSource?.getTileContentType("")).to.not.equal("tileset");
    expect(rdSource?.getTileContentType("tileset.json/")).to.not.equal("tileset");
    expect(rdSource?.getTileContentType("tileset.json2")).toEqual("tile");
    expect(rdSource?.getTileContentType("tileset.json/tileset.js")).toEqual("tile");
    expect(rdSource?.getTileContentType("TILESET.JSON")).toEqual("tileset");
    expect(rdSource?.getTileContentType("..\\tilesets\\tileset.json")).toEqual("tileset");
    expect(rdSource?.getTileContentType("/path/../tilesets/tileset.json")).toEqual("tileset");
    expect(rdSource?.getTileContentType("/path/../models/json.glb")).toEqual("tile");
    expect(rdSource?.getTileContentType("tile.glb?referer=tileset.json")).toEqual("tile");
    expect(rdSource?.getTileContentType("file:///c:/path/to/tileset.json")).toEqual("tileset");
  });

  describe("getTileUrl", () => {
    const sourceKey = {
      provider: "Test Google 3D Tiles provider",
      format: "ThreeDTile",
    }
    class TestGoogle3dTilesImpl extends RealityDataSourceGoogle3dTilesImpl {
      public constructor(props: RealityDataSourceProps) {
        super(props, undefined);
      }

      public override setBaseUrl(url: string): void {
        super.setBaseUrl(url);
      }

      public static override async createFromKey(key: RealityDataSourceKey): Promise<TestGoogle3dTilesImpl | undefined> {
        const source = await RealityDataSourceGoogle3dTilesImpl.createFromKey(key, undefined, undefined) as TestGoogle3dTilesImpl;
        source.setBaseUrl(key.id);
        return source;
      }
    }

    it("should get correct URL", async () => {
      const url = "https://tile.googleapis.com/some/sub/dirs/root.json";
      const source = await TestGoogle3dTilesImpl.createFromKey({ ...sourceKey, id: url });
      expect(source).toBeDefined();

      if (!source)
        return;

      const returnedUrl = source.getTileUrl("tileset.json");
      expect(returnedUrl).toEqual("https://tile.googleapis.com/tileset.json");

      const returnedUrl2 = source.getTileUrl("tile.glb");
      expect(returnedUrl2).toEqual("https://tile.googleapis.com/tile.glb");
    });

    it("should handle tile path starting with slash", async () => {
      const url = "https://tile.googleapis.com/some/sub/dirs/root.json";
      const source = await TestGoogle3dTilesImpl.createFromKey({ ...sourceKey, id: url });
      expect(source).toBeDefined();

      if (!source)
        return;

      const returnedUrl = source.getTileUrl("/tileset.json");
      expect(returnedUrl).toEqual("https://tile.googleapis.com/tileset.json");

      const returnedUrl2 = source.getTileUrl("/tile.glb");
      expect(returnedUrl2).toEqual("https://tile.googleapis.com/tile.glb");
    });

    it("should handle paths with leading subdirectories", async () => {
      const url = "https://tile.googleapis.com/some/sub/dirs/root.json?key=key&sessionId=id";
      const source = await TestGoogle3dTilesImpl.createFromKey({ ...sourceKey, id: url });
      expect(source).toBeDefined();

      if (!source)
        return;

      const returnedUrl = source.getTileUrl("some/leading/path/tileset.json");
      expect(returnedUrl).toEqual("https://tile.googleapis.com/some/leading/path/tileset.json?key=key&sessionId=id");

      const returnedUrl2 = source.getTileUrl("some/leading/path/tile.glb");
      expect(returnedUrl2).toEqual("https://tile.googleapis.com/some/leading/path/tile.glb?key=key&sessionId=id");
    });

    it("should pass down root search params", async () => {
      const url = "https://tile.googleapis.com/some/sub/dirs/root.json?key=key&sessionId=id";
      const source = await TestGoogle3dTilesImpl.createFromKey({ ...sourceKey, id: url });
      expect(source).toBeDefined();

      if (!source)
        return;

      const returnedUrl = source.getTileUrl("tileset.json");
      expect(returnedUrl).toEqual("https://tile.googleapis.com/tileset.json?key=key&sessionId=id");

      const returnedUrl2 = source.getTileUrl("tile.glb");
      expect(returnedUrl2).toEqual("https://tile.googleapis.com/tile.glb?key=key&sessionId=id");
    });

    it("should pass down root search params while preserving tile's search params", async () => {
      const url = "https://tile.googleapis.com/some/sub/dirs/root.json?key=key";
      const source = await TestGoogle3dTilesImpl.createFromKey({ ...sourceKey, id: url });
      expect(source).toBeDefined();

      if (!source)
        return;

      const returnedUrl = source.getTileUrl("tile.glb?sessionId=123");
      expect(returnedUrl).toEqual("https://tile.googleapis.com/tile.glb?sessionId=123&key=key");

      const returnedUrl2 = source.getTileUrl("tile.glb?sessionId=456");
      expect(returnedUrl2).toEqual("https://tile.googleapis.com/tile.glb?sessionId=456&key=key");
    });

    it("should pass down root search params while preserving tileset's search params", async () => {
      const url = "https://tile.googleapis.com/some/sub/dirs/root.json?key=key";
      const source = await TestGoogle3dTilesImpl.createFromKey({ ...sourceKey, id: url });
      expect(source).toBeDefined();

      if (!source)
        return;

      const returnedUrl = source.getTileUrl("tileset.json?sessionId=123");
      expect(returnedUrl).toEqual("https://tile.googleapis.com/tileset.json?sessionId=123&key=key");

      const returnedUrl2 = source.getTileUrl("tileset.json?sessionId=456");
      expect(returnedUrl2).toEqual("https://tile.googleapis.com/tileset.json?sessionId=456&key=key");
    });

    it("should pass down both root search params and tileset search params", async () => {
      const url = "https://tile.googleapis.com/some/sub/dirs/root.json?key=key";
      const source = await TestGoogle3dTilesImpl.createFromKey({ ...sourceKey, id: url });
      expect(source).toBeDefined();

      if (!source)
        return;

      const returnedUrl = source.getTileUrl("tileset.json?sessionId=123");
      expect(returnedUrl).toEqual("https://tile.googleapis.com/tileset.json?sessionId=123&key=key");

      const returnedUrl2 = source.getTileUrl("tileset.json?sessionId=456");
      expect(returnedUrl2).toEqual("https://tile.googleapis.com/tileset.json?sessionId=456&key=key");

      const returnedUrl3 = source.getTileUrl("tile.glb");
      // Nested tileset search params are merged into _searchParams with set(), so duplicate keys
      // (e.g. sessionId) keep only the latest value when passed down to child tiles.
      expect(returnedUrl3).toEqual("https://tile.googleapis.com/tile.glb?key=key&sessionId=456");
    });

    it("does not duplicate the same session across nested tilesets", async () => {
      const url = "https://tile.googleapis.com/v1/root.json?key=key";
      const source = await TestGoogle3dTilesImpl.createFromKey({ ...sourceKey, id: url });
      expect(source).toBeDefined();
      if (!source)
        return;

      // Simulate nested tileset resolution where Google repeats the same session on each tileset URL.
      source.getTileUrl("tileset.json?session=abc");
      source.getTileUrl("child/tileset.json?session=abc");
      source.getTileUrl("child/nested/tileset.json?session=abc");

      const tileUrl = source.getTileUrl("tile.glb");
      const parsedUrl = new URL(tileUrl);
      expect(parsedUrl.origin + parsedUrl.pathname).toEqual("https://tile.googleapis.com/tile.glb");
      expect(parsedUrl.searchParams.get("key")).toEqual("key");
      expect(parsedUrl.searchParams.getAll("session")).toEqual(["abc"]);
    });

    it("does not forward search params to a different origin", async () => {
      const source = await TestGoogle3dTilesImpl.createFromKey({ ...sourceKey, id: "https://tile.googleapis.com/v1/root.json?key=key&session=s" });
      expect(source?.getTileUrl("https://evil.example.com/tile.glb")).toEqual("https://evil.example.com/tile.glb");
      expect(source?.getTileUrl("//evil.example.com/tile.glb")).toEqual("https://evil.example.com/tile.glb");
      expect(source?.getTileUrl("https://evil.example.com/tileset.json?session=x")).toEqual("https://evil.example.com/tileset.json?session=x");
      // Cross-origin tileset params must not be accumulated either.
      expect(source?.getTileUrl("tile.glb")).toEqual("https://tile.googleapis.com/tile.glb?key=key&session=s");
    });

    it("only sends the auth token to the root origin", async () => {
      const fetchStub = vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("{}"));
      const getAuthToken = vi.fn(async () => "token");
      const url = "https://tile.googleapis.com/v1/root.json";
      const source = await RealityDataSourceGoogle3dTilesImpl.createFromKey({ ...sourceKey, id: url }, undefined, undefined, getAuthToken) as TestGoogle3dTilesImpl;
      source.setBaseUrl(url);

      await source.getTileJson("https://evil.example.com/tileset.json");
      expect(getAuthToken).not.toHaveBeenCalled();
      expect(new Headers(fetchStub.mock.lastCall?.[1]?.headers).has("authorization")).toBe(false);

      await source.getTileJson("tileset.json");
      expect(getAuthToken).toHaveBeenCalledTimes(1);
      expect(new Headers(fetchStub.mock.lastCall?.[1]?.headers).get("authorization")).toContain("token");
      fetchStub.mockRestore();
    });
  });
});