/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** @module Schema */

import { IModelError, IModelStatus } from "@bentley/imodeljs-common";
import { Logger } from "@bentley/bentleyjs-core";
import { ClassRegistry } from "./ClassRegistry";
import { IModelDb } from "./IModelDb";
import { Entity } from "./Entity";

/** Base class for all schema classes.
 * A Schema represents an ECSchema in TypeScript. It is a collection of [[Entity]]-based classes.
 *
 * <h2>ECSchema</h2>
 *
 * "EC" stands for "Entity Classification".
 * An "ECSchema" defines an EC data model. You can think of it as a namespace
 * for a set of ECClasses. An "ECClass" defines a class within an EC data model. An ECClass
 * consists of "ECProperties" which define the properties of the class. Relationships among ECClasses are described by
 * "ECRelationshipClasses". An analogy to SQL is often helpful.
 * ECClasses are like table definitions. ECProperties are like the column definitions within a table. ECRelationshipClasses are like link table definitions.
 * ECProperties can define primitive types, but can also define arrays or structs (think of TypeScript array and class concepts).
 *
 * <h2>Element Subclasses</h2>
 *
 * Define a subclass of [[Element]] to represent a specialization. To define a subclass, you must write an ECClass that subclasses from Element.
 * The ECClass must be defined in an ECSchema.
 * The same is true of subclassing [[ElementAspect]].
 *
 * <h2>Importing the Schema</h2>
 *
 * An ECSchema must be imported into an iModel before apps can insert and query instances of the ECClasses that it defines.
 * <p><em>Example:</em>
 * ``` ts
 * [[include:IModelDb.importSchema]]
 * ```
 *
 * ECSchema.xml files must be in the app backend's install set, as part of its assets.
 *
 * The app can ensure that the underlying schema is imported by registering an onOpened event handler:
 * <p><em>Example:</em>
 * ``` ts
 * [[include:Schema.importSchema]]
 * ```
 *
 * <h2>TypeScript and ECSchemas and ECClasses</h2>
 *
 * Once an ECSchema has been imported into an iModel, you can work with Elements, Models, and ElementAspects from that schema
 * without writing TypeScript classes to represent them. A JavaScript class will be generated dynamically to represent each ECClass that you
 * access, if there is no pre-registered TypeScript class to represent it.
 *
 * You <em>may</em> write a TypeScript [[Schema]] class to represent an ECSchema and TypeScript [[Element]]-based or [[ElementAspect]]-based classes to represent some or all of its ECClasses.
 * The benefit of writing a TypeScript class to represent an ECClass is that you can add hand-coded methods and type-safe constructors for it, to
 * provide and centralize the business logic that applications can use when working with that specific class. Note you still have to import
 * the underlying ECSchema.
 *
 * <h2>Schema Registration</h2>
 *
 * If an app backend wants to use a TypeScript Schema class, it must register it first.
 * <p><em>Example:</em>
 * ``` ts
 * [[include:Schema.registerSchema]]
 * ```
 *
 * The TypeScript Schema class itself must register all of the classes that it defines. The best practice is for the Schema class to do that in its constructor.
 * <p><em>Example:</em>
 * ``` ts
 * [[include:ClassRegistry.registerModule]]
 * ```
 * where RobotElement.ts might look like this:
 * ``` ts
 * [[include:Element.subclass]]
 * ```
 */
export class Schema {
  public get name(): string { return this.constructor.name; }

  /** Get the Entity class for the specified class name
   * @param className The name of the Entity
   * @param iModel The IModel that contains the class definitions
   * @returns The corresponding entity class
   */
  public static getClass(className: string, iModel: IModelDb): typeof Entity | undefined { return ClassRegistry.getClass(this.name + ":" + className, iModel); }
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
  public static getRegisteredSchema(schemaName: string): Schema | undefined { return Schemas._registeredSchemas[schemaName.toLowerCase()]; }
}
