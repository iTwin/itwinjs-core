/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import { IModelError, IModelStatus } from "../common/IModelError";
import { Logger } from "@bentley/bentleyjs-core/lib/Logger";
import { ClassRegistry } from "./ClassRegistry";
import { IModelDb } from "./IModelDb";
import { Entity } from "./Entity";

/** Base class for all schema classes. */
export class Schema {

  public get name(): string { return this.constructor.name; }

  /** Get the EntityCtor for the specified class name
   * @param className The name of the Entity
   * @param iModel The IModel that contains the class definitions
   * @returns The corresponding ClassCtor
   */
  public static getClass(className: string, iModel: IModelDb): typeof Entity | undefined {
    return ClassRegistry.getClass(this.name + ":" + className, iModel);
  }
}

/** Manages registered schemas */
export class Schemas {
  private static _registeredSchemas: { [key: string]: Schema; } = {};

  /** Register a schema prior to using it.
   * @throws [[IModelError]] if a schema of the same name is already registered.
   */
  public static registerSchema(schema: Schema) {
    const key = schema.name.toLowerCase();
    if (Schemas.getRegisteredSchema(key))
      throw new IModelError(IModelStatus.DuplicateName, "Schema \"" + key + "\" is already registered", Logger.logWarning, "imodeljs-backend.Schemas");
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
