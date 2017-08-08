/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { Schema } from "./Schema";
import { IModel } from "./IModel";

/**
 * The full name of an ECClass
 * @property name The name of the class
 * @property schema  The name of the ECSchema that defines this class
 */
export interface ClassFullName {
  name: string;
  schema: string;
}

/**
 * A custom attribute instance
 * @property  ecclass The ECClass of the custom attribute
 * @property  properties An object whose properties correspond by name to the properties of this class.
 */
export interface CustomAttribute {
  ecclass: ClassFullName;
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
  navigationECProperty: { type: string, direction: string, relationshipClass: ClassFullName };
  customAttributes: CustomAttribute[];
}

/**
 * Metadata for an ECProperty that is a struct.
 * @property structECProperty Describes the type
 */
export interface StructECProperty {
  structECProperty: { type: string };
}

/**
 * Metadata for an ECProperty that is a primitive array.
 * @property primitiveArrayECProperty Describes the type
 */
export interface PrimitiveArrayECProperty {
  primitiveArrayECProperty: { type: string, minOccurs: number, maxOccurs?: number };
}

/**
 * Metadata for an ECProperty that is a struct array.
 * @property { Object } structArrayECProperty Describes the type
 */
export interface StructArrayECProperty {
  structArrayECProperty: { type: string, minOccurs: number, maxOccurs?: number };
}

/**
 * Metadata  for an ECClass.
 * @property name  The ECClass name
 * @property schema  The name of the ECSchema that defines this class
 * @property baseClass The  base class that this class is derives from. If more than one, the first is the actual base class and the others are mixins.
 * @property customAttributes The Custom Attributes for this class
 * @property properties An object whose properties correspond by name to the properties of this class.
 */
export interface ClassMetaData {
  name: string;
  schema: string;
  baseClasses: ClassFullName[];
  customAttributes: CustomAttribute[];
  properties: { [propName: string]: PrimitiveECProperty | NavigationECProperty | StructECProperty | PrimitiveArrayECProperty | StructArrayECProperty };
}

/** The properties of any ECCLass. Every instance has at least the iModel and the name of the schema and class that defines it. */
export interface ClassProps {
  iModel: IModel;
  schemaName: string;
  className: string;
}

export interface ClassCtor extends FunctionConstructor {
  ecClass: ClassMetaData;
  schema: Schema;
  new(args: ClassProps): ECClass;
}

/** Base class for all ECClasses. */
export class ECClass {
  /** Metadata for this class. */
  public static ecClass: ClassMetaData;

  /** The schema that defines this class. */
  public static schema: Schema;

  public iModel: IModel;

  constructor(opt: ClassProps) { this.iModel = opt.iModel; }

  /** Get the full name of this class, in the form "schema.class"  */
  public static get sqlName(): string { return this.schema.name + "." + this.name; }

  /** Get the name of the schema that defines this class */
  public get schemaName(): string { return Object.getPrototypeOf(this).constructor.schema.name; }

  /** Get the name of this class */
  public get className(): string { return Object.getPrototypeOf(this).constructor.name; }
}
