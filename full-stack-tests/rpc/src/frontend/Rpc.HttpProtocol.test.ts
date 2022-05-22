/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { RpcOperation, RpcRequest, RpcRequestEvent, ServerError, ServerTimeoutError } from "@itwin/core-common";
import { TestOp1Params, TestRpcInterface } from "../common/TestRpcInterface";

if (false) {
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

      // assert(TestbedConfig.sendToMainSync({ name: CONSTANTS.PENDING_RESPONSE_QUOTA_MESSAGE, value: expectedPendings }));

      const params: TestOp1Params = { a: 1, b: 1 };
      const remoteSum = await TestRpcInterface.getClient().op1(params);

      // assert(TestbedConfig.sendToMainSync({ name: CONSTANTS.PENDING_RESPONSE_QUOTA_MESSAGE, value: 0 }));
      removeListener();

      assert.equal(pendingsReceived, expectedPendings);
      assert.equal(remoteSum, params.a + params.b);
    });

    it("should reject an unknown status code", async () => {
      try {
        await TestRpcInterface.getClient().interceptSendTimeoutStatus();
        assert(false);
      } catch (err) {
        assert(err instanceof ServerTimeoutError && err.errorNumber === 504);
      }

      try {
        await TestRpcInterface.getClient().interceptSendUnknownStatus();
        assert(false);
      } catch (err) {
        assert(err instanceof ServerError && err.errorNumber === 567);
      }
    });
  });
}
