/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { CURRENT_REQUEST } from "./rpc/core/RpcRegistry";
import { RpcConfiguration, RpcConfigurationSupplier } from "./rpc/core/RpcConfiguration";
import * as semver from "semver";

// tslint:disable-next-line:ban-types
export interface RpcInterfaceDefinition<T extends RpcInterface = RpcInterface> { prototype: T; name: string; version: string; types: () => Function[]; }
export type RpcInterfaceImplementation<T extends RpcInterface = RpcInterface> = new () => T;

/** An RPC interface is a set of operations exposed by a service that a client can call, using configurable protocols,
 * in a platform-independent way. TheRpcInterface class is the base class for RPC interface definitions and implementations.
 */
export abstract class RpcInterface {
  /** Determines whether the backend version of an RPC interface is compatible (according to semantic versioning) with the frontend version of the interface. */
  public static isVersionCompatible(backend: string, frontend: string): boolean {
    const difference = semver.diff(backend, frontend);
    if (semver.prerelease(backend) || semver.prerelease(frontend)) {
      return difference === null;
    } else {
      return difference === null || difference === "patch" || (difference === "minor" && semver.minor(frontend) < semver.minor(backend));
    }
  }

  /** The configuration for the RPC interface. */
  public readonly configuration = RpcConfiguration.supply(this);

  /** Obtains the implementation result for an RPC operation. */
  public forward<T>(operation: string, ...parameters: any[]): Promise<T> {
    const request = new (this.configuration.protocol.requestType)<T>(this, operation, parameters);
    request.submit();
    (this as any)[CURRENT_REQUEST] = request;
    return request.response;
  }

  /** @hidden */
  public configurationSupplier: RpcConfigurationSupplier | undefined;
}

RpcInterface.prototype.configurationSupplier = undefined;
