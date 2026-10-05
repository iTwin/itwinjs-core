/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { executeBackendCallback } from "@itwin/certa/lib/utils/CallbackUtils";
import { ProcessDetector } from "@itwin/core-bentley";
import { assert } from "chai";
import { MobileRpcProtocol } from "@itwin/core-mobile/lib/cjs/MobileFrontend";
import { BackendTestCallbacks } from "../common/SideChannels";
import { MobileTestInterface } from "../common/TestRpcInterface";
import { currentEnvironment } from "./_Setup.test";

if (!ProcessDetector.isElectronAppFrontend) {
  describe("Mobile", () => {
    it("reject unauthenticated WebSocket upgrades", async () => {
      if (currentEnvironment !== "http")
        return;

      const args = new URLSearchParams(window.location.hash.substring(1));
      const port = args.get("port");
      const rpcToken = args.get("rpcToken");
      for (const protocols of [undefined, "itwin-rpc.invalid", `itwin-rpc.${"0".repeat(64)}`, ["other", `itwin-rpc.${rpcToken}`]]) {
        const socket = new WebSocket(`ws://127.0.0.1:${port}`, protocols);
        const connected = await new Promise<boolean>((resolve) => {
          socket.addEventListener("open", () => { socket.close(); resolve(true); });
          socket.addEventListener("close", () => resolve(false));
        });
        assert.isFalse(connected);
      }
    });

    it("handle multipart", async () => {
      if (currentEnvironment === "websocket") {
        return;
      }

      const sum = await MobileTestInterface.getClient().multipart(1, new Uint8Array([2, 3, 4]));
      assert.equal(sum, 10);
    });

    it("authenticate after returning to the foreground", async () => {
      if (currentEnvironment !== "http")
        return;

      const { port, rpcToken } = JSON.parse(await executeBackendCallback(BackendTestCallbacks.restartMockMobileTest));
      (window as any)._imodeljs_rpc_reconnect(port, rpcToken);
      const protocol = MobileTestInterface.getClient().configuration.protocol as MobileRpcProtocol;
      await new Promise<void>((resolve, reject) => {
        protocol.socket.addEventListener("open", () => resolve(), { once: true });
        protocol.socket.addEventListener("error", () => reject(new Error("Authenticated reconnect failed.")), { once: true });
      });
      const sum = await MobileTestInterface.getClient().multipart(1, new Uint8Array([2, 3, 4]));
      assert.equal(sum, 10);
    });
  });
}
