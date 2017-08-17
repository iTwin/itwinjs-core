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

/** Metadata for an ECProperty. */
export interface ECProperty {
  description?: string;
  displayLabel?: string;
  minimumValue?: any;
  maximumValue?: any;
  minimumLength?: number;
  maximumLength?: number;
  readOnly?: boolean;
  kindOfQuantity?: string;
  isCustomHandled: boolean;
  /** The Custom Attributes for the property */
  customAttributes: CustomAttribute[];
}

/** Metadata for an ECProperty that is a primitive type. */
export interface PrimitiveECProperty extends ECProperty {
  /** primitiveECProperty Describes the type */
  primitiveECProperty: { type: string, extendedType?: string };
}

/** Metadata for an ECProperty that is a Navigation property (aka a pointer to another element in the iModel). */
export interface NavigationECProperty extends ECProperty {
  /** Describes the type */
  navigationECProperty: { type: string, direction: string, relationshipClass: ClassFullName };
}

/** Metadata for an ECProperty that is a struct. */
export interface StructECProperty extends ECProperty {
  /** Describes the type */
  structECProperty: { type: string };
}

/** Metadata for an ECProperty that is a primitive array. */
export interface PrimitiveArrayECProperty extends ECProperty {
  /**  Describes the type */
  primitiveArrayECProperty: { type: string, minOccurs: number, maxOccurs?: number };
}

/** Metadata for an ECProperty that is a struct array. */
export interface StructArrayECProperty extends ECProperty {
  /** Describes the type */
  structArrayECProperty: { type: string, minOccurs: number, maxOccurs?: number };
}

/** Metadata  for an ECClass. */
export interface ClassMetaData {
  /** The ECClass name */
  name: string;
  /** The name of the ECSchema that defines this class */
  schema: string;
  description?: string;
  modifier?: string;
  displayLabel?: string;
  /** The  base class that this class is derives from. If more than one, the first is the actual base class and the others are mixins. */
  baseClasses: ClassFullName[];

  /** The Custom Attributes for this class */
  customAttributes: CustomAttribute[];
  /** An object whose properties correspond by name to the properties of this class. */
  properties: { [propName: string]: ECProperty | PrimitiveECProperty | NavigationECProperty | StructECProperty | PrimitiveArrayECProperty | StructArrayECProperty };
}

/** The properties of any ECCLass. Every instance has at least the iModel and the name of the schema and class that defines it. */
export interface ClassProps {
  [propName: string]: any;

  iModel: IModel;
  classFullName: string;
}

export interface ClassCtor extends FunctionConstructor {
  ecClass: ClassMetaData;
  schema: Schema;
  new(args: ClassProps): ECClass;
}

/** Base class for all ECClasses. */
export class ECClass {

  [propName: string]: any;

  /** The schema that defines this class. */
  public static schema: Schema;

  public iModel: IModel;

  constructor(opt: ClassProps) {
    this.iModel = opt.iModel;

    ECClass.forEachECProperty(this.iModel, this.schemaName, this.className, true, (propname: string, ecprop: ECProperty) => {
      if (!ecprop.isCustomHandled)
        this[propname] = opt[propname];
    });
  }

  /* Set the auto-handled properties of obj that are defined in the specified ECClass */
  private static forEachECProperty(imodel: IModel, schemaName: string, className: string, wantAllProperties: boolean, cb: any) {

    const mdata = imodel.classMetaDataRegistry.get(schemaName, className);
    if (mdata === undefined) {
      throw new TypeError(schemaName + "." + className + " missing class metadata");
    }

    for (const propname in mdata.properties) {
      if (typeof propname === "string") { // this is a) just to be very safe and b) to satisfy TypeScript
        const ecprop: ECProperty = mdata.properties[propname] as ECProperty;
        cb(propname, ecprop);
      }
    }

    if (!wantAllProperties)
      return;

    if (mdata.baseClasses) {
      for (const base of mdata.baseClasses) {
        ECClass.forEachECProperty(imodel, base.schema, base.name, true, cb);
      }
    }
  }

  /** Get the full name of this class, in the form "schema.class"  */
  public static get sqlName(): string { return this.schema.name + "." + this.name; }

  /** Get the name of the schema that defines this class */
  public get schemaName(): string { return Object.getPrototypeOf(this).constructor.schema.name; }

  /** Get the name of this class */
  public get className(): string { return Object.getPrototypeOf(this).constructor.name; }
}
