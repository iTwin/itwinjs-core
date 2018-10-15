/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { IModelError } from "../../IModelError";
import { IModelToken } from "../../IModel";
import { BentleyStatus, Guid } from "@bentley/bentleyjs-core";
import { RpcInterface, RpcInterfaceDefinition } from "../../RpcInterface";
import { RpcRegistry, OPERATION, POLICY, builtins } from "./RpcRegistry";
import { RpcRequestTokenSupplier_T, RpcRequestIdSupplier_T, RpcRequestInitialRetryIntervalSupplier_T, RpcRequestCallback_T } from "./RpcRequest";
import { RpcInvocationCallback_T } from "./RpcInvocation";

/** The policy for an RPC operation. */
export class RpcOperationPolicy {
  /** Supplies the IModelToken for an operation request. */
  public token: RpcRequestTokenSupplier_T = (request) => request.findParameterOfType(IModelToken);

  /** Supplies the unique identifier for an operation request.  */
  public requestId: RpcRequestIdSupplier_T = (_request) => Guid.createValue();

  /** Supplies the initial retry interval for an operation request. */
  public retryInterval: RpcRequestInitialRetryIntervalSupplier_T = (configuration) => configuration.pendingOperationRetryInterval;

  /** Whether an operation request must be acknowledged. */
  public requiresAcknowledgement: boolean = false;

  /** Called before every operation request on the frontend is sent. */
  public requestCallback: RpcRequestCallback_T = (_request) => { };

  /** Called after every operation request on the frontend is sent. */
  public sentCallback: RpcRequestCallback_T = (_request) => { };

  /** Called for every operation invocation on the backend. */
  public invocationCallback: RpcInvocationCallback_T = (_invocation) => { };
}

/** An RPC operation descriptor. */
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

  /** @hidden */
  public constructor(definition: RpcInterfaceDefinition, operation: string, policy: RpcOperationPolicy) {
    this.interfaceDefinition = definition;
    this.operationName = operation;
    this.policy = policy;
  }

  /** @hidden */
  public static computeOperationName(identifier: string): string {
    const c = identifier.indexOf(":");
    if (c === -1)
      return identifier;

    return identifier.substring(0, c + 1);
  }
}

export namespace RpcOperation {
  /** Decorator for setting the policy for an RPC operation function. */
  export function setPolicy(policy: RpcOperationPolicy) {
    return <T extends RpcInterface>(target: T, propertyKey: string, descriptor: PropertyDescriptor) => {
      descriptor.value[OPERATION] = new RpcOperation(target.constructor as any, propertyKey, policy);
    };
  }

  /** Decorator for setting the default policy for an RPC interface definition class. */
  export function setDefaultPolicy(policy: RpcOperationPolicy) {
    return <T extends RpcInterface>(definition: RpcInterfaceDefinition<T>) => {
      (definition as any)[POLICY] = policy;
    };
  }
}
