/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/**
 * The full name of an ECClass
 * @property {string } name The name of the class
 * @property {string} schema  The name of the ECSchema that defines this class
 */
export interface ECClassFullname {
  name: string;
  schema: string;
}

/**
 * A custom attribute instance
 * @property { ECClassFullname } ecclass The ECClass of the custom attribute
 * @property { PrimitiveECProperty| NavigationECProperty|StructECProperty|PrimitiveArrayECProperty|StructArrayECProperty } properties An object whose properties correspond by name to the properties of this class.
 */
export interface CustomAttribute {
  ecclass: ECClassFullname;
  properties: { [propName: string]: PrimitiveECProperty | NavigationECProperty | StructECProperty | PrimitiveArrayECProperty | StructArrayECProperty };
}

/**
 * Metadata for an ECProperty that is a primitive type.
 * @property { Object } primitiveECProperty Describes the type
 * @property { CustomAttribute[] } customAttributes The Custom Attributes for this class
 */
export interface PrimitiveECProperty {
  primitiveECProperty: { type: string, extendedType?: string };
  customAttributes: CustomAttribute[];
}

/**
 * Metadata for an ECProperty that is a Navigation property (aka a pointer to another element in the iModel).
 * @property { Object } navigationECProperty Describes the type
 * @property { CustomAttribute[] } customAttributes The Custom Attributes for this class
 */
export interface NavigationECProperty {
  navigationECProperty: { type: string, direction: string, relationshipClass: ECClassFullname };
  customAttributes: CustomAttribute[];
}

/**
 * Metadata for an ECProperty that is a struct.
 * @property { Object } structECProperty Describes the type
 * @property { CustomAttribute[] } customAttributes The Custom Attributes for this class
 */
export interface StructECProperty {
  structECProperty: { type: string };
}

/**
 * Metadata for an ECProperty that is a primitive array.
 * @property { Object } primitiveArrayECProperty Describes the type
 * @property { CustomAttribute[] } customAttributes The Custom Attributes for this class
 */
export interface PrimitiveArrayECProperty {
  primitiveArrayECProperty: { type: string, minOccurs: number, maxOccurs?: number };
}

/**
 * Metadata for an ECProperty that is a struct array.
 * @property { Object } structArrayECProperty Describes the type
 * @property { CustomAttribute[] } customAttributes The Custom Attributes for this class
 */
export interface StructArrayECProperty {
  structArrayECProperty: { type: string, minOccurs: number, maxOccurs?: number };
}

/**
 * Metadata  for an ECClass.
 * @property {string} name  The ECClass name
 * @property {string} schema  The name of the ECSchema that defines this class
 * @property { ECClassFullname[] } baseClasses The list of base classes that this class is derived from. If more than one, the first is the actual base class and the others are mixins.
 * @property { CustomAttribute[] } customAttributes The Custom Attributes for this class
 * @property { PrimitiveECProperty| NavigationECProperty|StructECProperty|PrimitiveArrayECProperty|StructArrayECProperty } properties An object whose properties correspond by name to the properties of this class.
 */
export interface ECClass {
  name: string;
  schema: string;
  baseClasses: ECClassFullname[];
  customAttributes: CustomAttribute[];
  properties: { [propName: string]: PrimitiveECProperty | NavigationECProperty | StructECProperty | PrimitiveArrayECProperty | StructArrayECProperty };
}
