/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { NativeAppRpcInterface, RpcManager } from "@bentley/imodeljs-common";
import { EventSinkManager, IModelHost, NativeAppBackend } from "../../imodeljs-backend";

describe("EventSink", () => {
  before(async () => {
    await IModelHost.shutdown();
    RpcManager.initializeInterface(NativeAppRpcInterface);
    await NativeAppBackend.startup();
  });

  after(async () => {
    await NativeAppBackend.shutdown();
    await IModelHost.startup();
  });

  it("should be able to reuse sink name after deleting sink", () => {
    const name = "reused after delete";
    const sink1 = EventSinkManager.get(name);
    expect(EventSinkManager.has(name)).to.be.true;
    expect(EventSinkManager.get(name)).to.equal(sink1);

    EventSinkManager.delete(name);
    expect(EventSinkManager.has(name)).to.be.false;

    const sink2 = EventSinkManager.get(name);
    expect(sink2).not.to.equal(sink1);

    EventSinkManager.delete(name);
  });

  it("should reuse sink name after clearing sinks", () => {
    const name = "reused after clear";
    const sink1 = EventSinkManager.get(name);
    expect(EventSinkManager.has(name)).to.be.true;
    expect(EventSinkManager.get(name)).to.equal(sink1);

    EventSinkManager.clear();
    expect(EventSinkManager.has(name)).to.be.false;

    const sink2 = EventSinkManager.get(name);
    expect(sink2).not.to.equal(sink1);

    EventSinkManager.clear();
  });
});
