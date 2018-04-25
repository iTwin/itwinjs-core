/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Gateway */

import { GatewayRegistry } from "./GatewayRegistry";
import { GatewayOperation } from "./GatewayOperation";
import { GatewayProtocol } from "./GatewayProtocol";

let marshalingScope = "";

/** Gateway type marshaling directives. */
export enum GatewayMarshalingDirective {
  Name = "__name__",
  JSON = "__JSON__",
  Undefined = "__undefined__",
  Map = "__map__",
  Set = "__set__",
  Unregistered = "__unregistered__",
}

/** @hidden @internal */
export class GatewayMarshaling {
  private constructor() { }

  /** Serializes a value. */
  public static serialize(operation: GatewayOperation, _protocol: GatewayProtocol, value: any) {
    marshalingScope = operation.gateway.name;
    return JSON.stringify(value, GatewayMarshaling.marshal);
  }

  /** Deserializes a value. */
  public static deserialize(_operation: GatewayOperation, _protocol: GatewayProtocol, value: any) {
    if (value === "") {
      return undefined;
    }

    return JSON.parse(value, GatewayMarshaling.unmarshal);
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
      const name = `${marshalingScope}_${originalValue.constructor.name}`;
      const unregistered = !GatewayRegistry.instance.types.has(name);

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

      const type = GatewayRegistry.instance.types.get(name);

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
