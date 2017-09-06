/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { Schema } from "./Schema";
import { IModel } from "./IModel";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";

/** The properties of any ECEntityCLass. Every instance has at least the iModel and the name of the schema and class that defines it. */
export interface EntityProps {
  [propName: string]: any;

  iModel: IModel;
  classFullName?: string;
}

export interface EntityCtor extends FunctionConstructor {
  schema: Schema;
  new(args: EntityProps | Entity): Entity;
}

export type PropertyCallback = (name: string, meta: PropertyMetaData) => void;

/** Base class for all ECEntityClasses. */
export class Entity implements EntityProps {
  private persistent: boolean = false;
  public setPersistent() { this.persistent = true; Object.freeze(this); } // internal use only
  [propName: string]: any;

  /** The schema that defines this class. */
  public static schema: Schema;

  /** The IModel that contains this Entity */
  public iModel: IModel;

  /** The Id of this Entity. Valid only if persistent. */
  public id: Id64;

  constructor(props: EntityProps) {
    this.iModel = props.iModel;
    // copy all non-custom-handled properties from input to the object being constructed
    this.forEachProperty((propName: string) => this[propName] = props[propName]);
  }

  public toJSON() {
    const val: any = {};
    val.classFullName = this.classFullName;
    this.forEachProperty((propName: string) => val[propName] = this[propName]);
    return val;
  }

  /** call a function for each property of this Entity. Function arguments are property name and property metadata. */
  public forEachProperty(func: PropertyCallback, includeCustom: boolean = false) { EntityMetaData.forEach(this.iModel, this.classFullName, true, func, includeCustom); }

  /** STATIC method to get the full name of this class, in the form "schema.class"  */
  public static get sqlName() { return this.schema.name + "." + this.name; }

  /** get full class name of this Entity in the form "Schema:ClassName". */
  public get classFullName(): string { return this.schemaName + ":" + this.className; }

  /** Get the name of the schema that defines this class */
  public get schemaName(): string { return Object.getPrototypeOf(this).constructor.schema.name; }

  /** Get the name of this class */
  public get className(): string { return Object.getPrototypeOf(this).constructor.name; }

  /** Determine whether this Entity is in the persistent (unmodified) state from the database. Persistent Entities may
   * not be changed in any way. To modify an Entity, make a copy of it using #copyForEdit.
   */
  public isPersistent() { return this.persistent; }

  /** make a copy of this Entity so that it may be be modified. */
  public copyForEdit<T extends Entity>() { return new (this.constructor as EntityCtor)(this) as T; }
}

/*  ***
    *** WARNING: In the classes below, the property names are set in imodel-dgnplatform and must match.
    ***
*/

/** A custom attribute instance */
export class CustomAttribute {
  /** The class of the CustomAttribute */
  public ecclass: string;
  /** An object whose properties correspond by name to the properties of this custom attribute instance. */
  public properties: { [propName: string]: PropertyMetaData };
}

/** Metadata for a property. */
export class PropertyMetaData {
  public type: string;
  public description?: string;
  public displayLabel?: string;
  public minimumValue?: any;
  public maximumValue?: any;
  public minimumLength?: number;
  public maximumLength?: number;
  public readOnly?: boolean;
  public kindOfQuantity?: string;
  public isCustomHandled: boolean;
  public minOccurs?: number;
  public maxOccurs?: number;
  public extendedType?: string;
  public direction?: string;
  public relationshipClass?: string;

  /** The Custom Attributes for the property */
  public customAttributes: CustomAttribute[];
}

/** Metadata for an Entity. */
export class EntityMetaData {
  /** The Entity name */
  public ecclass: string;
  public description?: string;
  public modifier?: string;
  public displayLabel?: string;
  /** The  base class that this class is derives from. If more than one, the first is the actual base class and the others are mixins. */
  public baseClasses: string[];
  /** The Custom Attributes for this class */
  public customAttributes: CustomAttribute[];
  /** An object whose properties correspond by name to the properties of this class. */
  public properties: { [propName: string]: PropertyMetaData };

  /** Invoke a callback on each property of the specified class, optionally including superclass properties.
   * @param imodel  The IModel that contains the schema
   * @param schemaName The schema that defines the class
   * @param className The name of the class
   * @param wantSuper If true, superclass properties will also be processed
   * @param func The callback to be invoked on each property
   */
  public static forEach(imodel: IModel, classFullName: string, wantSuper: boolean, func: PropertyCallback, includeCustom: boolean) {
    const meta = imodel.classMetaDataRegistry.get(classFullName);
    if (meta === undefined) {
      throw new TypeError(classFullName + " missing class metadata");
    }

    for (const propName in meta.properties) {
      if (propName) {
        const propMeta = meta.properties[propName];
        if (includeCustom || !propMeta.isCustomHandled)
          func(propName, propMeta);
      }
    }

    if (wantSuper && meta.baseClasses) {
      for (const base of meta.baseClasses) {
        EntityMetaData.forEach(imodel, base, true, func, includeCustom);
      }
    }
  }

}
