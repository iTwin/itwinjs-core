/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { DbResult } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { BentleyReturn } from "@bentley/bentleyjs-core/lib/Bentley";

/** ECPrimitive types (Match this to ECN::PrimitiveType in ECObjects.h) */
export const enum PrimitiveTypeCode {
  Uninitialized = 0x00,
  Binary = 0x101,
  Boolean = 0x201,
  DateTime = 0x301,
  Double = 0x401,
  Integer = 0x501,
  Long = 0x601,
  Point2d = 0x701,
  Point3d = 0x801,
  String = 0x901,
}

/** Value type  (Match this to ECN::ValueKind in ECObjects.h) */
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

/** ECValue invariant */
export class ECValue {
  public kind: ValueKind;
  public type: PrimitiveTypeCode;
  public value: null | PrimitiveType | StructType | ArrayType;
}

/** Value types */
export interface Point2dType { x: number; y: number; }
export interface Point3dType { x: number; y: number; z: number; }
export type PrimitiveType = string | number | boolean | Point2dType | Point3dType;
export interface StructType {
  [index: string]: ECValue;
}
export type ArrayType = ECValue[];

/** Types that can be used for binding paramter values */
export type BindingValue = null | PrimitiveType | ECValue;

/** Custom type guard for Point2dType  */
export function isPoint2dType(arg: any): arg is Point2dType {
  return arg.x !== undefined && arg.y !== undefined && arg.z === undefined;
}

/** Custom type guard for Point3dType  */
export function isPoint3dType(arg: any): arg is Point3dType {
  return arg.x !== undefined && arg.y !== undefined && arg.z !== undefined;
}

/** Allows performing CRUD operations in an ECDb */
export class BindingUtility {

  private static getPrimitiveType(bindingValue: BindingValue): PrimitiveTypeCode {
    if (typeof bindingValue === "string")
      return PrimitiveTypeCode.String;
    if (typeof bindingValue === "number")
      return PrimitiveTypeCode.Integer;
    if (typeof bindingValue === "boolean")
      return PrimitiveTypeCode.Boolean;
    if (isPoint2dType(bindingValue))
      return PrimitiveTypeCode.Point2d;
    if (isPoint3dType(bindingValue))
      return PrimitiveTypeCode.Point3d;

    return PrimitiveTypeCode.Uninitialized;
  }

  private static convertToECValue(bindingValue: BindingValue | undefined): ECValue | undefined {
    if (typeof bindingValue === "undefined")
      return undefined;

    if (!bindingValue)
      return { kind: ValueKind.Uninitialized, type: PrimitiveTypeCode.Uninitialized, value: null }; // explicit binding to null

    if (bindingValue instanceof ECValue)
      return bindingValue;

    const primitiveType = BindingUtility.getPrimitiveType(bindingValue);
    if (primitiveType === PrimitiveTypeCode.Uninitialized)
      return undefined;

    return { kind: ValueKind.Primitive, type: primitiveType, value: bindingValue };
  }

  /**
   * Helper utility to pre-process bindings to standardize them into a fixed format containing ECValue-s
   * @param bindings Array or map of bindings
   * @return Array or map of ECValue-s.
   */
  public static preProcessBindings(bindings: Map<string, BindingValue> | BindingValue[]): BentleyReturn<DbResult, ECValue[] | Map<string, ECValue>> {
    if (bindings instanceof Array) {
      const ret = new Array<ECValue>();
      for (let ii = 0; ii < bindings.length; ii++) {
        const bindingValue = bindings[ii];
        const ecValue = BindingUtility.convertToECValue(bindingValue);
        if (!ecValue)
          return { error: { status: DbResult.BE_SQLITE_ERROR, message: `Invalid binding [${ii}]=${bindingValue}` } };
        ret.push(ecValue);
      }
      return { result: ret };
    }

    if (bindings instanceof Map) {
      const ret = new Map<string, ECValue>();
      for (const key of bindings.keys()) {
        const bindingValue = bindings.get(key);
        const ecValue = BindingUtility.convertToECValue(bindingValue);
        if (!ecValue)
          return { error: { status: DbResult.BE_SQLITE_ERROR, message: `Invalid binding [${key}]=${bindingValue}` } };
        ret.set(key, ecValue);
      }
      return { result: ret };
    }

    return { error: { status: DbResult.BE_SQLITE_ERROR, message: `Bindings must be specified as an array or a map` } };
  }
}
