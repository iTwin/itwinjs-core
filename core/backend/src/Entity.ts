/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Schema */

import { Id64, DbOpcode } from "@bentley/bentleyjs-core";
import { EntityProps, PropertyMetaData, PropertyCallback } from "@bentley/imodeljs-common";
import { IModelDb } from "./IModelDb";
import { Schema } from "./Schema";

/** Base class for all Entities in an iModel. */
export class Entity implements EntityProps {
  [propName: string]: any;

  /** The schema that defines this class. */
  public static schema: Schema;

  /** The [[IModelDb]] that contains this Entity */
  public iModel: IModelDb;

  /** The Id of this Entity. May be invalid if the Entity has not yet been saved in the database. */
  public id: Id64;

  /** @hidden */
  constructor(props: EntityProps, iModel: IModelDb) {
    this.iModel = iModel;
    this.id = Id64.fromJSON(props.id);
    // copy all auto-handled properties from input to the object being constructed
    this.forEachProperty((propName: string, meta: PropertyMetaData) => this[propName] = meta.createProperty(props[propName]));
  }

  /** @hidden */
  public toJSON(): EntityProps {
    const val: any = {};
    val.classFullName = this.classFullName;
    this.forEachProperty((propName: string) => val[propName] = this[propName]);
    return val;
  }

  /**
   * Add a request for locks, code reservations, and anything else that would be needed to carry out the specified operation.
   * @param _opcode The operation that will be performed on the element.
   */
  public buildConcurrencyControlRequest(_opcode: DbOpcode): void {
    // subclasses must override this method to build a request for the locks and codes and other concurrency control token that they know that they need.
  }

  /** Call a function for each property of this Entity. Function arguments are property name and property metadata. */
  public forEachProperty(func: PropertyCallback, includeCustom: boolean = false) { IModelDb.forEachMetaData(this.iModel, this.classFullName, true, func, includeCustom); }

  /** Get the full name of this class, in the form "schema:class"  */
  public static get classFullName(): string { return this.schema.name + ":" + this.name; }

  /** Get full class name of this Entity in the form "schema:class". */
  public get classFullName(): string { return this.schemaName + ":" + this.className; }

  /** Get the name of the schema that defines this class */
  public get schemaName(): string { return (this.constructor as typeof Entity).schema.name; }

  /** Get the name of this class */
  public get className(): string { return this.constructor.name; }

  /** Make a deep copy of this Entity */
  public clone<T extends Entity>(): T { return new (this.constructor as any)(this, this.iModel) as T; }
}
