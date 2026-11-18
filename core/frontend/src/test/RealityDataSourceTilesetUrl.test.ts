/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { RealityDataProvider } from "@itwin/core-common";
import { RealityDataSourceTilesetUrlImpl } from "../RealityDataSourceTilesetUrlImpl";

describe("RealityDataSourceTilesetUrl", () => {
  it("handle content type of relative urls", async () => {
    const rdSource = await RealityDataSourceTilesetUrlImpl.createFromKey({ format: "", id: "", provider : RealityDataProvider.TilesetUrl }, undefined);
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
    const rdSource = await RealityDataSourceTilesetUrlImpl.createFromKey({ format: "", id: "", provider : RealityDataProvider.TilesetUrl }, undefined);
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
    const rdSource = await RealityDataSourceTilesetUrlImpl.createFromKey({ format: "", id: "", provider : RealityDataProvider.TilesetUrl }, undefined);
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
    class TestTilesetUrlImpl extends RealityDataSourceTilesetUrlImpl {
      public constructor(url: string) {
        super({ sourceKey: { format: "", id: url, provider: RealityDataProvider.TilesetUrl } });
        this.setBaseUrl(url);
      }
    }

    const root = "https://acct.blob.core.windows.net/container/dir/tileset.json?sv=1&sig=secret";

    it("appends root search params to relative and same-origin URLs", () => {
      const source = new TestTilesetUrlImpl(root);
      expect(source.getTileUrl("tile.glb")).toEqual("https://acct.blob.core.windows.net/container/dir/tile.glb?sv=1&sig=secret");
      expect(source.getTileUrl("https://acct.blob.core.windows.net/container/other/tile.glb")).toEqual("https://acct.blob.core.windows.net/container/other/tile.glb?sv=1&sig=secret");
    });

    it("does not forward root search params to a different origin", () => {
      const source = new TestTilesetUrlImpl(root);
      expect(source.getTileUrl("https://evil.example.com/tile.glb")).toEqual("https://evil.example.com/tile.glb");
      expect(source.getTileUrl("http://acct.blob.core.windows.net/container/dir/tile.glb")).toEqual("http://acct.blob.core.windows.net/container/dir/tile.glb");
      expect(source.getTileUrl("https://acct.blob.core.windows.net:8443/container/dir/tile.glb")).toEqual("https://acct.blob.core.windows.net:8443/container/dir/tile.glb");
    });
  });
});
