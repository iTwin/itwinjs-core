/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { Schema } from "./Schema";
import { IModel } from "./IModel";
import { EntityMetaData, PropertyMetaData } from "./EntityMetaData";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id64";

/** The properties of any ECEntityCLass. Every instance has at least the iModel and the name of the schema and class that defines it. */
export interface ClassProps {
  [propName: string]: any;

  iModel: IModel;
  classFullName: string;
}

export interface ClassCtor extends FunctionConstructor {
  schema: Schema;
  new(args: ClassProps): Entity;
}

/** Base class for all ECEntityClasses. */
export class Entity {

  [propName: string]: any;

  /** The schema that defines this class. */
  public static schema: Schema;

  /** The IModel that contains this Entity */
  public iModel: IModel;

  /** The unique ID of this Entity within its IModel, if persistent. */
  public id: Id64;

  constructor(opt: ClassProps) {
    this.iModel = opt.iModel;

    EntityMetaData.forEachProperty(this.iModel, this.schemaName, this.className, true, (propname: string, ecprop: PropertyMetaData) => {
      if (!ecprop.isCustomHandled)
        this[propname] = opt[propname];
    });
  }

  /** Get the full name of this class, in the form "schema.class"  */
  public static get sqlName(): string { return this.schema.name + "." + this.name; }

  /** Get the name of the schema that defines this class */
  public get schemaName(): string { return Object.getPrototypeOf(this).constructor.schema.name; }

  /** Get the name of this class */
  public get className(): string { return Object.getPrototypeOf(this).constructor.name; }
}
