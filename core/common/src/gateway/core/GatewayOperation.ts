/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelError } from "../../IModelError";
import { IModelToken } from "../../IModel";
import { BentleyStatus } from "@bentley/bentleyjs-core";
import { Gateway, GatewayDefinition } from "../../Gateway";
import { GatewayRegistry, OPERATION, POLICY } from "./GatewayRegistry";
import { GatewayRequestTokenSupplier_T, GatewayRequestIdSupplier_T } from "./GatewayRequest";
import * as uuidv4 from "uuid/v4";

/** The policy for a gateway operation. */
export class GatewayOperationPolicy {
  /** Supplies the IModelToken for an operation request. */
  public token: GatewayRequestTokenSupplier_T = (request) => request.findParameterOfType(IModelToken);

  /** Supplies the unique identifier for an operation request.  */
  public requestId: GatewayRequestIdSupplier_T = (_request) => uuidv4();

  /** Whether an operation request must be acknowledged. */
  public readonly requiresAcknowledgement: boolean = false;
}

/** A gateway operation descriptor. */
export class GatewayOperation {
  /** Looks up a gateway operation by name. */
  public static lookup(gateway: string | GatewayDefinition, operationName: string): GatewayOperation {
    const definition = typeof (gateway) === "string" ? GatewayRegistry.instance.lookupGatewayDefinition(gateway) : gateway;

    const proto = (definition.prototype as any);
    if (!proto.hasOwnProperty(operationName))
      throw new IModelError(BentleyStatus.ERROR, `Gateway class "${definition.name}" does not does not declare operation "${operationName}"`);

    return proto[operationName][OPERATION];
  }

  /** Iterates the operations of a gateway definition. */
  public static forEach(gateway: GatewayDefinition, callback: (operation: GatewayOperation) => void): void {
    Object.getOwnPropertyNames(gateway.prototype).forEach((operationName) => {
      if (operationName === "constructor")
        return;

      callback((gateway.prototype as any)[operationName][OPERATION]);
    });
  }

  /** The gateway definition for this operation. */
  public readonly gateway: GatewayDefinition;

  /** The name of this operation. */
  public readonly name: string;

  /** The version of this operation. */
  public version: string = "0.0.0";

  /** The policy for this operation. */
  public policy: GatewayOperationPolicy;

  /** @hidden @internal */
  public constructor(gateway: GatewayDefinition, operation: string, policy: GatewayOperationPolicy) {
    this.gateway = gateway;
    this.name = operation;
    this.policy = policy;
  }
}

export namespace GatewayOperation {
  /** Decorator for setting the policy for a gateway operation function. */
  export function setPolicy(policy: GatewayOperationPolicy) {
    return <T extends Gateway>(target: T, propertyKey: string, descriptor: PropertyDescriptor) => {
      descriptor.value[OPERATION] = new GatewayOperation(target.constructor as any, propertyKey, policy);
    };
  }

  /** Decorator for setting the default policy for a gateway definition class. */
  export function setDefaultPolicy(policy: GatewayOperationPolicy) {
    return <T extends Gateway>(gatewayDefinition: GatewayDefinition<T>) => {
      (gatewayDefinition as any)[POLICY] = policy;
    };
  }
}
