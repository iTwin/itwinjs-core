import { assert } from "chai";
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ProcessDetector } from "@itwin/core-bentley";
import { TestRpcInterface, WebRoutingInterface } from "../common/TestRpcInterface";
import { RpcProtocol, WebAppRpcProtocol, WebAppRpcRequest } from "@itwin/core-common";
import { currentEnvironment } from "./_Setup.test";

if (!ProcessDetector.isElectronAppFrontend) {
  describe("Web Routing", () => {
    if (currentEnvironment === "websocket") {
      return;
    }

    it("should always send and recieve protocolVersion without prefectch", async () => {
      const originalProtocolVersion = RpcProtocol.protocolVersion;
      (RpcProtocol as any).protocolVersion = 99999;
      assert.notEqual(RpcProtocol.protocolVersion, originalProtocolVersion); // sanity check

      try {
        const protocol = TestRpcInterface.getClient().configuration.protocol as WebAppRpcProtocol;
        const req: WebAppRpcRequest = new (protocol.requestType)(TestRpcInterface.getClient(), "getRequestedProtocolVersion", []);
        await req.submit();
        assert.equal(req.responseProtocolVersion, originalProtocolVersion); // backend should have unmodified RpcProtocol.protocolVersion
        assert.equal(await req.response, RpcProtocol.protocolVersion);
      } finally {
        (RpcProtocol as any).protocolVersion = originalProtocolVersion;
      }
    });

    it("should honor retry-after", async () => {
      if (currentEnvironment === "websocket") {
        return;
      }

      const client = WebRoutingInterface.getClient();
      const sent = Date.now();

      return Promise.all([
        client.ping502(sent),
        client.ping503(sent),
        client.ping504(sent),
      ]).then((results) => results.forEach((result) => assert.isTrue(result)));
    });
  });
}
