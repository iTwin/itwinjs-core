/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Gateway, GatewayDefinition } from "../Gateway";
import { GatewayProtocol, GatewayDirectProtocol } from "./GatewayProtocol";

const INSTANCE = Symbol.for("instance");

/** Operating parameters for a gateway. */
export abstract class GatewayConfiguration {
  /** The protocol of the configuration. */
  public abstract protocol: GatewayProtocol;

  /** The gateways managed by the configuration. */
  public abstract gateways: () => GatewayDefinition[];

  /** Reserved for an application authorization key. */
  public applicationAuthorizationKey!: string;

  /** Reserved for an application authorization value. */
  public applicationAuthorizationValue!: string;

  /** The target interval (in milliseconds) between connection attempts for pending gateway operation requests. */
  public pendingOperationRetryInterval = 10000;

  /** Returns the instance of a configuration class. */
  public static getInstance<T extends GatewayConfiguration>(constructor: { new(): T }): T {
    let instance = (constructor as any)[INSTANCE] as T;
    if (!instance)
      instance = (constructor as any)[INSTANCE] = new constructor();

    return instance;
  }

  /** Initializes the gateways managed by the configuration. */
  public initializeGateways() { this.gateways().forEach((gateway) => Gateway.initialize(gateway)); }
}

/** A default gateway configuration (suitable for testing). */
export class GatewayDefaultConfiguration extends GatewayConfiguration {
  public gateways = () => [];
  public protocol: GatewayProtocol = new GatewayDirectProtocol(this);
}
