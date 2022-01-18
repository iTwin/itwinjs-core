/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { Id64, Id64String } from "@itwin/core-bentley";
import { EntityProps, PropertyCallback, PropertyMetaData } from "@itwin/core-common";
import { IModelDb } from "./IModelDb";
import { Schema } from "./Schema";

/** Base class for all Entities in an iModel. Every subclass of Entity handles one BIS class.
 * @public
 */
export class Entity implements EntityProps {
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

  /** @internal */
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
}

/** Parameter type that can accept both abstract constructor types and non-abstract constructor types for `instanceof` to test.
 * @public
 */
export type EntityClassType<T> = Function & { prototype: T };
