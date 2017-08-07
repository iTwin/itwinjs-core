/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import { IModel } from "./IModel";
import { ClassRegistry } from "./ClassRegistry";

/** Base class for all schema classes. */
export class Schema {

  public get name(): string { return this.constructor.name; }

  public static getFullClassName(className: string) { return this.name + "." + className; }

  /**
   * Get the class for the specified ECClass.
   * @param ecclassFullName The name of the ECClass
   * @param imodel        The IModel that contains the class definitions
   * @return The corresponding class
   */
  public static async getClass(className: string, imodel: IModel): Promise<any> {
    return ClassRegistry.getClass({schema: this.name, name: className}, imodel);
  }
}

/** Manages registered schemas */
export class Schemas {

  private static registeredDomains: { [key: string]: Schema; } = {};

  /**
   * Register a schema prior to using it.
   * @param schema The schema
   */
  public static registerSchema(schema: Schema) {
    const key: string = schema.name.toLowerCase();
    if (Schemas.getRegisteredSchema(key))
      throw new Error("schema " + key + " is already registered");
    Schemas.registeredDomains[key] = schema;
  }

  /**
   * Look up a previously registered schema
   * @param domainName The name of the schema
   * @return the previously registered schema or undefined if not registered.
   */
  public static getRegisteredSchema(domainName: string) {
    return Schemas.registeredDomains[domainName.toLowerCase()];
  }
}
