/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { BentleyStatus } from "@bentley/bentleyjs-core";
import { IModelToken } from "../../IModel";
import { IModelError } from "../../IModelError";
import { RpcInterface, RpcInterfaceDefinition } from "../../RpcInterface";
import { RpcResponseCacheControl } from "./RpcConstants";
import { RpcInvocationCallback_T } from "./RpcInvocation";
import { builtins, OPERATION, POLICY, RpcRegistry } from "./RpcRegistry";
import { RpcRequestCallback_T, RpcRequestInitialRetryIntervalSupplier_T, RpcRequestTokenSupplier_T, RpcResponseCachingCallback_T } from "./RpcRequest";

/** The policy for an RPC operation.
 * @public
 */
export class RpcOperationPolicy {
  /** Supplies the IModelToken for an operation request. */
  public token: RpcRequestTokenSupplier_T = (request) => request.findParameterOfType(IModelToken);

  /** Supplies the initial retry interval for an operation request. */
  public retryInterval: RpcRequestInitialRetryIntervalSupplier_T = (configuration) => configuration.pendingOperationRetryInterval;

  /** Called before every operation request on the frontend is sent. */
  public requestCallback: RpcRequestCallback_T = (_request) => { };

  /** Called after every operation request on the frontend is sent. */
  public sentCallback: RpcRequestCallback_T = (_request) => { };

  /** Called for every operation invocation on the backend. */
  public invocationCallback: RpcInvocationCallback_T = (_invocation) => { };

  /**
   * Determines if caching is permitted for an operation response.
   * @note Not all RPC protocols support caching.
   */
  public allowResponseCaching: RpcResponseCachingCallback_T = (_request) => RpcResponseCacheControl.None;
}

/** An RPC operation descriptor.
 * @public
 */
export class RpcOperation {
  /** A fallback token to use for RPC system management requests like RpcManager.describeAvailableEndpoints. */
  public static fallbackToken: IModelToken | undefined = undefined;

  /** Looks up an RPC operation by name. */
  public static lookup(target: string | RpcInterfaceDefinition, operationName: string): RpcOperation {
    const definition = typeof (target) === "string" ? RpcRegistry.instance.lookupInterfaceDefinition(target) : target;

    let propertyName: string | symbol = RpcOperation.computeOperationName(operationName);
    for (const builtin of builtins) {
      if (builtin === propertyName) {
        propertyName = Symbol.for(builtin);
        break;
      }
    }

    const proto = (definition.prototype as any);
    if (!proto.hasOwnProperty(propertyName))
      throw new IModelError(BentleyStatus.ERROR, `RPC interface class "${definition.name}" does not does not declare operation "${operationName}"`);

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

    Object.getOwnPropertySymbols(definition.prototype).forEach((builtinSymbol) => {
      const builtin = (definition.prototype as any)[builtinSymbol][OPERATION];
      if (builtin)
        callback(builtin);
    });
  }

  /** The RPC interface definition for this operation. */
  public readonly interfaceDefinition: RpcInterfaceDefinition;

  /** The name of this operation. */
  public readonly operationName: string;

  /** The version of this operation. */
  public get interfaceVersion(): string { return this.interfaceDefinition.version; }

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

/** @public */
export namespace RpcOperation {
  /** Decorator for setting the policy for an RPC operation function. */
  export function setPolicy(policy: RpcOperationPolicy) {
    return <T extends RpcInterface>(target: T, propertyKey: string, descriptor: PropertyDescriptor) => {
      descriptor.value[OPERATION] = new RpcOperation(target.constructor as any, propertyKey, policy);
    };
  }

  /** Convenience decorator for setting an RPC operation policy that allows response caching. */
  export function allowResponseCaching(control: RpcResponseCacheControl = RpcResponseCacheControl.Immutable) {
    return <T extends RpcInterface>(target: T, propertyKey: string, descriptor: PropertyDescriptor) => {
      descriptor.value[OPERATION] = new RpcOperation(target.constructor as any, propertyKey, new class extends RpcOperationPolicy {
        public allowResponseCaching = () => control;
      }());
    };
  }

  /** Decorator for setting the default policy for an RPC interface definition class. */
  export function setDefaultPolicy(policy: RpcOperationPolicy) {
    return <T extends RpcInterface>(definition: RpcInterfaceDefinition<T>) => {
      (definition as any)[POLICY] = policy;
    };
  }
}
