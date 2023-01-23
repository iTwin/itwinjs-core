/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import {
  IpcWebSocket, IpcWebSocketMessage, IpcWebSocketMessageType, IpcWebSocketTransport, RpcInterface, RpcManager, RpcMarshaling, RpcRequestFulfillment,
  SerializedRpcRequest,
} from "@itwin/core-common";
import { MobileEventLoop } from "./MobileEventLoop";
import { MobileRpcProtocol } from "./MobileRpcProtocol";
import { MobileRpcRequest } from "./MobileRpcRequest";

const IPC = "__ipc__";

class IpcInterface extends RpcInterface { // eslint-disable-line deprecation/deprecation
  public static interfaceName = IPC;
  public static interfaceVersion = "0.0.0";
  public async send() { }
}

/** @internal */
export class MobileIpcTransport extends IpcWebSocketTransport {
  private _protocol: MobileRpcProtocol; // eslint-disable-line deprecation/deprecation
  private _client: IpcInterface;

  public constructor(protocol: MobileRpcProtocol) { // eslint-disable-line deprecation/deprecation
    super();
    this._protocol = protocol;

    RpcManager.initializeInterface(IpcInterface); // eslint-disable-line deprecation/deprecation
    this._client = RpcManager.getClientForInterface(IpcInterface); // eslint-disable-line deprecation/deprecation
  }

  public send(message: IpcWebSocketMessage): void {
    if (message.type === IpcWebSocketMessageType.Send || message.type === IpcWebSocketMessageType.Invoke) {
      this.sendToBackend(message); // eslint-disable-line @typescript-eslint/no-floating-promises
    } else if (message.type === IpcWebSocketMessageType.Push || message.type === IpcWebSocketMessageType.Response) {
      this.sendToFrontend(message); // eslint-disable-line @typescript-eslint/no-floating-promises
    }
  }

  public consumeRequest(request: SerializedRpcRequest): boolean { // eslint-disable-line deprecation/deprecation
    if (request.operation.interfaceDefinition !== IPC)
      return false;

    const message = RpcMarshaling.deserialize(this._protocol, request.parameters)[0] as IpcWebSocketMessage; // eslint-disable-line deprecation/deprecation
    this.broadcast({} as Event, message);
    return true;
  }

  public consumeResponse(response: RpcRequestFulfillment): boolean { // eslint-disable-line deprecation/deprecation
    if (response.interfaceName !== IPC)
      return false;

    const message = RpcMarshaling.deserialize(this._protocol, response.result) as IpcWebSocketMessage; // eslint-disable-line deprecation/deprecation
    this.broadcast({} as Event, message);
    return true;
  }

  private async sendToBackend(message: IpcWebSocketMessage) {
    const request = new MobileRpcRequest(this._client, "send", [message]); // eslint-disable-line deprecation/deprecation
    const encoded = await MobileRpcProtocol.encodeRequest(request); // eslint-disable-line deprecation/deprecation
    this._protocol.sendToBackend(encoded);
    request.dispose();
  }

  private async sendToFrontend(message: IpcWebSocketMessage) {
    MobileEventLoop.addTask();
    const result = await RpcMarshaling.serialize(this._protocol, message); // eslint-disable-line deprecation/deprecation
    MobileEventLoop.removeTask();

    const fulfillment: RpcRequestFulfillment = { result, rawResult: message, interfaceName: IPC, id: message.channel, status: 0 }; // eslint-disable-line deprecation/deprecation
    const encoded = MobileRpcProtocol.encodeResponse(fulfillment); // eslint-disable-line deprecation/deprecation
    this._protocol.sendToFrontend(encoded);
  }

  private broadcast(evt: Event, message: IpcWebSocketMessage) {
    for (const listener of IpcWebSocket.receivers)
      listener(evt, message);
  }
}
