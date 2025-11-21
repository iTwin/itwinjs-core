/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Metadata
 */

import { PrimitiveType } from "./ECObjects";
import { ECSchemaError, ECSchemaStatus } from "./Exception";

enum PropertyFlags {
  Primitive = 0x01,
  Struct = 0x02,
  Array = 0x04,
  Navigation = 0x08,
  Enumeration = 0x10,
}

/**
 * @public @preview
 */
export enum PropertyType {
  Struct = 0x02, // PropertyFlags.Struct
  Struct_Array = 0x06, // PropertyFlags.Struct | PropertyFlags.Array
  Navigation = 0x08, // PropertyFlags.Navigation
  Binary = 0x101, // PrimitiveType.Binary
  Binary_Array = 0x105, // PrimitiveType.Binary | PropertyFlags.Array
  Boolean = 0x201, // PrimitiveType.Boolean
  Boolean_Array = 0x205, // PrimitiveType.Boolean | PropertyFlags.Array
  DateTime = 0x301, // PrimitiveType.DateTime
  DateTime_Array = 0x305, // PrimitiveType.DateTime | PropertyFlags.Array
  Double = 0x401, // PrimitiveType.Double
  Double_Array = 0x405, // PrimitiveType.Double | PropertyFlags.Array
  Integer = 0x501, // PrimitiveType.Integer
  Integer_Array = 0x505, // PrimitiveType.Integer | PropertyFlags.Array
  Integer_Enumeration = 0x511, // PrimitiveType.Integer | PropertyFlags.Enumeration
  Integer_Enumeration_Array = 0x515, // PrimitiveType.Integer | PropertyFlags.Enumeration | PropertyFlags.Array
  Long = 0x601, // PrimitiveType.Long
  Long_Array = 0x605, // PrimitiveType.Long | PropertyFlags.Array
  Point2d = 0x701, // PrimitiveType.Point2d
  Point2d_Array = 0x705, // PrimitiveType.Point2d | PropertyFlags.Array
  Point3d = 0x801, // PrimitiveType.Point3d
  Point3d_Array = 0x805, // PrimitiveType.Point3d | PropertyFlags.Array
  String = 0x901, // PrimitiveType.String
  String_Array = 0x905, // PrimitiveType.String | PropertyFlags.Array
  String_Enumeration = 0x911, // PrimitiveType.String | PropertyFlags.Enumeration
  String_Enumeration_Array = 0x915, // PrimitiveType.String | PropertyFlags.Enumeration | PropertyFlags.Array
  IGeometry = 0xA01, // PrimitiveType.IGeometry
  IGeometry_Array = 0xA05, // PrimitiveType.IGeometry | PropertyFlags.Array
}

/** @internal */
export namespace PropertyTypeUtils {
  export function isArray(type: PropertyType) {
    return (type === (PropertyFlags.Array | type));
  }
  export function isPrimitive(type: PropertyType) {
    return (type === (PropertyFlags.Primitive | type));
  }
  export function isStruct(type: PropertyType) {
    return (type === (PropertyFlags.Struct | type));
  }
  export function isNavigation(type: PropertyType) {
    return (type === (PropertyFlags.Navigation | type));
  }
  export function isEnumeration(type: PropertyType) {
    return (type === (PropertyFlags.Enumeration | type));
  }
  export function asArray(type: PropertyType): PropertyType {
    return type | PropertyFlags.Array;
  }
  export function getPrimitiveType(type: PropertyType): PrimitiveType {
    return (0xFF01 & type);
  }
  export function fromPrimitiveType(type: PrimitiveType): PropertyType {
    return type| 0;
  }
}

/** @internal */
export function propertyTypeToString(type: PropertyType) {
  if (PropertyTypeUtils.isPrimitive(type))
    return (PropertyTypeUtils.isArray(type)) ? "PrimitiveArrayProperty" : "PrimitiveProperty";
  if (PropertyTypeUtils.isStruct(type))
    return (PropertyTypeUtils.isArray(type)) ? "StructArrayProperty" : "StructProperty";
  if (PropertyTypeUtils.isNavigation(type))
    return "NavigationProperty";
  throw new ECSchemaError(ECSchemaStatus.InvalidType, "Invalid propertyType");
}
