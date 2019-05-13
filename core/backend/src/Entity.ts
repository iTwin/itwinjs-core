/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Schema */

import { DbOpcode, Id64, Id64String } from "@bentley/bentleyjs-core";
import { EntityProps, PropertyCallback, PropertyMetaData } from "@bentley/imodeljs-common";
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

  [propName: string]: any;

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
    this.forEachProperty((propName: string, meta: PropertyMetaData) => this[propName] = meta.createProperty(props[propName]));
  }

  /** @internal */
  public toJSON(): EntityProps {
    const val: any = {};
    val.classFullName = this.classFullName;
    if (Id64.isValid(this.id))
      val.id = this.id;
    this.forEachProperty((propName: string) => val[propName] = this[propName]);
    return val;
  }

  /** Add a request for locks, code reservations, and anything else that would be needed to carry out the specified operation.
   * @param _opcode The operation that will be performed on the element.
   * @note subclasses must override this method
   * @alpha
   */
  public buildConcurrencyControlRequest(_opcode: DbOpcode): void { }

  /** Call a function for each property of this Entity.
   * @beta
   */
  public forEachProperty(func: PropertyCallback, includeCustom: boolean = false) { IModelDb.forEachMetaData(this.iModel, this.classFullName, true, func, includeCustom); }

  /**  Get the full BIS class name of this Entity in the form "schema:class"  */
  public static get classFullName(): string { return this.schema.schemaName + ":" + this.className; }

  /** Get the full BIS class name of this Entity in the form "schema:class". */
  public get classFullName(): string { return this._ctor.classFullName; }

  /** Make a deep copy of this Entity */
  public clone(): this { return new this._ctor(this, this.iModel) as this; }
}
