/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

import { RpcInterface, RpcInterfaceImplementation, RpcInterfaceDefinition } from "../../RpcInterface";
import { RpcInterfaceEndpoints } from "../../RpcManager";
import { RpcOperation, RpcOperationPolicy } from "./RpcOperation";
import { RpcControlChannel } from "./RpcControl";
import { IModelError, ServerError } from "../../IModelError";
import { BentleyError, BentleyStatus } from "@bentley/bentleyjs-core";
import { RpcConfiguration } from "../../common";

// tslint:disable:ban-types

/** @hidden */
export const REGISTRY = Symbol.for("@bentley/imodeljs-common/RpcRegistry");

/** @hidden */
export const OPERATION = Symbol.for("@bentley/imodeljs-common/RpcOperation");

/** @hidden */
export const POLICY = Symbol.for("@bentley/imodeljs-common/RpcOperationPolicy");

/** @hidden */
export const INSTANCE = Symbol.for("@bentley/imodeljs-common/RpcInterface/__instance__");

/** @hidden */
export const CURRENT_REQUEST = Symbol.for("@bentley/imodeljs-common/RpcRequest/__current__");

/** @hidden */
export const CURRENT_INVOCATION = Symbol.for("@bentley/imodeljs-common/RpcInvocation/__current__");

/** @hidden */
export const builtins: string[] = [];

/** @hidden */
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
    if (!this.definitionClasses.has(name))
      throw new IModelError(BentleyStatus.ERROR, `RPC interface "${name}" is not initialized.`);

    return this.definitionClasses.get(name) as RpcInterfaceDefinition;
  }

  public describeAvailableEndpoints(): Promise<RpcInterfaceEndpoints[]> {
    const requests: Array<Promise<RpcInterfaceEndpoints[]>> = [];
    for (const channel of RpcControlChannel.channels) {
      requests.push(channel.describeEndpoints());
    }

    return Promise.all(requests).then((responses) => {
      const endpoints = responses.reduce((a, b) => a.concat(b), []);
      for (const endpoint of endpoints) {
        const definition = this.definitionClasses.get(endpoint.interfaceName);
        endpoint.compatible = (definition && definition.version === endpoint.interfaceVersion) ? true : false;
      }

      return endpoints;
    });
  }

  public getClientForInterface<T extends RpcInterface>(definition: RpcInterfaceDefinition<T>): T {
    let instance = this.proxies.get(definition.name) as (T | undefined);
    if (!instance)
      instance = this.instantiateClient(definition);

    return instance;
  }

  public getImplForInterface<T extends RpcInterface>(definition: RpcInterfaceDefinition<T>): T {
    let instance = this.implementations.get(definition.name) as (T | undefined);
    if (!instance)
      instance = this.instantiateImpl(definition);

    return instance;
  }

  public lookupImpl<T extends RpcInterface>(interfaceName: string): T {
    const definition = this.lookupInterfaceDefinition(interfaceName);
    return this.getImplForInterface(definition) as T;
  }

  public registerImpl<TDefinition extends RpcInterface, TImplementation extends TDefinition>(definition: RpcInterfaceDefinition<TDefinition>, implementation: RpcInterfaceImplementation<TImplementation>) {
    this.unregisterImpl(definition);
    this.implementationClasses.set(definition.name, implementation);
  }

  public unregisterImpl<TDefinition extends RpcInterface>(definition: RpcInterfaceDefinition<TDefinition>) {
    this.implementationClasses.delete(definition.name);

    const impl = this.implementations.get(definition.name);
    if (impl) {
      impl.configuration.onRpcImplTerminated(definition, impl);
      this.implementations.delete(definition.name);
    }
  }

  public supplyImplInstance<TDefinition extends RpcInterface, TImplementation extends TDefinition>(definition: RpcInterfaceDefinition<TDefinition>, instance: TImplementation): void {
    this.suppliedImplementations.set(definition.name, instance);
  }

  public isRpcInterfaceInitialized<T extends RpcInterface>(definition: RpcInterfaceDefinition<T>): boolean {
    return this.definitionClasses.has(definition.name);
  }

  public initializeRpcInterface<T extends RpcInterface>(definition: RpcInterfaceDefinition<T>): void {
    if (this.definitionClasses.has(definition.name))
      return;

    this.definitionClasses.set(definition.name, definition);
    this.configureOperations(definition);
    this.registerTypes(definition);
  }

  public terminateRpcInterface<T extends RpcInterface>(definition: RpcInterfaceDefinition<T>) {
    this.purgeTypes(definition);
    this.unregisterImpl(definition);
    this.purgeClient(definition);
    this.definitionClasses.delete(definition.name);
  }

  public definitionClasses: Map<string, RpcInterfaceDefinition> = new Map();
  public proxies: Map<string, RpcInterface> = new Map();
  public implementations: Map<string, RpcInterface> = new Map();
  public suppliedImplementations: Map<string, RpcInterface> = new Map();
  public implementationClasses: Map<string, RpcInterfaceImplementation> = new Map();
  public types: Map<string, Function> = new Map();

  public id = (() => {
    let i = 0;
    return () => ++i;
  })();

  private instantiateImpl<TDefinition extends RpcInterface, TImplementation extends TDefinition>(definition: RpcInterfaceDefinition<TDefinition>): TImplementation {
    this.checkInitialized(definition);

    const registeredImplementation = this.implementationClasses.get(definition.name) as RpcInterfaceImplementation<TImplementation>;
    if (!registeredImplementation)
      throw new IModelError(BentleyStatus.ERROR, `An RPC interface implementation class for "${definition.name}" is not registered.`);

    if (definition.prototype.configurationSupplier)
      registeredImplementation.prototype.configurationSupplier = definition.prototype.configurationSupplier;

    const supplied = this.suppliedImplementations.get(definition.name);
    const implementation = supplied || new registeredImplementation();
    if (!(implementation instanceof registeredImplementation))
      throw new IModelError(BentleyStatus.ERROR, `Invalid RPC interface implementation.`);

    if (supplied) {
      (supplied.configuration as any) = RpcConfiguration.supply(supplied);
    }

    this.implementations.set(definition.name, implementation);
    implementation.configuration.onRpcImplInitialized(definition, implementation);
    return implementation;
  }

  private instantiateClient<T extends RpcInterface>(definition: RpcInterfaceDefinition<T>): T {
    this.checkInitialized(definition);

    const proxy = new (definition as any)() as T;
    this.proxies.set(definition.name, proxy);

    Object.getOwnPropertyNames(definition.prototype).forEach((operationName) => {
      if (operationName === "constructor" || operationName === "configurationSupplier")
        return;

      (proxy as any)[operationName] = (proxy as any)[operationName].bind(proxy, operationName);
    });

    proxy.configuration.onRpcClientInitialized(definition, proxy);
    return proxy;
  }

  private checkInitialized<T extends RpcInterface>(definition: RpcInterfaceDefinition<T>) {
    if (!this.definitionClasses.has(definition.name))
      throw new IModelError(BentleyStatus.ERROR, `RPC interface "${definition.name}" is not initialized.`);
  }

  private configureOperations<T extends RpcInterface>(definition: RpcInterfaceDefinition<T>) {
    const proto = (definition.prototype as any);

    for (const builtin of builtins) {
      const propertyName = Symbol.for(builtin);
      if (!proto[propertyName]) {
        proto[propertyName] = { [OPERATION]: new RpcOperation(definition, builtin, new RpcOperationPolicy()) };
      }
    }

    Object.getOwnPropertyNames(definition.prototype).forEach((operationName) => {
      if (operationName === "constructor" || operationName === "configurationSupplier")
        return;

      const propertyName = RpcOperation.computeOperationName(operationName);

      if (!proto[propertyName][OPERATION]) {
        const policy = (definition as any)[POLICY] || new RpcOperationPolicy();
        proto[propertyName][OPERATION] = new RpcOperation(definition, propertyName, policy);
      }
    });
  }

  private registerTypes<T extends RpcInterface>(definition: RpcInterfaceDefinition<T>) {
    definition.types().forEach((type) => {
      this.registerType(definition, type, true);
    });

    for (const type of [Error, EvalError, RangeError, ReferenceError, SyntaxError, TypeError, URIError, BentleyError, IModelError, ServerError]) {
      this.registerType(definition, type, false);
    }
  }

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

  private purgeClient<T extends RpcInterface>(definition: RpcInterfaceDefinition<T>) {
    const proxy = this.proxies.get(definition.name);
    if (proxy) {
      proxy.configuration.onRpcClientTerminated(definition, proxy);
      this.proxies.delete(definition.name);
    }
  }

  private purgeTypes<T extends RpcInterface>(definition: RpcInterfaceDefinition<T>) {
    const keyPrefix = `${definition.name}_`;
    for (const key of this.types.keys()) {
      if (key.indexOf(keyPrefix) !== -1) {
        this.types.delete(key);
      }
    }
  }
}
