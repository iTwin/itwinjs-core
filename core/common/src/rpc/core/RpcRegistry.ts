/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { RpcInterface, RpcInterfaceImplementation, RpcInterfaceDefinition } from "../../RpcInterface";
import { RpcDirectProtocol } from "./RpcConfiguration";
import { RpcOperation, RpcOperationPolicy } from "./RpcOperation";
import { IModelError, ServerError } from "../../IModelError";
import { BentleyError, BentleyStatus } from "@bentley/bentleyjs-core";

// tslint:disable:ban-types

/** @hidden @internal */
export const REGISTRY = Symbol.for("@bentley/imodeljs-common/RpcRegistry");

/** @hidden @internal */
export const OPERATION = Symbol.for("@bentley/imodeljs-common/RpcOperation");

/** @hidden @internal */
export const POLICY = Symbol.for("@bentley/imodeljs-common/RpcOperationPolicy");

/** @hidden @internal */
export const INSTANCE = Symbol.for("@bentley/imodeljs-common/RpcInterface/__instance__");

/** @hidden @internal */
export const CURRENT_REQUEST = Symbol.for("@bentley/imodeljs-common/RpcRequest/__current__");

/** @hidden @internal */
export const CURRENT_INVOCATION = Symbol.for("@bentley/imodeljs-common/RpcInvocation/__current__");

/** @hidden @internal */
export class RpcRegistry {
  private static _instance: RpcRegistry;

  private constructor() {
  }

  public static get instance() {
    if (!RpcRegistry._instance) {
      const globalObj: any = typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {};
      if (!globalObj[REGISTRY])
        globalObj[REGISTRY] = new RpcRegistry();

      RpcRegistry._instance = globalObj[REGISTRY];
    }

    return RpcRegistry._instance;
  }

  public lookupInterfaceDefinition(name: string): RpcInterfaceDefinition {
    if (!RpcRegistry.instance.definitionClasses.has(name))
      throw new IModelError(BentleyStatus.ERROR, `RPC interface "${name}" is not initialized.`);

    return this.definitionClasses.get(name) as RpcInterfaceDefinition;
  }

  public getClientForInterface<T extends RpcInterface>(definition: RpcInterfaceDefinition<T>): T {
    const instance = this.proxies.get(definition.name) as T;
    if (!instance)
      throw new IModelError(BentleyStatus.ERROR, `RPC interface client for "${definition.name}" is not initialized.`);

    return instance;
  }

  public getImplementationForInterface<T extends RpcInterface>(definition: RpcInterfaceDefinition<T>): T {
    if (!this.implementationClasses.has(definition.name))
      throw new IModelError(BentleyStatus.ERROR, `RPC interface implementation for "${definition.name}" is not registered.`);

    const instance = this.implementations.get(definition.name) as T;
    if (!instance)
      throw new IModelError(BentleyStatus.ERROR, `RPC interface implementation for "${definition.name}" is not initialized.`);

    return instance;
  }

  public registerImplementation<TDefinition extends RpcInterface, TImplementation extends TDefinition>(definition: RpcInterfaceDefinition<TDefinition>, implementation: RpcInterfaceImplementation<TImplementation>) {
    if (this.implementationClasses.has(definition.name))
      throw new IModelError(BentleyStatus.ERROR, `RPC interface "${definition.name}" is already registered.`);

    this.implementationClasses.set(definition.name, implementation);
  }

  public setImplementationInstance<TDefinition extends RpcInterface, TImplementation extends TDefinition>(definition: RpcInterfaceDefinition<TDefinition>, instance?: TImplementation): TImplementation {
    const registeredImplementation = this.implementationClasses.get(definition.name) as RpcInterfaceImplementation<TImplementation>;
    if (!registeredImplementation)
      throw new IModelError(BentleyStatus.ERROR, `An RPC interface implementation class for "${definition.name}" is not registered.`);

    if (definition.prototype.configurationSupplier)
      registeredImplementation.prototype.configurationSupplier = definition.prototype.configurationSupplier;

    const implementation = instance || new registeredImplementation();
    if (!(implementation instanceof registeredImplementation))
      throw new IModelError(BentleyStatus.ERROR, `Invalid RPC interface implementation.`);

    this.implementations.set(definition.name, implementation);
    return implementation;
  }

  public initializeRpcInterface<T extends RpcInterface>(definition: RpcInterfaceDefinition<T>) {
    let directProtocol = false;

    if (this.definitionClasses.has(definition.name))
      throw new IModelError(BentleyStatus.ERROR, `RPC interface "${definition.name}" is already initialized.`);

    this.definitionClasses.set(definition.name, definition);

    Object.getOwnPropertyNames(definition.prototype).forEach((operationName) => {
      if (operationName === "constructor")
        return;

      const proto = (definition.prototype as any);
      if (!proto[operationName][OPERATION]) {
        const policy = (definition as any)[POLICY] || new RpcOperationPolicy();
        proto[operationName][OPERATION] = new RpcOperation(definition, operationName, policy);
      }
    });

    definition.types().forEach((type) => {
      this.registerType(definition, type, true);
    });

    for (const type of [Error, EvalError, RangeError, ReferenceError, SyntaxError, TypeError, URIError, BentleyError, IModelError, ServerError]) {
      this.registerType(definition, type, false);
    }

    const registeredImplementation = this.implementationClasses.get(definition.name) as RpcInterfaceImplementation<T>;
    if (registeredImplementation) {
      const implementation = this.setImplementationInstance(definition);
      directProtocol = implementation.configuration.protocol instanceof RpcDirectProtocol;
      implementation.configuration.onRpcImplInitialized(definition, implementation);
    }

    if (!registeredImplementation || directProtocol) {
      if (this.proxies.has(definition.name))
        throw new IModelError(BentleyStatus.ERROR, `RPC interface client for "${definition.name}" is already initialized.`);

      const proxy = new (definition as any)() as T;
      this.proxies.set(definition.name, proxy);

      Object.getOwnPropertyNames(definition.prototype).forEach((operationName) => {
        if (operationName === "constructor")
          return;

        (proxy as any)[operationName] = (proxy as any)[operationName].bind(proxy, operationName);
      });

      proxy.configuration.onRpcClientInitialized(definition, proxy);
    }
  }

  public definitionClasses: Map<string, RpcInterfaceDefinition> = new Map();
  public proxies: Map<string, RpcInterface> = new Map();
  public implementations: Map<string, RpcInterface> = new Map();
  public implementationClasses: Map<string, RpcInterfaceImplementation> = new Map();
  public types: Map<string, Function> = new Map();

  public id = (() => {
    let i = 0;
    return () => ++i;
  })();

  private registerType(definition: RpcInterfaceDefinition, type: Function, throwIfRegistered: boolean) {
    const name = `${definition.name}_${type.name}`;
    if (this.types.has(name)) {
      if (throwIfRegistered)
        throw new IModelError(BentleyStatus.ERROR, `Class "${name}" is already registered for RPC interface type marshaling.`);
      else
        return;
    }

    this.types.set(name, type);
  }
}
