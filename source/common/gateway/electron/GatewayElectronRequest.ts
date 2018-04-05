/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { GatewayRequest } from "../core/GatewayRequest";
import { GatewayProtocolEvent, GatewayRequestFulfillment } from "../core/GatewayProtocol";
import { GatewayElectronProtocol, CHANNEL, interop } from "./GatewayElectronProtocol";

export class GatewayElectronRequest extends GatewayRequest {
  /** Convenience access to the protocol of this request. */
  public readonly protocol: GatewayElectronProtocol = this.gateway.configuration.protocol as any;

  /** The fulfillment of this request. */
  public fulfillment: GatewayRequestFulfillment = { result: "", status: 0 };

  /** Initializes the request communication channel. */
  protected initializeChannel(): void {

  }

  /** Sends the request. */
  protected send(): void {
    try {
      interop.ipcRenderer.once(`${CHANNEL}${this.id}`, (_evt: any, arg: any) => {
        this.fulfillment = arg;
        this.protocol.events.raiseEvent(GatewayProtocolEvent.ResponseLoaded, this);
      });

      const request = this.protocol.serialize(this);
      interop.ipcRenderer.send(CHANNEL, request);
    } catch (e) {
      this.protocol.events.raiseEvent(GatewayProtocolEvent.ConnectionErrorReceived, this);
    }
  }

  /** Sets request header values. */
  protected setHeader(_name: string, _value: string): void {

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
