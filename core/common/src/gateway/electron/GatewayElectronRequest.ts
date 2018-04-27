/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Gateway */

import { GatewayRequest } from "../core/GatewayRequest";
import { GatewayProtocolEvent, GatewayRequestFulfillment } from "../core/GatewayProtocol";
import { GatewayElectronProtocol, CHANNEL, interop } from "./GatewayElectronProtocol";

export class GatewayElectronRequest extends GatewayRequest {
  /** Convenience access to the protocol of this request. */
  public readonly protocol: GatewayElectronProtocol = this.gateway.configuration.protocol as any;

  /** The fulfillment of this request. */
  public fulfillment: GatewayRequestFulfillment = { result: "", status: 0, id: "", gateway: "" };

  /** Sends the request. */
  protected send(): void {
    try {
      const request = this.protocol.serialize(this);
      interop.ipcRenderer.send(CHANNEL, request);
    } catch (e) {
      this.protocol.events.raiseEvent(GatewayProtocolEvent.ConnectionErrorReceived, this);
    }
  }

  /** Supplies response status code. */
  public getResponseStatusCode(): number {
    return this.fulfillment.status;
  }

  /** Supplies response text. */
  public getResponseText(): string {
    return this.fulfillment.result || "";
  }
}
