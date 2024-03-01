/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import {
  CustomAttribute,
  CustomAttributeContainerProps,
  DelayedPromiseWithProps,
  ECClass, ECName, ECObjectsError, ECObjectsStatus, Enumeration, EnumerationPropertyProps, PrimitiveArrayPropertyProps,
  PrimitivePropertyProps, PrimitiveType, PropertyCategory, SchemaItemKey, SchemaItemType, StructArrayPropertyProps,
  StructClass, StructPropertyProps,
} from "@itwin/ecschema-metadata";
import { assert } from "@itwin/core-bentley";
import { PropertyEditResults, SchemaContextEditor, SchemaItemEditResults } from "./Editor";
import { MutableClass } from "./Mutable/MutableClass";
import * as Rules from "../Validation/ECRules";
import { MutableProperty } from "./Mutable/MutableProperty";

/**
 * @alpha
 * Acts as a base class for schema class creation. Enables property creation.
 */
export class ECClasses {

  protected constructor(protected _schemaEditor: SchemaContextEditor) { }

  /**
   * Creates a property on class identified by the given SchemaItemKey. This method restricts the
   * property type to primitives of type Double, String, DateTime and Integer.
   * @param classKey The SchemaItemKey of the class.
   * @param name The name of the new property.
   * @param type The PrimitiveType assigned to the new property.
   */
  public async createProperty(classKey: SchemaItemKey, name: string, type: PrimitiveType, prefix: string): Promise<PropertyEditResults> {
    let mutableClass: MutableClass;

    if (type !== PrimitiveType.Double && type !== PrimitiveType.String && type !== PrimitiveType.DateTime
      && type !== PrimitiveType.Integer)
      throw new Error ("Property creation is restricted to type Double, String, DateTime, and Integer.");

    if ("" === prefix)
      throw new Error("The specified property name prefix is invalid");

    const prefixedName = `${prefix}_${name}`;

    try {
      mutableClass = await this.getClass(classKey);
    } catch (e: any) {
      return { errorMessage: e.message };
    }

    await mutableClass.createPrimitiveProperty(prefixedName, type);
    return { itemKey: classKey, propertyName: prefixedName };
  }

  /**
   * Create a primitive property on class identified by the given SchemaItemKey.
   * @param classKey The SchemaItemKey of the class.
   * @param name The name of the new property.
   * @param type The PrimitiveType assigned to the new property.
   */
  public async createPrimitiveProperty(classKey: SchemaItemKey, name: string, type: PrimitiveType): Promise<PropertyEditResults> {
    let mutableClass: MutableClass;
    try {
      mutableClass = await this.getClass(classKey);
    } catch (e: any) {
      return { errorMessage: e.message };
    }

    await mutableClass.createPrimitiveProperty(name, type);
    return { itemKey: classKey, propertyName: name };
  }

  public async createPrimitivePropertyFromProps(classKey: SchemaItemKey, name: string, type: PrimitiveType, primitiveProps: PrimitivePropertyProps): Promise<PropertyEditResults> {
    let mutableClass: MutableClass;
    try {
      mutableClass = await this.getClass(classKey);
    } catch (e: any) {
      return { errorMessage: e.message };
    }

    const newProperty = await mutableClass.createPrimitiveProperty(name, type);
    await newProperty.fromJSON(primitiveProps);
    return { itemKey: classKey, propertyName: name };
  }

  public async createEnumerationProperty(classKey: SchemaItemKey, name: string, type: Enumeration): Promise<PropertyEditResults> {
    let mutableClass: MutableClass;
    try {
      mutableClass = await this.getClass(classKey);
    } catch (e: any) {
      return { errorMessage: e.message };
    }

    const enumSchemaItemKey = mutableClass.schema.getSchemaItemKey(type.fullName);
    if (enumSchemaItemKey === undefined)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate the enumeration ${type.fullName}.`);

    await mutableClass.createPrimitiveProperty(name, type);
    return { itemKey: classKey, propertyName: name };
  }

  public async createEnumerationPropertyFromProps(classKey: SchemaItemKey, name: string, type: Enumeration, enumProps: EnumerationPropertyProps): Promise<PropertyEditResults> {
    let mutableClass: MutableClass;
    try {
      mutableClass = await this.getClass(classKey);
    } catch (e: any) {
      return { errorMessage: e.message };
    }

    const newProperty = await mutableClass.createPrimitiveProperty(name, type);
    await newProperty.fromJSON(enumProps);
    return { itemKey: classKey, propertyName: name };
  }

  public async createPrimitiveArrayProperty(classKey: SchemaItemKey, name: string, type: PrimitiveType): Promise<PropertyEditResults> {
    let mutableClass: MutableClass;
    try {
      mutableClass = await this.getClass(classKey);
    } catch (e: any) {
      return { errorMessage: e.message };
    }

    await mutableClass.createPrimitiveArrayProperty(name, type);
    return { itemKey: classKey, propertyName: name };
  }

  public async createPrimitiveArrayPropertyFromProps(classKey: SchemaItemKey, name: string, type: PrimitiveType, primitiveProps: PrimitiveArrayPropertyProps): Promise<PropertyEditResults> {
    let mutableClass: MutableClass;
    try {
      mutableClass = await this.getClass(classKey);
    } catch (e: any) {
      return { errorMessage: e.message };
    }

    const newProperty = await mutableClass.createPrimitiveArrayProperty(name, type);
    await newProperty.fromJSON(primitiveProps);
    return { itemKey: classKey, propertyName: name };
  }

  public async createEnumerationArrayProperty(classKey: SchemaItemKey, name: string, type: Enumeration): Promise<PropertyEditResults> {
    let mutableClass: MutableClass;
    try {
      mutableClass = await this.getClass(classKey);
    } catch (e: any) {
      return { errorMessage: e.message };
    }

    await mutableClass.createPrimitiveArrayProperty(name, type);
    return { itemKey: classKey, propertyName: name };
  }

  public async createEnumerationArrayPropertyFromProps(classKey: SchemaItemKey, name: string, type: Enumeration, props: PrimitiveArrayPropertyProps): Promise<PropertyEditResults> {
    let mutableClass: MutableClass;
    try {
      mutableClass = await this.getClass(classKey);
    } catch (e: any) {
      return { errorMessage: e.message };
    }

    const newProperty = await mutableClass.createPrimitiveArrayProperty(name, type);
    await newProperty.fromJSON(props);
    return { itemKey: classKey, propertyName: name };
  }

  public async createStructProperty(classKey: SchemaItemKey, name: string, type: StructClass): Promise<PropertyEditResults> {
    let mutableClass: MutableClass;
    try {
      mutableClass = await this.getClass(classKey);
    } catch (e: any) {
      return { errorMessage: e.message };
    }

    await mutableClass.createStructProperty(name, type);
    return { itemKey: classKey, propertyName: name };
  }

  public async createStructPropertyFromProps(classKey: SchemaItemKey, name: string, type: StructClass, structProps: StructPropertyProps): Promise<PropertyEditResults> {
    let mutableClass: MutableClass;
    try {
      mutableClass = await this.getClass(classKey);
    } catch (e: any) {
      return { errorMessage: e.message };
    }

    const newProperty = await mutableClass.createStructProperty(name, type);
    await newProperty.fromJSON(structProps);
    return { itemKey: classKey, propertyName: name };
  }

  public async createStructArrayProperty(classKey: SchemaItemKey, name: string, type: StructClass): Promise<PropertyEditResults> {
    let mutableClass: MutableClass;
    try {
      mutableClass = await this.getClass(classKey);
    } catch (e: any) {
      return { errorMessage: e.message };
    }

    await mutableClass.createStructArrayProperty(name, type);
    return { itemKey: classKey, propertyName: name };
  }

  public async createStructArrayPropertyFromProps(classKey: SchemaItemKey, name: string, type: StructClass, structProps: StructArrayPropertyProps): Promise<PropertyEditResults> {
    let mutableClass: MutableClass;
    try {
      mutableClass = await this.getClass(classKey);
    } catch (e: any) {
      return { errorMessage: e.message };
    }

    const newProperty = await mutableClass.createStructArrayProperty(name, type);
    await newProperty.fromJSON(structProps);
    return { itemKey: classKey, propertyName: name };
  }

  public async deleteProperty(classKey: SchemaItemKey, name: string): Promise<PropertyEditResults> {
    let mutableClass: MutableClass;
    try {
      mutableClass = await this.getClass(classKey);
    } catch (e: any) {
      return { errorMessage: e.message };
    }

    await mutableClass.deleteProperty(name);
    return { itemKey: classKey, propertyName: name };
  }

  public async delete(classKey: SchemaItemKey): Promise<SchemaItemEditResults> {
    const schema = await this._schemaEditor.getSchema(classKey.schemaKey);
    if (schema === undefined)
      return { errorMessage: `Schema Key ${classKey.schemaKey.toString(true)} not found in context` };

    const ecClass = await schema.getItem<ECClass>(classKey.name);
    if (ecClass === undefined)
      return {};

    await schema.deleteClass(ecClass.name);

    return { itemKey: classKey };
  }

  /**
   * Adds a CustomAttribute instance to the Class identified by the given SchemaItemKey
   * @param classKey The SchemaItemKey identifying the schema.
   * @param customAttribute The CustomAttribute instance to add.
   */
  public async addCustomAttribute(classKey: SchemaItemKey, customAttribute: CustomAttribute): Promise<SchemaItemEditResults> {
    let mutableClass: MutableClass;
    try {
      mutableClass = await this.getClass(classKey);
    } catch (e: any) {
      return { errorMessage: e.message };
    }

    mutableClass.addCustomAttribute(customAttribute);

    const diagnostics = Rules.validateCustomAttributeInstance(mutableClass, customAttribute);

    const result: SchemaItemEditResults = { errorMessage: "" };
    for await (const diagnostic of diagnostics) {
      result.errorMessage += `${diagnostic.code}: ${diagnostic.messageText}\r\n`;
    }

    if (result.errorMessage) {
      this.removeCustomAttribute(mutableClass, customAttribute);
      return result;
    }

    return {};
  }

  /**
   * Adds a CustomAttribute instance to the Property identified by the given SchemaItemKey and property name.
   * @param classKey The SchemaItemKey identifying the class.
   * @param propertyName The name of the property.
   * @param customAttribute The CustomAttribute instance to add.
   */
  public async addCustomAttributeToProperty(classKey: SchemaItemKey, propertyName: string, customAttribute: CustomAttribute): Promise<PropertyEditResults> {
    let mutableClass: MutableClass;
    try {
      mutableClass = await this.getClass(classKey);
    } catch (e: any) {
      return { errorMessage: e.message };
    }

    const property = await mutableClass.getProperty(propertyName) as MutableProperty;
    if (!property) {
      return { errorMessage: `Property with the name ${propertyName} could not be found in the class ${classKey.fullName}.` };
    }

    property.addCustomAttribute(customAttribute);

    const diagnostics = Rules.validateCustomAttributeInstance(property, customAttribute);

    const result: SchemaItemEditResults = { errorMessage: "" };
    for await (const diagnostic of diagnostics) {
      result.errorMessage += `${diagnostic.code}: ${diagnostic.messageText}\r\n`;
    }

    if (result.errorMessage) {
      this.removeCustomAttribute(property, customAttribute);
      return result;
    }

    return {};
  }

  /**
   * Renames the property on the specified class. The rename will fail if the new
   * name causes a conflict with a base or derived property. All derived classes
   * containing a property override will be renamed, as well.
   * @param classKey  The SchemaItemKey identifying the class.
   * @param existingPropertyName The name of the property.
   * @param newPropertyName The new property name.
   */
  public async setPropertyName(classKey: SchemaItemKey, existingPropertyName: string, newPropertyName: string): Promise<PropertyEditResults> {
    const newName = new ECName(newPropertyName);

    let mutableClass: MutableClass;
    try {
      mutableClass = await this.getClass(classKey);
    } catch (e: any) {
      return { errorMessage: e.message };
    }

    const existingProperty = await mutableClass.getProperty(existingPropertyName) as MutableProperty;
    if (!existingProperty) {
      return { errorMessage: `An ECProperty with the name ${existingPropertyName} could not be found in the class ${classKey.fullName}.` };
    }

    const baseProperty = await mutableClass.getProperty(newPropertyName, true) as MutableProperty;
    if (baseProperty)
      return { errorMessage: `An ECProperty with the name ${newPropertyName} already exists in the class ${baseProperty.class.name}.` };

    // Handle derived classes
    const derivedProperties: Array<MutableProperty> = [];
    const derivedClasses = await this.findDerivedClasses(mutableClass);
    for (const derivedClass of derivedClasses) {
      if (await derivedClass.getProperty(newPropertyName))
        return { errorMessage: `An ECProperty with the name ${newPropertyName} already exists in the class ${derivedClass.fullName}.` };

      const propertyOverride = await derivedClass.getProperty(existingPropertyName) as MutableProperty;
      // If found the property is overridden in the derived class.
      if (propertyOverride)
        derivedProperties.push(propertyOverride);
    }

    // Re-name the overridden property in all derived classes
    derivedProperties.forEach((prop: MutableProperty) => {
      prop.setName(newName);
    });

    existingProperty.setName(newName);

    return { itemKey: classKey, propertyName: newName.name };
  }

  /**
   * Sets the name of the ECClass.
   * @param classKey The SchemaItemKey of the class.
   * @param name The new name of the class.
   * @throws ECObjectsError if `name` does not meet the criteria for a valid EC name
   */
  public async setName(classKey: SchemaItemKey, name: string): Promise<SchemaItemEditResults> {
    let mutableClass: MutableClass;

    const schema = await this._schemaEditor.getSchema(classKey.schemaKey);
    if (schema === undefined) {
      return { errorMessage: `Schema Key ${classKey.schemaKey.toString(true)} not found in context` };
    }

    const ecClass = await schema.getItem<MutableClass>(name);
    if (ecClass !== undefined)
      return { errorMessage: `An EC Class with the name ${name} already exists within the schema ${schema.name}` };

    try {
      mutableClass = await this.getClass(classKey);
    } catch (e: any) {
      return { errorMessage: e.message };
    }
    mutableClass.setName(name);

    return {};
  }

  /**
   * Sets the Category to the Property.
   * @param classKey The SchemaItemKey of the class.
   * @param propertyName The name of the property.
   * @param categoryKey The SchemaItemKey of the PropertyCategory assigned to the property.
   */
  public async setPropertyCategory(classKey: SchemaItemKey, propertyName: string, categoryKey: SchemaItemKey): Promise<PropertyEditResults> {
    let mutableClass: MutableClass;
    try {
      mutableClass = await this.getClass(classKey);
    } catch (e: any) {
      return { errorMessage: e.message };
    }

    const property = await mutableClass.getProperty(propertyName) as MutableProperty;
    if (property === undefined) {
      return { errorMessage: `An ECProperty with the name ${propertyName} could not be found in the class ${classKey.fullName}.` };
    }

    const category = await mutableClass.schema.lookupItem<PropertyCategory>(categoryKey);
    if (category === undefined) {
      return { errorMessage: `Can't locate the Property Category ${categoryKey.fullName} in the schema ${mutableClass.schema.fullName}.` };
    }

    property.setCategory(new DelayedPromiseWithProps<SchemaItemKey, PropertyCategory>(categoryKey, async () => category));
    return { itemKey: classKey, propertyName };
  }

  private async getClass(classKey: SchemaItemKey): Promise<MutableClass> {
    const schema = await this._schemaEditor.getSchema(classKey.schemaKey);
    if (schema === undefined)
      throw new ECObjectsError(ECObjectsStatus.UnableToLocateSchema,`Schema Key ${classKey.schemaKey.toString(true)} not found in context`);

    const ecClass = await schema.getItem<MutableClass>(classKey.name);
    if (ecClass === undefined)
      throw new ECObjectsError(ECObjectsStatus.ClassNotFound, `Class ${classKey.name} was not found in schema ${classKey.schemaKey.toString(true)}`);

    switch (ecClass.schemaItemType) {
      case SchemaItemType.EntityClass:
      case SchemaItemType.Mixin:
      case SchemaItemType.StructClass:
      case SchemaItemType.CustomAttributeClass:
      case SchemaItemType.RelationshipClass:
        break;
      default:
        throw new ECObjectsError(ECObjectsStatus.InvalidSchemaItemType, `Schema item type not supported`);
    }

    return ecClass;
  }

  protected removeCustomAttribute(container: CustomAttributeContainerProps, customAttribute: CustomAttribute) {
    assert(container.customAttributes !== undefined);
    const map = container.customAttributes as Map<string, CustomAttribute>;
    map.delete(customAttribute.className);
  }

  private async findDerivedClasses(mutableClass: MutableClass): Promise<Array<MutableClass>>{
    const derivedClasses: Array<MutableClass> = [];
    const schemaItems = this._schemaEditor.schemaContext.getSchemaItems();
    let { value, done } = schemaItems.next();
    while (!done) {
      if (await value.is(mutableClass)) {
        if (!mutableClass.key.matches(value.key)) {
          derivedClasses.push(value);
        }
      }
      ({ value, done } = schemaItems.next());
    }

    return derivedClasses;
  }
}

