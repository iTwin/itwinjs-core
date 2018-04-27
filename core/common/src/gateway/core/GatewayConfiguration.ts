/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Gateway */
import { Gateway, GatewayDefinition } from "../../Gateway";
import { GatewayProtocol, GatewayRequestFulfillment, GatewayProtocolEvent } from "./GatewayProtocol";
import { GatewayRequest } from "./GatewayRequest";
import { INSTANCE } from "./GatewayRegistry";
import { GatewayControlChannel } from "./GatewayControl";

export type GatewayConfigurationSupplier = () => { new(): GatewayConfiguration };

/** A GatewayConfiguration specifies how calls on a gateway will be marshalled, plus other operating parameters.
 * GatewayConfiguration is the base class for specific configurations.
 */
export abstract class GatewayConfiguration {
  /** Sets the configuration supplier for a gateway class. */
  public static assign<T extends Gateway>(gateway: GatewayDefinition<T>, supplier: GatewayConfigurationSupplier): void {
    gateway.prototype.configurationSupplier = supplier;
  }

  /** Obtains the instance of a gateway configuration class. */
  public static obtain<T extends GatewayConfiguration>(constructor: { new(): T }): T {
    let instance = (constructor as any)[INSTANCE] as T;
    if (!instance)
      instance = (constructor as any)[INSTANCE] = new constructor();

    return instance;
  }

  /** The protocol of the configuration. */
  public abstract readonly protocol: GatewayProtocol;

  /** The gateways managed by the configuration. */
  public abstract readonly gateways: () => GatewayDefinition[];

  /** Reserved for an application authorization key. */
  public applicationAuthorizationKey: string = "";

  /** Reserved for an application authorization value. */
  public applicationAuthorizationValue: string = "";

  /** The target interval (in milliseconds) between connection attempts for pending gateway operation requests. */
  public pendingOperationRetryInterval = 10000;

  /** The control channel for the configuration. */
  public readonly controlChannel = GatewayControlChannel.obtain(this);

  /** Initializes the gateways managed by the configuration. */
  protected static initializeGateways(configuration: GatewayConfiguration) {
    configuration.gateways().forEach((gateway) => Gateway.initialize(gateway));
  }

  /** @hidden @internal */
  public static supply(gateway: Gateway): GatewayConfiguration {
    return GatewayConfiguration.obtain(gateway.configurationSupplier ? gateway.configurationSupplier() : GatewayDefaultConfiguration);
  }

  /** @hidden @internal */
  public onGatewayProxyInitialized(definition: GatewayDefinition, instance: Gateway): void {
    this.protocol.onGatewayProxyInitialized(definition, instance);
  }

  /** @hidden @internal */
  public onGatewayImplementationInitialized(definition: GatewayDefinition, instance: Gateway): void {
    this.protocol.onGatewayImplementationInitialized(definition, instance);
  }
}

// A default configuration that can be used for basic testing within a library.
export class GatewayDefaultConfiguration extends GatewayConfiguration {
  public gateways = () => [];
  public protocol: GatewayProtocol = new GatewayDirectProtocol(this);
  public applicationAuthorizationKey = "Authorization";
  public applicationAuthorizationValue = "Basic Og==";
}

// A default protocol that can be used for basic testing within a library.
export class GatewayDirectProtocol extends GatewayProtocol {
  public readonly requestType = GatewayDirectRequest;
}

// A default request type that can be used for basic testing within a library.
export class GatewayDirectRequest extends GatewayRequest {
  public headers: Map<string, string> = new Map();
  public fulfillment: GatewayRequestFulfillment = { result: "", status: 0, id: "", gateway: "" };

  protected send(): void {
    const request = this.protocol.serialize(this);

    this.protocol.fulfill(request).then((fulfillment) => {
      this.fulfillment = fulfillment;
      this.protocol.events.raiseEvent(GatewayProtocolEvent.ResponseLoaded, this);
    });
  }

  protected setHeader(name: string, value: string): void {
    this.headers.set(name, value);
  }

  public getResponseStatusCode(): number {
    return this.fulfillment.status;
  }

  public getResponseText(): string {
    return this.fulfillment.result;
  }
}
