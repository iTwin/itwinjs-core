import { assert } from "chai";
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ProcessDetector } from "@itwin/core-bentley";
import { TestRpcInterface, WebRoutingInterface } from "../common/TestRpcInterface";
import { BentleyCloudRpcProtocol, RpcProtocol, RpcProtocolVersion, WebAppRpcProtocol, WebAppRpcRequest } from "@itwin/core-common";
import { currentEnvironment } from "./_Setup.test";

if (!ProcessDetector.isElectronAppFrontend) {
  describe("Web Routing", () => {

    it("should always send and recieve protocolVersion without prefectch", async () => {
      if (currentEnvironment === "websocket") {
        return;
      }

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

    it("should return 400 response for requests with invalid URL parameters", async () => {
      if (currentEnvironment === "websocket")
        return;

      const protocol = TestRpcInterface.getClient().configuration.protocol as BentleyCloudRpcProtocol;

      const testParamsWithSuffix = async (suffix: string) => {
        const realParams = btoa(JSON.stringify([1, 10]));
        assert.equal(realParams.indexOf("="), -1);  // we don't want any padding in the real base64 value

        const response = await fetch(`${protocol.pathPrefix}/${protocol.info.title}/${protocol.info.version}/mode/1/context/undefined/imodel/undefined/changeset/0/${TestRpcInterface.interfaceName}-${TestRpcInterface.interfaceVersion}-op1?parameters=${encodeURIComponent(realParams)}${suffix}`, {
          method: "GET",
          headers: {
            "accept": "*/*",
            "content-type": "text/plain",
            [protocol.protocolVersionHeaderName]: String(RpcProtocolVersion.IntroducedStatusCategory),
            [protocol.serializedClientRequestContextHeaderNames.id]: "foo",
          },
        });
        assert.equal(response.status, 400);
        const result = (await (response.json()));
        assert.isTrue(result.isError);
        assert.equal(result.message, "Error: Invalid request: Malformed URL parameters detected.");
      };
      await testParamsWithSuffix("%3D%27%27");
      await testParamsWithSuffix("%27%27BAD");
      await testParamsWithSuffix("%27%27%2BAD");
    });

    it("should return 400 response for requests with missing id", async () => {
      if (currentEnvironment === "websocket")
        return;

      const protocol = TestRpcInterface.getClient().configuration.protocol as BentleyCloudRpcProtocol;
      const realParams = btoa(JSON.stringify([1, 10]));
      const response = await fetch(`${protocol.pathPrefix}/${protocol.info.title}/${protocol.info.version}/mode/1/context/undefined/imodel/undefined/changeset/0/${TestRpcInterface.interfaceName}-${TestRpcInterface.interfaceVersion}-op1?parameters=${encodeURIComponent(realParams)}`, {
        method: "GET",
        headers: {
          "accept": "*/*",
          "content-type": "text/plain",
          [protocol.protocolVersionHeaderName]: String(RpcProtocolVersion.IntroducedStatusCategory),
        },
      });
      assert.equal(response.status, 400);
      const result = (await (response.json()));
      assert.isTrue(result.isError);
      assert.equal(result.message, "Error: Invalid request: Missing required activity ID.");
    });
  });
}
