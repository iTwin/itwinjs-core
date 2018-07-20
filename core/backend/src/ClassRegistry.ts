/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Schema */

import { EntityProps, IModelError, IModelStatus, EntityMetaData } from "@bentley/imodeljs-common";
import { Entity } from "./Entity";
import { IModelDb } from "./IModelDb";
import { Schema, Schemas } from "./Schema";

/** The mapping between a class name (schema.class) and its constructor function  */
export class ClassRegistry {
  private static readonly classMap = new Map<string, typeof Entity>();
  private static getKey(schemaName: string, className: string) { return (schemaName + ":" + className).toLowerCase(); }
  private static lookupClass(name: string) { return this.classMap.get(name.toLowerCase()); }

  /** @hidden */
  public static isNotFoundError(err: any) { return (err instanceof IModelError) && (err.errorNumber === IModelStatus.NotFound); }

  private static makeClassNotFoundError(className: string): IModelError { return new IModelError(IModelStatus.NotFound, "class " + className + "not found"); }

  /** @hidden */
  public static makeMetaDataNotFoundError(className: string): IModelError { return new IModelError(IModelStatus.NotFound, "metadata not found for " + className); }

  /**
   * Construct an instance of an Entity class, given its EntityProps.
   * @throws IModelError if the class or class metadata is not available.
   * @hidden
   */
  public static createInstance(props: EntityProps, iModel: IModelDb): Entity {
    if (!props.classFullName)
      throw new IModelError(IModelStatus.BadArg, "props must have a classFullName member");

    let entityClass = this.classMap.get(props.classFullName.toLowerCase());
    if (!entityClass) {
      entityClass = this.generateClass(props.classFullName, iModel);
      if (!entityClass)
        throw this.makeClassNotFoundError(props.classFullName);
    }
    return new entityClass(props, iModel);
  }

  /** @hidden */
  public static register(entityClass: typeof Entity) { this.classMap.set(this.getKey(entityClass.schema.name, entityClass.name), entityClass); }
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
    // the above line creates an "anonymous" class. We rely on the "constructor.name" property to be eponymous with the EcClass name.
    Object.defineProperty(generatedClass, "name", { get: () => className });  // this is the (only) way to change that readonly property.

    generatedClass.schema = schema; // save the schema property
    this.register(generatedClass); // register it before returning
    return generatedClass;
  }

  /**
   * Register all of the classes that derive from Entity, that are found in a given module. See the example in [[Schema]]
   * @param moduleObj The module to search for subclasses of Entity
   * @param schema The schema for all found classes
   */
  public static registerModule(moduleObj: any, schema: Schema) {
    for (const thisMember in moduleObj) {
      if (!thisMember)
        continue;

      const thisClass = moduleObj[thisMember];
      if (thisClass.prototype instanceof Entity) {
        thisClass.schema = schema;
        this.register(thisClass);
      }
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

    // Make sure that we have all base classes registered.
    // This recurses. I have to know that the super class is defined and registered before defining a derived class.
    if (metadata!.baseClasses && metadata.baseClasses.length !== 0)
      this.getClass(metadata.baseClasses[0], iModel);

    // Now we can generate the class from the classDef.
    return this.generateClassForEntity(metadata);
  }

  /**
   * Get the Entity class for the specified Entity.
   * @param fullName The name of the Entity
   * @param iModel The IModel that contains the class definitions
   * @returns A promise that resolves to an object containing a result property set to the Entity.
   * @throws [[IModelError]] if the class is not found.
   */
  public static getClass(fullName: string, iModel: IModelDb): typeof Entity {
    const key = fullName.toLowerCase();
    if (!this.classMap.has(key))
      return this.generateClass(fullName, iModel);

    const ctor = this.classMap.get(key);
    if (!ctor)
      throw this.makeClassNotFoundError(fullName);

    return ctor;
  }
}

/**
 * A cache that records mappings between class names and class metadata
 */
export class MetaDataRegistry {
  private _registry: Map<string, EntityMetaData> = new Map<string, EntityMetaData>();

  /** Get the specified Entity metadata */
  public find(classFullName: string): EntityMetaData | undefined { return this._registry.get(classFullName.toLowerCase()); }

  /** Add metadata to the cache */
  public add(classFullName: string, metaData: EntityMetaData): void { this._registry.set(classFullName.toLowerCase(), metaData); }
}
