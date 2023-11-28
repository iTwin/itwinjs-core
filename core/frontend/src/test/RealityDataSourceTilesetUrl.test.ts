/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { RealityDataProvider } from "@itwin/core-common";
import { RealityDataSourceTilesetUrlImpl } from "../RealityDataSourceTilesetUrlImpl";

describe("RealityDataSourceTilesetUrl", () => {
  it("handle content type of relative urls", async () => {
    const rdSource = await RealityDataSourceTilesetUrlImpl.createFromKey({ format: "", id: "", provider : RealityDataProvider.TilesetUrl }, undefined);
    expect(rdSource).to.not.be.undefined;
    expect(rdSource?.getTileContentType("tileset.json")).to.equal("tileset");
    expect(rdSource?.getTileContentType("tile.glb")).to.equal("tile");
    expect(rdSource?.getTileContentType("./tileset.json")).to.equal("tileset");
    expect(rdSource?.getTileContentType("./tile.glb")).to.equal("tile");
    expect(rdSource?.getTileContentType("../tilesets/tileset.json")).to.equal("tileset");
    expect(rdSource?.getTileContentType("../models/tile.glb")).to.equal("tile");
    expect(rdSource?.getTileContentType("tilesets/tileset.json")).to.equal("tileset");
    expect(rdSource?.getTileContentType("models/tile.glb")).to.equal("tile");

    expect(rdSource?.getTileContentType("tileset.json?a=b&c=d")).to.equal("tileset");
    expect(rdSource?.getTileContentType("tile.glb?a=b&c=d")).to.equal("tile");
    expect(rdSource?.getTileContentType("./tileset.json?a=b&c=d")).to.equal("tileset");
    expect(rdSource?.getTileContentType("./tile.glb?a=b&c=d")).to.equal("tile");
    expect(rdSource?.getTileContentType("../tilesets/tileset.json?a=b&c=d")).to.equal("tileset");
    expect(rdSource?.getTileContentType("../models/tile.glb?a=b&c=d")).to.equal("tile");
    expect(rdSource?.getTileContentType("tilesets/tileset.json?a=b&c=d")).to.equal("tileset");
    expect(rdSource?.getTileContentType("models/tile.glb?a=b&c=d")).to.equal("tile");

    expect(rdSource?.getTileContentType("tileset.json?a=b&c=d#fragment")).to.equal("tileset");
    expect(rdSource?.getTileContentType("tile.glb?a=b&c=d#fragment")).to.equal("tile");
    expect(rdSource?.getTileContentType("./tileset.json?a=b&c=d#fragment")).to.equal("tileset");
    expect(rdSource?.getTileContentType("./tile.glb?a=b&c=d#fragment")).to.equal("tile");
    expect(rdSource?.getTileContentType("../tilesets/tileset.json?a=b&c=d#fragment")).to.equal("tileset");
    expect(rdSource?.getTileContentType("../models/tile.glb?a=b&c=d#fragment")).to.equal("tile");
    expect(rdSource?.getTileContentType("tilesets/tileset.json?a=b&c=d#fragment")).to.equal("tileset");
    expect(rdSource?.getTileContentType("models/tile.glb?a=b&c=d#fragment")).to.equal("tile");

    expect(rdSource?.getTileContentType("tileset.json#fragment")).to.equal("tileset");
    expect(rdSource?.getTileContentType("tile.glb#fragment")).to.equal("tile");
    expect(rdSource?.getTileContentType("./tileset.json#fragment")).to.equal("tileset");
    expect(rdSource?.getTileContentType("./tile.glb#fragment")).to.equal("tile");
    expect(rdSource?.getTileContentType("../tilesets/tileset.json#fragment")).to.equal("tileset");
    expect(rdSource?.getTileContentType("../models/tile.glb#fragment")).to.equal("tile");
    expect(rdSource?.getTileContentType("tilesets/tileset.json#fragment")).to.equal("tileset");
    expect(rdSource?.getTileContentType("models/tile.glb#fragment")).to.equal("tile");
  });
  it("handle content type of absolute urls", async () => {
    const rdSource = await RealityDataSourceTilesetUrlImpl.createFromKey({ format: "", id: "", provider : RealityDataProvider.TilesetUrl }, undefined);
    expect(rdSource).to.not.be.undefined;
    expect(rdSource?.getTileContentType("https://localhost/tilesets/tileset.json")).to.equal("tileset");
    expect(rdSource?.getTileContentType("https://localhost/models/tile.glb")).to.equal("tile");
    expect(rdSource?.getTileContentType("https://localhost/tilesets/tileset.json?a=b&c=d")).to.equal("tileset");
    expect(rdSource?.getTileContentType("https://localhost/models/tile.glb?a=b&c=d")).to.equal("tile");
    expect(rdSource?.getTileContentType("https://localhost/tilesets/tileset.json?a=b&c=d#fragment")).to.equal("tileset");
    expect(rdSource?.getTileContentType("https://localhost/models/tile.glb?a=b&c=d#fragment")).to.equal("tile");
    expect(rdSource?.getTileContentType("https://localhost/tilesets/tileset.json#fragment")).to.equal("tileset");
    expect(rdSource?.getTileContentType("https://localhost/models/tile.glb#fragment")).to.equal("tile");
  });
  it("handle content type of other cases", async () => {
    const rdSource = await RealityDataSourceTilesetUrlImpl.createFromKey({ format: "", id: "", provider : RealityDataProvider.TilesetUrl }, undefined);
    expect(rdSource).to.not.be.undefined;
    expect(rdSource?.getTileContentType("")).to.not.equal("tileset");
    expect(rdSource?.getTileContentType("tileset.json/")).to.not.equal("tileset");
    expect(rdSource?.getTileContentType("tileset.json2")).to.equal("tile");
    expect(rdSource?.getTileContentType("tileset.json/tileset.js")).to.equal("tile");
    expect(rdSource?.getTileContentType("TILESET.JSON")).to.equal("tileset");
    expect(rdSource?.getTileContentType("..\\tilesets\\tileset.json")).to.equal("tileset");
    expect(rdSource?.getTileContentType("/path/../tilesets/tileset.json")).to.equal("tileset");
    expect(rdSource?.getTileContentType("/path/../models/json.glb")).to.equal("tile");
    expect(rdSource?.getTileContentType("tile.glb?referer=tileset.json")).to.equal("tile");
    expect(rdSource?.getTileContentType("file:///c:/path/to/tileset.json")).to.equal("tileset");
  });
});
