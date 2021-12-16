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

describe("TileRequestChannels", () => {
  it("uses customized channels for RPC if IPC is configured", () => {
    const isCustomChannel = (ch: any) => undefined !== ch._canceled;

    let channels = new TileRequestChannels(undefined, false);
    expect(channels.rpcConcurrency).to.equal(channels.httpConcurrency);
    expect(channels.elementGraphicsRpc.concurrency).to.equal(channels.httpConcurrency);
    expect(channels.iModelChannels.rpc.concurrency).to.equal(channels.httpConcurrency);
    expect(isCustomChannel(channels.elementGraphicsRpc)).to.be.false;
    expect(isCustomChannel(channels.iModelChannels.rpc)).to.be.false;
    expectClassName(channels.elementGraphicsRpc, "TileRequestChannel");
    expectClassName(channels.iModelChannels.rpc, "TileRequestChannel");

    channels = new TileRequestChannels(42, false);
    expect(channels.rpcConcurrency).to.equal(42);
    expect(channels.elementGraphicsRpc.concurrency).to.equal(channels.rpcConcurrency);
    expect(channels.iModelChannels.rpc.concurrency).to.equal(channels.rpcConcurrency);
    expect(isCustomChannel(channels.elementGraphicsRpc)).to.be.true;
    expect(isCustomChannel(channels.iModelChannels.rpc)).to.be.true;
    expectClassName(channels.elementGraphicsRpc, "ElementGraphicsChannel");
    expectClassName(channels.iModelChannels.rpc, "IModelTileChannel");
  });

  it("requires unique channel names", () => {
    const channels = new TileRequestChannels(undefined, false);
    channels.add(new TileRequestChannel("abc", 123));
    expect(() => channels.add(new TileRequestChannel("abc", 456))).to.throw(Error);
    expect(channels.get("abc")!.concurrency).to.equal(123);

    channels.getForHttp("xyz");
    expect(() => channels.add(new TileRequestChannel("xyz", 999))).to.throw(Error);
    expect(channels.getForHttp("xyz").concurrency).to.equal(channels.httpConcurrency);
  });

  it("allocates http channel on first request", () => {
    const channels = new TileRequestChannels(undefined, false);
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
    const channels = new TileRequestChannels(undefined, false);
    expect(channels.iModelChannels.cloudStorage).to.be.undefined;
    channels.enableCloudStorageCache();
    expect(channels.iModelChannels.cloudStorage).not.to.be.undefined;
    expect(channels.iModelChannels.cloudStorage!.concurrency).to.equal(channels.httpConcurrency);
    expectClassName(channels.iModelChannels.cloudStorage!, "CloudStorageCacheChannel");
  });

  it("returns whether channel is registered", () => {
    const channel = new TileRequestChannel("abc", 123);
    const channels = new TileRequestChannels(undefined, false);
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
    const channels = new TileRequestChannels(undefined, false);
    expect(channels.rpcConcurrency).to.equal(channels.httpConcurrency);
    expect(channels.elementGraphicsRpc.concurrency).to.equal(channels.rpcConcurrency);
    expect(channels.iModelChannels.rpc.concurrency).to.equal(channels.rpcConcurrency);

    const concurrency = channels.rpcConcurrency + 1;
    channels.setRpcConcurrency(concurrency);
    expect(channels.rpcConcurrency).to.equal(concurrency);
    expect(channels.elementGraphicsRpc.concurrency).to.equal(concurrency);
    expect(channels.iModelChannels.rpc.concurrency).to.equal(concurrency);
  });
});
