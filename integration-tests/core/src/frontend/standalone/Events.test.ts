import { IModelToken } from "@bentley/imodeljs-common";
import { GuidString, BeEvent, Guid } from "@bentley/bentleyjs-core";
import { EventSourceManager } from "@bentley/imodeljs-frontend/lib/EventSource";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { assert } from "chai";
import { EventsTestRpcInterface } from "../../common/RpcInterfaces";

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/**
 * Internal diagnostic utility for backends
 * @internal
 */
export class EventTest {
  public static connectToBackendInstance(iModelToken: IModelToken): EventTest {
    return new EventTest(iModelToken);
  }
  /**
   * Backend event handler.
   */
  public readonly onEcho = new BeEvent<(id: GuidString, message: string) => void>();

  /** Constructor */
  private constructor(
    private readonly _iModelToken: IModelToken) {
    // setup backend event handler.
    const eventSourceId = this._iModelToken.key!;
    EventSourceManager.get(eventSourceId, this._iModelToken)
      .on(EventsTestRpcInterface.name, "echo", (data: any) => {
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
      await EventsTestRpcInterface.getClient().echo(this._iModelToken.toJSON(), id, message);
      this.onEcho.removeListener(listener);
    });
  }
}
/** Test */
describe("Events", () => {
  let eventTool: EventTest;

  before(async () => {
    IModelApp.startup();
    const iModelToken: IModelToken = {
      iModelId: "test",
      changeSetId: "test",
      key: EventSourceManager.GLOBAL,
      toJSON() { return this; },
    }; // Supply a real token in an integration test
    eventTool = EventTest.connectToBackendInstance(iModelToken);
  });

  after(async () => {
    IModelApp.shutdown();
  });

  it("echo - roundtrip", async () => {
    let eventRecieved = 0;
    const eventSent = 100;
    eventTool.onEcho.addListener((_message: string) => {
      ++eventRecieved;
    });
    const ready = [];
    for (let i = 0; i < eventSent; i++) {
      ready.push(eventTool.echo(Guid.createValue(), "Hello, world!"));
    }
    await Promise.all(ready);
    assert.equal(eventSent, eventRecieved);
  });
});
