/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import { IModel } from "./IModel";
import { EntityCtor } from "./Entity";
import { ClassRegistry } from "./ClassRegistry";

/** Base class for all schema classes. */
export class Schema {

  public get name(): string { return this.constructor.name; }

  /** Get the EntityCtor for the specified class name
   * @param className The name of the Entity
   * @param imodel The IModel that contains the class definitions
   * @returns The corresponding ClassCtor
   */
  public static getClass(className: string, imodel: IModel): EntityCtor | undefined {
    return ClassRegistry.getClass(this.name + ":" + className, imodel);
  }
}

/** Manages registered schemas */
export class Schemas {
  private static _registeredSchemas: { [key: string]: Schema; } = {};

  /** Register a schema prior to using it.  */
  public static registerSchema(schema: Schema) {
    const key = schema.name.toLowerCase();
    if (Schemas.getRegisteredSchema(key))
      throw new Error("schema " + key + " is already registered");
    Schemas._registeredSchemas[key] = schema;
  }

  /** Look up a previously registered schema
   * @param schemaName The name of the schema
   * @returns the previously registered schema or undefined if not registered.
   */
  public static getRegisteredSchema(schemaName: string): Schema | undefined {
    return Schemas._registeredSchemas[schemaName.toLowerCase()];
  }
}
