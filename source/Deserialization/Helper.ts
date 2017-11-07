/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { SchemaInterface, SchemaChildInterface, ClassInterface } from "../Interfaces";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { SchemaContext } from "../Context";
import { ECVersion, SchemaKey } from "../ECObjects";
import SchemaChild from "../Metadata/SchemaChild";

/**
 * The purpose of this helper class is to properly order
 * the various ECObjects deserialization. For example, when deserializing an ECClass
 * most times all base class should be deserialized before the given class.
 *
 * The goal of the class is to remove the implementer of a a deserializer from having to know
 * and/or worry about if they ordered something properly.
 */
export default class SchemaReadHelper {
  private static context: SchemaContext;

  private itemToRead: any; // This will be the json object of the Schema or SchemaChild to deserialize. Not sure if this is the best option.. Going to leave it for now.

  constructor(context?: SchemaContext) {
    if (context)
      SchemaReadHelper.context = context;

    if (!SchemaReadHelper.context)
      SchemaReadHelper.context = new SchemaContext();
  }

  /**
   * Populates the given schema object with the information presented in the schemaJson provided. If present, uses the provided context to resolve any references within the schema. Otherwise, those references will be unresovled.
   * @param schema The schema object to populate. Must be an extension of the DeserializableSchemaInterface.
   * @param schemaJson An object, or string representing that object, that follows the SchemaJson format.
   * @param context TODO:
   */
  public static to<T extends SchemaInterface>(schema: T, schemaJson: object | string): T {
    const helper = new SchemaReadHelper();
    return helper.readSchema(schema, schemaJson);
  }

  /**
   *
   * @param schema
   * @param schemaJson
   */
  public readSchema<T extends SchemaInterface>(schema: T, schemaJson: object | string): T {
    this.itemToRead = typeof schemaJson === "string" ? JSON.parse(schemaJson) : schemaJson;

    // Loads all of the properties on the SchemaInterface object
    schema.fromJson(this.itemToRead);

    // Load schema references first
    // Need to figure out if other schemas are present.
    if (this.itemToRead.references)
      this.loadSchemaReferences(schema, this.itemToRead.references);

    // Load all schema children
    if (this.itemToRead.children) {
      for (const childName in this.itemToRead.children) {
        // Make sure the child has not already been read.
        if (schema.getChild(childName) !== undefined)
          continue;

        this.loadSchemaChild(schema, this.itemToRead.children[childName], childName);
      }
    }

    // TODO: Load CustomAttributes

    return schema;
  }

  private loadSchemaReferences(schema: SchemaInterface, referencesJson: any) {
    if (!Array.isArray(referencesJson))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The schema ${schema.schemaKey.name} has an invalid 'references' property. It should be of type 'array'.`);

    referencesJson.forEach((ref) => {
      if (!ref.name)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The schema ${schema.schemaKey.name} has an invalid 'references' property. One of the references is missing the required 'name' property.`);

      if (!ref.version)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The schema ${schema.schemaKey.name} has an invalid 'references' property. One of the references is missing the required 'version' property.`);

      const refVersion = new ECVersion();
      refVersion.fromString(ref.version);

      const schemaKey = new SchemaKey(ref.name);
      schemaKey.readVersion = refVersion.read;
      schemaKey.writeVersion = refVersion.write;
      schemaKey.minorVersion = refVersion.minor;

      const refSchema = SchemaReadHelper.context.locateSchema(schemaKey);
      if (!refSchema)
        throw new ECObjectsError(ECObjectsStatus.UnableToLocateSchema, `Could not locate the referenced schema, ${ref.name}.${ref.version}, of ${schema.schemaKey.name}`);

      schema.addReference(refSchema);
    });
  }

  /**
   *
   * @param schemaChild The schemaChild object to populate. Must extend from DeserializableItem.
   * @param schemaChildJson The json to deserialize from. Must follow the SchemaChildJson format.
   * @param context The context in which the provided SchemaChild should be deserialized in. If no context is provided, none of the references within the child will be resolved. // TODO: Context should be either an ECSchema or an ECSchemaContext, which contains an entire graph of things.
   */
  // public static loadSchemaChild<T extends DeserializableItem>(schemaChild: T, schemaChildJson: any, context?: DeserializableSchemaInterface): void {
  //   const helper = new DeserializationHelper(context);
  //   helper.loadSchemaChild(schemaChild, schemaChildJson);
  // }

  /**
   *
   * @param schemaChild
   * @param schemaChildJson
   * @param name
   */
  private loadSchemaChild(schema: SchemaInterface, schemaChildJson: any, name?: string) {
    const childName = (schemaChildJson.name) ? schemaChildJson.name : name;
    if (!childName)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson);

    switch (schemaChildJson.schemaChildType) {
      case "EntityClass":
        const entityClass: ClassInterface = schema.createEntityClass(childName);
        this.loadEntityClass(entityClass, schemaChildJson, schema);
        break;
      case "StructClass":
        const structClass: ClassInterface = schema.createStructClass(childName);
        this.loadClass(structClass, schemaChildJson, schema);
        break;
      case "Mixin":
        const mixin: ClassInterface = schema.createMixinClass(childName);
        this.loadMixin(mixin, schemaChildJson, schema);
        break;
      case "CustomAttributeClass":
        const caClass: ClassInterface = schema.createCustomAttributeClass(childName);
        this.loadClass(caClass, schemaChildJson, schema);
        break;
      case "RelationshipClass":
        break;
      case "KindOfQuantity":
        const koq: SchemaChildInterface = schema.createKindOfQuantity(childName);
        koq.fromJson(schemaChildJson);
        break;
      case "PropertyCategory":
        const propCategory: SchemaChildInterface = schema.createPropertyCategory(childName);
        propCategory.fromJson(schemaChildJson);
        break;
      case "Enumeration":
        const enumeration: SchemaChildInterface = schema.createEnumeration(childName);
        enumeration.fromJson(schemaChildJson);
        break;
    }
  }

  /**
   *
   * @param schemaJson The original json object of the schema.
   * @param classJson The json object for this class
   * @param schema The ECSchema this class exists in.
   */
  private loadClass(classObj: ClassInterface, classJson: any, schema?: SchemaInterface): void {
    // Load base class first
    if (classJson.baseClass) {
      const [schemaName, childName] = SchemaChild.parseFullName(classJson.baseClass);

      // First look to see if the class exists in the current schema
      if (schema && schema.schemaKey.name.toLowerCase() === schemaName.toLowerCase()) {
        if (undefined === schema.getChild(childName))
          this.loadSchemaChild(schema, this.itemToRead[childName], childName);
        else
          classObj.baseClass = schema.getChild<ClassInterface>(childName);

      } else{
        const potentialBaseClass = SchemaReadHelper.context.locateSchemaChild<ClassInterface>(classJson.baseClass);
        if (undefined === potentialBaseClass)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, "");

        classObj.baseClass = potentialBaseClass;
      }
    }

    classObj.fromJson(classJson);
  }

  private loadEntityClass(entity: ClassInterface, entityJson: any, schema?: SchemaInterface): void {
    // Load Mixin classes first
    if (entityJson.mixin) {
      // if (typeof(entityJson.mixin) === "string" && entity.schema.getChild(entityJson.mixin) === undefined)
      //   this.loadClass(schema, schemaJson, schemaJson.children[entityJson.mixin]);
      // else if (Array.isArray(entityJson.mixin)) {
      //   entityJson.mixin.array.forEach((mixinName: string) => {
      //     if (schema.getChild(mixinName) !== undefined)
      //       return;
      //     this.loadClass(schema, schemaJson, schemaJson.children[mixinName], mixinName);
      //   });
      // }
    }

    this.loadClass(entity, entityJson, schema);
  }

  private loadMixin(mixin: ClassInterface, mixinJson: any, schema?: SchemaInterface): void {
    if (mixinJson.appliesTo) {
      // if (typeof(mixinJson.appliesTo) === "string" && schema.getChild(mixinJson.appliesTo) === undefined)
      //   this.loadClass(schema, schemaJson, schemaJson.children[mixinJson.appliesTo], mixinJson.appliesTo);
      // else
      //   throw new ECObjectsError(ECObjectsStatus.InvalidECJson, "");
    }

    this.loadClass(mixin, mixinJson, schema);
  }
}
