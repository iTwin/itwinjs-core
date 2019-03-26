/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { CURRENT_REQUEST, RESOURCE } from "./rpc/core/RpcRegistry";
import { RpcConfiguration, RpcConfigurationSupplier } from "./rpc/core/RpcConfiguration";
import * as semver from "semver";
import { IModelToken } from "./IModel";
import { RpcRequest } from "./rpc/core/RpcRequest";
import { Readable } from "stream";
import { RpcOperation } from "./rpc/core/RpcOperation";

/** @public */
export interface RpcInterfaceDefinition<T extends RpcInterface = RpcInterface> { prototype: T; name: string; version: string; types: () => Function[]; } // tslint:disable-line:ban-types
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

  /** The configuration for the RPC interface. */
  public readonly configuration = RpcConfiguration.supply(this);

  /** Obtains the implementation result for an RPC operation. */
  public async forward<T = any>(parameters: IArguments): Promise<T> {
    const parametersCompat = (arguments.length === 1 && typeof (parameters) === "object") ? parameters : arguments;
    const parametersArray = Array.isArray(parametersCompat) ? parametersCompat : Array.prototype.slice.call(parametersCompat);
    const operationName = parametersArray.pop();
    const request = new (this.configuration.protocol.requestType as any)(this, operationName, parametersArray) as RpcRequest;
    request.submit(); // tslint:disable-line:no-floating-promises
    (this as any)[CURRENT_REQUEST] = request;
    return request.response;
  }

  /** Obtains a named resource from the backend. */
  @RpcOperation.allowResponseCaching()
  public async getResource(token: IModelToken, name: string): Promise<Response> {
    const request = new (this.configuration.protocol.requestType as any)(this, RESOURCE, [token, name]) as RpcRequest;
    request.submit(); // tslint:disable-line:no-floating-promises
    (this as any)[CURRENT_REQUEST] = request;
    return request.rawResponse;
  }

  /** Override on the backend to fulfill getResource requests. */
  public async supplyResource(_token: IModelToken, _name: string): Promise<Readable | undefined> {
    return undefined;
  }

  /** @internal */
  public configurationSupplier: RpcConfigurationSupplier | undefined;
}

RpcInterface.prototype.configurationSupplier = undefined;
