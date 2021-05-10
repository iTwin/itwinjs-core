/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ProcessDetector } from "@bentley/bentleyjs-core";
import { IpcWebSocketFrontend } from "@bentley/imodeljs-common";
import { executeBackendCallback } from "@bentley/certa/lib/utils/CallbackUtils";
import { assert } from "chai";
import { BackendTestCallbacks } from "../common/SideChannels";
import { IModelApp, NativeApp } from "@bentley/imodeljs-frontend";
import { AccessToken } from "@bentley/itwin-client";

if (!ProcessDetector.isElectronAppFrontend) {
  describe("IpcWebSocket", () => {
    let socket: IpcWebSocketFrontend;

    before(async () => {
      assert(await executeBackendCallback(BackendTestCallbacks.startIpcTest));
      socket = new IpcWebSocketFrontend();
    });

    it("should support send/receive", async () => {
      return new Promise(async (resolve) => {
        socket.addListener("test", (_evt: Event, ...arg: any[]) => {
          assert.equal(arg[0], 4);
          assert.equal(arg[1], 5);
          assert.equal(arg[2], 6);
          resolve();
        });

        socket.send("test", 1, 2, 3);

        assert(await executeBackendCallback(BackendTestCallbacks.sendIpcMessage));
      });
    });

    it("should support invoke", async () => {
      return new Promise(async (resolve) => {
        const invoked = await socket.invoke("testinvoke", "hi", 1, 2, 3);
        assert.equal(invoked[0], "hi");
        assert.equal(invoked[1], 1);
        assert.equal(invoked[2], 2);
        assert.equal(invoked[3], 3);
        resolve();
      });
    });

    it("should not recurse in auth call", async () => {
      await NativeApp.startup(socket);
      IModelApp.authorizationClient!.onUserStateChanged.raiseEvent(new AccessToken(undefined, undefined, new Date(0)));
      await NativeApp.callNativeHost("getAccessTokenProps");
      IModelApp.authorizationClient = undefined;
    });
  });
}
