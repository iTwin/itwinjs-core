/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { GatewayProtocolEvent, GatewayRequest } from "@bentley/imodeljs-common";
import { TestGateway3 } from "../common/TestGateway";
import { assert } from "chai";

describe("Gateway.ElectronProtocol", () => {
  it("generate one response per request", async () => {
    let received = 0;
    let request: GatewayRequest;
    const gateway = TestGateway3.getProxy();

    gateway.configuration.protocol.events.addListener((type, object) => {
      if (type !== GatewayProtocolEvent.ResponseLoaded)
        return;

      if (!request)
        request = object as GatewayRequest;
      else if (object !== request)
        return;

      ++received;
    });

    const response = await gateway.op1(1);
    assert.equal(response, 1);

    return new Promise((resolve, reject) => setTimeout(() => {
      (received === 1) ? resolve() : reject(new Error(`Received ${received} responses for 1 request`));
    }, 2000));
  });
});
