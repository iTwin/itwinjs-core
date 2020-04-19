/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BeEvent, Guid, GuidString } from "@bentley/bentleyjs-core";
import { IModelRpcProps } from "@bentley/imodeljs-common";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { EventSourceManager } from "@bentley/imodeljs-frontend/lib/EventSource";
import { assert } from "chai";
import { EventsTestRpcInterface } from "../../common/RpcInterfaces";

/**
 * Internal diagnostic utility for backends
 * @internal
 */
export class EventTest {
  public static connectToBackendInstance(tokenProps: IModelRpcProps): EventTest {
    return new EventTest(tokenProps);
  }
  /**
   * Backend event handler.
   */
  public readonly onEcho = new BeEvent<(id: GuidString, message: string) => void>();

  /** Constructor */
  private constructor(
    private readonly _tokenProps: IModelRpcProps) {
    // setup backend event handler.
    const eventSourceId = this._tokenProps.key!;
    EventSourceManager.get(eventSourceId, this._tokenProps)
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
      await EventsTestRpcInterface.getClient().echo(this._tokenProps, id, message);
      this.onEcho.removeListener(listener);
    });
  }
}
/** Test */
describe("Events", () => {
  let eventTool: EventTest;

  before(async () => {
    IModelApp.startup();
    const iModelRpcProps: IModelRpcProps = {
      key: EventSourceManager.GLOBAL,
      iModelId: "test",
      changeSetId: "test",
    }; // Supply a real token in an integration test
    eventTool = EventTest.connectToBackendInstance(iModelRpcProps);
  });

  after(async () => {
    IModelApp.shutdown();
  });

  it("echo - roundtrip", async () => {
    let eventReceived = 0;
    const eventSent = 100;
    eventTool.onEcho.addListener((_message: string) => {
      ++eventReceived;
    });
    const ready = [];
    for (let i = 0; i < eventSent; i++) {
      ready.push(eventTool.echo(Guid.createValue(), "Hello, world!"));
    }
    await Promise.all(ready);
    assert.equal(eventSent, eventReceived);
  });
});
