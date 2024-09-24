/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { Tile, TileContentDecodingStatistics, TileRequestChannel, TileRequestChannels } from "../../tile/internal";

// Assumes no minification or uglification.
function expectClassName(obj: Object, name: string): void {
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
    expect(() => channels.add(new TileRequestChannel("abc", 456))).toThrowError();
    expect(channels.get("abc")!.concurrency).toEqual(123);

    channels.getForHttp("xyz");
    expect(() => channels.add(new TileRequestChannel("xyz", 999))).toThrowError();
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

  it("always enables cloud storage cache", () => {
    const channels = new TileRequestChannels(undefined, false);
    expect(channels.iModelChannels.cloudStorage).toBeDefined();
    expect(channels.iModelChannels.cloudStorage.concurrency).toEqual(channels.httpConcurrency);
    expectClassName(channels.iModelChannels.cloudStorage, "CloudStorageCacheChannel");
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
    expect(() => TileRequestChannels.getNameFromUrl("not a url")).toThrowError(TypeError);
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
    const content = {};

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
