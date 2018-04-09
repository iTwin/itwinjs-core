/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Gateway, GatewayImplementation, GatewayDefinition } from "../../Gateway";
import { GatewayDirectProtocol } from "./GatewayConfiguration";
import { GatewayOperation, GatewayOperationPolicy } from "./GatewayOperation";
import { IModelError } from "../../IModelError";
import { BentleyStatus } from "@bentley/bentleyjs-core/lib/Bentley";

// tslint:disable:ban-types

/** @hidden @internal */
export const REGISTRY = Symbol.for("@bentley/imodeljs-common/GatewayRegistry");

/** @hidden @internal */
export const OPERATION = Symbol.for("@bentley/imodeljs-common/GatewayOperation");

/** @hidden @internal */
export const POLICY = Symbol.for("@bentley/imodeljs-common/GatewayOperationPolicy");

/** @hidden @internal */
export const INSTANCE = Symbol.for("@bentley/imodeljs-common/Gateway/__instance__");

/** @hidden @internal */
export class GatewayRegistry {
  private static _instance: GatewayRegistry;

  private constructor() {
  }

  public static get instance() {
    if (!GatewayRegistry._instance) {
      const globalObj: any = typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {};
      if (!globalObj[REGISTRY])
        globalObj[REGISTRY] = new GatewayRegistry();

      GatewayRegistry._instance = globalObj[REGISTRY];
    }

    return GatewayRegistry._instance;
  }

  public lookupGatewayDefinition(name: string): GatewayDefinition {
    if (!GatewayRegistry.instance.definitionClasses.has(name))
      throw new IModelError(BentleyStatus.ERROR, `Gateway "${name}" is not initialized.`);

    return this.definitionClasses.get(name) as GatewayDefinition;
  }

  public getProxyForGateway<T extends Gateway>(definition: GatewayDefinition<T>): T {
    const instance = this.proxies.get(definition.name) as T;
    if (!instance)
      throw new IModelError(BentleyStatus.ERROR, `Gateway proxy for "${definition.name}" is not initialized.`);

    return instance;
  }

  public getImplementationForGateway<T extends Gateway>(definition: GatewayDefinition<T>): T {
    if (!this.implementationClasses.has(definition.name))
      throw new IModelError(BentleyStatus.ERROR, `Gateway implementation for "${definition.name}" is not registered.`);

    const instance = this.implementations.get(definition.name) as T;
    if (!instance)
      throw new IModelError(BentleyStatus.ERROR, `Gateway implementation for "${definition.name}" is not initialized.`);

    return instance;
  }

  public registerImplementation<TDefinition extends Gateway, TImplementation extends TDefinition>(definition: GatewayDefinition<TDefinition>, implementation: GatewayImplementation<TImplementation>) {
    if (this.implementationClasses.has(definition.name))
      throw new IModelError(BentleyStatus.ERROR, `Gateway "${definition.name}" is already registered.`);

    this.implementationClasses.set(definition.name, implementation);
  }

  public initializeGateway<T extends Gateway>(definition: GatewayDefinition<T>) {
    let directProtocol = false;

    if (this.definitionClasses.has(definition.name))
      throw new IModelError(BentleyStatus.ERROR, `Gateway "${definition.name}" is already initialized.`);

    this.definitionClasses.set(definition.name, definition);

    Object.getOwnPropertyNames(definition.prototype).forEach((operationName) => {
      if (operationName === "constructor")
        return;

      const proto = (definition.prototype as any);
      if (!proto[operationName][OPERATION]) {
        const policy = (definition as any)[POLICY] || new GatewayOperationPolicy();
        proto[operationName][OPERATION] = new GatewayOperation(definition, operationName, policy);
      }
    });

    definition.types().forEach((type) => {
      const name = `${definition.name}_${type.name}`;
      if (this.types.has(name))
        throw new IModelError(BentleyStatus.ERROR, `Class "${name}" is already registered for gateway type marshaling.`);

      this.types.set(name, type);
    });

    const registeredImplementation = this.implementationClasses.get(definition.name) as GatewayImplementation<T>;
    if (registeredImplementation) {
      if (this.implementations.has(definition.name))
        throw new IModelError(BentleyStatus.ERROR, `Gateway implementation for "${definition.name}" is already initialized.`);

      if (definition.prototype.configurationSupplier)
        registeredImplementation.prototype.configurationSupplier = definition.prototype.configurationSupplier;

      const implementation = new registeredImplementation();
      this.implementations.set(definition.name, implementation);
      directProtocol = implementation.configuration.protocol instanceof GatewayDirectProtocol;
    }

    if (!registeredImplementation || directProtocol) {
      if (this.proxies.has(definition.name))
        throw new IModelError(BentleyStatus.ERROR, `Gateway proxy for "${definition.name}" is already initialized.`);

      const proxy = new (definition as any)();
      this.proxies.set(definition.name, proxy);

      Object.getOwnPropertyNames(definition.prototype).forEach((operationName) => {
        if (operationName === "constructor")
          return;

        proxy[operationName] = proxy[operationName].bind(proxy, operationName);
      });
    }
  }

  public definitionClasses: Map<string, GatewayDefinition> = new Map();
  public proxies: Map<string, Gateway> = new Map();
  public implementations: Map<string, Gateway> = new Map();
  public implementationClasses: Map<string, GatewayImplementation> = new Map();
  public types: Map<string, Function> = new Map();

  public id = (() => {
    let i = 0;
    return () => ++i;
  })();
}
