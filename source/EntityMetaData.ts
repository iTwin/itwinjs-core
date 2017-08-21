/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { IModel } from "./IModel";

/**
 * The full name of an Entity
 * @property name The name of the class
 * @property schema  The name of the ECSchema that defines this class
 */
export interface ClassFullName {
  name: string;
  schema: string;
}

/*  ***
    *** WARNING: In the classes below, the property names are set by native code. If you change them here, you must also change the native code.
    ***
*/

/** A custom attribute instance */
export class CustomAttribute {
  /** The class of the CustomAttribute */
  public ecclass: ClassFullName;
  /** An object whose properties correspond by name to the properties of this custom attribute instance. */
  public properties: { [propName: string]: PropertyMetaData };
}

/** Metadata for a property. */
export class PropertyMetaData {
  public description?: string;
  public displayLabel?: string;
  public minimumValue?: any;
  public maximumValue?: any;
  public minimumLength?: number;
  public maximumLength?: number;
  public readOnly?: boolean;
  public kindOfQuantity?: string;
  public isCustomHandled: boolean;
  /** The Custom Attributes for the property */
  public customAttributes: CustomAttribute[];
}

/** Metadata for an PropertyMetaData that is a primitive type. */
export class PrimitivePropertyMetaData extends PropertyMetaData {
  /** primitiveECProperty Describes the type */
  public primitiveECProperty: { type: string, extendedType?: string };
}

/** Metadata for an PropertyMetaData that is a Navigation property (aka a pointer to another element in the iModel). */
export class NavigationPropertyMetaData extends PropertyMetaData {
  /** Describes the type */
  public navigationECProperty: { type: string, direction: string, relationshipClass: ClassFullName };
}

/** Metadata for an PropertyMetaData that is a struct. */
export class StructPropertyMetaData extends PropertyMetaData {
  /** Describes the type */
  public structECProperty: { type: string };
}

/** Metadata for an PropertyMetaData that is a primitive array. */
export class PrimitiveArrayPropertyMetaData extends PropertyMetaData {
  /**  Describes the type */
  public primitiveArrayECProperty: { type: string, minOccurs: number, maxOccurs?: number };
}

/** Metadata for an PropertyMetaData that is a struct array. */
export class StructArrayPropertyMetaData extends PropertyMetaData {
  /** Describes the type */
  public structArrayECProperty: { type: string, minOccurs: number, maxOccurs?: number };
}

/** Metadata  for an Entity. */
export class EntityMetaData {
  /** The Entity name */
  public name: string;
  /** The name of the ECSchema that defines this class */
  public schema: string;
  public description?: string;
  public modifier?: string;
  public displayLabel?: string;
  /** The  base class that this class is derives from. If more than one, the first is the actual base class and the others are mixins. */
  public baseClasses: ClassFullName[];
  /** The Custom Attributes for this class */
  public customAttributes: CustomAttribute[];
  /** An object whose properties correspond by name to the properties of this class. */
  public properties: { [propName: string]: PropertyMetaData };

  /** Invoke a callback on each property of the specified class, optionally including superclass properties.
   * @param imodel  The IModel that contains the schema
   * @param schemaName The schema that defines the class
   * @param className The name of the class
   * @param wantAllProperties If true, superclass properties will also be processed
   * @param cb  The callback to be invoked on each property
   */
  public static forEachProperty(imodel: IModel, schemaName: string, className: string, wantAllProperties: boolean, cb: any) {

    const mdata = imodel.classMetaDataRegistry.get(schemaName, className);
    if (mdata === undefined) {
      throw new TypeError(schemaName + "." + className + " missing class metadata");
    }

    for (const propname in mdata.properties) {
      if (typeof propname === "string") { // this is a) just to be very safe and b) to satisfy TypeScript
        const ecprop: PropertyMetaData = mdata.properties[propname] as PropertyMetaData;
        cb(propname, ecprop);
      }
    }

    if (!wantAllProperties)
      return;

    if (mdata.baseClasses) {
      for (const base of mdata.baseClasses) {
        EntityMetaData.forEachProperty(imodel, base.schema, base.name, true, cb);
      }
    }
  }

}
