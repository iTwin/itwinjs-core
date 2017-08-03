/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { Schema } from "./Schema";
import { IModel } from "./IModel";

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
 * @property  ecclass The ECClass of the custom attribute
 * @property  properties An object whose properties correspond by name to the properties of this class.
 */
export interface CustomAttribute {
  ecclass: ECClassFullname;
  properties: { [propName: string]: PrimitiveECProperty | NavigationECProperty | StructECProperty | PrimitiveArrayECProperty | StructArrayECProperty };
}

/**
 * Metadata for an ECProperty that is a primitive type.
 * @property primitiveECProperty Describes the type
 * @property customAttributes The Custom Attributes for this class
 */
export interface PrimitiveECProperty {
  primitiveECProperty: { type: string, extendedType?: string };
  customAttributes: CustomAttribute[];
}

/**
 * Metadata for an ECProperty that is a Navigation property (aka a pointer to another element in the iModel).
 * @property navigationECProperty Describes the type
 * @property customAttributes The Custom Attributes for this class
 */
export interface NavigationECProperty {
  navigationECProperty: { type: string, direction: string, relationshipClass: ECClassFullname };
  customAttributes: CustomAttribute[];
}

/**
 * Metadata for an ECProperty that is a struct.
 * @property structECProperty Describes the type
 * @property customAttributes The Custom Attributes for this class
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
 * @property name  The ECClass name
 * @property schema  The name of the ECSchema that defines this class
 * @property baseClasses The list of base classes that this class is derived from. If more than one, the first is the actual base class and the others are mixins.
 * @property customAttributes The Custom Attributes for this class
 * @property properties An object whose properties correspond by name to the properties of this class.
 */
export interface ClassDef {
  name: string;
  schema: string;
  baseClasses: ECClassFullname[];
  customAttributes: CustomAttribute[];
  properties: { [propName: string]: PrimitiveECProperty | NavigationECProperty | StructECProperty | PrimitiveArrayECProperty | StructArrayECProperty };
}

/** An ECInstance has at least the name of the ECSchema/schema and ECClass that defines it. */
export interface ECClassProps {
  iModel: IModel;
  schemaName: string;
  className: string;
}

/** Base class for all ECClasses */
export class ECClass {
  public iModel: IModel;

  /** ECClass metadata for this class. */
  public static ecClass: ClassDef;

  /** The Domain / schema that defines this class. */
  public static schema: Schema;

  /** The full name of this class, including the schema name */
  public static get sqlName(): string { return this.schema.name + "." + this.name; }

  /** The name of the ECSchema and schema that defines this class */
  public get schemaName(): string {
    return Object.getPrototypeOf(this).constructor.schema.name;
  }
  /** The name of this class */
  public get className(): string {
    return Object.getPrototypeOf(this).constructor.name;
  }

  constructor(opt: ECClassProps) {
    this.iModel = opt.iModel;
  }

}
