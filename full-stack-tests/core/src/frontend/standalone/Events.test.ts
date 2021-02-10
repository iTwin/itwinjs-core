/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { BeEvent, Guid, GuidString } from "@bentley/bentleyjs-core";
import { RpcPushChannel } from "@bentley/imodeljs-common";
import { EventListener, EventSource, IModelApp, SnapshotConnection } from "@bentley/imodeljs-frontend";
import { EventsTestRpcInterface } from "../../common/RpcInterfaces";

/**
 * Internal diagnostic utility for backends
 * @internal
 */
export class EventTest {
  public static connectToBackendInstance(): EventTest {
    return new EventTest();
  }
  /**
   * Backend event handler.
   */
  public readonly onEcho = new BeEvent<(id: GuidString, message: string) => void>();

  public readonly cleanup: () => void;

  /** Constructor */
  private constructor() {
    // setup backend event handler.
    this.cleanup = EventSource.global.on(EventsTestRpcInterface.name, "echo", (data: any) => {
      this.onEcho.raiseEvent(data.id, data.message);
    });
  }

  /** Sets up a log level at the backend and returns the old log level */
  public async echo(id: GuidString, message: string): Promise<string> {
    return new Promise<string>(async (resolve) => {
      const listener = this.onEcho.addListener((echoId: GuidString, msg: string) => {
        if (id === echoId) {
          if (msg !== message)
            throw new Error("Message does not match");

          resolve(message);
        }
      });

      await EventsTestRpcInterface.getClient().echo(id, message);
      this.onEcho.removeListener(listener);
    });
  }
}

/** Test */
describe("Events", () => {
  if (RpcPushChannel.enabled) {
    let eventTool: EventTest;

    before(async () => {
      await IModelApp.startup();
      eventTool = EventTest.connectToBackendInstance();
    });

    after(async () => {
      eventTool.cleanup();
      await IModelApp.shutdown();
    });

    it("echo - roundtrip", async () => {
      let eventReceived = 0;
      const eventSent = 100;
      eventTool.onEcho.addListener((_message: string) => {
        ++eventReceived;
      });

      const ready = [];
      for (let i = 0; i < eventSent; i++)
        ready.push(eventTool.echo(Guid.createValue(), "Hello, world!"));

      await Promise.all(ready);
      assert.equal(eventSent, eventReceived);
    });
  }
});

function getListeners(src: EventSource, namespace: string, eventName: string): EventListener[] {
  const listeners = (src as any).getListeners(namespace, eventName, false) as EventListener[] | undefined;
  return listeners ?? [];
}

function getNamespaces(src: EventSource): string[] {
  const ns = (src as any)._namespaces as Map<string, Map<string, EventListener[]>>;
  return Array.from(ns.keys());
}

function getEvents(src: EventSource, namespace: string): string[] {
  const namespaces = (src as any)._namespaces as Map<string, Map<string, EventListener[]>>;
  const ns = namespaces.get(namespace);
  return undefined !== ns ? Array.from(ns.keys()) : [];
}

describe("EventSource", () => {
  if (RpcPushChannel.enabled) {
    let imodel: SnapshotConnection | undefined;

    before(async () => {
      await IModelApp.startup();
    });

    after(async () => {
      await IModelApp.shutdown();
    });

    afterEach(async () => {
      if (imodel && imodel.isOpen)
        await imodel.close();

      imodel = undefined;
    });

    it("disposes EventSource when iModel is closed", async () => {
      imodel = await SnapshotConnection.openFile("test.bim");
      expect(imodel.eventSource.isDisposed).to.be.false;
      await imodel.close();
      expect(imodel.eventSource.isDisposed).to.be.true;

      // Can reuse same id for EventSource when reopening same file.
      imodel = await SnapshotConnection.openFile("test.bim");
      expect(imodel.eventSource.isDisposed).to.be.false;
      await imodel.close();
      expect(imodel.eventSource.isDisposed).to.be.true;
      imodel = undefined;
    });

    it("can share RpcPushChannel", async () => {
      const s1 = EventSource.create("events");
      const s2 = EventSource.create("events");
      expect(s1).not.to.equal(s2);

      const channel = (s1 as any)._channel;
      const ch2 = (s2 as any)._channel;
      expect(channel).to.equal(ch2);
      expect(channel._refCount).to.equal(2);
      expect(channel.isDisposed).to.be.false;

      expect(s1.isDisposed).to.be.false;
      expect(s2.isDisposed).to.be.false;

      s1.dispose();
      expect(s1.isDisposed).to.be.true;
      expect(s2.isDisposed).to.be.false;
      expect(channel.isDisposed).to.be.false;
      expect(channel._refCount).to.equal(1);

      s2.dispose();
      expect(s2.isDisposed).to.be.true;
      expect(channel.isDisposed).to.be.true;
      expect(channel._refCount).to.equal(0);
    });

    it("disposes of global EventSource on shutdown", async () => {
      const src = EventSource.global;
      expect(src.isDisposed).to.be.false;

      await IModelApp.shutdown();
      expect(src.isDisposed).to.be.true;

      await IModelApp.startup();
      expect(EventSource.global.isDisposed).to.be.false;
      expect(EventSource.global).not.to.equal(src);
    });

    it("removes listeners upon disposal", () => {
      let _dummy = 0;
      const listener = (input: number) => { _dummy += input; };
      const src = EventSource.create("remove-on-disposal");
      const getDummyListeners = () => getListeners(src, "dummy", "event");

      expect(getDummyListeners.length).to.equal(0);
      src.on("dummy", "event", listener);
      expect(getDummyListeners().length).to.equal(1);
      expect(getDummyListeners()[0]).to.equal(listener);

      src.dispose();
      expect(getDummyListeners().length).to.equal(0);
    });

    it("adds and removes listeners for individual events", () => {
      let _dummy = 0;
      const l1 = (input: number) => { _dummy += input; };
      const l2 = (input: number) => { _dummy -= input; };
      const src = EventSource.create("listeners");
      const getA = () => getListeners(src, "dummy", "a");
      const getB = () => getListeners(src, "dummy", "b");

      const r1 = src.on("dummy", "a", l1);
      const r2 = src.on("dummy", "b", l2);
      expect(getA()).to.deep.equal([l1]);
      expect(getB()).to.deep.equal([l2]);

      const r3 = src.on("dummy", "b", l1);
      const r4 = src.on("dummy", "a", l2);

      expect(getNamespaces(src).length).to.equal(1);
      expect(getEvents(src, "dummy").length).to.equal(2);

      expect(getA()).to.deep.equal([l1, l2]);
      expect(getB()).to.deep.equal([l2, l1]);

      const r5 = src.on("dummy", "a", l1);
      expect(getA()).to.deep.equal([l1, l2, l1]);
      expect(getB()).to.deep.equal([l2, l1]);

      r1();
      r2();
      expect(getA()).to.deep.equal([l2, l1]);
      expect(getB()).to.deep.equal([l1]);

      r5();
      expect(getA()).to.deep.equal([l2]);
      expect(getB()).to.deep.equal([l1]);

      r4();
      expect(getA().length).to.equal(0);
      expect(getEvents(src, "dummy").length).to.equal(1);

      r3();
      expect(getB().length).to.equal(0);
      expect(getNamespaces(src).length).to.equal(0);
    });
  }

  it("produces an inert channel for an empty name", () => {
    const empty = EventSource.create("");
    expect(empty.isDisposed).to.be.true;
  });

  it("produces an inert channel if push events are not enabled", () => {
    const src = EventSource.create("evt-src");
    expect(src.isDisposed).to.equal(!RpcPushChannel.enabled);
    src.dispose();
    expect(src.isDisposed).to.be.true;
  });

  it("does not accept listeners after disposal", () => {
    const src = EventSource.create("listener-after-disposal");
    src.dispose();
    src.on("dummy", "event", (_data: string) => undefined);
    expect(getListeners(src, "dummy", "event").length).to.equal(0);
  });
});
