/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Schema */

import { IModelError, IModelStatus, EntityMetaData } from "@bentley/imodeljs-common";
import { Entity } from "./Entity";
import { IModelDb } from "./IModelDb";
import { Schema, Schemas } from "./Schema";

/** The mapping between a class name (schema.class) and its constructor function  */
export class ClassRegistry {
  private static readonly _classMap = new Map<string, typeof Entity>();
  private static getKey(schemaName: string, className: string) { return (schemaName + ":" + className).toLowerCase(); }
  private static lookupClass(name: string) { return this._classMap.get(name.toLowerCase()); }

  /** @hidden */
  public static isNotFoundError(err: any) { return (err instanceof IModelError) && (err.errorNumber === IModelStatus.NotFound); }

  /** @hidden */
  public static makeMetaDataNotFoundError(className: string): IModelError { return new IModelError(IModelStatus.NotFound, "metadata not found for " + className); }

  /** @hidden */
  public static register(entityClass: typeof Entity, schema: Schema) { entityClass.schema = schema; this._classMap.set(this.getKey(entityClass.schema.name, entityClass.name), entityClass); }
  /** @hidden */
  public static registerSchema(schema: Schema) { Schemas.registerSchema(schema); }
  /** @hidden */
  public static getRegisteredSchema(domainName: string) { return Schemas.getRegisteredSchema(domainName); }
  /** @hidden */
  public static getSchemaBaseClass() { return Schema; }

  private static generateProxySchema(schemaName: string): typeof Schema {
    const schemaClass = class extends Schema { };
    // the above line creates an "anonymous" class. But, we rely on the "constructor.name" property to be eponymous with the Schema name.
    // this is the (only) way to change that readonly property.
    Object.defineProperty(schemaClass, "name", { get: () => schemaName });
    this.registerSchema(schemaClass); // register the class before we return it.
    return schemaClass;
  }

  /**
   * Generate a JavaScript class from Entity metadata.
   * @param entityMetaData The Entity metadata that defines the class
   */
  private static generateClassForEntity(entityMetaData: EntityMetaData): typeof Entity {
    const name = entityMetaData.ecclass.split(":");
    const schemaName = name[0];
    const className = name[1];

    if (entityMetaData.baseClasses.length === 0) // metadata must contain a superclass
      throw new IModelError(IModelStatus.BadArg, "class " + name + " has no superclass");

    // make sure schema exists
    let schema = Schemas.getRegisteredSchema(schemaName);
    if (!schema)
      schema = this.generateProxySchema(schemaName); // no schema found, create it too

    // this method relies on the caller having previously created/registered all superclasses
    const superclass = this.lookupClass(entityMetaData.baseClasses[0]);
    if (!superclass)
      throw new IModelError(IModelStatus.NotFound, "cannot find superclass for class " + name);

    const generatedClass = class extends superclass { };
    // the above line creates an "anonymous" class. We rely on the "constructor.name" property to be the same as the EcClass name.
    Object.defineProperty(generatedClass, "name", { get: () => className });  // this is the (only) way to change that readonly property.

    this.register(generatedClass, schema); // register it before returning
    return generatedClass;
  }

  /**
   * Register all of the classes found in the given module that derive from Entity. See the example in [[Schema]]
   * @param moduleObj The module to search for subclasses of Entity
   * @param schema The schema for all found classes
   */
  public static registerModule(moduleObj: any, schema: Schema) {
    for (const thisMember in moduleObj) {
      if (!thisMember)
        continue;

      const thisClass = moduleObj[thisMember];
      if (thisClass.prototype instanceof Entity)
        this.register(thisClass, schema);
    }
  }

  /**
   * This function fetches the specified Entity from the imodel, generates a JavaScript class for it, and registers the generated
   * class. This function also ensures that all of the base classes of the Entity exist and are registered.
   */
  private static generateClass(classFullName: string, iModel: IModelDb): typeof Entity {
    const metadata: EntityMetaData | undefined = iModel.classMetaDataRegistry.find(classFullName);
    if (metadata === undefined || metadata.ecclass === undefined)
      throw this.makeMetaDataNotFoundError(classFullName);

    // Make sure we have all base classes registered.
    if (metadata!.baseClasses && metadata.baseClasses.length !== 0)
      this.getClass(metadata.baseClasses[0], iModel);

    // Now we can generate the class from the classDef.
    return this.generateClassForEntity(metadata);
  }

  /**
   * Find a registered class by classFullName (must be all lowercase, caller should ensure that)
   * @param classFullName class to find
   * @param iModel The IModel that contains the class definitions
   */
  public static findRegisteredClass(classFullName: string): typeof Entity | undefined { return this._classMap.get(classFullName); }

  /**
   * Get the Entity class for the specified Entity.
   * @param fullName The name of the Entity
   * @param iModel The IModel that contains the class definitions
   * @returns The Entity class
   */
  public static getClass(fullName: string, iModel: IModelDb): typeof Entity {
    const key = fullName.toLowerCase();
    const ctor = this.findRegisteredClass(key);
    return ctor ? ctor : this.generateClass(key, iModel);
  }
}

/**
 * A cache that records the mapping between class names and class metadata
 * @hidden
 */
export class MetaDataRegistry {
  private _registry: Map<string, EntityMetaData> = new Map<string, EntityMetaData>();

  /** Get the specified Entity metadata */
  public find(classFullName: string): EntityMetaData | undefined { return this._registry.get(classFullName.toLowerCase()); }

  /** Add metadata to the cache */
  public add(classFullName: string, metaData: EntityMetaData): void { this._registry.set(classFullName.toLowerCase(), metaData); }
}
