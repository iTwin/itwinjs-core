/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module RpcInterface
 */

import { BentleyStatus } from "@itwin/core-bentley";
import { IModelRpcProps } from "../../IModel";
import { IModelError } from "../../IModelError";
import { RpcInterface, RpcInterfaceDefinition } from "../../RpcInterface";
import { RpcResponseCacheControl } from "./RpcConstants";
import { OPERATION, POLICY, RpcRegistry } from "./RpcRegistry";
import {
  RpcRequestCallback_T, RpcRequestInitialRetryIntervalSupplier_T, RpcRequestTokenSupplier_T, RpcResponseCachingCallback_T,
} from "./RpcRequest";

/** The policy for an RPC operation.
 * @internal
 */
export class RpcOperationPolicy {
  /** Supplies the IModelRpcProps for an operation request. */
  public token: RpcRequestTokenSupplier_T = (request) => request.findTokenPropsParameter();

  /** Supplies the initial retry interval for an operation request. */
  public retryInterval: RpcRequestInitialRetryIntervalSupplier_T = (configuration) => configuration.pendingOperationRetryInterval;

  /** Called before every operation request on the frontend is sent. */
  public requestCallback: RpcRequestCallback_T = (_request) => { };

  /** Called after every operation request on the frontend is sent. */
  public sentCallback: RpcRequestCallback_T = (_request) => { };

  /**
   * Determines if caching is permitted for an operation response.
   * @note Not all RPC protocols support caching.
   */
  public allowResponseCaching: RpcResponseCachingCallback_T = (_request) => RpcResponseCacheControl.None;

  /** The Cache-Control header set on the response by the backend if response caching is enabled. */
  public cacheControlHeader: string = "no-store";

  /** Forces RpcConfiguration.strictMode for this operation. */
  public forceStrictMode: boolean = false;

  /** Whether the IModelRpcProps in the operation parameter list is allowed to differ from the token in the request URL. */
  public allowTokenMismatch: boolean = false;

  /** Whether to compress the operation response with one of the client's supported encodings. */
  public allowResponseCompression: boolean = false;
}

/** An RPC operation descriptor.
 * @internal
 */
export class RpcOperation {
  /** A fallback token to use for RPC requests that do not semantically depend on an iModel. */
  public static fallbackToken: IModelRpcProps | undefined = undefined;

  /** Looks up an RPC operation by name. */
  public static lookup(target: string | RpcInterfaceDefinition, operationName: string): RpcOperation {
    const definition = typeof (target) === "string" ? RpcRegistry.instance.lookupInterfaceDefinition(target) : target;
    const propertyName: string | symbol = RpcOperation.computeOperationName(operationName);

    const proto = (definition.prototype as any);
    if (!proto.hasOwnProperty(propertyName))
      throw new IModelError(BentleyStatus.ERROR, `RPC interface class "${definition.interfaceName}" does not does not declare operation "${operationName}"`);

    return proto[propertyName][OPERATION];
  }

  /** Iterates the operations of an RPC interface definition. */
  public static forEach(definition: RpcInterfaceDefinition, callback: (operation: RpcOperation) => void): void {
    Object.getOwnPropertyNames(definition.prototype).forEach((operationName) => {
      if (operationName === "constructor" || operationName === "configurationSupplier")
        return;

      const propertyName = RpcOperation.computeOperationName(operationName);
      callback((definition.prototype as any)[propertyName][OPERATION]);
    });
  }

  /** The RPC interface definition for this operation. */
  public readonly interfaceDefinition: RpcInterfaceDefinition;

  /** The name of this operation. */
  public readonly operationName: string;

  /** The version of this operation. */
  public get interfaceVersion(): string { return this.interfaceDefinition.interfaceVersion; }

  /** The policy for this operation. */
  public policy: RpcOperationPolicy;

  /** @internal */
  public constructor(definition: RpcInterfaceDefinition, operation: string, policy: RpcOperationPolicy) {
    this.interfaceDefinition = definition;
    this.operationName = operation;
    this.policy = policy;
  }

  /** @internal */
  public static computeOperationName(identifier: string): string {
    const c = identifier.indexOf(":");
    if (c === -1)
      return identifier;

    return identifier.substring(0, c + 1);
  }
}

/** @internal */
export type RpcOperationPolicyProps = Partial<RpcOperationPolicy>;

/** @internal */
export namespace RpcOperation { // eslint-disable-line no-redeclare

  /** This is the recommended cache header for RPC operations which are deemed cacheable. Currently the header instructs a shared cache to store the response for 24 hours
    * and instructs the browser to store the response for 48 hours.
    * Please see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control
    * for more information on cache headers.
    *
    * @note This cache header may not be applicable to all cacheable RPC operations!
    * Example RPC operation where this header does not apply:
    *   getTileCacheContainerUrl - This RPC operation returns a SAS key which expires in 24 hours, so it can't be cached on the browser for 48 hours.
    *
    *
    * TODO: Add stale-while-revalidate to this header, once it is supported and tested in the RPC caching service.
    */
  export const recommendedCacheHeader = `s-maxage=${3600 * 24}, max-age=${3600 * 48}, immutable`;

  function obtainInstance(obj: RpcOperationPolicy | RpcOperationPolicyProps) {
    if (obj instanceof RpcOperationPolicy) {
      return obj;
    } else {
      const instance = new RpcOperationPolicy();
      Object.assign(instance, obj);
      return instance;
    }
  }

  /** Decorator for setting the policy for an RPC operation function. */
  export function setPolicy(policy: RpcOperationPolicy | RpcOperationPolicyProps) {
    return <T extends RpcInterface>(target: T, propertyKey: string, descriptor: PropertyDescriptor) => {
      descriptor.value[OPERATION] = new RpcOperation(target.constructor as any, propertyKey, obtainInstance(policy));
    };
  }

  /** Convenience decorator for setting an RPC operation policy that allows response caching.
   *  The current default cacheControlHeader when using this decorator is "no-store".
   */
  export function allowResponseCaching(control: RpcResponseCacheControl = RpcResponseCacheControl.Immutable, cacheControlHeader: string = "no-store") {
    return <T extends RpcInterface>(target: T, propertyKey: string, descriptor: PropertyDescriptor) => {
      descriptor.value[OPERATION] = new RpcOperation(target.constructor as any, propertyKey, new class extends RpcOperationPolicy {
        public override allowResponseCaching = () => control;
        public override cacheControlHeader = cacheControlHeader;
      }());
    };
  }

  /** Convenience decorator for setting an RPC operation policy that supplies the IModelRpcProps for an operation. */
  export function setRoutingProps(handler: RpcRequestTokenSupplier_T) {
    return <T extends RpcInterface>(target: T, propertyKey: string, descriptor: PropertyDescriptor) => {
      descriptor.value[OPERATION] = new RpcOperation(target.constructor as any, propertyKey, new class extends RpcOperationPolicy {
        public override token = handler;
      }());
    };
  }

  /** Decorator for setting the default policy for an RPC interface definition class. */
  export function setDefaultPolicy(policy: RpcOperationPolicy | RpcOperationPolicyProps) {
    return <T extends RpcInterface>(definition: RpcInterfaceDefinition<T>) => {
      (definition as any)[POLICY] = obtainInstance(policy);
    };
  }
}
