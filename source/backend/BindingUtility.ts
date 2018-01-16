/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { DbResult } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { PrimitiveTypeCode } from "./Entity";
import { IModelError } from "../common/IModelError";
import { XYAndZ, XAndY, XYZ } from "@bentley/geometry-core/lib/PointVector";

/** Value type (Match this to ECN::ValueKind in ECObjects.h) */
export const enum ValueKind {
  /** The ECValue has not be initialized yet */
  Uninitialized = 0x00,
  /** The ECValue holds a Primitive type */
  Primitive = 0x01,
  /** The ECValue holds a struct */
  Struct = 0x02,
  /** The ECValue holds an array */
  Array = 0x04,
  /** The ECValue holds a navigation type */
  Navigation = 0x08,
}

/**
 * ECValue invariant.
 */
export class ECValue {
  public kind: ValueKind;
  public type: PrimitiveTypeCode;
  public value: null | PrimitiveType | StructType | ArrayType;
}

/** Value types. */
export type PrimitiveType = string | number | boolean | XAndY | XYAndZ;
export interface StructType {
  [index: string]: ECValue;
}
export type ArrayType = ECValue[];

/** Types that can be used for binding paramter values */
export type BindingValue = null | PrimitiveType | ECValue | Id64;

/** Allows performing CRUD operations in an ECDb */
export class BindingUtility {

  private static getPrimitiveType(bindingValue: BindingValue): PrimitiveTypeCode {
    if (typeof bindingValue === "string")
      return PrimitiveTypeCode.String;
    if (typeof bindingValue === "number")
      return PrimitiveTypeCode.Double;
    if (typeof bindingValue === "boolean")
      return PrimitiveTypeCode.Boolean;
    if (XYZ.isXYAndZ(bindingValue))
      return PrimitiveTypeCode.Point3d;
    if (XYZ.isXAndY(bindingValue))
      return PrimitiveTypeCode.Point2d;

    return PrimitiveTypeCode.Uninitialized;
  }

  private static convertToECValue(bindingValue: BindingValue | undefined): ECValue | undefined {
    if (typeof bindingValue === "undefined")
      return undefined;

    if (!bindingValue)
      return { kind: ValueKind.Uninitialized, type: PrimitiveTypeCode.Uninitialized, value: null }; // explicit binding to null

    if (bindingValue instanceof ECValue)
      return bindingValue;

    if (bindingValue instanceof Id64)
      return { kind: ValueKind.Primitive, type: PrimitiveTypeCode.Long, value: bindingValue.value };

    const primitiveType = BindingUtility.getPrimitiveType(bindingValue);
    if (primitiveType === PrimitiveTypeCode.Uninitialized)
      return undefined;

    return { kind: ValueKind.Primitive, type: primitiveType, value: bindingValue };
  }

  /**
   * Helper utility to pre-process bindings to standardize them into a fixed format containing ECValue-s
   * @param bindings Array or map of bindings
   * @returns Array or map of ECValue-s.
   * @throws IModelError if a value cannot be converted to an ECValue.
   */
  public static preProcessBindings(bindings: Map<string, BindingValue> | BindingValue[] | any): ECValue[] | Map<string, ECValue> {
    if (bindings instanceof Array) {
      const ret = new Array<ECValue>();
      for (let ii = 0; ii < bindings.length; ii++) {
        const bindingValue = bindings[ii];
        const ecValue = BindingUtility.convertToECValue(bindingValue);
        if (!ecValue)
          throw new IModelError(DbResult.BE_SQLITE_ERROR, `Invalid binding [${ii}]=${bindingValue}`);
        ret.push(ecValue);
      }
      return ret;
    }

    // NB: We transform a Map into a vanilla object. That is so that can pass it to native code and/or across the wire via JSON. You can't stringify a Map.
    if (bindings instanceof Map) {
      const ret: any = new Object();
      for (const key of bindings.keys()) {
        const bindingValue = bindings.get(key);
        const ecValue = BindingUtility.convertToECValue(bindingValue);
        if (!ecValue)
          throw new IModelError(DbResult.BE_SQLITE_ERROR, `Invalid binding [${key}]=${bindingValue}`);
        ret[key] = ecValue;
      }
      return ret;
    }

    const ret2: any = new Object();
    Object.keys(bindings).forEach((key) => {
      const bindingValue = bindings[key];
      const ecValue = BindingUtility.convertToECValue(bindingValue);
      if (!ecValue)
        throw new Error(`Invalid binding [${key}]=${bindingValue}`);
      ret2[key] = ecValue;
    });

    return ret2;
    // return { error: { status: DbResult.BE_SQLITE_ERROR, message: `Bindings must be specified as an array or a map` } };
  }
}
