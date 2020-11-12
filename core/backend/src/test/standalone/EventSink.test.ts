/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { QueuedEvent, RpcPushChannel, RpcPushConnection } from "@bentley/imodeljs-common";
import { EmitStrategy } from "@bentley/imodeljs-native";
import { EventSink, IModelHost, SnapshotDb } from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";

describe("EventSink", () => {
  const rpcPushConnectionFor = RpcPushConnection.for;
  let imodel: SnapshotDb | undefined;

  function mockRpcPushConnection(channel: RpcPushChannel<any>, client: unknown): RpcPushConnection<any> {
    return {
      channel,
      client,
      send: async (_data: any) => Promise.resolve(),
    };
  }

  function fetchEvents(sink: EventSink): QueuedEvent[] {
    const queue = (sink as any)._queue;
    const events = [...queue];
    queue.length = 0;
    return events;
  }

  before(() => {
    RpcPushConnection.for = mockRpcPushConnection;
  });

  after(() => {
    RpcPushConnection.for = rpcPushConnectionFor;
  });

  afterEach(() => {
    if (imodel && imodel.isOpen)
      imodel.close();

    imodel = undefined;
  });

  it("should be able to reuse sink name after deleting sink", () => {
    const name = "reused after delete";
    const sink1 = new EventSink(name);

    expect((sink1 as any).isDisposed).to.be.false;
    sink1.dispose();
    expect((sink1 as any).isDisposed).to.be.true;

    const sink2 = new EventSink(name);
    expect(sink2).not.to.equal(sink1);
    expect((sink2 as any).isDisposed).to.be.false;
    sink2.dispose();
  });

  it("should use one global event sink", () => {
    expect(EventSink.global).to.equal(EventSink.global);
  });

  it("should dispose of global sink on shutdown", async () => {
    const sink = EventSink.global;
    expect(sink.isDisposed).to.be.false;
    await IModelHost.shutdown();
    expect(sink.isDisposed).to.be.true;
    await IModelHost.startup();
    expect(EventSink.global).not.to.equal(sink);
    expect(sink.isDisposed).to.be.true;
    expect(EventSink.global.isDisposed).to.be.false;
  });

  it("disposes of sink when IModelDb is closed", () => {
    imodel = SnapshotDb.openFile(IModelTestUtils.resolveAssetFile("test.bim"));
    expect(imodel.eventSink.isDisposed).to.be.false;
    imodel.close();
    expect(imodel.eventSink.isDisposed).to.be.true;
    imodel = undefined;
  });

  it("applies emit strategy", () => {
    const sink = new EventSink("emit-strategy");

    function emit(strategy: EmitStrategy): number[] {
      const opts = { strategy };
      sink.emit("ns1", "ev1", 1, opts);
      sink.emit("ns1", "ev1", 2, opts);
      sink.emit("ns2", "ev1", 3, opts);
      sink.emit("ns2", "ev2", 4, opts);
      sink.emit("ns1", "ev2", 5, opts);
      sink.emit("ns1", "ev1", 6, opts);
      sink.emit("ns3", "ev3", 7, opts);
      sink.emit("ns2", "ev2", 8, opts);

      return fetchEvents(sink).map((x) => x.data as number);
    }

    expect(emit(EmitStrategy.None)).to.deep.equal([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(emit(EmitStrategy.PurgeOlderEvents)).to.deep.equal([3, 5, 6, 7, 8]);

    sink.dispose();
  });

  it("requires unique name", () => {
    const makeEventSink = () => new EventSink("event-sink");
    const s1 = makeEventSink();
    expect(makeEventSink).to.throw(`Channel "dedicated-event-sink" already exists.`);
    s1.dispose();
    expect(makeEventSink).not.to.throw;
  });
});
