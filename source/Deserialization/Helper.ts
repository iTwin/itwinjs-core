/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { DeserializableSchemaInterface } from "../ECInterfaces/DeserializationInterfaces";
import { ECObjectsError, ECObjectsStatus } from "../Exception";

/**
 * The purpose of this helper class is to properly order
 * the various ECObjects deserialization. For example, when deserializing an ECClass
 * most times all base class should be deserialized before the given class.
 *
 * The goal of the class is to remove the implementer of a a deserializer from having to know
 * and/or worry about if they ordered something properly.
 */
export default class DeserializationHelper {

  public static to<T extends DeserializableSchemaInterface>(schema: T, schemaJson: object | string): T {
    const jsonObj = typeof schemaJson === "string" ? JSON.parse(schemaJson) : schemaJson;

    // TODO : Load schema references first

    // Loads all of the properties on the ECSchemaInterface object
    schema.fromJson(jsonObj);

    if (jsonObj.children) {
      for (const childName in jsonObj.children) {
        if (schema.getClass(childName) !== undefined)
          continue;
        DeserializationHelper.loadClass(schema, jsonObj, jsonObj.children[childName], childName);
      }
    }

    // TODO: Load CustomAttributes

    return schema;
  }

  /**
   * 
   * @param schemaChildJson The json representation of the SchemaChild.
   * @param schema A parent object to add this schemaChild to
   * @param name The name of the Schema Child. Only needed if the Child lives within its parent.
   */
  // private static loadSchemaChild(schemaChildJson: any, parent?: DeserializableSchemaInterface, name?: string): void {
  //   // If in the context of a parent, check if the schema child already has been deserailized
  //   if (parent) {
  //     parent.getChild(name);
  //   }
  // }

  /**
   *
   * @param schema The ECSchema to add the class to.
   * @param schemaJson The original json object of the schema.
   * @param classJson The json object for this class
   */
  private static loadClass(schema: DeserializableSchemaInterface, schemaJson: any, classJson: any, name?: string): void {
    const className = name ? name : classJson.name;

    // Load base classes first
    if (classJson.baseClass) {
      if (schema.getClass(classJson.baseClass) === undefined) {
        DeserializationHelper.loadClass(schema, schemaJson, schemaJson.children[classJson.baseClass], classJson.baseClass);
      }
    }

    switch (classJson.schemaChildType) {
      case "EntityClass":
        // Need to create the Entity first because of silly circular dependencies with Mixins...
        const entityClass = schema.createEntityClass(className);

        // Load Mixin classes first
        if (classJson.mixin) {
          if (typeof(classJson.mixin) === "string" && schema.getClass(classJson.mixin) === undefined)
            DeserializationHelper.loadClass(schema, schemaJson, schemaJson.children[classJson.mixin]);
          else if (Array.isArray(classJson.mixin)) {
            classJson.array.forEach((mixinName: string) => {
              if (schema.getClass(mixinName) !== undefined)
                return;
              DeserializationHelper.loadClass(schema, schemaJson, schemaJson.children[mixinName], mixinName);
            });
          }
        }

        entityClass.fromJson(classJson);
        break;
      case "Mixin":
        // Need to create the Mixin first because of silly circular dependencies with the AppliesTo EntityClasses...
        const mixinClass = schema.createMixinClass(className);

        if (classJson.appliesTo) {
          if (typeof(classJson.appliesTo) === "string" && schema.getClass(classJson.appliesTo) === undefined)
            DeserializationHelper.loadClass(schema, schemaJson, schemaJson.children[classJson.appliesTo], classJson.appliesTo);
          else
            throw new ECObjectsError(ECObjectsStatus.InvalidECJson, "");
        }

        mixinClass.fromJson(classJson);
        break;
      case "StructClass":
        const structClass = schema.createStructClass(className);
        structClass.fromJson(classJson);
        break;
      case "RelationshipClass":
        // TODO
        break;
    }
  }
}
