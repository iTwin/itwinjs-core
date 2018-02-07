import { LazyLoadedEnumeration, LazyLoadedStructClass, LazyLoadedRelationshipClass } from "./Interfaces";
import { PrimitiveType, SchemaChildType } from "./ECObjects";

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
export const enum PropTypeId {
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

export type AnyStructPropTypeId = PropTypeId.Struct | PropTypeId.Struct_Array;
export type AnyEnumerationPropTypeId = PropTypeId.Integer_Enumeration | PropTypeId.Integer_Enumeration_Array | PropTypeId.String_Enumeration | PropTypeId.String_Enumeration_Array;
export type AnyPrimitivePropTypeId = PropTypeId.Binary | PropTypeId.Binary_Array
  | PropTypeId.Boolean | PropTypeId.Boolean_Array
  | PropTypeId.DateTime | PropTypeId.DateTime_Array
  | PropTypeId.Double | PropTypeId.Double_Array
  | PropTypeId.Integer | PropTypeId.Integer_Array
  | PropTypeId.Long | PropTypeId.Long_Array
  | PropTypeId.Point2d | PropTypeId.Point2d_Array
  | PropTypeId.Point3d | PropTypeId.Point3d_Array
  | PropTypeId.String | PropTypeId.String_Array
  | PropTypeId.IGeometry | PropTypeId.IGeometry_Array;

class PropertyTypeImpl {
  protected _typeId: PropTypeId;
  public enumeration?: LazyLoadedEnumeration;
  public relationshipClass?: LazyLoadedRelationshipClass;
  public structClass?: LazyLoadedStructClass;

  constructor(typeId: PropTypeId, relatedType?: LazyLoadedEnumeration | LazyLoadedRelationshipClass | LazyLoadedStructClass) {
    this._typeId = typeId;

    if (relatedType) {
      switch (relatedType.type) {
        case SchemaChildType.Enumeration: this.enumeration = relatedType; return;
        case SchemaChildType.StructClass: this.structClass = relatedType; return;
        case SchemaChildType.RelationshipClass: this.relationshipClass = relatedType; return;
      }
    }
  }

  public get isArray() { return (this._typeId === (PropertyFlags.Array | this._typeId)); }
  public get isPrimitive() { return (this._typeId === (PropertyFlags.Primitive | this._typeId)); }
  public get isStruct() { return (this._typeId === (PropertyFlags.Struct | this._typeId)); }
  public get isNavigation() { return (this._typeId === (PropertyFlags.Navigation | this._typeId)); }
  public get isEnumeration() { return (this._typeId === (PropertyFlags.Enumeration | this._typeId)); }
  public get primitiveType(): PrimitiveType { return (0xFF01 & this._typeId); }
}

export interface NotArray {
  readonly isArray: false;
}

export interface IsArray {
  readonly isArray: true;
}

export interface PrimitivePropertyType {
  readonly isPrimitive: true;
  readonly isStruct: false;
  readonly isEnumeration: false;
  readonly isNavigation: false;
  readonly primitiveType: PrimitiveType;
}

export interface EnumerationPropertyType {
  readonly isPrimitive: false;
  readonly isStruct: false;
  readonly isEnumeration: true;
  readonly isNavigation: false;
  enumeration: LazyLoadedEnumeration;
}

export interface StructPropertyType {
  readonly isPrimitive: false;
  readonly isStruct: true;
  readonly isEnumeration: false;
  readonly isNavigation: false;
  structClass: LazyLoadedStructClass;
}

export interface NavigationPropertyType {
  readonly isPrimitive: false;
  readonly isStruct: false;
  readonly isEnumeration: false;
  readonly isNavigation: true;
  relationshipClass: LazyLoadedRelationshipClass;
}

export namespace PropertyType {

  export type Primitive = PrimitivePropertyType & NotArray;
  export type Enumeration = EnumerationPropertyType & NotArray;
  export type Struct = StructPropertyType & NotArray;
  export type Navigation = NavigationPropertyType & NotArray;

  export type PrimitiveArray = PrimitivePropertyType & IsArray;
  export type EnumerationArray = EnumerationPropertyType & IsArray;
  export type StructArray = StructPropertyType & IsArray;

  export type Any = Primitive | Enumeration | Struct | Navigation | PrimitiveArray | EnumerationArray | StructArray;

  export function createFromTypeId(typeId: AnyPrimitivePropTypeId): PropertyType.Primitive;
  export function createFromTypeId(typeId: AnyEnumerationPropTypeId, enumeration: LazyLoadedEnumeration): PropertyType.Enumeration;
  export function createFromTypeId(typeId: AnyStructPropTypeId, structClass: LazyLoadedStructClass): PropertyType.Struct;
  export function createFromTypeId(typeId: PropTypeId.Navigation, relationshipClass: LazyLoadedRelationshipClass): PropertyType.Navigation;
  export function createFromTypeId(typeId: PropTypeId, relatedType?: LazyLoadedEnumeration | LazyLoadedRelationshipClass | LazyLoadedStructClass): PropertyType.Any {
    return new PropertyTypeImpl(typeId, relatedType) as PropertyType.Any;
  }

  export function createPrimitive(primitiveType: PrimitiveType): PropertyType.Primitive {
    return new PropertyTypeImpl(primitiveType | 0) as PropertyType.Primitive;
  }

  export function createEnumeration(enumeration: LazyLoadedEnumeration): PropertyType.Enumeration {
    // TODO: Should we allow specifying the backing type?
    return new PropertyTypeImpl(PropTypeId.Integer_Enumeration, enumeration) as PropertyType.Enumeration;
  }

  export function createStruct(structClass: LazyLoadedStructClass): PropertyType.Struct {
    return new PropertyTypeImpl(PropTypeId.Struct, structClass) as PropertyType.Struct;
  }

  export function createNavigation(relationshipClass: LazyLoadedRelationshipClass): PropertyType.Navigation {
    return new PropertyTypeImpl(PropTypeId.Navigation, relationshipClass) as PropertyType.Navigation;
  }

  export function createPrimitiveArray(primitiveType: PrimitiveType): PropertyType.PrimitiveArray {
    return new PropertyTypeImpl(primitiveType | PropertyFlags.Array) as PropertyType.PrimitiveArray;
  }

  export function createEnumerationArray(enumeration: LazyLoadedEnumeration): PropertyType.EnumerationArray {
    // TODO: Should we allow specifying the backing type?
    return new PropertyTypeImpl(PropTypeId.Integer_Enumeration_Array, enumeration) as PropertyType.EnumerationArray;
  }

  export function createStructArray(structClass: LazyLoadedStructClass): PropertyType.StructArray {
    return new PropertyTypeImpl(PropTypeId.Struct_Array, structClass) as PropertyType.StructArray;
  }
}
