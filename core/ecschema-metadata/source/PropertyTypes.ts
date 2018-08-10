import { PrimitiveType } from "./ECObjects";
import { ECObjectsError, ECObjectsStatus } from "./Exception";

const enum PropertyFlags {
  Primitive = 0x01,
  Struct = 0x02,
  Array = 0x04,
  Navigation = 0x08,
  Enumeration = 0x10,
}

/**
 *
 */
export const enum PropertyType {
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

export namespace PropertyTypeUtils {
  export function isArray(t: PropertyType) { return (t === (PropertyFlags.Array | t)); }
  export function isPrimitive(t: PropertyType) { return (t === (PropertyFlags.Primitive | t)); }
  export function isStruct(t: PropertyType) { return (t === (PropertyFlags.Struct | t)); }
  export function isNavigation(t: PropertyType) { return (t === (PropertyFlags.Navigation | t)); }
  export function isEnumeration(t: PropertyType) { return (t === (PropertyFlags.Enumeration | t)); }
  export function asArray(t: PropertyType): PropertyType { return t | PropertyFlags.Array; }
  export function getPrimitiveType(t: PropertyType): PrimitiveType { return (0xFF01 & t); }
  export function fromPrimitiveType(t: PrimitiveType): PropertyType { return t | 0; }
}

export function propertyTypeToString(type: PropertyType) {
  if (PropertyTypeUtils.isPrimitive(type))
    return (PropertyTypeUtils.isArray(type)) ? "PrimitiveArrayProperty" : "PrimitiveProperty";
  if (PropertyTypeUtils.isStruct(type))
    return (PropertyTypeUtils.isArray(type)) ? "StructArrayProperty" : "StructProperty";
  if (PropertyTypeUtils.isNavigation(type))
    return "NavigationProperty";
  throw new ECObjectsError(ECObjectsStatus.InvalidType, "Invalid propertyType");
}
