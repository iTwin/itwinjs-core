/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { BeDuration } from "@itwin/core-bentley";
import { ServerTimeoutError } from "@itwin/core-common";
import {
  IModelApp, IModelTile, IModelTileTree, IpcApp, SnapshotConnection, Tile, TileLoadStatus, TileRequestChannel, Viewport,
} from "@itwin/core-frontend";
import { TILE_DATA_2_0 } from "./data/TileIO.data.2.0";
import { fakeViewState } from "./TileIO.test";

describe("IModelTileRequestChannels", () => {
  function getCloudStorageChannel(): TileRequestChannel {
    const channels = IModelApp.tileAdmin.channels;
    if (!channels.iModelChannels.cloudStorage) {
      channels.enableCloudStorageCache();
      expect(channels.iModelChannels.cloudStorage).not.to.be.undefined;
    }

    return channels.iModelChannels.cloudStorage!;
  }

  async function getTileForIModel(imodel: SnapshotConnection): Promise<IModelTile> {
    await imodel.models.load("0x1c");
    const model = imodel.models.getLoaded("0x1c")!.asGeometricModel!;
    const view = fakeViewState(imodel);
    const ref = model.createTileTreeReference(view);
    const tree = (await ref.treeOwner.loadTree()) as IModelTileTree;

    // The root tile marks itself as "ready" immediately. Make it "not loaded" instead.
    tree.staticBranch.disposeContents();
    return tree.staticBranch;
  }

  async function waitUntil(condition: () => boolean): Promise<void> {
    await BeDuration.wait(1);
    if (!condition())
      return waitUntil(condition);
  }

  async function loadContent(tile: Tile): Promise<void> {
    const viewport = {
      viewportId: 12345,
      iModel: tile.tree.iModel,
      invalidateScene: () => { },
    } as Viewport;

    IModelApp.tileAdmin.requestTiles(viewport, new Set<Tile>([tile]));
    IModelApp.tileAdmin.process();
    return waitUntil(() => tile.loadStatus !== TileLoadStatus.Queued && tile.loadStatus !== TileLoadStatus.Loading);
  }

  describe("CloudStorageCacheChannel", () => {
    let imodel: SnapshotConnection;

    beforeEach(async () => {
      await IModelApp.startup();
      imodel = await SnapshotConnection.openFile("test.bim");
    });

    afterEach(async () => {
      await imodel.close();
      await IModelApp.shutdown();
    });

    function getTile() {
      return getTileForIModel(imodel);
    }

    it("is not configured by default", async () => {
      expect(IModelApp.tileAdmin.channels.iModelChannels.cloudStorage).to.be.undefined;
      const tile = await getTile();
      expect(tile.channel).to.equal(IModelApp.tileAdmin.channels.iModelChannels.rpc);
    });

    it("uses http concurrency", async () => {
      const channel = getCloudStorageChannel();
      expect(channel.concurrency).to.equal(IModelApp.tileAdmin.channels.httpConcurrency);
    });

    it("is used first if configured", async () => {
      IModelApp.tileAdmin.channels.enableCloudStorageCache();
      expect(IModelApp.tileAdmin.channels.iModelChannels.cloudStorage).not.to.be.undefined;
      const tile = await getTile();
      expect(tile.channel).to.equal(IModelApp.tileAdmin.channels.iModelChannels.cloudStorage);

      tile.channel.requestContent = async () => Promise.resolve(TILE_DATA_2_0.rectangle.bytes);
      await loadContent(tile);
      expect(tile.loadStatus).to.equal(TileLoadStatus.Ready);
      expect(tile.channel).to.equal(IModelApp.tileAdmin.channels.iModelChannels.cloudStorage);
    });

    it("falls back to RPC if content is not found", async () => {
      IModelApp.tileAdmin.channels.enableCloudStorageCache();
      const tile = await getTile();
      const channel = getCloudStorageChannel();
      expect(tile.channel).to.equal(channel);

      channel.requestContent = async () => Promise.resolve(undefined);
      await loadContent(tile);
      expect(tile.loadStatus).to.equal(TileLoadStatus.NotLoaded);
      expect(tile.channel).to.equal(IModelApp.tileAdmin.channels.iModelChannels.rpc);

      tile.channel.requestContent = async () => Promise.resolve(TILE_DATA_2_0.rectangle.bytes);
      await loadContent(tile);
      expect(tile.loadStatus).to.equal(TileLoadStatus.Ready);
    });

    it("is not used again after cache miss", async () => {
      IModelApp.tileAdmin.channels.enableCloudStorageCache();
      const tile = await getTile();
      const channel = getCloudStorageChannel();

      channel.requestContent = async () => { throw new ServerTimeoutError("..."); };
      await loadContent(tile);
      expect(tile.loadStatus).to.equal(TileLoadStatus.NotLoaded);
      expect(tile.channel).to.equal(channel);
      expect(tile.requestChannel).to.be.undefined;

      channel.requestContent = async () => Promise.resolve(undefined);
      await loadContent(tile);
      expect(tile.loadStatus).to.equal(TileLoadStatus.NotLoaded);
      expect(tile.channel).to.equal(IModelApp.tileAdmin.channels.iModelChannels.rpc);
      expect(tile.requestChannel).to.equal(IModelApp.tileAdmin.channels.iModelChannels.rpc);

      tile.channel.requestContent = async () => Promise.resolve(TILE_DATA_2_0.rectangle.bytes);
      await loadContent(tile);
      expect(tile.loadStatus).to.equal(TileLoadStatus.Ready);

      tile.disposeContents();
      expect(tile.loadStatus).to.equal(TileLoadStatus.NotLoaded);
      expect(tile.requestChannel).to.equal(IModelApp.tileAdmin.channels.iModelChannels.rpc);
      expect(tile.channel).to.equal(IModelApp.tileAdmin.channels.iModelChannels.rpc);
    });
  });

  describe("Metadata cache channel", () => {
    let imodel: SnapshotConnection;

    beforeEach(async () => {
      await IModelApp.startup({ tileAdmin: { cacheTileMetadata: true } });
      imodel = await SnapshotConnection.openFile("test.bim");
    });

    afterEach(async () => {
      await imodel.close();
      await IModelApp.shutdown();
    });

    function getTile() {
      return getTileForIModel(imodel);
    }

    function getChannel(): TileRequestChannel {
      let channel: TileRequestChannel | undefined;
      for (const ch of IModelApp.tileAdmin.channels) {
        if (ch.name === "itwinjs-imodel-metadata-cache") {
          channel = ch;
          break;
        }
      }

      expect(channel).not.to.be.undefined;
      return channel!;
    }

    it("is configured if specified at startup", () => {
      expect(getChannel()).not.to.be.undefined;
    });

    it("is highly concurrent", () => {
      expect(getChannel().concurrency).to.equal(100);
    });

    it("is used first", async () => {
      const tile = await getTile();
      expect(tile.channel).to.equal(getChannel());
      expect(tile.requestChannel).to.be.undefined;

      tile.channel.requestContent = async () => Promise.resolve(TILE_DATA_2_0.rectangle.bytes);
      await loadContent(tile);
      expect(tile.loadStatus).to.equal(TileLoadStatus.Ready);
      expect(tile.channel).to.equal(getChannel());
      expect(tile.requestChannel).to.be.undefined;
    });

    it("falls back to RPC if content is not found and cloud storage is not configured", async () => {
      expect(IModelApp.tileAdmin.channels.iModelChannels.cloudStorage).to.be.undefined;
      const tile = await getTile();
      const channel = getChannel();
      expect(tile.channel).to.equal(channel);

      channel.requestContent = async () => Promise.resolve(undefined);
      await loadContent(tile);
      expect(tile.loadStatus).to.equal(TileLoadStatus.NotLoaded);
      expect(tile.channel).to.equal(IModelApp.tileAdmin.channels.iModelChannels.rpc);

      tile.channel.requestContent = async () => Promise.resolve(TILE_DATA_2_0.rectangle.bytes);
      await loadContent(tile);
      expect(tile.loadStatus).to.equal(TileLoadStatus.Ready);
    });

    it("falls back to cloud storage, then to RPC, if content is not found and cloud storage is configured", async () => {
      IModelApp.tileAdmin.channels.enableCloudStorageCache();
      const cloud = IModelApp.tileAdmin.channels.iModelChannels.cloudStorage!;
      expect(cloud).not.to.be.undefined;

      const tile = await getTile();
      const channel = getChannel();
      expect(tile.channel).to.equal(channel);

      channel.requestContent = async () => Promise.resolve(undefined);
      await loadContent(tile);
      expect(tile.loadStatus).to.equal(TileLoadStatus.NotLoaded);
      expect(tile.channel).to.equal(cloud);

      cloud.requestContent = async () => Promise.resolve(undefined);
      await loadContent(tile);
      expect(tile.loadStatus).to.equal(TileLoadStatus.NotLoaded);
      expect(tile.channel).to.equal(IModelApp.tileAdmin.channels.iModelChannels.rpc);
    });

    it("caches metadata from RPC", async () => {
    });

    it("obtains metadata and empty graphic from cache if present", async () => {
    });

    it("is not used again after cache miss", async () => {
    });
  });
});

describe("RPC channels", () => {
  before(async () => { await IModelApp.startup(); });
  after(async () => { await IModelApp.shutdown(); });

  it("use http or rpc concurrency based on type of app", async () => {
    const channels = IModelApp.tileAdmin.channels;
    if (IpcApp.isValid)
      expect(channels.rpcConcurrency).to.equal(await IpcApp.callIpcHost("queryConcurrency", "cpu"));
    else
      expect(channels.rpcConcurrency).to.equal(channels.httpConcurrency);

    for (const channel of [channels.iModelChannels.rpc, channels.elementGraphicsRpc])
      expect(channel.concurrency).to.equal(IpcApp.isValid ? channels.rpcConcurrency : channels.httpConcurrency);
  });
});
