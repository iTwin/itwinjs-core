/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { SchemaContext } from "../Context";
import { SchemaKey, relationshipEndToString, SchemaChildKey, SchemaChildType, tryParsePrimitiveType, tryParseSchemaChildType, ECVersion } from "../ECObjects";
import SchemaChild from "../Metadata/SchemaChild";
import Schema, { MutableSchema } from "../Metadata/Schema";
import EntityClass, { MutableEntityClass } from "../Metadata/EntityClass";
import Mixin from "../Metadata/Mixin";
import RelationshipClass, { RelationshipConstraint } from "../Metadata/RelationshipClass";
import { AnyClass, SchemaDeserializationVisitor, AnySchemaChild } from "../Interfaces";
import { Property } from "../Metadata/Property";
import { MutableClass } from "../Metadata/Class";

/**
 * The purpose of this class is to properly order the deserialization of ECSchemas and SchemaChildren from the JSON formats.
 * For example, when deserializing an ECClass most times all base class should be de-serialized before the given class.
 */
export default class SchemaReadHelper {
  private _context: SchemaContext;
  private _visitor?: SchemaDeserializationVisitor;

  // This is a cache of the schema we are loading. It also exists within the _context but in order
  // to not have to go back to the context every time if we don't have to this cache has been added.
  private _schema: Schema;

  private _itemToRead: any; // This will be the json object of the Schema or SchemaChild to deserialize. Not sure if this is the best option.. Going to leave it for now.

  constructor(context?: SchemaContext, visitor?: SchemaDeserializationVisitor) {
    if (context)
      this._context = context;

    if (!this._context)
      this._context = new SchemaContext();

    this._visitor = visitor;
  }

  /**
   * Populates the given schema object with the information presented in the schemaJson provided. If present, uses the provided context to resolve any references within the schema.
   * Otherwise, those references will be unresolved.
   * @param schema The schema object to populate. Must be an extension of the DeserializableSchema.
   * @param schemaJson An object, or string representing that object, that follows the SchemaJson format.
   */
  public static to<T extends Schema>(schema: T, schemaJson: object | string, visitor?: SchemaDeserializationVisitor): Promise<T> {
    const helper = new SchemaReadHelper(undefined, visitor);
    return helper.readSchema(schema, schemaJson);
  }

  /**
   * Populates the given Schema with the JSON.
   * @param schema The Schema to populate
   * @param schemaJson The JSON to use to populate the Schema.
   */
  public async readSchema<T extends Schema>(schema: T, schemaJson: object | string): Promise<T> {
    this._itemToRead = typeof schemaJson === "string" ? JSON.parse(schemaJson) : schemaJson;

    // Loads all of the properties on the Schema object
    await schema.fromJson(this._itemToRead);

    this._schema = schema;

    // Need to add this schema to the context to be able to locate schemaChildren within the context.
    await this._context.addSchema(schema);

    // Load schema references first
    // Need to figure out if other schemas are present.
    if (undefined !== this._itemToRead.references)
      await this.loadSchemaReferences(this._itemToRead.references);

    if (this._visitor && this._visitor.visitEmptySchema)
      await this._visitor.visitEmptySchema(schema);

    // Load all schema children
    if (undefined !== this._itemToRead.children) {
      if (typeof(this._itemToRead.children) !== "object" || Array.isArray(this._itemToRead.children))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The schema ${this._schema.schemaKey.name} has an invalid 'children' property. It should be of type 'object'.`);

      for (const childName in this._itemToRead.children) {
        // Make sure the child has not already been read. No need to check the SchemaContext because all SchemaChildren are added to a Schema,
        // which would be found when adding to the context.
        if (await schema.getChild(childName, false) !== undefined)
          continue;

        const loadedChild = await this.loadSchemaChild(schema, this._itemToRead.children[childName], childName);
        if (loadedChild && this._visitor) {
          await loadedChild.accept(this._visitor);
        }
      }
    }

    if (this._itemToRead.customAttributes)
      await this.loadCustomAttributes(this._itemToRead.customAttributes);

    if (this._visitor && this._visitor.visitFullSchema)
      await this._visitor.visitFullSchema(schema);

    return schema;
  }

  // public readSchemaChild<T extends SchemaChild>(schemaChild: T, childJson: object | string): T {
  //   this._itemToRead = typeof childJson === "string" ? JSON.parse(childJson) : childJson;

  // }

  /**
   * Ensures that the SchemaReferences can be located and then loads the references.
   * @param referencesJson The JSON to read the SchemaReference from.
   */
  private async loadSchemaReferences(referencesJson: any) {
    if (!Array.isArray(referencesJson))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The schema ${this._schema.schemaKey.name} has an invalid 'references' property. It should be of type 'object[]'.`);

    const promises = referencesJson.map(async (ref) => {
      if (typeof(ref) !== "object")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The schema ${this._schema.schemaKey.name} has an invalid 'references' property. It should be of type 'object[]'.`);

      if (undefined === ref.name)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The schema ${this._schema.schemaKey.name} has an invalid 'references' property. One of the references is missing the required 'name' property.`);

      if (typeof(ref.name) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The schema ${this._schema.schemaKey.name} has an invalid 'references' property. One of the references has an invalid 'name' property. It should be of type 'string'.`);

      if (undefined === ref.version)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The schema ${this._schema.schemaKey.name} has an invalid 'references' property. One of the references is missing the required 'version' property.`);

      if (typeof(ref.version) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The schema ${this._schema.schemaKey.name} has an invalid 'references' property. One of the references has an invalid 'version' property. It should be of type 'string'.`);

      const schemaKey = new SchemaKey(ref.name, ECVersion.fromString(ref.version));
      const refSchema = await this._context.getSchema(schemaKey);
      if (!refSchema)
        throw new ECObjectsError(ECObjectsStatus.UnableToLocateSchema, `Could not locate the referenced schema, ${ref.name}.${ref.version}, of ${this._schema.schemaKey.name}`);

      await (this._schema as MutableSchema).addReference(refSchema);
    });

    await Promise.all(promises);
  }

  /**
   * Given
   * @param schema The Schema to add this SchemaChild to.
   * @param schemaChildJson The JSON to populate the SchemaChild with.
   * @param name The name of the SchemaChild, only needed if the SchemaChild is being loaded outside the context of a Schema.
   */
  private async loadSchemaChild(schema: Schema, schemaChildJson: any, name?: string): Promise<SchemaChild | undefined> {
    const childName = (undefined === name) ? schemaChildJson.name : name;
    if (!childName)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `A SchemaChild in ${this._schema.schemaKey.name} has an invalid name.`);

    if (undefined === schemaChildJson.schemaChildType)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaChild ${childName} is missing the required schemaChildType property.`);

    if (typeof(schemaChildJson.schemaChildType) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaChild ${childName} has an invalid 'schemaChildType' property. It should be of type 'string'.`);

    let schemaChild: AnySchemaChild | undefined;

    switch (tryParseSchemaChildType(schemaChildJson.schemaChildType)) {
       case SchemaChildType.EntityClass:
        schemaChild = await (schema as MutableSchema).createEntityClass(childName);
        await this.loadEntityClass(schemaChild, schemaChildJson);
        break;
       case SchemaChildType.StructClass:
        schemaChild = await (schema as MutableSchema).createStructClass(childName);
        await this.loadClass(schemaChild, schemaChildJson);
        break;
       case SchemaChildType.Mixin:
        schemaChild = await (schema as MutableSchema).createMixinClass(childName);
        await this.loadMixin(schemaChild, schemaChildJson);
        break;
       case SchemaChildType.CustomAttributeClass:
        schemaChild = await (schema as MutableSchema).createCustomAttributeClass(childName);
        await this.loadClass(schemaChild, schemaChildJson);
        break;
       case SchemaChildType.RelationshipClass:
        schemaChild = await (schema as MutableSchema).createRelationshipClass(childName);
        await this.loadRelationshipClass(schemaChild, schemaChildJson);
        break;
       case SchemaChildType.KindOfQuantity:
        schemaChild = await (schema as MutableSchema).createKindOfQuantity(childName);
        await schemaChild.fromJson(schemaChildJson);
        break;
       case SchemaChildType.PropertyCategory:
        schemaChild = await (schema as MutableSchema).createPropertyCategory(childName);
        await schemaChild.fromJson(schemaChildJson);
        break;
       case SchemaChildType.Enumeration:
        schemaChild = await (schema as MutableSchema).createEnumeration(childName);
        await schemaChild.fromJson(schemaChildJson);
        break;
      // NOTE: we are being permissive here and allowing unknown types to silently fail. Not sure if we want to hard fail or just do a basic deserialization
    }

    return schemaChild;
  }

  /**
   * Finds the a SchemaChild matching the fullName first by checking the schema that is being deserialized. If it does
   * not exist within the schema the SchemaContext will be searched.
   * @param fullName The full name of the SchemaChild to search for.
   * @param skipVisitor Used to break Mixin -appliesTo-> Entity -extends-> Mixin cycle.
   * @returns The SchemaChild if it had to be loaded, otherwise undefined.
   */
  private async findSchemaChild(fullName: string, skipVisitor = false): Promise<SchemaChild | undefined> {
    const [schemaName, childName] = SchemaChild.parseFullName(fullName);
    const isInThisSchema = (this._schema && this._schema.name.toLowerCase() === schemaName.toLowerCase());

    if (isInThisSchema && undefined === await this._schema.getChild(childName, false)) {
      const schemaChild = await this.loadSchemaChild(this._schema, this._itemToRead.children[childName], childName);
      if (!skipVisitor && schemaChild && this._visitor) {
        await schemaChild.accept(this._visitor);
      }
      return schemaChild;
    }

    if (undefined === await this._context.getSchemaChild(new SchemaChildKey(childName, undefined, new SchemaKey(schemaName))))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate SchemaChild ${fullName}.`);

    return undefined;
  }

  /**
   * Given a CustomAttributeContainer and a CustomAttribute JSON it will make sure that all of the the CustomAttribute classes can be found within the context
   * of the Container.
   * @param caContainer The CustomAttribute Container to read the customAttributes within the context of.
   * @param customAttributesJson The JSON containing the customAttributes that are to be added to the container
   */
  private async loadCustomAttributes(customAttributesJson: any): Promise<void> {
    if (!customAttributesJson.customAttributes)
      return;

    if (!Array.isArray(customAttributesJson.customAttributes))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The `);

    customAttributesJson.customAttributes.forEach((caJson: any) => {
      if (caJson) {
        if (!caJson.className)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

        if (typeof(caJson.className) !== "string")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

        this.findSchemaChild(caJson.className);
      }
    });
  }

  /**
   *
   * @param schemaJson The original json object of the schema.
   * @param classJson The json object for this class
   * @param schema The ECSchema this class exists in.
   */
  private async loadClass(classObj: AnyClass, classJson: any): Promise<void> {
    // Load base class first
    let baseClass: undefined | SchemaChild;
    if (undefined !== classJson.baseClass) {
      if (typeof(classJson.baseClass) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECClass ${classObj.name} has an invalid 'baseClass' attribute. It should be of type 'string'.`);
      baseClass = await this.findSchemaChild(classJson.baseClass, true);
    }

    // Now deserialize the class itself, *before* any properties
    // (We need to do this to break Entity -navProp-> Relationship -constraint-> Entity cycle.)
    await classObj.fromJson(classJson);

    if (undefined !== classJson.properties) {
      if (!Array.isArray(classJson.properties))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECClass ${classObj.name} has an invalid 'properties' attribute. It should be of type 'object[]'.`);

      for (const property of classJson.properties) {
        if (typeof(property) !== "object")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECClass ${classObj.name} has an invalid 'properties' attribute. It should be of type 'object[]'.`);

        await this.loadPropertyTypes(classObj, property);
      }
    }

    if (baseClass && this._visitor)
      await baseClass.accept(this._visitor);
  }

  private async loadEntityClass(entity: EntityClass, entityJson: any): Promise<void> {
    // Load Mixin classes first
    if (undefined !== entityJson.mixins) {
      if (!Array.isArray(entityJson.mixins))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECClass ${entity.name} has an invalid 'mixins' attribute. It should be of type 'string[]'.`);

      for (const mixinName of entityJson.mixins) {
        if (typeof(mixinName) !== "string")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECClass ${entity.name} has an invalid 'mixins' attribute. It should be of type 'string[]'.`);
        await this.findSchemaChild(mixinName);
      }
    }

    await this.loadClass(entity, entityJson);
  }

  private async loadMixin(mixin: Mixin, mixinJson: any): Promise<void> {
    let appliesToClass: undefined | SchemaChild;
    if (undefined !== mixinJson.appliesTo) {
      if (typeof(mixinJson.appliesTo) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Mixin ${mixin.name} has an invalid 'appliesTo' property. It should be of type 'string'.`);

      appliesToClass = await this.findSchemaChild(mixinJson.appliesTo, true);
    }

    await this.loadClass(mixin, mixinJson);
    if (appliesToClass && this._visitor)
      await appliesToClass.accept(this._visitor);
  }

  private async loadRelationshipClass(rel: RelationshipClass, relJson: any): Promise<void> {
    await this.loadClass(rel, relJson);

    if (undefined === relJson.source)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The RelationshipClass ${rel.name} is missing the required source constraint.`);

    if (typeof(relJson.source) !== "object")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The RelationshipClass ${rel.name} has an invalid source constraint. It should be of type 'object'.`);

    await this.loadRelationshipConstraint(rel.source, relJson.source);

    if (undefined === relJson.target)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The RelationshipClass ${rel.name} is missing the required target constraint.`);

    if (typeof(relJson.target) !== "object")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The RelationshipClass ${rel.name} has an invalid target constraint. It should be of type 'object'.`);

    await this.loadRelationshipConstraint(rel.target, relJson.target);
  }

  private async loadRelationshipConstraint(relConstraint: RelationshipConstraint, relConstraintJson: any): Promise<void> {
    if (undefined !== relConstraintJson.abstractConstraint) {
      if (typeof(relConstraintJson.abstractConstraint) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ${relationshipEndToString(relConstraint.relationshipEnd)} Constraint of ${relConstraint.relationshipClass!.name} has an invalid 'abstractConstraint' property. It should be of type 'string'.`);

      await this.findSchemaChild(relConstraintJson.abstractConstraint);
    }

    if (undefined !== relConstraintJson.constraintClasses) {
      if (!Array.isArray(relConstraintJson.constraintClasses))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ${relationshipEndToString(relConstraint.relationshipEnd)} Constraint of ${relConstraint.relationshipClass!.name} has an invalid 'constraintClasses' property. It should be of type 'array'.`);

      for (const constraintClass of relConstraintJson.constraintClasses) {
        await this.findSchemaChild(constraintClass);
      }
    }

    await relConstraint.fromJson(relConstraintJson);
  }

  /**
   * Creates the property defined in the JSON in the given class.
   * @param classObj
   * @param propertyJson
   */
  private async loadPropertyTypes(classObj: AnyClass, propertyJson: any): Promise<void> {
    if (undefined === propertyJson.name)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `An ECProperty in ${classObj.key.schemaName}.${classObj.name} is missing the required 'name' property.`);
    if (typeof(propertyJson.name) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `An ECProperty in ${classObj.key.schemaName}.${classObj.name} has an invalid 'name' property. It should be of type 'string'.`);

    const propName = propertyJson.name;

    if (undefined === propertyJson.propertyType)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${classObj.key.schemaName}.${classObj.name}.${propName} is missing the required 'propertyType' property.`);
    if (typeof(propertyJson.propertyType) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${classObj.key.schemaName}.${classObj.name}.${propName} has an invalid 'propertyType' property. It should be of type 'string'.`);

    const loadTypeName = async () => {
      if (undefined === propertyJson.typeName)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${classObj.key.schemaName}.${classObj.name}.${propName} is missing the required 'typeName' property.`);

      if (typeof(propertyJson.typeName) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${classObj.key.schemaName}.${classObj.name}.${propName} has an invalid 'typeName' property. It should be of type 'string'.`);

      if (undefined === tryParsePrimitiveType(propertyJson.typeName))
        await this.findSchemaChild(propertyJson.typeName);
    };

    switch (propertyJson.propertyType) {
      case "PrimitiveProperty":
        await loadTypeName();
        const primProp = await (classObj as MutableClass).createPrimitiveProperty(propName, propertyJson.typeName);
        return this.loadProperty(primProp, propertyJson);

      case "StructProperty":
        await loadTypeName();
        const structProp = await (classObj as MutableClass).createStructProperty(propName, propertyJson.typeName);
        return this.loadProperty(structProp, propertyJson);

      case "PrimitiveArrayProperty":
        await loadTypeName();
        const primArrProp = await (classObj as MutableClass).createPrimitiveArrayProperty(propName, propertyJson.typeName);
        return this.loadProperty(primArrProp, propertyJson);

      case "StructArrayProperty":
        await loadTypeName();
        const structArrProp = await (classObj as MutableClass).createStructArrayProperty(propName, propertyJson.typeName);
        return this.loadProperty(structArrProp, propertyJson);

      case "NavigationProperty":
        if (classObj.type !== SchemaChildType.EntityClass && classObj.type !== SchemaChildType.RelationshipClass)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Navigation Property ${classObj.name}.${propName} is invalid, because only EntityClasses and RelationshipClasses can have NavigationProperties.`);

        if (undefined === propertyJson.relationshipName)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Navigation Property ${classObj.name}.${propName} is missing the required 'relationshipName' property.`);

        if (typeof(propertyJson.relationshipName) !== "string")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Navigation Property ${classObj.name}.${propName} has an invalid 'relationshipName' property. It should be of type 'string'.`);

        await this.findSchemaChild(propertyJson.relationshipName);

        const navProp = await (classObj as MutableEntityClass).createNavigationProperty(propName, propertyJson.relationshipName);
        return this.loadProperty(navProp, propertyJson);
    }
  }

  private async loadProperty<T extends Property>(prop: T, propertyJson: any): Promise<void> {
    if (undefined !== propertyJson.category) {
      if (typeof(propertyJson.category) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${prop.class.name}.${prop.name} has an invalid 'category' property. It should be of type 'string'.`);

      await this.findSchemaChild(propertyJson.category);
    }

    if (undefined !== propertyJson.kindOfQuantity) {
      if (typeof(propertyJson.kindOfQuantity) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${prop.class.name}.${prop.name} has an invalid 'kindOfQuantity' property. It should be of type 'string'.`);

      await this.findSchemaChild(propertyJson.kindOfQuantity);
    }

    // TODO Load CustomAttributeClasses

    await prop.fromJson(propertyJson);
  }
}
