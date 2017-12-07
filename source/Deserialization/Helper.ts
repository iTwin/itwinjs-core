/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { SchemaInterface, SchemaChildInterface, ECClassInterface, EntityClassInterface, MixinInterface,
        RelationshipClassInterface, RelationshipConstraintInterface, CustomAttributeClassInterface, KindOfQuantityInterface } from "../Interfaces";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { SchemaContext } from "../Context";
import { ECVersion, SchemaKey, parsePrimitiveType } from "../ECObjects";
import SchemaChild from "../Metadata/SchemaChild";
// import KindOfQuantity from "Metadata/KindOfQuantity";

/**
 * The purpose of this helper class is to properly order
 * the various ECObjects deserialization. For example, when deserializing an ECClass
 * most times all base class should be deserialized before the given class.
 *
 * The goal of the class is to remove the implementer of a deserializer from having to know
 * and/or worry about if they ordered something properly.
 */
export default class SchemaReadHelper {
  private _context: SchemaContext;

  // This is a cache of the schema we are loading. It also exists within the _context but in order
  // to not have to go back to the context every time if we don't have to this cache has been added.
  private _schema?: SchemaInterface;

  private _itemToRead: any; // This will be the json object of the Schema or SchemaChild to deserialize. Not sure if this is the best option.. Going to leave it for now.

  constructor(context?: SchemaContext) {
    if (context)
      this._context = context;

    if (!this._context)
      this._context = new SchemaContext();
  }

  /**
   * Populates the given schema object with the information presented in the schemaJson provided. If present, uses the provided context to resolve any references within the schema. Otherwise, those references will be unresovled.
   * @param schema The schema object to populate. Must be an extension of the DeserializableSchemaInterface.
   * @param schemaJson An object, or string representing that object, that follows the SchemaJson format.
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
    this._itemToRead = typeof schemaJson === "string" ? JSON.parse(schemaJson) : schemaJson;

    // Loads all of the properties on the SchemaInterface object
    schema.fromJson(this._itemToRead);

    // Need to add this schema to the context to be able to locate schemaChildren within the context.
    // TODO: It should be removed if it fails to deserialize... Although that may not happen since we throw errors now.
    this._schema = schema;
    this._context.addSchema(schema);

    // Load schema references first
    // Need to figure out if other schemas are present.
    if (this._itemToRead.references)
      this.loadSchemaReferences(schema, this._itemToRead.references);

    // Load all schema children
    if (this._itemToRead.children) {
      for (const childName in this._itemToRead.children) {
        // Make sure the child has not already been read.
        // TODO: Possibly check the SchemaContext to make sure the SchemaChild has not already been previously loaded.
        //       For now we will just double load a SchemaChild
        if (schema.getChild(childName) !== undefined)
          continue;

        this.loadSchemaChild(schema, this._itemToRead.children[childName], childName);
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

      const refSchema = this._context.locateSchema(schemaKey);
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

    if (!schemaChildJson.schemaChildType)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

    switch (schemaChildJson.schemaChildType) {
      case "EntityClass":
        const entityClass: EntityClassInterface = schema.createEntityClass(childName);
        this.loadEntityClass(entityClass, schemaChildJson);
        break;
      case "StructClass":
        const structClass: ECClassInterface = schema.createStructClass(childName);
        this.loadClass(structClass, schemaChildJson);
        break;
      case "Mixin":
        const mixin: MixinInterface = schema.createMixinClass(childName);
        this.loadMixin(mixin, schemaChildJson);
        break;
      case "CustomAttributeClass":
        const caClass: CustomAttributeClassInterface = schema.createCustomAttributeClass(childName);
        this.loadClass(caClass, schemaChildJson);
        break;
      case "RelationshipClass":
        const relClass: RelationshipClassInterface = schema.createRelationshipClass(childName);
        this.loadRelationshipClass(relClass, schemaChildJson);
        break;
      case "KindOfQuantity":
        const koq: KindOfQuantityInterface = schema.createKindOfQuantity(childName);
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
   * Helps find a SchemaChild by first checking if it exists within the provided schema.
   * @param fullName
   * @param schema
   */
  private findSchemaChild(fullName: string): void {
    const [schemaName, childName] = SchemaChild.parseFullName(fullName);

    if (this._schema && this._schema.schemaKey.name.toLowerCase() === schemaName.toLowerCase() && undefined === this._schema.getChild(childName)) {
      this.loadSchemaChild(this._schema, this._itemToRead.children[childName], childName);
    } else if (undefined === this._context.locateSchemaChild(fullName)) {
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate SchemaChild ${fullName}.`);
    }
  }

  // private loadCustomAttributeClasses(customAttributesJson: any, schema?: SchemaInterface): void {
  //   if (!customAttributesJson.customAttributes)
  //     return;

  //   if (!Array.isArray(customAttributesJson.customAttributes))
  //     throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

  //   customAttributesJson.customAttributes.forEach((caJson: any) => {
  //     if (caJson) {
  //       if (!caJson.className)
  //         throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

  //       if (typeof(caJson.className) !== "string")
  //         throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

  //       this.findSchemaChild(caJson.className, schema);
  //     }
  //   });
  // }

  /**
   *
   */
  private loadPropertyTypes(classObj: ECClassInterface, propertyJson: any): void {
    if (typeof(propertyJson.name) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

    const propName = propertyJson.name;

    if (typeof(propertyJson.propertyType) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

    if (propertyJson.category) {
      if (typeof(propertyJson.category) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
      this.findSchemaChild(propertyJson.category);
    }

    if (propertyJson.kindOfQuantity) {
      if (typeof(propertyJson.kindOfQuantity) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
      this.findSchemaChild(propertyJson.kindOfQuantity);
    }

    const loadEnumForPrimitiveProp = () => {
      if (propertyJson.typeName) {
        if (typeof(propertyJson.typeName) !== "string")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

        try {
          parsePrimitiveType(propertyJson.typeName);
        } catch (err) {
          this.findSchemaChild(propertyJson.typeName);
        }
        // TODO Load Enumeration
      }
    };

    const loadStructForStructProp = () => {
      if (propertyJson.typeName) {
        if (typeof(propertyJson.typeName) !== "string")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
        this.findSchemaChild(propertyJson.typeName);
      }
    };

    switch (propertyJson.propertyType) {
      case "PrimitiveProperty":
        loadEnumForPrimitiveProp();

        const primProp = classObj.createPrimitiveProperty(propName);
        primProp.fromJson(propertyJson);
        break;
      case "StructProperty":
        // Try and load struct class on property
        loadStructForStructProp();

        const structProp = classObj.createStructProperty(propName, propertyJson.typeName);
        structProp.fromJson(propertyJson);
        break;
      case "PrimitiveArrayProperty":
        loadEnumForPrimitiveProp();

        const primArrProp = classObj.createPrimitiveArrayProperty(propName);
        primArrProp.fromJson(propertyJson);
        break;
      case "StructArrayProperty":
        loadStructForStructProp();

        const structArrProp = classObj.createStructArrayProperty(propName, propertyJson.typeName);
        structArrProp.fromJson(propertyJson);
        break;
      case "NavigationProperty":
        break;
    }

    // TODO Load CustomAttributeClasses
  }

  /**
   *
   * @param schemaJson The original json object of the schema.
   * @param classJson The json object for this class
   * @param schema The ECSchema this class exists in.
   */
  private loadClass(classObj: ECClassInterface, classJson: any): void {
    // Load base class first
    if (classJson.baseClass) {
      if (typeof(classJson.baseClass) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
      this.findSchemaChild(classJson.baseClass);
    }

    if (classJson.properties) {
      if (!Array.isArray(classJson.properties))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

      classJson.properties.forEach((property: any) => {
        if (typeof(property) !== "object")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

        this.loadPropertyTypes(classObj, property);
      });
    }
    // TODO Load all class that are used within properties

    classObj.fromJson(classJson);
  }

  private loadEntityClass(entity: EntityClassInterface, entityJson: any): void {
    // Load Mixin classes first
    if (entityJson.mixin) {
      if (typeof(entityJson.mixin) === "string") {
        this.findSchemaChild(entityJson.mixin);
      } else if (Array.isArray(entityJson.mixin)) {
        entityJson.mixin.forEach((mixinName: string) => {
          this.findSchemaChild(mixinName);
        });
      }
    }

    this.loadClass(entity, entityJson);
  }

  private loadMixin(mixin: ECClassInterface, mixinJson: any): void {
    if (mixinJson.appliesTo) {
      if (typeof(mixinJson.appliesTo) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, "");
      this.findSchemaChild(mixinJson.appliesTo);
    }

    this.loadClass(mixin, mixinJson);
  }

  private loadRelationshipClass(rel: RelationshipClassInterface, relJson: any): void {
    if (!relJson.source)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The RelationshipClass ${rel.name} is missing the required source constraint.`);
    this.loadRelationshipConstraint(rel.source, relJson.source);

    if (!relJson.target)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The RelationshipClass ${rel.name} is missing the required target constraint.`);
    this.loadRelationshipConstraint(rel.target, relJson.target);

    this.loadClass(rel, relJson);
  }

  private loadRelationshipConstraint(relConstraint: RelationshipConstraintInterface, relConstraintJson: any): void {
    if (relConstraintJson.abstractConstraint) {
      if (typeof(relConstraintJson.abstractConstraint) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
      this.findSchemaChild(relConstraintJson.abstractConstraint);
    }

    if (relConstraintJson.constraintClasses) {
      if (!Array.isArray(relConstraintJson.constraintClasses))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
      relConstraintJson.constraintClasses.forEach((constraintClass: string) => {
        this.findSchemaChild(constraintClass);
      });
    }

    relConstraint.fromJson(relConstraintJson);
  }
}
