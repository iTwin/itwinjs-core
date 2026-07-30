/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it, vi } from "vitest";
import { IModelApp } from "../../IModelApp";
import { IModelTile } from "../../internal/tile/IModelTile";
import { MockRender } from "../../internal/render/MockRender";
import { TileAdmin } from "../../tile/TileAdmin";
import { TileRequest } from "../../tile/TileRequest";
import {
  Tile, TileContentDecodingStatistics, TileRequestChannel, TileRequestChannels, TileUser,
} from "../../tile/internal";

// Assumes no minification or uglification.
function expectClassName(obj: object, name: string): void {
  expect(obj.constructor.name).toEqual(name);
}

describe("TileRequestChannels", () => {
  it("uses customized channels for RPC if IPC is configured", () => {
    const isCustomChannel = (ch: any) => undefined !== ch._canceled;

    let channels = new TileRequestChannels(undefined, false);
    expect(channels.rpcConcurrency).toEqual(channels.httpConcurrency);
    expect(channels.elementGraphicsRpc.concurrency).toEqual(channels.httpConcurrency);
    expect(channels.iModelChannels.rpc.concurrency).toEqual(channels.httpConcurrency);
    expect(isCustomChannel(channels.elementGraphicsRpc)).toBe(false);
    expect(isCustomChannel(channels.iModelChannels.rpc)).toBe(false);
    expectClassName(channels.elementGraphicsRpc, "TileRequestChannel");
    expectClassName(channels.iModelChannels.rpc, "TileRequestChannel");

    channels = new TileRequestChannels(42, false);
    expect(channels.rpcConcurrency).toEqual(42);
    expect(channels.elementGraphicsRpc.concurrency).toEqual(channels.rpcConcurrency);
    expect(channels.iModelChannels.rpc.concurrency).toEqual(channels.rpcConcurrency);
    expect(isCustomChannel(channels.elementGraphicsRpc)).toBe(true);
    expect(isCustomChannel(channels.iModelChannels.rpc)).toBe(true);
    expectClassName(channels.elementGraphicsRpc, "ElementGraphicsChannel");
    expectClassName(channels.iModelChannels.rpc, "IModelTileChannel");
  });

  it("requires unique channel names", () => {
    const channels = new TileRequestChannels(undefined, false);
    channels.add(new TileRequestChannel("abc", 123));
    expect(() => channels.add(new TileRequestChannel("abc", 456))).toThrow();
    expect(channels.get("abc")!.concurrency).toEqual(123);

    channels.getForHttp("xyz");
    expect(() => channels.add(new TileRequestChannel("xyz", 999))).toThrow();
    expect(channels.getForHttp("xyz").concurrency).toEqual(channels.httpConcurrency);
  });

  it("allocates http channel on first request", () => {
    const channels = new TileRequestChannels(undefined, false);
    expect(channels.size).toEqual(3);
    const channel = channels.getForHttp("abc");
    expect(channels.size).toEqual(4);
    const channel2 = channels.getForHttp("abc");
    expect(channels.size).toEqual(4);
    expect(channel2).toEqual(channel);
    channels.getForHttp("xyz");
    expect(channels.size).toEqual(5);
  });

  it("configures external tile cache lookup independently of the transport", () => {
    for (const rpcConcurrency of [undefined, 42]) {
      const defaulted = new TileAdmin(false, rpcConcurrency);
      expect(defaulted.enableExternalTileCacheLookup).toBe(true);
      expect(defaulted.channels.iModelChannels.cloudStorage).toBeDefined();

      const enabled = new TileAdmin(false, rpcConcurrency, { enableExternalTileCacheLookup: true });
      expect(enabled.enableExternalTileCacheLookup).toBe(true);
      expect(enabled.channels.iModelChannels.cloudStorage).toBeDefined();
      expectClassName(enabled.channels.iModelChannels.cloudStorage!, "CloudStorageCacheChannel");

      const disabled = new TileAdmin(false, rpcConcurrency, { enableExternalTileCacheLookup: false });
      expect(disabled.enableExternalTileCacheLookup).toBe(false);
      expect(disabled.channels.iModelChannels.cloudStorage).toBeUndefined();
    }
  });

  it("checks the external tile cache for every newly requested iModel tile", async () => {
    await MockRender.App.startup({ tileAdmin: { enableExternalTileCacheLookup: true } });
    const requestCachedTileContent = vi.spyOn(IModelApp.tileAdmin, "requestCachedTileContent").mockResolvedValue(undefined);

    try {
      const tiles = Array.from({ length: 7 }, () => Object.create(IModelTile.prototype) as IModelTile);
      for (const tile of tiles) {
        const channel = tile.channel;
        await channel.requestContent(tile, () => false);
        expect(channel.onNoContent({ tile } as unknown as TileRequest)).toBe(true);
        expect(tile.requestChannel).toBe(IModelApp.tileAdmin.channels.iModelChannels.rpc);
      }

      expect(requestCachedTileContent).toHaveBeenCalledTimes(tiles.length);
      expect(requestCachedTileContent.mock.calls.map(([tile]) => tile)).toEqual(tiles);
      expect(IModelApp.tileAdmin.channels.iModelChannels.cloudStorage!.statistics.totalCacheMisses).toBe(tiles.length);
    } finally {
      requestCachedTileContent.mockRestore();
      await MockRender.App.shutdown();
    }
  });

  it("retries a cache miss through the RPC channel", async () => {
    await MockRender.App.startup({ tileAdmin: { enableExternalTileCacheLookup: true } });

    const requestCachedTileContent = vi.spyOn(IModelApp.tileAdmin, "requestCachedTileContent").mockResolvedValue(undefined);
    const tile = Object.create(IModelTile.prototype) as IModelTile;
    const iModel = { tiles: { isDisposed: false } };
    Object.assign(tile, {
      tree: { iModel },
      _contentId: "tile",
      _maximumSize: 1,
      _isLeaf: true,
      requestContent: vi.fn().mockResolvedValue(new Uint8Array([1])),
      readContent: vi.fn().mockResolvedValue({ isLeaf: true }),
      setContent: vi.fn(),
      computeLoadPriority: () => 0,
    });
    const user = {
      tileUserId: 1,
      iModel,
      discloseTileTrees: () => { },
    } as unknown as TileUser;

    IModelApp.tileAdmin.registerUser(user);
    try {
      const cacheRequest = new TileRequest(tile, user);
      tile.request = cacheRequest;
      cacheRequest.channel.append(cacheRequest);
      cacheRequest.channel.process();
      await vi.waitFor(() => expect(IModelApp.tileAdmin.channels.iModelChannels.cloudStorage!.statistics.totalCacheMisses).toBe(1));

      expect(cacheRequest.channel).toBe(IModelApp.tileAdmin.channels.iModelChannels.cloudStorage);
      expect(tile.requestChannel).toBe(IModelApp.tileAdmin.channels.iModelChannels.rpc);
      expect(IModelApp.tileAdmin.channels.iModelChannels.cloudStorage!.statistics.totalDispatchedRequests).toBe(1);
      expect(IModelApp.tileAdmin.channels.iModelChannels.cloudStorage!.statistics.totalCacheMisses).toBe(1);

      const rpcRequest = new TileRequest(tile, user);
      tile.request = rpcRequest;
      rpcRequest.channel.append(rpcRequest);
      rpcRequest.channel.process();
      await vi.waitFor(() => expect(tile.request).toBeUndefined());

      expect(rpcRequest.channel).toBe(IModelApp.tileAdmin.channels.iModelChannels.rpc);
      expect(IModelApp.tileAdmin.channels.iModelChannels.rpc.statistics.totalDispatchedRequests).toBe(1);
      expect(IModelApp.tileAdmin.statistics.totalDispatchedRequests).toBe(2);
      expect(IModelApp.tileAdmin.statistics.totalCompletedRequests).toBe(1);
      expect(requestCachedTileContent).toHaveBeenCalledTimes(1);
    } finally {
      IModelApp.tileAdmin.forgetUser(user);
      requestCachedTileContent.mockRestore();
      await MockRender.App.shutdown();
    }
  });

  it("returns whether channel is registered", () => {
    const channel = new TileRequestChannel("abc", 123);
    const channels = new TileRequestChannels(undefined, false);
    expect(channels.has(channel)).toBe(false);
    channels.add(channel);
    expect(channels.has(channel)).toBe(true);
    expect(channels.has(new TileRequestChannel("abc", 123))).toBe(false);
  });

  it("extracts hostname from url", () => {
    expect(TileRequestChannels.getNameFromUrl("https://www.google.com/stuff")).toEqual("www.google.com");
    expect(() => TileRequestChannels.getNameFromUrl("not a url")).toThrow(TypeError);
  });

  it("changes RPC concurrency", () => {
    const channels = new TileRequestChannels(undefined, false);
    expect(channels.rpcConcurrency).toEqual(channels.httpConcurrency);
    expect(channels.elementGraphicsRpc.concurrency).toEqual(channels.rpcConcurrency);
    expect(channels.iModelChannels.rpc.concurrency).toEqual(channels.rpcConcurrency);

    const concurrency = channels.rpcConcurrency + 1;
    channels.setRpcConcurrency(concurrency);
    expect(channels.rpcConcurrency).toEqual(concurrency);
    expect(channels.elementGraphicsRpc.concurrency).toEqual(concurrency);
    expect(channels.iModelChannels.rpc.concurrency).toEqual(concurrency);
  });

  it("records decoding time statistics from multiple channels", () => {
    const c1 = new TileRequestChannel("1", 1);
    const c2 = new TileRequestChannel("2", 2);
    const c3 = new TileRequestChannel("3", 3);

    const channels = new TileRequestChannels(undefined, false);
    channels.add(c1);
    channels.add(c2);
    channels.add(c3);

    const tile = { isEmpty: false, isUndisplayable: false } as unknown as Tile;
    const content = { };

    const expectStats = (expected: TileContentDecodingStatistics) => {
      const actual = channels.statistics.decoding;
      expect(actual.total).toEqual(expected.total);
      expect(actual.mean).toEqual(expected.mean);
      expect(actual.min).toEqual(expected.min);
      expect(actual.max).toEqual(expected.max);
    };

    expectStats({ total: 0, mean: 0, min: Number.MAX_SAFE_INTEGER, max: Number.MIN_SAFE_INTEGER });
    c1.recordCompletion(tile, content, 20);
    expectStats({ total: 20, mean: 20, min: 20, max: 20 });
    c2.recordCompletion(tile, content, 10);
    expectStats({ total: 30, mean: 15, min: 10, max: 20 });
    c3.recordCompletion(tile, content, 30);
    expectStats({ total: 60, mean: 20, min: 10, max: 30 });
  });
});
