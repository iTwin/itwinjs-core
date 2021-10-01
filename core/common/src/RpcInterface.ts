/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import * as semver from "semver";
import { RpcConfiguration, RpcConfigurationSupplier } from "./rpc/core/RpcConfiguration";
import { CURRENT_REQUEST } from "./rpc/core/RpcRegistry";
import { RpcRequest } from "./rpc/core/RpcRequest";
import { RpcRoutingToken } from "./rpc/core/RpcRoutingToken";

/** @internal */
export interface RpcInterfaceDefinition<T extends RpcInterface = RpcInterface> { prototype: T, interfaceName: string, interfaceVersion: string }

/** @internal */
export type RpcInterfaceImplementation<T extends RpcInterface = RpcInterface> = new () => T;

/** An RPC interface is a set of operations exposed by a service that a client can call, using configurable protocols,
 * in a platform-independent way. TheRpcInterface class is the base class for RPC interface definitions and implementations.
 * @public
 */
export abstract class RpcInterface {
  /** Determines whether the backend version of an RPC interface is compatible (according to semantic versioning) with the frontend version of the interface. */
  public static isVersionCompatible(backend: string, frontend: string): boolean {
    const difference = semver.diff(backend, frontend);
    if (semver.prerelease(backend) || semver.prerelease(frontend)) {
      return difference === null;
    } else if (semver.major(backend) === 0 || semver.major(frontend) === 0) {
      return difference === null || (difference === "patch" && semver.patch(frontend) < semver.patch(backend));
    } else {
      return difference === null || difference === "patch" || (difference === "minor" && semver.minor(frontend) < semver.minor(backend));
    }
  }

  /** The configuration for the RPC interface.
   * @internal
   */
  public readonly configuration: RpcConfiguration;

  /** @internal */
  public readonly routing: RpcRoutingToken;

  /** @internal */
  public constructor(routing: RpcRoutingToken = RpcRoutingToken.default) {
    this.routing = routing;
    this.configuration = RpcConfiguration.supply(this);
  }

  /** Obtains the implementation result for an RPC operation. */
  public async forward<T = any>(parameters: IArguments): Promise<T> {
    const parametersCompat = (arguments.length === 1 && typeof (parameters) === "object") ? parameters : arguments;
    const parametersArray = Array.isArray(parametersCompat) ? parametersCompat : Array.prototype.slice.call(parametersCompat);
    const operationName = parametersArray.pop();
    const request = new (this.configuration.protocol.requestType as any)(this, operationName, parametersArray) as RpcRequest;
    request.submit(); // eslint-disable-line @typescript-eslint/no-floating-promises
    (this as any)[CURRENT_REQUEST] = request;
    return request.response;
  }

  /** @internal */
  public configurationSupplier: RpcConfigurationSupplier | undefined;
}

RpcInterface.prototype.configurationSupplier = undefined;
