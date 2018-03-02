/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Gateway, GatewayImplementation, GatewayDefinition } from "../Gateway";
import { GatewayConfiguration } from "./GatewayConfiguration";
import { IModelError } from "../IModelError";
import { BentleyStatus } from "@bentley/bentleyjs-core";

/**
 * Global store of gateway parameters.
 * @private
 * @hidden
 */
export class GatewayRegistry {
  private static _instance: GatewayRegistry;
  private _token: symbol;

  private constructor(token: symbol) {
    this._token = token;
  }

  public static instance(token: symbol) {
    if (!GatewayRegistry._instance) {
      const globalObj: any = typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {};

      if (!globalObj[token])
        globalObj[token] = new GatewayRegistry(token);

      GatewayRegistry._instance = globalObj[token];
    }

    const instance = GatewayRegistry._instance;
    if (instance._token !== token)
      throw new IModelError(BentleyStatus.ERROR, "Gateway registry is invalid.");

    return instance;
  }

  public proxies: Map<string, Gateway> = new Map();
  public implementations: Map<string, Gateway> = new Map();
  public implementationClasses: Map<string, GatewayImplementation> = new Map();
  // tslint:disable-next-line:ban-types
  public types: Map<string, Function> = new Map();
}

const registry = GatewayRegistry.instance(Symbol.for("@bentley/imodeljs-core/common/Gateway"));

/** Gateway type marshaling directives. */
export enum GatewayMarshalingDirective {
  Name = "__name__",
  JSON = "__JSON__",
  Undefined = "__undefined__",
  Map = "__map__",
  Set = "__set__",
  Unregistered = "__unregistered__",
}

/** An application protocol for a gateway. */
export abstract class GatewayProtocol {
  private static marshalingScope = "";

  /** The configuration for the protocol. */
  public configuration: GatewayConfiguration;

  /** Creates a protocol. */
  public constructor(configuration: GatewayConfiguration) {
    this.configuration = configuration;
  }

  /** Obtains the implementation result for a gateway operation. */
  public abstract obtainGatewayImplementationResult<T>(gateway: GatewayDefinition, operation: string, ...parameters: any[]): Promise<T>;

  /** Serializes a gateway operation value. */
  public serializeOperationValue(gatewayName: string, value: any) {
    GatewayProtocol.marshalingScope = gatewayName;
    return JSON.stringify(value, GatewayProtocol.marshal);
  }

  /** Deserializes a gateway operation value. */
  public deserializeOperationValue(value: any) {
    return (value === "") ? undefined : JSON.parse(value, GatewayProtocol.unmarshal);
  }

  /** Records a gateway operation response. */
  protected static recordOperationResponse() {
    Gateway.recordResponse();
  }

  /** JSON.stringify replacer callback that marshals JavaScript class instances. */
  private static marshal(this: any, key: string, value: any) {
    if (key === GatewayMarshalingDirective.Name || key === GatewayMarshalingDirective.Undefined || key === GatewayMarshalingDirective.Unregistered) {
      delete this[key];
    }

    let originalValue = value;
    let custom = false;
    if (this[key] !== value && (typeof (value) !== "object" || value === null || Array.isArray(value))) {
      custom = true;
      originalValue = this[key];
    }

    if (typeof (originalValue) === "object" && originalValue !== null && !Array.isArray(originalValue) && originalValue.constructor !== Object) {
      const name = `${GatewayProtocol.marshalingScope}_${originalValue.constructor.name}`;
      const unregistered = !registry.types.has(name);

      if (custom) {
        return {
          [GatewayMarshalingDirective.Name]: name,
          [GatewayMarshalingDirective.JSON]: value,
          [GatewayMarshalingDirective.Unregistered]: unregistered,
        };
      } else {
        if (value instanceof Map) {
          const elements = Array.from(value);
          return {
            [GatewayMarshalingDirective.Name]: name,
            [GatewayMarshalingDirective.Map]: elements,
            [GatewayMarshalingDirective.Unregistered]: unregistered,
          };
        } else if (value instanceof Set) {
          const elements = Array.from(value);
          return {
            [GatewayMarshalingDirective.Name]: name,
            [GatewayMarshalingDirective.Set]: elements,
            [GatewayMarshalingDirective.Unregistered]: unregistered,
          };
        } else {
          value[GatewayMarshalingDirective.Name] = name;
          value[GatewayMarshalingDirective.Unregistered] = unregistered;

          const undefineds = [];
          for (const prop in value) {
            if (value.hasOwnProperty(prop) && value[prop] === undefined)
              undefineds.push(prop);
          }

          if (undefineds.length)
            value[GatewayMarshalingDirective.Undefined] = undefineds;
        }
      }
    }

    return value;
  }

  /** JSON.parse reviver callback that unmarshals JavaScript class instances. */
  private static unmarshal(_key: string, value: any) {
    if (typeof (value) === "object" && value !== null && value[GatewayMarshalingDirective.Name]) {
      const name = value[GatewayMarshalingDirective.Name];
      delete value[GatewayMarshalingDirective.Name];

      delete value[GatewayMarshalingDirective.Unregistered]; // may use this information later

      const type = registry.types.get(name);

      const customJSON = value[GatewayMarshalingDirective.JSON];
      if (customJSON) {
        if (type) {
          const typeFromJSON = (type as any).fromJSON;
          if (typeFromJSON)
            return typeFromJSON(customJSON);
          else
            return new (type as any)(customJSON);
        } else {
          return customJSON;
        }
      } else {
        const mapInit = value[GatewayMarshalingDirective.Map];
        const setInit = value[GatewayMarshalingDirective.Set];
        if (mapInit) {
          return new Map(mapInit);
        } else if (setInit) {
          return new Set(setInit);
        } else {
          const undefineds = value[GatewayMarshalingDirective.Undefined];
          if (undefineds)
            delete value[GatewayMarshalingDirective.Undefined];

          const descriptors: { [index: string]: PropertyDescriptor } = {};
          const props = Object.keys(value);
          for (const prop of props)
            descriptors[prop] = Object.getOwnPropertyDescriptor(value, prop) as PropertyDescriptor;

          if (undefineds) {
            for (const prop of undefineds)
              descriptors[prop] = { configurable: true, enumerable: true, writable: true, value: undefined };
          }

          return Object.create(type ? type.prototype : Object.prototype, descriptors);
        }
      }
    }

    return value;
  }
}

/** Direct function call protocol within a single JavaScript context (suitable for testing). */
export class GatewayDirectProtocol extends GatewayProtocol {
  public obtainGatewayImplementationResult<T>(gateway: GatewayDefinition, operation: string, ...parameters: any[]): Promise<T> {
    return new Promise<T>(async (resolve, reject) => {
      try {
        const impl = Gateway.getImplementationForGateway(gateway);
        const result = await impl.invoke<T>(operation, ...parameters);
        GatewayProtocol.recordOperationResponse();
        resolve(result);
      } catch (e) {
        GatewayProtocol.recordOperationResponse();
        reject(e);
      }
    });
  }
}
