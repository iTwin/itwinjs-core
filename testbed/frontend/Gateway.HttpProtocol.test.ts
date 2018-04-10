/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Gateway, GatewayRequestEvent, GatewayRequest, GatewayOperation } from "@bentley/imodeljs-common";
import { TestGateway, TestOp1Params } from "../common/TestGateway";
import { assert } from "chai";
import { TestbedConfig } from "../common/TestbedConfig";

if (TestbedConfig.gatewayConfig) {
  describe("Gateway.HttpProtocol", () => {
    it("should send pending request updates.", async () => {
      const COUNT = Symbol("Pending Count");
      const op1 = GatewayOperation.lookup(TestGateway, "op1");

      const expectedPendings = 2;
      let pendingsReceived = 0;

      const removeListener = GatewayRequest.events.addListener((type: GatewayRequestEvent, request: GatewayRequest) => {
        if (type !== GatewayRequestEvent.PendingUpdateReceived || request.operation !== op1)
          return;

        if ((request as any)[COUNT] === undefined) {
          (request as any)[COUNT] = 0;
        }

        assert.equal((request as any)[COUNT], pendingsReceived);
        ++pendingsReceived;
        assert.equal(request.extendedStatus, `Pending Response #${pendingsReceived}`);
        (request as any)[COUNT] = pendingsReceived;
      });

      Gateway.getProxyForGateway(TestGateway).configuration.pendingOperationRetryInterval = 1;

      assert(TestbedConfig.sendToMainSync({ name: "pendingResponseQuota", value: expectedPendings }));

      const params = new TestOp1Params(1, 1);
      const remoteSum = await TestGateway.getProxy().op1(params);
      assert.equal(pendingsReceived, expectedPendings);
      assert.equal(remoteSum, params.sum());

      assert(TestbedConfig.sendToMainSync({ name: "pendingResponseQuota", value: 0 }));
      removeListener();
    });
  });
}
