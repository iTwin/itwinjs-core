/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { RpcProtocolEvent, RpcRequest } from "@bentley/imodeljs-common";
import { TestRpcInterface3 } from "../common/TestRpcInterface";
import { assert } from "chai";

describe("Rpc.ElectronProtocol", () => {
  it("generate one response per request", async () => {
    let received = 0;
    let request: RpcRequest;
    const client = TestRpcInterface3.getClient();

    client.configuration.protocol.events.addListener((type, object) => {
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
      (received === 1) ? resolve() : reject(new Error(`Received ${received} responses for 1 request`));
    }, 2000));
  });
});
