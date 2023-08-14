/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { DbResult, Id64, IModelStatus, Logger } from "@itwin/core-bentley";
import { EntityMetaData, EntityReferenceSet, IModelError, RelatedElement } from "@itwin/core-common";
import { Entity } from "./Entity";
import { IModelDb } from "./IModelDb";
import { Schema, Schemas } from "./Schema";
import { EntityReferences } from "./EntityReferences";
import * as assert from "assert";

const isGeneratedClassTag = Symbol("isGeneratedClassTag");

/** The mapping between a BIS class name (in the form "schema:class") and its JavaScript constructor function
 * @public
 */
export class ClassRegistry {
  private static readonly _classMap = new Map<string, typeof Entity>();
  /** @internal */
  public static isNotFoundError(err: any) { return (err instanceof IModelError) && (err.errorNumber === IModelStatus.NotFound); }
  /** @internal */
  public static makeMetaDataNotFoundError(className: string): IModelError { return new IModelError(IModelStatus.NotFound, `metadata not found for ${className}`); }
  /** @internal */
  public static register(entityClass: typeof Entity, schema: typeof Schema) {
    entityClass.schema = schema;
    const key = (`${schema.schemaName}:${entityClass.className}`).toLowerCase();
    if (this._classMap.has(key)) {
      const errMsg = `Class ${key} is already registered. Make sure static className member is correct on JavaScript class ${entityClass.name}`;
      Logger.logError("core-frontend.classRegistry", errMsg);
      throw new Error(errMsg);
    }

    this._classMap.set(key, entityClass);
  }

  /** Generate a proxy Schema for a domain that has not been registered. */
  private static generateProxySchema(domain: string, iModel: IModelDb): typeof Schema {
    const hasBehavior = iModel.withPreparedSqliteStatement(`
      SELECT NULL FROM [ec_CustomAttribute] [c]
        JOIN [ec_schema] [s] ON [s].[Id] = [c].[ContainerId]
        JOIN [ec_class] [e] ON [e].[Id] = [c].[ClassId]
        JOIN [ec_schema] [b] ON [e].[SchemaId] = [b].[Id]
      WHERE [c].[ContainerType] = 1 AND [s].[Name] = ? AND [b].[Name] || '.' || [e].[name] = ?`, (stmt) => {
      stmt.bindString(1, domain);
      stmt.bindString(2, "BisCore.SchemaHasBehavior");
      return stmt.step() === DbResult.BE_SQLITE_ROW;
    });

    const schemaClass = class extends Schema {
      public static override get schemaName() { return domain; }
      public static override get missingRequiredBehavior() { return hasBehavior; }
    };

    Schemas.registerSchema(schemaClass); // register the class before we return it.
    return schemaClass;
  }

  /** First, finds the root BisCore entity class for an entity, by traversing base classes and mixin targets (AppliesTo).
   * Then, gets its metadata and returns that.
   * @param iModel - iModel containing the metadata for this type
   * @param ecTypeQualifier - a full name of an ECEntityClass to find the root of
   * @returns the qualified full name of an ECEntityClass
   * @internal public for testing only
   */
  public static getRootEntity(iModel: IModelDb, ecTypeQualifier: string): string {
    const [classSchema, className] = ecTypeQualifier.split(".");
    const schemaItemJson = iModel.nativeDb.getSchemaItem(classSchema, className);
    if (schemaItemJson.error)
      throw new IModelError(schemaItemJson.error.status, `failed to get schema item '${ecTypeQualifier}'`);

    assert(undefined !== schemaItemJson.result);
    const schemaItem = JSON.parse(schemaItemJson.result);
    if (!("appliesTo" in schemaItem) && schemaItem.baseClass === undefined) {
      return ecTypeQualifier;
    }

    // typescript doesn't understand that the inverse of the above condition is
    // ("appliesTo" in rootclassMetaData || rootClassMetaData.baseClass !== undefined)
    const parentItemQualifier = schemaItem.appliesTo ?? schemaItem.baseClass as string;
    return this.getRootEntity(iModel, parentItemQualifier);
  }

  /** Generate a JavaScript class from Entity metadata.
   * @param entityMetaData The Entity metadata that defines the class
   */
  private static generateClassForEntity(entityMetaData: EntityMetaData, iModel: IModelDb): typeof Entity {
    const name = entityMetaData.ecclass.split(":");
    const domainName = name[0];
    const className = name[1];

    if (0 === entityMetaData.baseClasses.length) // metadata must contain a superclass
      throw new IModelError(IModelStatus.BadArg, `class ${name} has no superclass`);

    // make sure schema exists
    let schema = Schemas.getRegisteredSchema(domainName);
    if (undefined === schema)
      schema = this.generateProxySchema(domainName, iModel); // no schema found, create it too

    const superclass = this._classMap.get(entityMetaData.baseClasses[0].toLowerCase());
    if (undefined === superclass)
      throw new IModelError(IModelStatus.NotFound, `cannot find superclass for class ${name}`);

    // user defined class hierarchies may skip a class in the hierarchy, and therefore their JS base class cannot
    // be used to tell if there are any generated classes in the hierarchy
    let generatedClassHasNonGeneratedNonCoreAncestor = false;
    let currentSuperclass = superclass;
    const MAX_ITERS = 1000;
    for (let i = 0; i < MAX_ITERS; ++i) {
      if (currentSuperclass.schema.schemaName === "BisCore")
        break;

      if (!currentSuperclass.isGeneratedClass) {
        generatedClassHasNonGeneratedNonCoreAncestor = true;
        break;
      }
      const superclassMetaData = iModel.classMetaDataRegistry.find(currentSuperclass.classFullName);
      if (superclassMetaData === undefined)
        throw new IModelError(IModelStatus.BadSchema, `could not find the metadata for class '${currentSuperclass.name}', class metadata should be loaded by now`);
      const maybeNextSuperclass = this.getClass(superclassMetaData.baseClasses[0], iModel);
      if (maybeNextSuperclass === undefined)
        throw new IModelError(IModelStatus.BadSchema, `could not find the base class of '${currentSuperclass.name}', all generated classes must have a base class`);
      currentSuperclass = maybeNextSuperclass;
    }

    const generatedClass = class extends superclass {
      public static override get className() { return className; }
      private static [isGeneratedClassTag] = true;
      public static override get isGeneratedClass() { return this.hasOwnProperty(isGeneratedClassTag); }
    };

    // the above creates an anonymous class. For help debugging, set the "constructor.name" property to be the same as the bisClassName.
    Object.defineProperty(generatedClass, "name", { get: () => className });  // this is the (only) way to change that readonly property.

    // a class only gets an automatic `collectReferenceIds` implementation if:
    // - it is not in the `BisCore` schema
    // - there are no ancestors with manually registered JS implementations, (excluding BisCore base classes)
    if (!generatedClassHasNonGeneratedNonCoreAncestor) {
      const navigationProps = Object.entries(entityMetaData.properties)
        .filter(([_name, prop]) => prop.isNavigation)
        // eslint-disable-next-line @typescript-eslint/no-shadow
        .map(([name, prop]) => {
          assert(prop.relationshipClass);
          const maybeMetaData = iModel.nativeDb.getSchemaItem(...prop.relationshipClass.split(":") as [string, string]);
          assert(maybeMetaData.result !== undefined, "The nav props relationship metadata was not found");
          const relMetaData = JSON.parse(maybeMetaData.result);
          const rootClassMetaData = ClassRegistry.getRootEntity(iModel, relMetaData.target.constraintClasses[0]);
          // root class must be in BisCore so should be loaded since biscore classes will never get this
          // generated implementation
          const normalizeClassName = (clsName: string) => clsName.replace(".", ":");
          const rootClass = ClassRegistry.findRegisteredClass(normalizeClassName(rootClassMetaData));
          assert(rootClass, `The root class for ${prop.relationshipClass} was not in BisCore.`);
          return { name, concreteEntityType: EntityReferences.typeFromClass(rootClass) };
        });

      Object.defineProperty(
        generatedClass.prototype,
        "collectReferenceIds",
        {
          value(this: typeof generatedClass, referenceIds: EntityReferenceSet) {
            // eslint-disable-next-line @typescript-eslint/dot-notation
            const superImpl = superclass.prototype["collectReferenceIds"];
            superImpl.call(this, referenceIds);
            for (const navProp of navigationProps) {
              const relatedElem: RelatedElement | undefined = (this as any)[navProp.name]; // cast to any since subclass can have any extensions
              if (!relatedElem || !Id64.isValid(relatedElem.id))
                continue;
              const referenceId = EntityReferences.fromEntityType(relatedElem.id, navProp.concreteEntityType);
              referenceIds.add(referenceId);
            }
          },
          // defaults for methods on a prototype (required for sinon to stub out methods on tests)
          writable: true,
          configurable: true,
        },
      );
    }

    // if the schema is a proxy for a domain with behavior, throw exceptions for all protected operations
    if (schema.missingRequiredBehavior) {
      const throwError = () => {
        throw new IModelError(IModelStatus.WrongHandler, `Schema [${domainName}] not registered, but is marked with SchemaHasBehavior`);
      };

      superclass.protectedOperations.forEach((operation) => (generatedClass as any)[operation] = throwError);
    }

    this.register(generatedClass, schema); // register it before returning
    return generatedClass;
  }

  /** Register all of the classes found in the given module that derive from Entity. See the example in [[Schema]]
   * @param moduleObj The module to search for subclasses of Entity
   * @param schema The schema for all found classes
   */
  public static registerModule(moduleObj: any, schema: typeof Schema) {
    for (const thisMember in moduleObj) { // eslint-disable-line guard-for-in
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
    if (metadata.baseClasses && (0 !== metadata.baseClasses.length))
      this.getClass(metadata.baseClasses[0], iModel);

    // Now we can generate the class from the classDef.
    return this.generateClassForEntity(metadata, iModel);
  }

  /** Find a registered class by classFullName.
   * @param classFullName class to find
   * @param iModel The IModel that contains the class definitions
   * @returns The Entity class or undefined
   */
  public static findRegisteredClass(classFullName: string): typeof Entity | undefined {
    return this._classMap.get(classFullName.toLowerCase());
  }

  /** Get the Entity class for the specified Entity className.
   * @param classFullName The full BIS class name of the Entity
   * @param iModel The IModel that contains the class definitions
   * @returns The Entity class
   */
  public static getClass(classFullName: string, iModel: IModelDb): typeof Entity {
    const key = classFullName.toLowerCase();
    const ctor = this._classMap.get(key);
    return ctor ? ctor : this.generateClass(key, iModel);
  }

  /** Unregister a class, by name, if one is already registered.
   * This function is not normally needed, but is useful for cases where a generated *proxy* class needs to be replaced by the *real* class.
   * @param classFullName Name of the class to unregister
   * @return true if the class was unregistered
   * @internal
   */
  public static unregisterCLass(classFullName: string) { return this._classMap.delete(classFullName.toLowerCase()); }
  /** Unregister all classes from a schema.
   * This function is not normally needed, but is useful for cases where a generated *proxy* schema needs to be replaced by the *real* schema.
   * @param schema Name of the schema to unregister
   * @internal
   */
  public static unregisterClassesFrom(schema: typeof Schema) {
    for (const entry of Array.from(this._classMap)) {
      if (entry[1].schema === schema)
        this.unregisterCLass(entry[0]);
    }
  }
}

/**
 * A cache that records the mapping between class names and class metadata.
 * @see [[IModelDb.classMetaDataRegistry]] to access the registry for a specific iModel.
 * @internal
 */
export class MetaDataRegistry {
  private _registry: Map<string, EntityMetaData> = new Map<string, EntityMetaData>();

  /** Get the specified Entity metadata */
  public find(classFullName: string): EntityMetaData | undefined { return this._registry.get(classFullName.toLowerCase()); }

  /** Add metadata to the cache */
  public add(classFullName: string, metaData: EntityMetaData): void { this._registry.set(classFullName.toLowerCase(), metaData); }
}
