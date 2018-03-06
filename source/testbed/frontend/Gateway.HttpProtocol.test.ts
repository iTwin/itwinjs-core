/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Gateway, GatewayHttpProtocol } from "@bentley/imodeljs-common";
import { TestGateway, TestOp1Params } from "../common/TestGateway";
import { assert } from "chai";
import { TestbedConfig } from "../common/TestbedConfig";

if (TestbedConfig.gatewayConfig) {
  describe("Gateway.HttpProtocol", () => {
    it("should send pending request updates.", async () => {
      const expectedPendings = 2;
      let pendingsReceived = 0;

      const configuration = Gateway.getProxyForGateway(TestGateway).configuration;
      const protocol = configuration.protocol as GatewayHttpProtocol;
      const listener = protocol.pendingOperationRequestListeners.push((request: GatewayHttpProtocol.PendingOperationRequest) => {
        if (request.applicationData === undefined) {
          request.applicationData = 0;
          return;
        }

        assert.equal(request.applicationData, pendingsReceived);
        ++pendingsReceived;
        assert.equal(request.currentStatus, `Pending Response #${pendingsReceived}`);
        request.applicationData = pendingsReceived;
      });
      configuration.pendingOperationRetryInterval = 1;

      assert(TestbedConfig.sendToMainSync({ name: "pendingResponseQuota", value: expectedPendings }));

      const params = new TestOp1Params(1, 1);
      const remoteSum = await TestGateway.getProxy().op1(params);
      assert.equal(pendingsReceived, expectedPendings);
      assert.equal(remoteSum, params.sum());

      assert(TestbedConfig.sendToMainSync({ name: "pendingResponseQuota", value: 0 }));
      protocol.pendingOperationRequestListeners.splice(listener - 1, 1);
    });
  });
}
