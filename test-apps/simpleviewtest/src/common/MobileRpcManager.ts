/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { RpcRequest, RpcRequestFulfillment, RpcProtocol, RpcProtocolEvent, RpcConfiguration, RpcInterfaceDefinition, SerializedRpcRequest } from "@bentley/imodeljs-common/lib/common";

declare var bentley: any;

/** Holds configuration for the RpcInterfaces used by the application. */
export class MobileRpcManager {
  // ***
  // *** TODO: Move this into imodeljs-core -> BentleyMobileRpcManager
  // ***
  public static readonly isMobile: boolean = typeof (window) !== "undefined" ? /iphone|ipod|ipad/.test(window.navigator.userAgent.toLowerCase()) : true;
  public static initializeMobile(rpcInterfaces: RpcInterfaceDefinition[]): RpcConfiguration {
    let mobilegateway: { handler: (payload: string) => void; send: (message: string) => void; port: number; };
    interface MobileResponse {
      id: string;
      fulfillment: RpcRequestFulfillment;
    }

    class MobileRequest extends RpcRequest {
      public readonly protocol: MobileProtocol = this.client.configuration.protocol as any;
      public fulfillment: RpcRequestFulfillment = { result: "", status: 0, id: "", interfaceName: "" };
      protected initializeChannel(): void { }
      protected setHeader(_name: string, _value: string): void { }
      public getResponseStatusCode(): number { return this.fulfillment.status; }
      public getResponseText(): string { return this.fulfillment.result || ""; }

      protected send(): void {
        this.protocol.map.set(this.id, this);
        const serialized = JSON.stringify(this.protocol.serialize(this));
        if (this.protocol.socket.readyState === 1)
          this.protocol.socket.send(serialized);
        else
          this.protocol.pending.push(serialized);
      }
    }

    class MobileProtocol extends RpcProtocol {
      public socket: WebSocket = (undefined as any);
      public map: Map<string, MobileRequest> = new Map();
      public pending: string[] = [];
      public readonly requestType = MobileRequest;

      constructor(configuration: MobileRpcConfiguration) {
        super(configuration);

        if (typeof (WebSocket) !== "undefined") {
          this.socket = new WebSocket(`ws://localhost:${window.location.hash.substr(1)}`);

          this.socket.addEventListener("message", (event) => {
            const response: MobileResponse = JSON.parse(event.data);
            const request = this.map.get(response.id) as MobileRequest;
            this.map.delete(response.id);
            request.fulfillment = response.fulfillment;
            this.events.raiseEvent(RpcProtocolEvent.ResponseLoaded, request);
          });

          this.socket.addEventListener("open", (_event) => {
            for (const pending of this.pending) {
              this.socket.send(pending);
            }
            this.pending = [];
          });
        } else {
          mobilegateway = bentley.imodeljs.servicesTier.require("@bentley/imodeljs-mobilegateway");

          mobilegateway.handler = async (payload) => {
            const request: SerializedRpcRequest = JSON.parse(payload);
            const fulfillment = await this.fulfill(request);
            const response: MobileResponse = { id: request.id, fulfillment };
            mobilegateway.send(JSON.stringify(response));
          };

          (self as any).__imodeljs_mobilegateway_handler__ = mobilegateway.handler;
        }
      }
    }

    abstract class MobileRpcConfiguration extends RpcConfiguration {
      public protocol: MobileProtocol = new MobileProtocol(this);

      public static initialize(definitions: RpcInterfaceDefinition[]) {
        class Config extends MobileRpcConfiguration {
          public interfaces = () => definitions;
        }

        for (const definition of definitions) {
          RpcConfiguration.assign(definition, () => Config);
        }

        const instance = RpcConfiguration.obtain(Config);
        RpcConfiguration.initializeInterfaces(instance);

        return instance;
      }
    }

    return MobileRpcConfiguration.initialize(rpcInterfaces);
  }
}
