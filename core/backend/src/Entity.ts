/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { Id64, Id64String } from "@itwin/core-bentley";
import { EntityProps, EntityReferenceSet, PropertyCallback, PropertyMetaData } from "@itwin/core-common";
import type { IModelDb } from "./IModelDb";
import { Schema } from "./Schema";
import { EntityClass, PropertyHandler, SchemaItemKey } from "@itwin/ecschema-metadata";

export interface ECSqlRow {
  [key: string]: any
}

export interface InstanceProps {
  row: ECSqlRow;
  iModel: IModelDb;
}

/** Represents one of the fundamental building block in an [[IModelDb]]: as an [[Element]], [[Model]], or [[Relationship]].
 * Every subclass of Entity represents one BIS [ECClass]($ecschema-metadata).
 * An Entity is typically instantiated from an [EntityProps]($common) and can be converted back to this representation via [[Entity.toJSON]].
 * @public
 */
export class Entity {
  /** An immutable property used to discriminate between [[Entity]] and [EntityProps]($common), used to inform the TypeScript compiler that these two types
   * are never substitutable for one another. To obtain an EntityProps from an Entity, use [[Entity.toJSON]].
   */
  public readonly isInstanceOfEntity = true as const;
  /** The Schema that defines this class. */
  public static schema: typeof Schema; // TODO: Schema key on the static level, but it requires a version which may differ between imodels

  private get _ctor(): typeof Entity { return this.constructor as typeof Entity; }

  /** The name of the BIS class associated with this class.
   * @note Every subclass of Entity **MUST** override this method to identify its BIS class.
   * Failure to do so will ordinarily result in an error when the class is registered, since there may only
   * be one JavaScript class for a given BIS class (usually the errant class will collide with its superclass.)
   */
  public static get className(): string { return "Entity"; }

  /** Serves as a unique identifier for this class. Typed variant of [[classFullName]].
   * @beta
   */
  public static get schemaItemKey(): SchemaItemKey {
    // We cannot cache this here because the className gets overridden in subclasses
    return new SchemaItemKey(this.className, this.schema.schemaKey);
  }

  private _metadata?: EntityClass;

  /** When working with an Entity it can be useful to set property values directly, bypassing the compiler's type checking.
   * This property makes such code slightly less tedious to read and write.
   * @internal
   */
  public get asAny(): any { return this; }

  /** The name of the BIS Schema that defines this class */
  public get schemaName(): string { return this._ctor.schema.schemaName; }

  /** The name of the BIS class associated with this class. */
  public get className(): string { return this._ctor.className; }

  /** The [[IModelDb]] that contains this Entity */
  public iModel: IModelDb;

  /** The Id of this Entity. May be invalid if the Entity has not yet been saved in the database. */
  public id: Id64String;


  protected constructor(props: EntityProps, iModel: IModelDb) {
    this.iModel = iModel;
    this.id = Id64.fromJSON(props.id);
    // copy all auto-handled properties from input to the object being constructed
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    this.forEachProperty((propName: string, meta: PropertyMetaData) => (this as any)[propName] = meta.createProperty((props as any)[propName]), false);
  }

  /** Invoke the constructor of the specified `Entity` subclass.
   * @internal
   */
  public static instantiate(subclass: typeof Entity, props: EntityProps, iModel: IModelDb): Entity {
    return new subclass(props, iModel);
  }

  protected static get customHandledECProperties(): string[] {
    return ["id", "className"];
  }

  public static deserialize(props: InstanceProps): EntityProps {
    const enProps: EntityProps = {
      id: props.row.id,
      classFullName: props.row.classFullName,
    }
    Object.keys(props.row).filter((propName) => !this.customHandledECProperties.includes(propName)).forEach((propName) => {
      (enProps as any)[propName] = props.row[propName];
    });
    return enProps;
  }

  public static serialize(props: EntityProps, _iModel: IModelDb): ECSqlRow {
    const inst: ECSqlRow = {
      id: props.id,
      className: props.classFullName,
    }
    Object.keys(props).filter((propName) => !this.customHandledECProperties.includes(propName)).forEach((propName) => {
      inst[propName] = (props as any)[propName];
    });
    return inst;
  }

  /** Obtain the JSON representation of this Entity. Subclasses of [[Entity]] typically override this method to return their corresponding sub-type of [EntityProps]($common) -
   * for example, [[GeometricElement.toJSON]] returns a [GeometricElementProps]($common).
   */
  public toJSON(): EntityProps {
    const val: any = {};
    val.classFullName = this.classFullName;
    if (Id64.isValid(this.id))
      val.id = this.id;
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    this.forEachProperty((propName: string) => val[propName] = (this as any)[propName], false);
    return val;
  }

  /** Call a function for each property of this Entity.
   * @param func The callback to be invoked on each property
   * @param includeCustom If true (default), include custom-handled properties in the iteration. Otherwise, skip custom-handled properties.
   * @note Custom-handled properties are core properties that have behavior enforced by C++ handlers.
   * @deprecated in 5.0. Please use `forEach` to get the metadata and iterate over the properties instead.
   *
   * @example
   * ```typescript
   * // Deprecated method
   * entity.forEachProperty((name, propMetaData) => {
   *   console.log(`Property name: ${name}, Property type: ${propMetaData.primitiveType}`);
   * });
   *
   * // New method
   * entity.forEach((name, property) => {
   *   console.log(`Property name: ${name}, Property type: ${property.propertyType}`);
   * });
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  public forEachProperty(func: PropertyCallback, includeCustom: boolean = true) {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    this.iModel.forEachMetaData(this.classFullName, true, func, includeCustom);
  }

  /**
   * Call a function for each property of this Entity.
   * @param func The callback to be invoked on each property.
   * @param includeCustom If true (default), include custom-handled properties in the iteration. Otherwise, skip custom-handled properties.
   * @note Custom-handled properties are core properties that have behavior enforced by C++ handlers.
   * @throws Error if metadata for the class cannot be retrieved.
   *
   * @example
   * ```typescript
   * entity.forEach((name, property) => {
   *   console.log(`Property name: ${name}, Property type: ${property.propertyType}`);
   * });
   * ```
   */
  public forEach(func: PropertyHandler, includeCustom: boolean = true) {
    const metaData = this.iModel.schemaContext.getSchemaItemSync(this.schemaItemKey, EntityClass);
    if (!metaData)
      throw new Error(`Cannot get metadata for ${this.classFullName}`);

    for (const property of metaData.getPropertiesSync()) {
      if (includeCustom || !property.customAttributes?.has(`BisCore.CustomHandledProperty`))
        func(property.name, property);
    }
  }

  /** Get the full BIS class name of this Entity in the form "schema:class" */
  public static get classFullName(): string { return `${this.schema.schemaName}:${this.className}`; }

  /** Get the full BIS class name of this Entity in the form "schema:class". */
  public get classFullName(): string { return this._ctor.classFullName; }
  /**
   * Get the item key used by the ecschema-metadata package to identify this entity class
   * @beta
   */
  public get schemaItemKey(): SchemaItemKey { return this._ctor.schemaItemKey; }

  /** query metadata for this entity class from the iModel's schema
   * @throws [[IModelError]] if there is a problem querying the schema
   * @returns The metadata for the current entity
   * @beta
   */
  public async getMetaData(): Promise<EntityClass> {
    if (!this._metadata) {
      this._metadata = await this.iModel.schemaContext.getSchemaItem(this.schemaItemKey, EntityClass);
    }

    if (!this._metadata) {
      throw new Error(`Cannot get metadata for ${this.classFullName}`);
    }

    return this._metadata;
  }


  /** @internal */
  public static get protectedOperations(): string[] { return []; }

  /** return whether this Entity class is a subclass of another Entity class
   * @note the subclass-ness is checked according to JavaScript inheritance, to check the underlying raw EC class's
   * inheritance, you can use [ECClass.is]($ecschema-metadata)
   * @note this should have a type of `is<T extends typeof Entity>(otherClass: T): this is T` but can't because of
   * typescript's restriction on the `this` type in static methods
   */
  public static is(otherClass: typeof Entity): boolean {
    // inline of @itwin/core-bentley's isSubclassOf due to protected constructor.
    return this === otherClass || this.prototype instanceof otherClass;
  }

  /** whether this JavaScript class was generated for this ECClass because there was no registered custom implementation
   * ClassRegistry overrides this when generating a class
   * @internal
   */
  public static get isGeneratedClass() { return false; }

  /** Get the set of this entity's *entity references*, [EntityReferenceSet]($backend). An *entity reference* is any id
   * stored on the entity, in its EC properties or json fields.
   * This is important for cloning operations but can be useful in other situations as well.
   * @see this.collectReferenceIds
   * @beta
   */
  public getReferenceIds(): EntityReferenceSet {
    const referenceIds = new EntityReferenceSet();
    this.collectReferenceIds(referenceIds);
    return referenceIds;
  }

  /** Collect the Ids of this entity's *references* at this level of the class hierarchy.
   * A *reference* is any entity referenced by this entity's EC Data, including json fields.
   * This is important for cloning operations but can be useful in other situations as well.
   * @param _referenceIds The Id64Set to populate with reference Ids.
   * @note This should be overridden (with `super` called) at each level the class hierarchy that introduces references.
   * @see getReferenceIds
   * @beta
   */
  protected collectReferenceIds(_referenceIds: EntityReferenceSet): void {
    return; // no references by default
  }
}

/** Parameter type that can accept both abstract constructor types and non-abstract constructor types for `instanceof` to test.
 * @public
 */
export type EntityClassType<T> = Function & { prototype: T }; // eslint-disable-line @typescript-eslint/no-unsafe-function-type
