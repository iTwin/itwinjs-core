/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { InterceptedRpcRequest } from "../../ipc/IpcSession";
import { RpcConfiguration } from "./RpcConfiguration";
import { RpcRequestStatus, RpcResponseCacheControl } from "./RpcConstants";
import { RpcInvocation } from "./RpcInvocation";
import { RpcSerializedValue } from "./RpcMarshaling";
import { RpcProtocol, SerializedRpcRequest } from "./RpcProtocol";
import { RpcRequest } from "./RpcRequest";

class SessionConfiguration extends RpcConfiguration {
  public interfaces = () => [];
  public get protocol() { return SessionProtocol.instance; }
}

class SessionProtocol extends RpcProtocol {
  public static instance = new SessionProtocol();
  public requestType = RpcRequest;
  public override supportsStatusCategory = true;
  constructor() { super(new SessionConfiguration()); }
}

/** @internal */
export class RpcSessionInvocation extends RpcInvocation {
  public static create(request: InterceptedRpcRequest): RpcSessionInvocation {
    const serializedRequest: SerializedRpcRequest = {
      id: request.context.id,
      applicationId: request.context.applicationId,
      applicationVersion: request.context.applicationVersion,
      sessionId: request.context.sessionId,
      authorization: "",
      operation: {
        interfaceDefinition: request.definition.interfaceName,
        interfaceVersion: request.definition.interfaceVersion,
        operationName: request.operation,
      },
      method: request.operation,
      path: "",
      parameters: RpcSerializedValue.create(),
      parametersOverride: request.parameters,
      caching: RpcResponseCacheControl.None,
      protocolVersion: parseInt(request.context.protocolVersion, 10),
    };

    return new RpcSessionInvocation(SessionProtocol.instance, serializedRequest);
  }

  public get rejected() {
    return this.status === RpcRequestStatus.Rejected;
  }
}
