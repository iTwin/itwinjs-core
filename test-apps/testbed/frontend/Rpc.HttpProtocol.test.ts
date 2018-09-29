/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { RpcRequestEvent, RpcRequest, RpcOperation } from "@bentley/imodeljs-common";
import { TestRpcInterface, TestOp1Params } from "../common/TestRpcInterface";
import { assert } from "chai";
import { TestbedConfig } from "../common/TestbedConfig";
import { CONSTANTS } from "../common/Testbed";

if (TestbedConfig.cloudRpc) {
  describe("Rpc.HttpProtocol", () => {
    it("should send pending request updates.", async () => {
      const COUNT = Symbol("Pending Count");
      const op1 = RpcOperation.lookup(TestRpcInterface, "op1");

      const expectedPendings = 2;
      let pendingsReceived = 0;

      const removeListener = RpcRequest.events.addListener((type: RpcRequestEvent, request: RpcRequest) => {
        if (type !== RpcRequestEvent.PendingUpdateReceived || request.operation !== op1)
          return;

        if ((request as any)[COUNT] === undefined) {
          (request as any)[COUNT] = 0;
        }

        assert.equal((request as any)[COUNT], pendingsReceived);
        ++pendingsReceived;
        assert.equal(request.extendedStatus, `Pending Response #${pendingsReceived}`);
        (request as any)[COUNT] = pendingsReceived;
      });

      op1.policy.retryInterval = () => 1;

      assert(TestbedConfig.sendToMainSync({ name: CONSTANTS.PENDING_RESPONSE_QUOTA_MESSAGE, value: expectedPendings }));

      const params = new TestOp1Params(1, 1);
      const remoteSum = await TestRpcInterface.getClient().op1(params);

      assert(TestbedConfig.sendToMainSync({ name: CONSTANTS.PENDING_RESPONSE_QUOTA_MESSAGE, value: 0 }));
      removeListener();

      assert.equal(pendingsReceived, expectedPendings);
      assert.equal(remoteSum, params.sum());
    });
  });
}
