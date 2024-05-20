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
  ECClass, Enumeration, EnumerationPropertyProps, PrimitiveArrayPropertyProps,
  PrimitivePropertyProps, PrimitiveType, SchemaItemKey, SchemaItemType, StructArrayPropertyProps,
  StructClass, StructPropertyProps,
} from "@itwin/ecschema-metadata";
import { assert } from "@itwin/core-bentley";
import { SchemaContextEditor } from "./Editor";
import { MutableClass } from "./Mutable/MutableClass";
import * as Rules from "../Validation/ECRules";
import { ArrayProperties, EnumerationProperties, PrimitiveProperties, Properties, StructProperties } from "./Properties";
import { ECEditingError, ECEditingStatus } from "./Exception";
import { AnyDiagnostic } from "../Validation/Diagnostic";

export type ECClassSchemaItems = SchemaItemType.EntityClass | SchemaItemType.StructClass | SchemaItemType.RelationshipClass | SchemaItemType.Mixin | SchemaItemType.CustomAttributeClass;

/**
 * @alpha
 * Acts as a base class for schema class creation. Enables property creation.
 */
export class ECClasses {

  protected constructor(protected schemaItemType: ECClassSchemaItems, protected _schemaEditor: SchemaContextEditor) { }

  /**
   * Allows access for editing of base Property attributes.
   */
  public readonly properties = new Properties(this.schemaItemType, this._schemaEditor);
  /**
   * Allows access for editing of ArrayProperty attributes.
   */
  public readonly arrayProperties = new ArrayProperties(this.schemaItemType, this._schemaEditor);
  /**
   * Allows access for editing of PrimitiveProperty attributes.
   */
  public readonly primitiveProperties = new PrimitiveProperties(this.schemaItemType, this._schemaEditor);
  /**
   * Allows access for editing of EnumerationProperty attributes.
   */
  public readonly enumerationProperties = new EnumerationProperties(this.schemaItemType, this._schemaEditor);
  /**
   * Allows access for editing of StructProperty attributes.
   */
  public readonly structProperties = new StructProperties(this.schemaItemType, this._schemaEditor);

  /**
   * Creates a property on class identified by the given SchemaItemKey. This method restricts the
   * property type to primitives of type Double, String, DateTime and Integer.
   * @param classKey The SchemaItemKey of the class.
   * @param name The name of the new property.
   * @param type The PrimitiveType assigned to the new property.
   */
  public async createProperty(classKey: SchemaItemKey, name: string, type: PrimitiveType, prefix: string): Promise<void> {
    if (type !== PrimitiveType.Double && type !== PrimitiveType.String && type !== PrimitiveType.DateTime
      && type !== PrimitiveType.Integer)
      throw new Error ("Property creation is restricted to type Double, String, DateTime, and Integer.");

    if ("" === prefix)
      throw new Error("The specified property name prefix is invalid");

    const prefixedName = `${prefix}_${name}`;

    const mutableClass = await this.getClass(classKey);

    await mutableClass.createPrimitiveProperty(prefixedName, type);
  }

  /**
   * Create a primitive property on class identified by the given SchemaItemKey.
   * @param classKey The SchemaItemKey of the class.
   * @param name The name of the new property.
   * @param type The PrimitiveType assigned to the new property.
   */
  public async createPrimitiveProperty(classKey: SchemaItemKey, name: string, type: PrimitiveType): Promise<void> {
    const mutableClass = await this.getClass(classKey);
    await mutableClass.createPrimitiveProperty(name, type);
  }

  public async createPrimitivePropertyFromProps(classKey: SchemaItemKey, name: string, type: PrimitiveType, primitiveProps: PrimitivePropertyProps): Promise<void> {
    const mutableClass = await this.getClass(classKey);
    const newProperty = await mutableClass.createPrimitiveProperty(name, type);
    await newProperty.fromJSON(primitiveProps);
  }

  public async createEnumerationProperty(classKey: SchemaItemKey, name: string, type: Enumeration): Promise<void> {
    const mutableClass = await this.getClass(classKey);
    const enumSchemaItemKey = mutableClass.schema.getSchemaItemKey(type.fullName);
    if (enumSchemaItemKey === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaItemNotFound, `Unable to locate the enumeration ${type.fullName}.`);

    await mutableClass.createPrimitiveProperty(name, type);
  }

  public async createEnumerationPropertyFromProps(classKey: SchemaItemKey, name: string, type: Enumeration, enumProps: EnumerationPropertyProps): Promise<void> {
    const mutableClass = await this.getClass(classKey);
    const newProperty = await mutableClass.createPrimitiveProperty(name, type);
    await newProperty.fromJSON(enumProps);
  }

  public async createPrimitiveArrayProperty(classKey: SchemaItemKey, name: string, type: PrimitiveType): Promise<void> {
    const mutableClass = await this.getClass(classKey);
    await mutableClass.createPrimitiveArrayProperty(name, type);
  }

  public async createPrimitiveArrayPropertyFromProps(classKey: SchemaItemKey, name: string, type: PrimitiveType, primitiveProps: PrimitiveArrayPropertyProps): Promise<void> {
    const mutableClass = await this.getClass(classKey);
    const newProperty = await mutableClass.createPrimitiveArrayProperty(name, type);
    await newProperty.fromJSON(primitiveProps);
  }

  public async createEnumerationArrayProperty(classKey: SchemaItemKey, name: string, type: Enumeration): Promise<void> {
    const mutableClass = await this.getClass(classKey);
    await mutableClass.createPrimitiveArrayProperty(name, type);
  }

  public async createEnumerationArrayPropertyFromProps(classKey: SchemaItemKey, name: string, type: Enumeration, props: PrimitiveArrayPropertyProps): Promise<void> {
    const mutableClass = await this.getClass(classKey);
    const newProperty = await mutableClass.createPrimitiveArrayProperty(name, type);
    await newProperty.fromJSON(props);
  }

  public async createStructProperty(classKey: SchemaItemKey, name: string, type: StructClass): Promise<void> {
    const mutableClass = await this.getClass(classKey);
    await mutableClass.createStructProperty(name, type);
  }

  public async createStructPropertyFromProps(classKey: SchemaItemKey, name: string, type: StructClass, structProps: StructPropertyProps): Promise<void> {
    const mutableClass = await this.getClass(classKey);
    const newProperty = await mutableClass.createStructProperty(name, type);
    await newProperty.fromJSON(structProps);
  }

  public async createStructArrayProperty(classKey: SchemaItemKey, name: string, type: StructClass): Promise<void> {
    const mutableClass = await this.getClass(classKey);
    await mutableClass.createStructArrayProperty(name, type);
  }

  public async createStructArrayPropertyFromProps(classKey: SchemaItemKey, name: string, type: StructClass, structProps: StructArrayPropertyProps): Promise<void> {
    const mutableClass = await this.getClass(classKey);
    const newProperty = await mutableClass.createStructArrayProperty(name, type);
    await newProperty.fromJSON(structProps);
  }

  public async deleteProperty(classKey: SchemaItemKey, name: string): Promise<void> {
    const mutableClass = await this.getClass(classKey);
    await mutableClass.deleteProperty(name);
  }

  public async delete(classKey: SchemaItemKey): Promise<void> {
    const schema = await this._schemaEditor.getSchema(classKey.schemaKey);
    if (schema === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaNotFound, `Schema Key ${classKey.schemaKey.toString(true)} not found in context`);

    const ecClass = await schema.getItem<ECClass>(classKey.name);
    if (ecClass === undefined)
      return;

    await schema.deleteClass(ecClass.name);
  }

  /**
   * Adds a CustomAttribute instance to the Class identified by the given SchemaItemKey
   * @param classKey The SchemaItemKey identifying the schema.
   * @param customAttribute The CustomAttribute instance to add.
   */
  public async addCustomAttribute(classKey: SchemaItemKey, customAttribute: CustomAttribute): Promise<void> {
    const mutableClass = await this.getClass(classKey);
    mutableClass.addCustomAttribute(customAttribute);

    const diagnosticIterable = Rules.validateCustomAttributeInstance(mutableClass, customAttribute);

    const diagnostics: AnyDiagnostic[] = [];
    for await (const diagnostic of diagnosticIterable) {
      diagnostics.push(diagnostic);
    }

    if (diagnostics.length > 0) {
      this.removeCustomAttribute(mutableClass, customAttribute);
      throw new ECEditingError(ECEditingStatus.RuleViolation, undefined, diagnostics);
    }
  }

  /**
   * Sets the name of the ECClass.
   * @param classKey The SchemaItemKey of the class.
   * @param name The new name of the class.
   * @throws ECObjectsError if `name` does not meet the criteria for a valid EC name
   */
  public async setName(classKey: SchemaItemKey, name: string): Promise<SchemaItemKey> {
    const schema = await this._schemaEditor.getSchema(classKey.schemaKey);
    if (schema === undefined) {
      throw new ECEditingError(ECEditingStatus.SchemaNotFound, `Schema Key ${classKey.schemaKey.toString(true)} not found in context`);
    }

    const ecClass = await schema.getItem<MutableClass>(name);
    if (ecClass !== undefined)
      throw new ECEditingError(ECEditingStatus.SchemaItemNameAlreadyExists, `An EC Class with the name ${name} already exists within the schema ${schema.name}`);

    const mutableClass = await this.getClass(classKey);

    const existingName = classKey.name;
    mutableClass.setName(name);

    // Must reset in schema item map
    await schema.deleteClass(existingName);
    schema.addItem(mutableClass);
    return mutableClass.key;
  }

  /**
   * Sets the base class of a SchemaItem.
   * @param itemKey The SchemaItemKey of the Item.
   * @param baseClassKey The SchemaItemKey of the base class. Specifying 'undefined' removes the base class.
   */
  public async setBaseClass(itemKey: SchemaItemKey, baseClassKey?: SchemaItemKey): Promise<void> {
    const classItem = await this._schemaEditor.schemaContext.getSchemaItem<MutableClass>(itemKey);

    if (classItem === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaItemNotFound, `Class ${itemKey.fullName} not found in schema context.`);

    if (baseClassKey === undefined) {
      classItem.baseClass = undefined;
      return;
    }

    const baseClassSchema = !baseClassKey.schemaKey.matches(itemKey.schemaKey) ? await this._schemaEditor.getSchema(baseClassKey.schemaKey) : classItem.schema;
    if (baseClassSchema === undefined) {
      throw new ECEditingError(ECEditingStatus.SchemaNotFound, `Schema Key ${baseClassKey.schemaKey.toString(true)} not found in context`);
    }

    const baseClassItem = await baseClassSchema.lookupItem<ECClass>(baseClassKey);
    if (baseClassItem === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaItemNotFound, `Unable to locate base class ${baseClassKey.fullName} in schema ${baseClassSchema.fullName}.`);

    if (baseClassItem.schemaItemType !== classItem.schemaItemType)
      throw new ECEditingError(ECEditingStatus.InvalidSchemaItemType, `${baseClassItem.fullName} is not of type ${classItem.schemaItemType}.` );

    if (classItem.baseClass !== undefined && !await baseClassItem.is(await classItem.baseClass))
      throw new ECEditingError(ECEditingStatus.InvalidBaseClass, `Base class ${baseClassItem.fullName} must derive from ${classItem.baseClass.fullName}.`);

    classItem.baseClass = new DelayedPromiseWithProps<SchemaItemKey, ECClass>(baseClassKey, async () => baseClassItem);
  }

  private async getClass(classKey: SchemaItemKey): Promise<MutableClass> {
    const schema = await this._schemaEditor.getSchema(classKey.schemaKey);
    if (schema === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaNotFound, `Schema Key ${classKey.schemaKey.toString(true)} not found in context`);

    const ecClass = await schema.getItem<MutableClass>(classKey.name);
    if (ecClass === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaItemNotFound, `Class ${classKey.name} was not found in schema ${classKey.schemaKey.toString(true)}`);

    switch (ecClass.schemaItemType) {
      case SchemaItemType.EntityClass:
      case SchemaItemType.Mixin:
      case SchemaItemType.StructClass:
      case SchemaItemType.CustomAttributeClass:
      case SchemaItemType.RelationshipClass:
        break;
      default:
        throw new ECEditingError(ECEditingStatus.InvalidSchemaItemType, `Schema item type not supported`);
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
