/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { TileRequestChannel, TileRequestChannels } from "../../tile/internal";

// Assumes no minification or uglification.
function expectClassName(obj: Object, name: string): void {
  expect(obj.constructor.name).to.equal(name);
}

function findChannelByName(channels: TileRequestChannels, name: string): TileRequestChannel | undefined {
  for (const channel of channels)
    if (channel.name === name)
      return channel;

  return undefined;
}

function getIModelRpc(channels: TileRequestChannels): TileRequestChannel {
  const channel = findChannelByName(channels, "itwinjs-tile-rpc");
  expect(channel).not.to.be.undefined;
  return channel!;
}

function getCloudStorage(channels: TileRequestChannels) {
  return findChannelByName(channels, "itwinjs-cloud-cache");
}

describe("TileRequestChannels", () => {
  it("uses customized channels for RPC if IPC is configured", () => {
    const isCustomChannel = (ch: any) => undefined !== ch._canceled;

    let channels = new TileRequestChannels(undefined);
    const iModelRpc = getIModelRpc(channels);
    expect(channels.rpcConcurrency).to.equal(channels.httpConcurrency);
    expect(channels.elementGraphicsRpc.concurrency).to.equal(channels.httpConcurrency);
    expect(iModelRpc.concurrency).to.equal(channels.httpConcurrency);
    expect(isCustomChannel(channels.elementGraphicsRpc)).to.be.false;
    expect(isCustomChannel(iModelRpc)).to.be.false;
    expectClassName(channels.elementGraphicsRpc, "TileRequestChannel");
    expectClassName(iModelRpc, "TileRequestChannel");

    channels = new TileRequestChannels(42);
    expect(channels.rpcConcurrency).to.equal(42);
    expect(channels.elementGraphicsRpc.concurrency).to.equal(channels.rpcConcurrency);
    expect(iModelRpc.concurrency).to.equal(channels.rpcConcurrency);
    expect(isCustomChannel(channels.elementGraphicsRpc)).to.be.true;
    expect(isCustomChannel(iModelRpc)).to.be.true;
    expectClassName(channels.elementGraphicsRpc, "ElementGraphicsChannel");
    expectClassName(iModelRpc, "IModelTileChannel");
  });

  it("requires unique channel names", () => {
    const channels = new TileRequestChannels(undefined);
    channels.add(new TileRequestChannel("abc", 123));
    expect(() => channels.add(new TileRequestChannel("abc", 456))).to.throw(Error);
    expect(channels.get("abc")!.concurrency).to.equal(123);

    channels.getForHttp("xyz");
    expect(() => channels.add(new TileRequestChannel("xyz", 999))).to.throw(Error);
    expect(channels.getForHttp("xyz").concurrency).to.equal(channels.httpConcurrency);
  });

  it("allocates http channel on first request", () => {
    const channels = new TileRequestChannels(undefined);
    expect(channels.size).to.equal(2);
    const channel = channels.getForHttp("abc");
    expect(channels.size).to.equal(3);
    const channel2 = channels.getForHttp("abc");
    expect(channels.size).to.equal(3);
    expect(channel2).to.equal(channel);
    channels.getForHttp("xyz");
    expect(channels.size).to.equal(4);
  });

  it("enables cloud storage cache", () => {
    const channels = new TileRequestChannels(undefined);
    expect(getCloudStorage(channels)).to.be.undefined;

    channels.enableCloudStorageCache();
    const cloud = getCloudStorage(channels);
    expect(cloud).not.to.be.undefined;
    expect(cloud!.concurrency).to.equal(channels.httpConcurrency);
    expectClassName(cloud!, "CloudStorageCacheChannel");
  });

  it("returns whether channel is registered", () => {
    const channel = new TileRequestChannel("abc", 123);
    const channels = new TileRequestChannels(undefined);
    expect(channels.has(channel)).to.be.false;
    channels.add(channel);
    expect(channels.has(channel)).to.be.true;
    expect(channels.has(new TileRequestChannel("abc", 123))).to.be.false;
  });

  it("extracts hostname from url", () => {
    expect(TileRequestChannels.getNameFromUrl("https://www.google.com/stuff")).to.equal("www.google.com");
    expect(() => TileRequestChannels.getNameFromUrl("not a url")).to.throw(TypeError);
  });

  it("changes RPC concurrency", () => {
    const channels = new TileRequestChannels(undefined);
    const iModelRpc = getIModelRpc(channels);
    expect(channels.rpcConcurrency).to.equal(channels.httpConcurrency);
    expect(channels.elementGraphicsRpc.concurrency).to.equal(channels.rpcConcurrency);
    expect(iModelRpc.concurrency).to.equal(channels.rpcConcurrency);

    const concurrency = channels.rpcConcurrency + 1;
    channels.setRpcConcurrency(concurrency);
    expect(channels.rpcConcurrency).to.equal(concurrency);
    expect(channels.elementGraphicsRpc.concurrency).to.equal(concurrency);
    expect(iModelRpc.concurrency).to.equal(concurrency);
  });
});
