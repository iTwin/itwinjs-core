/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { RpcProtocolEvent, RpcRequest, ElectronRpcConfiguration } from "@bentley/imodeljs-common";
import { TestRpcInterface3 } from "../common/TestRpcInterface";
import { assert } from "chai";
import { executeBackendCallback } from "@bentley/certa/lib/utils/CallbackUtils";
import { BackendTestCallbacks } from "../common/SideChannels";

// N.B.: These tests only run in electron!
if (ElectronRpcConfiguration.isElectron) {
  describe("Rpc.ElectronProtocol", () => {
    it("should generate one response per request", async () => {
      let received = 0;
      let request: RpcRequest;
      const client = TestRpcInterface3.getClient();

      const removeListener = client.configuration.protocol.events.addListener((type, object) => {
        if (type !== RpcProtocolEvent.ResponseLoaded)
          return;

        if (!request)
          request = object as RpcRequest;
        else if (object !== request)
          return;

        ++received;
      });

      const response = await client.op1(1);
      assert.equal(response, 1);

      return new Promise((resolve, reject) => setTimeout(() => {
        removeListener();
        (received === 1) ? resolve() : reject(new Error(`Received ${received} responses for 1 request`));
      }, 2000));
    });

    it("should chunk data larger than 64mb", async () => {
      const client = TestRpcInterface3.getClient();
      const threshold = client.configuration.protocol.transferChunkThreshold;

      let size = 2 * 1024 * 1024;
      assert(await executeBackendCallback(BackendTestCallbacks.setChunkThreshold, size));
      let data = await client.op2(size * 2, true);
      assert.equal(data.byteLength, size * 2);

      for (let i = 0; i !== (size * 2); ++i) {
        assert.equal(data[i], i % 2);
      }

      size = 48 * 1024 * 1024;
      assert(await executeBackendCallback(BackendTestCallbacks.setChunkThreshold, size));
      data = await client.op2(size * 2, false);
      assert.equal(data.byteLength, size * 2);

      assert(await executeBackendCallback(BackendTestCallbacks.setChunkThreshold, threshold));
    });
  });
}
