/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as sinon from "sinon";
import * as sinonChai from "sinon-chai";
import { expect, use } from "chai";
import { BeDuration } from "@itwin/core-bentley";
import { CloudStorageContainerUrl, CloudStorageTileCache, IModelTileRpcInterface, ServerTimeoutError, TileContentIdentifier } from "@itwin/core-common";
import {
  IModelApp, IModelConnection, IModelTile, IModelTileContent, IModelTileTree, IpcApp, RenderGraphic, RenderMemory, SnapshotConnection, Tile, TileLoadStatus,
  TileRequestChannel, TileStorage, Viewport,
} from "@itwin/core-frontend";
import { FrontendStorage, TransferConfig } from "@itwin/object-storage-core/lib/frontend";
import { TestUtility } from "../../TestUtility";
import { TILE_DATA_2_0 } from "./data/TileIO.data.2.0";
import { fakeViewState } from "./TileIO.test";

use(sinonChai);

describe("IModelTileRequestChannels", () => {
  function getCloudStorageChannel(): TileRequestChannel {
    const channels = IModelApp.tileAdmin.channels;
    expect(channels.iModelChannels.cloudStorage).not.to.be.undefined;
    return channels.iModelChannels.cloudStorage;
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
      await TestUtility.startFrontend();
      imodel = await SnapshotConnection.openFile("test.bim");
    });

    afterEach(async () => {
      await imodel.close();
      await TestUtility.shutdownFrontend();
    });

    async function getTile() {
      return getTileForIModel(imodel);
    }

    it("is configured by default", async () => {
      expect(IModelApp.tileAdmin.channels.iModelChannels.cloudStorage).not.to.be.undefined;
      const tile = await getTile();
      expect(tile.channel).to.equal(IModelApp.tileAdmin.channels.iModelChannels.cloudStorage);
    });

    it("uses http concurrency", async () => {
      const channel = getCloudStorageChannel();
      expect(channel.concurrency).to.equal(IModelApp.tileAdmin.channels.httpConcurrency);
    });

    it("is used first", async () => {
      expect(IModelApp.tileAdmin.channels.iModelChannels.cloudStorage).not.to.be.undefined;
      const tile = await getTile();
      expect(tile.channel).to.equal(IModelApp.tileAdmin.channels.iModelChannels.cloudStorage);

      tile.channel.requestContent = async () => Promise.resolve(TILE_DATA_2_0.rectangle.bytes);
      await loadContent(tile);
      expect(tile.loadStatus).to.equal(TileLoadStatus.Ready);
      expect(tile.channel).to.equal(IModelApp.tileAdmin.channels.iModelChannels.cloudStorage);
    });

    it("falls back to RPC if content is not found", async () => {
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
      const tile = await getTile();
      const channel = getCloudStorageChannel();

      channel.requestContent = async () => {
        throw new ServerTimeoutError("...");
      };
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
      await TestUtility.startFrontend({ tileAdmin: { cacheTileMetadata: true } });
      imodel = await SnapshotConnection.openFile("test.bim");
    });

    afterEach(async () => {
      await imodel.close();
      await TestUtility.shutdownFrontend();
    });

    async function getTile() {
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

    it("falls back to cloud storage, then to RPC, if content is not found", async () => {
      const cloud = IModelApp.tileAdmin.channels.iModelChannels.cloudStorage;
      expect(cloud).not.to.be.undefined;

      const tile = await getTile();
      const channel = getChannel();
      expect(tile.channel).to.equal(channel);

      await loadContent(tile);
      expect(tile.loadStatus).to.equal(TileLoadStatus.NotLoaded);
      expect(tile.channel).to.equal(cloud);

      cloud.requestContent = async () => Promise.resolve(undefined);
      await loadContent(tile);
      expect(tile.loadStatus).to.equal(TileLoadStatus.NotLoaded);
      expect(tile.channel).to.equal(IModelApp.tileAdmin.channels.iModelChannels.rpc);
    });

    function expectEqualContent(a: IModelTileContent, b: IModelTileContent): void {
      expect(a).not.to.be.undefined;
      expect(a.sizeMultiplier).to.equal(b.sizeMultiplier);
      expect(a.emptySubRangeMask).to.equal(b.emptySubRangeMask);
      expect(a.isLeaf).to.equal(b.isLeaf);
      if (undefined === a.contentRange)
        expect(b.contentRange).to.be.undefined;
      else
        expect(a.contentRange.isAlmostEqual(b.contentRange!)).to.be.true;

      expect(a.graphic).not.to.be.undefined;
      expect(b.graphic).not.to.be.undefined;
    }

    function graphicSize(graphic: RenderGraphic): number {
      const stats = new RenderMemory.Statistics();
      graphic.collectStatistics(stats);
      return stats.totalBytes;
    }

    it("caches metadata from RPC", async () => {
      const tile = await getTile();
      const channels = IModelApp.tileAdmin.channels.iModelChannels;
      expect(channels.getCachedContent(tile)).to.be.undefined;

      await loadContent(tile);
      expect(tile.loadStatus).to.equal(TileLoadStatus.NotLoaded);
      expect(tile.channel).to.equal(IModelApp.tileAdmin.channels.iModelChannels.cloudStorage);

      const channel = getChannel();
      await loadContent(tile);
      expect(tile.channel).to.equal(channels.rpc);
      expect(channels.getCachedContent(tile)).to.be.undefined;

      tile.channel.requestContent = async () => Promise.resolve(TILE_DATA_2_0.rectangle.bytes);
      await loadContent(tile);

      const content = channels.getCachedContent(tile)!;
      expect(content).not.to.be.undefined;
      const tileContent: IModelTileContent = {
        graphic: tile.produceGraphics(),
        emptySubRangeMask: tile.emptySubRangeMask,
        contentRange: tile.contentRange,
        sizeMultiplier: tile.sizeMultiplier,
        isLeaf: tile.isLeaf,
      };

      if (!content.contentRange)
        content.contentRange = tile.contentRange;

      expectEqualContent(content, tileContent);

      expect(graphicSize(content.graphic!)).to.equal(0);
      expect(graphicSize(tile.produceGraphics()!)).least(1);

      tile.disposeContents();
      tile.requestChannel = undefined;
      expect(tile.loadStatus).to.equal(TileLoadStatus.NotLoaded);
      expect(tile.channel).to.equal(channel);

      const newContent = await channel.requestContent(tile, () => false) as { content: IModelTileContent };
      expect(newContent).not.to.be.undefined;
      expect(newContent.content).not.to.be.undefined;
      expectEqualContent(newContent.content, content);
      expect(graphicSize(newContent.content.graphic!)).to.equal(0);
    });

    it("is not used again after cache miss", async () => {
      const tile = await getTile();

      await loadContent(tile);
      expect(tile.loadStatus).to.equal(TileLoadStatus.NotLoaded);
      expect(tile.channel).to.equal(IModelApp.tileAdmin.channels.iModelChannels.cloudStorage);

      await loadContent(tile);
      expect(tile.loadStatus).to.equal(TileLoadStatus.NotLoaded);
      expect(tile.channel).to.equal(IModelApp.tileAdmin.channels.iModelChannels.rpc);

      tile.channel.requestContent = async () => Promise.resolve(TILE_DATA_2_0.rectangle.bytes);
      await loadContent(tile);
      expect(tile.loadStatus).to.equal(TileLoadStatus.Ready);

      tile.disposeContents();
      expect(IModelApp.tileAdmin.channels.iModelChannels.cloudStorage).to.not.be.undefined;
      expect(tile.loadStatus).to.equal(TileLoadStatus.NotLoaded);
      expect(tile.requestChannel).to.equal(IModelApp.tileAdmin.channels.iModelChannels.rpc);
      expect(tile.channel).to.equal(IModelApp.tileAdmin.channels.iModelChannels.rpc);
    });

    it("marks tile as failed if no content is produced", async () => {
      const tile = await getTile();

      await loadContent(tile);
      expect(tile.loadStatus).to.equal(TileLoadStatus.NotLoaded);
      expect(tile.channel).to.equal(IModelApp.tileAdmin.channels.iModelChannels.cloudStorage);

      await loadContent(tile);
      expect(tile.loadStatus).to.equal(TileLoadStatus.NotLoaded);
      expect(tile.channel).to.equal(IModelApp.tileAdmin.channels.iModelChannels.rpc);

      tile.channel.requestContent = async () => Promise.resolve(undefined);
      await loadContent(tile);
      expect(tile.loadStatus).to.equal(TileLoadStatus.NotFound);
    });
  });
});

describe("RPC channels", () => {
  before(async () => {
    await TestUtility.startFrontend();
  });
  after(async () => {
    await TestUtility.shutdownFrontend();
  });

  it("use http or rpc concurrency based on type of app", async () => {
    const channels = IModelApp.tileAdmin.channels;
    if (IpcApp.isValid)
      expect(channels.rpcConcurrency).to.equal(await IpcApp.appFunctionIpc.queryConcurrency("cpu"));
    else
      expect(channels.rpcConcurrency).to.equal(channels.httpConcurrency);

    for (const channel of [channels.iModelChannels.rpc, channels.elementGraphicsRpc])
      expect(channel.concurrency).to.equal(IpcApp.isValid ? channels.rpcConcurrency : channels.httpConcurrency);
  });
});

describe("TileStorage", () => {
  const mockFrontendStorage: FrontendStorage = {
    async download(): Promise<ArrayBuffer> {
      return Promise.resolve(new ArrayBuffer(1));
    },
  } as unknown as FrontendStorage;

  function stubTileRpcInterface(
    getTileCacheConfigReturns: TransferConfig | undefined
  ): sinon.SinonStub<[], IModelTileRpcInterface> {
    return sinon.stub(IModelTileRpcInterface, "getClient").returns(
      {
        async getTileCacheConfig(): Promise<TransferConfig | undefined> {
          return Promise.resolve(getTileCacheConfigReturns);
        },
      } as unknown as IModelTileRpcInterface
    );
  }

  let tileStorage: TileStorage;
  let iModel: SnapshotConnection;
  let downloadTileParameters: Parameters<typeof tileStorage.downloadTile>;
  before(async () => {
    await TestUtility.startFrontend();
    iModel = await SnapshotConnection.openFile("test.bim");
    const rpcProps = iModel.getRpcProps();
    downloadTileParameters = [
      rpcProps,
      iModel.iModelId,
      rpcProps.changeset!.id,
      "treeId",
      "contentId",
      undefined,
    ];
  });
  after(async () => {
    await iModel.close();
    await TestUtility.shutdownFrontend();
  });
  beforeEach(() => {
    tileStorage = new TileStorage(mockFrontendStorage); // Clears cache
  });
  afterEach(() => {
    sinon.restore();
  });

  it("should return undefined if the backend does not support caching", async () => {
    stubTileRpcInterface(undefined);
    const result = await tileStorage.downloadTile(...downloadTileParameters);
    expect(result).to.be.undefined;
  });

  it("should not request tile content when the backend does not support caching", async () => {
    stubTileRpcInterface(undefined);
    const storageSpy = sinon.spy(tileStorage.storage).download;
    await tileStorage.downloadTile(...downloadTileParameters);
    expect(storageSpy).to.have.not.been.called;
  });

  it("should cache transfer configs", async () => {
    const transferConfig: TransferConfig = {
      baseUrl: "test",
      expiration: new Date(new Date().getTime() + (1000 * 60 * 60)), // 1 hour from now
    };
    const tileRpcInterfaceStub = stubTileRpcInterface(transferConfig);
    await tileStorage.downloadTile(...downloadTileParameters);
    expect(tileRpcInterfaceStub).to.have.been.calledOnce;
    await tileStorage.downloadTile(...downloadTileParameters);
    expect(tileRpcInterfaceStub).to.have.been.calledOnce; // Not called again
  });

  it("should refresh expired cached transfer config", async () => {
    const clock = sinon.useFakeTimers();
    after(() => clock.restore());
    const dateExpiration = new Date(new Date().getTime() + (1000 * 60 * 60)); // 1 hour from now
    const transferConfig: TransferConfig = {
      baseUrl: "test",
      expiration: dateExpiration,
    };
    const tileRpcInterfaceStub = stubTileRpcInterface(transferConfig);
    await tileStorage.downloadTile(...downloadTileParameters);
    expect(tileRpcInterfaceStub).to.have.been.calledOnce;

    clock.setSystemTime(new Date(dateExpiration.getTime() + 1000)); // Advance 1hour 1s
    await tileStorage.downloadTile(...downloadTileParameters);
    expect(tileRpcInterfaceStub).to.have.been.calledTwice;
  });
});

/* eslint-disable deprecation/deprecation */
describe("CloudStorageTileCache", () => {
  let imodel: IModelConnection;
  let cache: TestCloudStorageTileCache;
  let tileProps: TileContentIdentifier;

  class TestCloudStorageTileCache extends CloudStorageTileCache {
    public constructor() { super(); }

    public failOnContentRequest() {
      this.requestResource = async () => expect.fail("Not supposed to fetch cached tile!");
    }

    public failOnContainerUrlRequest() {
      this.obtainContainerUrl = async () => expect.fail("Not supposed to fetch container URL again!");
    }
  }

  before(async () => {
    await TestUtility.startFrontend();
    imodel = await SnapshotConnection.openFile("test.bim");
    tileProps = {
      tokenProps: imodel.getRpcProps(),
      treeId: "treeId",
      contentId: "contentId",
      guid: undefined,
    };
  });

  after(async () => {
    await imodel.close();
    await TestUtility.shutdownFrontend();
  });

  beforeEach(async () => {
    cache = new TestCloudStorageTileCache();
  });

  it("loads undefined content when backend does not support caching", async () => {
    const containerUrl = await IModelTileRpcInterface.getClient().getTileCacheContainerUrl(imodel.getRpcProps(), { name: imodel.iModelId! });
    expect(containerUrl).to.eql(CloudStorageContainerUrl.empty());

    const content = await cache.retrieve(tileProps);
    expect(content).to.be.undefined;
  });

  it("does not request tile content when backend does not support caching", async () => {
    const containerUrl = await IModelTileRpcInterface.getClient().getTileCacheContainerUrl(imodel.getRpcProps(), { name: imodel.iModelId! });
    expect(containerUrl).to.eql(CloudStorageContainerUrl.empty());

    cache.failOnContentRequest();
    const content = await cache.retrieve(tileProps);
    expect(content).to.be.undefined;
  });

  it("reuses empty storage container URL", async () => {
    const containerUrl = await IModelTileRpcInterface.getClient().getTileCacheContainerUrl(imodel.getRpcProps(), { name: imodel.iModelId! });
    expect(containerUrl).to.eql(CloudStorageContainerUrl.empty());

    let content = await cache.retrieve(tileProps);
    expect(content).to.be.undefined;

    cache.failOnContainerUrlRequest();
    content = await cache.retrieve(tileProps);
    expect(content).to.be.undefined;
  });
});
/* eslint-enable deprecation/deprecation */
