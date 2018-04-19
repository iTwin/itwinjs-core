/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Gateway */

import { GatewayRegistry } from "./gateway/core/GatewayRegistry";
import { GatewayConfiguration, GatewayConfigurationSupplier } from "./gateway/core/GatewayConfiguration";

// tslint:disable-next-line:ban-types
export interface GatewayDefinition<T extends Gateway = Gateway> { prototype: T; name: string; version: string; types: () => Function[]; }
export type GatewayImplementation<T extends Gateway = Gateway> = new () => T;

/** A set of related asynchronous APIs that operate over configurable protocols across multiple platforms. */
export abstract class Gateway {
  /**
   * Initializes a gateway class.
   * <em>note:</em> This function must be called on the frontend and on the backend for each gateway class used by an application.
   */
  public static initialize<T extends Gateway>(definition: GatewayDefinition<T>): void {
    GatewayRegistry.instance.initializeGateway(definition);
  }

  /** Returns the gateway proxy instance for the frontend. */
  public static getProxyForGateway<T extends Gateway>(definition: GatewayDefinition<T>): T {
    return GatewayRegistry.instance.getProxyForGateway(definition);
  }

  /** Registers the gateway implementation class for the backend. */
  public static registerImplementation<TDefinition extends Gateway, TImplementation extends TDefinition>(definition: GatewayDefinition<TDefinition>, implementation: GatewayImplementation<TImplementation>): void {
    GatewayRegistry.instance.registerImplementation(definition, implementation);
  }

  /** Supply the instance of the gateway implementation class for the backend (optional). */
  public static supplyImplementationInstance<TDefinition extends Gateway, TImplementation extends TDefinition>(definition: GatewayDefinition<TDefinition>, instance: TImplementation): void {
    GatewayRegistry.instance.setImplementationInstance(definition, instance);
  }

  /** The configuration for the gateway. */
  public readonly configuration = GatewayConfiguration.supply(this);

  /** Obtains the implementation result for a gateway operation. */
  public forward<T>(operation: string, ...parameters: any[]): Promise<T> {
    const request = new (this.configuration.protocol.requestType)<T>(this, operation, parameters);
    request.submit();
    return request.response;
  }

  /** @hidden @internal */
  public configurationSupplier: GatewayConfigurationSupplier | undefined;
}

Gateway.prototype.configurationSupplier = undefined;
