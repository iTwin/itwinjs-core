/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { CURRENT_REQUEST } from "./rpc/core/RpcRegistry";
import { RpcConfiguration, RpcConfigurationSupplier } from "./rpc/core/RpcConfiguration";

// tslint:disable-next-line:ban-types
export interface RpcInterfaceDefinition<T extends RpcInterface = RpcInterface> { prototype: T; name: string; version: string; types: () => Function[]; }
export type RpcInterfaceImplementation<T extends RpcInterface = RpcInterface> = new () => T;

/** An RPC interface is a set of operations exposed by a service that a client can call, using configurable protocols,
 * in a platform-independent way. TheRpcInterface class is the base class for RPC interface definitions and implementations.
 */
export abstract class RpcInterface {
  /** The configuration for the RPC interface. */
  public readonly configuration = RpcConfiguration.supply(this);

  /** Obtains the implementation result for an RPC operation. */
  public forward<T>(operation: string, ...parameters: any[]): Promise<T> {
    const request = new (this.configuration.protocol.requestType)<T>(this, operation, parameters);
    request.submit();
    (this as any)[CURRENT_REQUEST] = request;
    return request.response;
  }

  /** @hidden @internal */
  public configurationSupplier: RpcConfigurationSupplier | undefined;
}

RpcInterface.prototype.configurationSupplier = undefined;
