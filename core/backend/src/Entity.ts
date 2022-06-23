/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { Id64, Id64Set, Id64String, isSubclassOf } from "@itwin/core-bentley";
import { EntityProps, PropertyCallback, PropertyMetaData } from "@itwin/core-common";
import { IModelDb } from "./IModelDb";
import { Schema } from "./Schema";

/** Represents an entity in an [[IModelDb]] such as an [[Element]], [[Model]], or [[Relationship]].
 * Every subclass of Entity represents one BIS [ECClass]($ecschema-metadata).
 * An Entity is typically instantiated from an [EntityProps]($common) and can be converted back to this representation via [[Entity.toJSON]].
 * @public
 */
export class Entity {
  /** An immutable property used to discriminate between [[Entity]] and [EntityProps]($common), used to inform the TypeScript compiler that these two types
   * are never substitutable for one another. To obtain an EntityProps from an Entity, use [[Entity.toJSON]].
   */
  public readonly isInstanceOfEntity: true = true;
  /** The Schema that defines this class. */
  public static schema: typeof Schema;

  private get _ctor(): typeof Entity { return this.constructor as typeof Entity; }

  /** The name of the BIS class associated with this class.
   * @note Every subclass of Entity **MUST** override this method to identify its BIS class.
   * Failure to do so will ordinarily result in an error when the class is registered, since there may only
   * be one JavaScript class for a given BIS class (usually the errant class will collide with its superclass.)
   */
  public static get className(): string { return "Entity"; }

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

  /** @internal */
  constructor(props: EntityProps, iModel: IModelDb) {
    this.iModel = iModel;
    this.id = Id64.fromJSON(props.id);
    // copy all auto-handled properties from input to the object being constructed
    this.forEachProperty((propName: string, meta: PropertyMetaData) => (this as any)[propName] = meta.createProperty((props as any)[propName]), false);
  }

  /** Obtain the JSON representation of this Entity. Subclasses of [[Entity]] typically override this method to return their corresponding sub-type of [EntityProps]($common) -
   * for example, [[GeometricElement.toJSON]] returns a [GeometricElementProps]($common).
   */
  public toJSON(): EntityProps {
    const val: any = {};
    val.classFullName = this.classFullName;
    if (Id64.isValid(this.id))
      val.id = this.id;
    this.forEachProperty((propName: string) => val[propName] = (this as any)[propName], false);
    return val;
  }

  /** Call a function for each property of this Entity.
   * @param func The callback to be invoked on each property
   * @param includeCustom If true (default), include custom-handled properties in the iteration. Otherwise, skip custom-handled properties.
   * @note Custom-handled properties are core properties that have behavior enforced by C++ handlers.
   */
  public forEachProperty(func: PropertyCallback, includeCustom: boolean = true) { IModelDb.forEachMetaData(this.iModel, this.classFullName, true, func, includeCustom); }

  /** Get the full BIS class name of this Entity in the form "schema:class" */
  public static get classFullName(): string { return `${this.schema.schemaName}:${this.className}`; }

  /** Get the full BIS class name of this Entity in the form "schema:class". */
  public get classFullName(): string { return this._ctor.classFullName; }

  /** @internal */
  public static get protectedOperations(): string[] { return []; }

  /** return whether this Entity class is a subclass of another Entity class
   * @note the subclass-ness is checked according to JavaScript inheritance, to check the underlying raw EC class's
   * inheritance, you can use [ECClass.is]($ecschema-metadata)
   * @note this should have a type of `is<T extends typeof Entity>(otherClass: T): this is T` but can't because of
   * typescript's restriction on the `this` type in static methods
   */
  public static is(otherClass: typeof Entity): boolean { return isSubclassOf(this, otherClass); }

  /** whether this JavaScript class was generated for this ECClass because there was no registered custom implementation
   * ClassRegistry overrides this when generating a class
   * @internal
   */
  public static get isGeneratedClass() { return false; }

  /** Get the Ids of this element's *references*. A *reference* is an element that this element references.
   * This is important for cloning operations but can be useful in other situations as well.
   * @see collectReferenceIds
   * @beta
   */
  public getReferenceIds(): Id64Set {
    const referenceIds = new Set<Id64String>();
    this.collectReferenceIds(referenceIds);
    return referenceIds;
  }

  /** Collect the Ids of this entity's *references* at this level of the class hierarchy.
   * A *reference* is any entity referenced by this entity's EC Data
   * This is important for cloning operations but can be useful in other situations as well.
   * @param referenceIds The Id64Set to populate with reference Ids.
   * @note In order to clone/transform an entity, all referenced elements must have been previously cloned and remapped within the [IModelCloneContext]($backend).
   * @note This should be overridden (with `super` called) at each level the class hierarchy that introduces references.
   * @see getReferenceIds
   * @beta
   */
  protected collectReferenceIds(_referenceIds: Id64Set): void {
    return; // no references by default
  }

}

/** Parameter type that can accept both abstract constructor types and non-abstract constructor types for `instanceof` to test.
 * @public
 */
export type EntityClassType<T> = Function & { prototype: T };
