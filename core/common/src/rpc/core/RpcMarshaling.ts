/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module RpcInterface */

// tslint:disable:no-string-literal

import { RpcRegistry } from "./RpcRegistry";
import { RpcOperation } from "./RpcOperation";
import { RpcProtocol } from "./RpcProtocol";
import { RpcConfiguration } from "./RpcConfiguration";
import { IModelError, BentleyStatus } from "../../IModelError";

let marshalingScope = "";

/** RPC interface type marshaling directives. */
export enum RpcMarshalingDirective {
  Name = "__name__",
  JSON = "__JSON__",
  Undefined = "__undefined__",
  Map = "__map__",
  Set = "__set__",
  Unregistered = "__unregistered__",
  Error = "__error__",
  ErrorName = "__error_name__",
  ErrorMessage = "__error_message__",
  ErrorStack = "__error_stack__",
}

/** @hidden */
export class RpcMarshaling {
  private constructor() { }

  /** Serializes a value. */
  public static serialize(operation: RpcOperation | string, _protocol: RpcProtocol | undefined, value: any) {
    if (typeof (value) === "undefined") {
      return "";
    }

    marshalingScope = typeof (operation) === "string" ? operation : operation.interfaceDefinition.name;
    return JSON.stringify(value, RpcMarshaling.marshal);
  }

  /** Deserializes a value. */
  public static deserialize(_operation: RpcOperation, _protocol: RpcProtocol | undefined, value: any) {
    if (value === "") {
      return undefined;
    }

    return JSON.parse(value, RpcMarshaling.unmarshal);
  }

  /** JSON.stringify replacer callback that marshals JavaScript class instances. */
  private static marshal(this: any, key: string, value: any) {
    if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
      throw new IModelError(BentleyStatus.ERROR, "Cannot serialize binary data.");
    }

    if (key === RpcMarshalingDirective.Name || key === RpcMarshalingDirective.Undefined || key === RpcMarshalingDirective.Unregistered) {
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
      const unregistered = !RpcRegistry.instance.types.has(name);

      if (custom) {
        return {
          [RpcMarshalingDirective.Name]: name,
          [RpcMarshalingDirective.JSON]: value,
          [RpcMarshalingDirective.Unregistered]: unregistered,
        };
      } else {
        if (value instanceof Map) {
          const elements = Array.from(value);
          return {
            [RpcMarshalingDirective.Name]: name,
            [RpcMarshalingDirective.Map]: elements,
            [RpcMarshalingDirective.Unregistered]: unregistered,
          };
        } else if (value instanceof Set) {
          const elements = Array.from(value);
          return {
            [RpcMarshalingDirective.Name]: name,
            [RpcMarshalingDirective.Set]: elements,
            [RpcMarshalingDirective.Unregistered]: unregistered,
          };
        } else {
          value[RpcMarshalingDirective.Name] = name;
          value[RpcMarshalingDirective.Unregistered] = unregistered;

          if (value instanceof Error) {
            (value as any)[RpcMarshalingDirective.Error] = true;

            const errorName = value.name;
            value.name = "";

            const errorMessage = value.message;
            value.message = "[Backend to Frontend Transition]";

            let stack = value.stack;
            if (typeof (stack) === "undefined")
              stack = "[Backend to Frontend Transition]\n[Backend Implementation]";

            (value as any)[RpcMarshalingDirective.ErrorStack] = stack;

            value.message = errorMessage;
            (value as any)[RpcMarshalingDirective.ErrorMessage] = value.message;

            value.name = errorName;
            (value as any)[RpcMarshalingDirective.ErrorName] = value.name;
          }

          const undefineds = [];
          for (const prop in value) {
            if (value.hasOwnProperty(prop) && value[prop] === undefined)
              undefineds.push(prop);
          }

          if (undefineds.length)
            value[RpcMarshalingDirective.Undefined] = undefineds;
        }
      }
    }

    return value;
  }

  /** JSON.parse reviver callback that unmarshals JavaScript class instances. */
  private static unmarshal(_key: string, value: any) {
    if (typeof (value) === "object" && value !== null && value[RpcMarshalingDirective.Name]) {
      const name: string = value[RpcMarshalingDirective.Name];
      delete value[RpcMarshalingDirective.Name];

      if (RpcConfiguration.strictMode && value[RpcMarshalingDirective.Unregistered]) {
        const [className, typeName] = name.split("_", 2);
        throw new Error(`Cannot unmarshal type "${typeName} for this RPC interface. Ensure this type is listed in ${className}.types or suppress using RpcConfiguration.strictMode.`);
      }

      delete value[RpcMarshalingDirective.Unregistered];

      const type = RpcRegistry.instance.types.get(name);

      const customJSON = value[RpcMarshalingDirective.JSON];
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
        const mapInit = value[RpcMarshalingDirective.Map];
        const setInit = value[RpcMarshalingDirective.Set];
        if (mapInit) {
          return new Map(mapInit);
        } else if (setInit) {
          return new Set(setInit);
        } else {
          const undefineds = value[RpcMarshalingDirective.Undefined];
          if (undefineds)
            delete value[RpcMarshalingDirective.Undefined];

          const isError = value[RpcMarshalingDirective.Error];
          delete value[RpcMarshalingDirective.Error];

          const errorName = value[RpcMarshalingDirective.ErrorName];
          delete value[RpcMarshalingDirective.ErrorName];

          const errorMessage = value[RpcMarshalingDirective.ErrorMessage];
          delete value[RpcMarshalingDirective.ErrorMessage];

          const errorStack = value[RpcMarshalingDirective.ErrorStack];
          delete value[RpcMarshalingDirective.ErrorStack];

          const descriptors: { [index: string]: PropertyDescriptor } = {};
          const props = Object.keys(value);
          for (const prop of props)
            descriptors[prop] = Object.getOwnPropertyDescriptor(value, prop) as PropertyDescriptor;

          if (isError) {
            if (!descriptors.hasOwnProperty("name")) {
              descriptors["name"] = { configurable: true, enumerable: true, writable: true, value: errorName };
            }

            if (!descriptors.hasOwnProperty("message")) {
              descriptors["message"] = { configurable: true, enumerable: true, writable: true, value: errorMessage };
            }

            if (!descriptors.hasOwnProperty("stack")) {
              descriptors["stack"] = { configurable: true, enumerable: true, writable: true, value: errorStack };
            }
          }

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
