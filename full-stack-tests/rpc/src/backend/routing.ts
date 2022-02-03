/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { BentleyCloudRpcProtocol, SerializedRpcRequest } from "@itwin/core-common";
import { RpcRequestFulfillment } from "@itwin/core-common";

export function initializeWebRoutingTest(protocol: BentleyCloudRpcProtocol) {
  const realFulfill = protocol.fulfill; // eslint-disable-line @typescript-eslint/unbound-method
  const interceptions = new Map<number, number>();

  protocol.fulfill = async (request: SerializedRpcRequest) => {
    if (request.operation.interfaceDefinition === "WebRoutingInterface") {
      const fulfillment = await RpcRequestFulfillment.forUnknownError(request, "");
      fulfillment.status = Number(request.operation.operationName.substr(4));

      let intercepted = interceptions.get(fulfillment.status) ?? 0;
      if (intercepted < 3) {
        interceptions.set(fulfillment.status, ++intercepted);

        if (fulfillment.status === 503) {
          if (intercepted === 3) {
            const retry = new Date(Date.now() + 1000);
            fulfillment.retry = retry.toISOString();
          } else {
            fulfillment.retry = ".25";
          }
        }

        return fulfillment;
      }
    }

    return realFulfill.call(protocol, request);
  };
}
