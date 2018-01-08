/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { SchemaInterface, SchemaChildInterface, ECClassInterface, EntityClassInterface, MixinInterface,
        RelationshipClassInterface, RelationshipConstraintInterface, CustomAttributeClassInterface,
        KindOfQuantityInterface, PropertyInterface } from "../Interfaces";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { SchemaContext } from "../Context";
import { ECVersion, SchemaKey, parsePrimitiveType, relationshipEndToString } from "../ECObjects";
import SchemaChild from "../Metadata/SchemaChild";

/**
 * The purpose of this class is to properly order the deserialization of ECSchemas and SchemaChildren from the JSON formats.
 * For example, when deserializing an ECClass most times all base class should be deserialized before the given class.
 */
export default class SchemaReadHelper {
  private _context: SchemaContext;

  // This is a cache of the schema we are loading. It also exists within the _context but in order
  // to not have to go back to the context every time if we don't have to this cache has been added.
  private _schema: SchemaInterface;

  private _itemToRead: any; // This will be the json object of the Schema or SchemaChild to deserialize. Not sure if this is the best option.. Going to leave it for now.

  constructor(context?: SchemaContext) {
    if (context)
      this._context = context;

    if (!this._context)
      this._context = new SchemaContext();
  }

  /**
   * Populates the given schema object with the information presented in the schemaJson provided. If present, uses the provided context to resolve any references within the schema.
   * Otherwise, those references will be unresovled.
   * @param schema The schema object to populate. Must be an extension of the DeserializableSchemaInterface.
   * @param schemaJson An object, or string representing that object, that follows the SchemaJson format.
   */
  public static to<T extends SchemaInterface>(schema: T, schemaJson: object | string): T {
    const helper = new SchemaReadHelper();
    return helper.readSchema(schema, schemaJson);
  }

  /**
   * Populates the given Schema with the JSON.
   * @param schema The Schema to populate
   * @param schemaJson The JSON to use to populate the Schema.
   */
  public readSchema<T extends SchemaInterface>(schema: T, schemaJson: object | string): T {
    this._itemToRead = typeof schemaJson === "string" ? JSON.parse(schemaJson) : schemaJson;

    // Loads all of the properties on the SchemaInterface object
    schema.fromJson(this._itemToRead);

    this._schema = schema;

    // Need to add this schema to the context to be able to locate schemaChildren within the context.
    this._context.addSchemaSync(schema);

    // Load schema references first
    // Need to figure out if other schemas are present.
    if (this._itemToRead.references)
      this.loadSchemaReferences(this._itemToRead.references);

    // Load all schema children
    if (this._itemToRead.children) {
      for (const childName in this._itemToRead.children) {
        // Make sure the child has not already been read. No need to check the SchemaContext because all SchemaChildren are added to a Schema,
        // which would be found when adding to the context.
        if (schema.getChild(childName) !== undefined)
          continue;

        this.loadSchemaChild(schema, this._itemToRead.children[childName], childName);
      }
    }

    if (this._itemToRead.customAttributes)
      this.loadCustomAttributes(this._itemToRead.customAttributes);

    return schema;
  }

  /**
   * Ensures that the SchemaReferences can be located and then loads the references.
   * @param referencesJson The JSON to read the SchemaReference from.
   */
  private loadSchemaReferences(referencesJson: any) {
    if (!Array.isArray(referencesJson))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The schema ${this._schema.schemaKey.name} has an invalid 'references' property. It should be of type 'array'.`);

    referencesJson.forEach((ref) => {
      if (!ref.name)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The schema ${this._schema.schemaKey.name} has an invalid 'references' property. One of the references is missing the required 'name' property.`);

      if (!ref.version)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The schema ${this._schema.schemaKey.name} has an invalid 'references' property. One of the references is missing the required 'version' property.`);

      const refVersion = new ECVersion();
      refVersion.fromString(ref.version);

      const schemaKey = new SchemaKey(ref.name);
      schemaKey.readVersion = refVersion.read;
      schemaKey.writeVersion = refVersion.write;
      schemaKey.minorVersion = refVersion.minor;

      const refSchema = this._context.locateSchemaSync(schemaKey);
      if (!refSchema)
        throw new ECObjectsError(ECObjectsStatus.UnableToLocateSchema, `Could not locate the referenced schema, ${ref.name}.${ref.version}, of ${this._schema.schemaKey.name}`);

      this._schema.addReference(refSchema);
    });
  }

  /**
   * Given
   * @param schema The Schema to add this SchemaChild to.
   * @param schemaChildJson The JSON to populate the SchemaChild with.
   * @param name The name of the SchemaChild, only needed if the SchemaChild is being loaded outside the context of a Schema.
   */
  private loadSchemaChild(schema: SchemaInterface, schemaChildJson: any, name?: string) {
    const childName = (schemaChildJson.name) ? schemaChildJson.name : name;
    if (!childName)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson);

    if (!schemaChildJson.schemaChildType)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaChild ${childName} is missing the required schemaChildType property.`);

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
      // NOTE: we are being permissive here and allowing unknown types to silently fail. Not sure if we want to hard fail or just do a basic deserialization
    }
  }

  /**
   * Finds the a SchemaChild matching the fullName first by checking the schema that is being deserialized. If it does
   * not exist within the schema the SchemaContext will be searched.
   * @param fullName The full name of the SchemaChild to search for.
   */
  private findSchemaChild(fullName: string): void {
    const [schemaName, childName] = SchemaChild.parseFullName(fullName);

    if (this._schema && this._schema.schemaKey.name.toLowerCase() === schemaName.toLowerCase() && undefined === this._schema.getChild(childName)) {
      this.loadSchemaChild(this._schema, this._itemToRead.children[childName], childName);
    } else if (undefined === this._context.locateSchemaChildSync(fullName)) {
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate SchemaChild ${fullName}.`);
    }
  }

  /**
   * Given a CustomAttributeContainer and a CustomAttribute JSON it will make sure that all of the the CustomAttribute classes can be found within the context
   * of the Container.
   * @param caContainer The CustomAttribute Container to read the customAttributes within the context of.
   * @param customAttributesJson The JSON containing the customAttributes that are to be added to the container
   */
  private loadCustomAttributes(customAttributesJson: any): void {
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
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Mixin ${mixin.name} has an invalid 'appliesTo' property. It should be of type 'string'.`);
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
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ${relationshipEndToString(relConstraint.relationshipEnd)} Constraint of ${relConstraint.relClass!.name} has an invalid 'abstractConstraint' property. It should be of type 'string'.`);
      this.findSchemaChild(relConstraintJson.abstractConstraint);
    }

    if (relConstraintJson.constraintClasses) {
      if (!Array.isArray(relConstraintJson.constraintClasses))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ${relationshipEndToString(relConstraint.relationshipEnd)} Constraint of ${relConstraint.relClass!.name} has an invalid 'constraintClasses' property. It should be of type 'array'.`);
      relConstraintJson.constraintClasses.forEach((constraintClass: string) => {
        this.findSchemaChild(constraintClass);
      });
    }

    relConstraint.fromJson(relConstraintJson);
  }

  /**
   * Creates the property defined in the JSON in the given class.
   * @param classObj
   * @param propertyJson
   */
  private loadPropertyTypes<T extends ECClassInterface>(classObj: T, propertyJson: any): void {
    if (!propertyJson.name)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson,  `An ECProperty in ${classObj.key.schemaName}.${classObj.name} is missing the required 'name' property.`);
    if (typeof(propertyJson.name) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson,  `An ECProperty in ${classObj.key.schemaName}.${classObj.name} has an invalid 'name' property. It should be of type 'string'.`);

    const propName = propertyJson.name;

    if (!propertyJson.propertyType)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${classObj.key.schemaName}.${classObj.name}.${propName} is missing the required 'propertyType' property.`);
    if (typeof(propertyJson.propertyType) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${classObj.key.schemaName}.${classObj.name}.${propName} has an invalid 'propertyType' property. It should be of type 'string'.`);

    const loadTypeName = () => {
      if (propertyJson.typeName) {
        if (typeof(propertyJson.typeName) !== "string")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${classObj.name}.${propName} has an invalid 'typeName' property. It should be of type 'string'.`);

        try {
          parsePrimitiveType(propertyJson.typeName);
        } catch (err) { // Catch the error since the type should now be assumed to be an ECEnumeration
          this.findSchemaChild(propertyJson.typeName);
        }
      }
    };

    switch (propertyJson.propertyType) {
      case "PrimitiveProperty":
        loadTypeName();

        const primProp = classObj.createPrimitiveProperty(propName);
        this.loadProperty(primProp, propertyJson);
        break;
      case "StructProperty":
        loadTypeName();

        const structProp = classObj.createStructProperty(propName, propertyJson.typeName);
        this.loadProperty(structProp, propertyJson);
        break;
      case "PrimitiveArrayProperty":
        loadTypeName();

        const primArrProp = classObj.createPrimitiveArrayProperty(propName);
        this.loadProperty(primArrProp, propertyJson);
        break;
      case "StructArrayProperty":
        loadTypeName();

        const structArrProp = classObj.createStructArrayProperty(propName, propertyJson.typeName);
        this.loadProperty(structArrProp, propertyJson);
        break;
      case "NavigationProperty":
        const hasNavigationProperty = (testClass: ECClassInterface): testClass is EntityClassInterface | RelationshipClassInterface => {
          return (testClass as EntityClassInterface | RelationshipClassInterface).createNavigationProperty !== undefined;
        };

        if (!hasNavigationProperty(classObj))
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson);

        const specificClass: EntityClassInterface | RelationshipClassInterface = classObj as EntityClassInterface | RelationshipClassInterface;

        if (!propertyJson.relationshipName)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Navigation Property ${specificClass.name}.${propName} is missing the required 'relationshipName' property.`);

        if (propertyJson.relationshipName) {
          if (typeof(propertyJson.relationshipName) !== "string")
            throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Navigation Property ${specificClass.name}.${propName} has an invalid 'relationshipClass' property. It should be of type 'string'.`);
          this.findSchemaChild(propertyJson.relationshipName);
        }

        const navProp = specificClass.createNavigationProperty(propName, propertyJson.relationshipName);
        this.loadProperty(navProp, propertyJson);
    }
  }

  private loadProperty<T extends PropertyInterface>(prop: T, propertyJson: any): void {
    if (propertyJson.category) {
      if (typeof(propertyJson.category) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${prop.class.name}.${prop.name} has an invalid 'category' property. It should be of type 'string'.`);
      this.findSchemaChild(propertyJson.category);
    }

    if (propertyJson.kindOfQuantity) {
      if (typeof(propertyJson.kindOfQuantity) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The ECProperty ${prop.class.name}.${prop.name} has an invalid 'kindOfQuantity' property. It should be of type 'string'.`);
      this.findSchemaChild(propertyJson.kindOfQuantity);
    }

    // TODO Load CustomAttributeClasses

    prop.fromJson(propertyJson);
  }
}
