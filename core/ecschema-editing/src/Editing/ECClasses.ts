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
  ECClass, ECObjectsError, ECObjectsStatus, Enumeration, EnumerationPropertyProps, PrimitiveArrayPropertyProps,
  PrimitivePropertyProps, PrimitiveType, SchemaItemKey, SchemaItemType, SchemaKey, StructArrayPropertyProps,
  StructClass, StructPropertyProps,
} from "@itwin/ecschema-metadata";
import { assert } from "@itwin/core-bentley";
import { SchemaContextEditor } from "./Editor";
import { MutableClass } from "./Mutable/MutableClass";
import * as Rules from "../Validation/ECRules";
import { ArrayProperties, EnumerationProperties, PrimitiveProperties, Properties, StructProperties } from "./Properties";
import { ClassId, CustomAttributeId, ECEditingStatus, PropertyId, SchemaEditingError, SchemaItemId } from "./Exception";
import { AnyDiagnostic } from "../Validation/Diagnostic";
import { CreateSchemaItem, SchemaItems } from "./SchemaItems";
import { MutableSchema } from "./Mutable/MutableSchema";

export type ECClassSchemaItems = SchemaItemType.EntityClass | SchemaItemType.StructClass | SchemaItemType.RelationshipClass | SchemaItemType.Mixin | SchemaItemType.CustomAttributeClass;

/**
 * @alpha
 * Acts as a base class for schema class creation. Enables property creation.
 */
export class ECClasses extends SchemaItems{

  protected constructor(schemaItemType: ECClassSchemaItems, schemaEditor: SchemaContextEditor) {
    super(schemaItemType, schemaEditor);
    this.schemaItemType = schemaItemType;
  }

  protected override schemaItemType: ECClassSchemaItems;

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

  public async createClass<T extends ECClass>(schemaKey: SchemaKey, type: SchemaItemType, create: CreateSchemaItem<T>, name: string, baseClassKey?: SchemaItemKey, ...args: any[]): Promise<T> {
    const newClass = await this.createSchemaItem(schemaKey, type, create, name, ...args);

    if (baseClassKey !== undefined) {
      const baseClassSchema = !baseClassKey.schemaKey.matches(newClass.schema.schemaKey) ? await this.getSchema(baseClassKey.schemaKey) : newClass.schema as MutableSchema;
      const baseClassItem = await this.lookupSchemaItem<ECClass>(baseClassSchema, baseClassKey);
      newClass.baseClass = new DelayedPromiseWithProps<SchemaItemKey, T>(baseClassKey, async () => baseClassItem as T);
    }

    return newClass;
  }

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
    try {
      const mutableClass = await this.getClass(classKey);
      await mutableClass.createPrimitiveProperty(name, type);
    } catch(e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreatePrimitiveProperty, new PropertyId(this.schemaItemType, classKey, name), e);
    }
  }

  public async createPrimitivePropertyFromProps(classKey: SchemaItemKey, name: string, type: PrimitiveType, primitiveProps: PrimitivePropertyProps): Promise<void> {
    try {
      const mutableClass = await this.getClass(classKey);
      const newProperty =  await mutableClass.createPrimitiveProperty(name, type);
      await newProperty.fromJSON(primitiveProps);
    } catch(e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreatePrimitivePropertyFromProps, new PropertyId(this.schemaItemType, classKey, name), e);
    }
  }

  public async createEnumerationProperty(classKey: SchemaItemKey, name: string, type: Enumeration): Promise<void> {
    try {
      const mutableClass = await this.getClass(classKey);
      const enumSchemaItemKey = mutableClass.schema.getSchemaItemKey(type.fullName);
      if (enumSchemaItemKey === undefined)
        throw new SchemaEditingError(ECEditingStatus.SchemaItemNotFound, new SchemaItemId(SchemaItemType.Enumeration, type.name, mutableClass.schema.schemaKey));

      await mutableClass.createPrimitiveProperty(name, type);
    } catch(e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateEnumerationProperty, new PropertyId(this.schemaItemType, classKey, name), e);
    }
  }

  public async createEnumerationPropertyFromProps(classKey: SchemaItemKey, name: string, type: Enumeration, enumProps: EnumerationPropertyProps): Promise<void> {
    try {
      const mutableClass = await this.getClass(classKey);
      const newProperty =  await mutableClass.createPrimitiveProperty(name, type);
      await newProperty.fromJSON(enumProps);
    } catch(e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateEnumerationArrayPropertyFromProps, new PropertyId(this.schemaItemType, classKey, name), e);
    }
  }

  public async createPrimitiveArrayProperty(classKey: SchemaItemKey, name: string, type: PrimitiveType): Promise<void> {
    try {
      const mutableClass = await this.getClass(classKey);
      await mutableClass.createPrimitiveArrayProperty(name, type);
    } catch(e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreatePrimitiveArrayProperty, new PropertyId(this.schemaItemType, classKey, name), e);
    }
  }

  public async createPrimitiveArrayPropertyFromProps(classKey: SchemaItemKey, name: string, type: PrimitiveType, primitiveProps: PrimitiveArrayPropertyProps): Promise<void> {
    try {
      const mutableClass = await this.getClass(classKey);
      const newProperty =  await mutableClass.createPrimitiveArrayProperty(name, type);
      await newProperty.fromJSON(primitiveProps);
    } catch(e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreatePrimitiveArrayPropertyFromProps, new PropertyId(this.schemaItemType, classKey, name), e);
    }
  }

  public async createEnumerationArrayProperty(classKey: SchemaItemKey, name: string, type: Enumeration): Promise<void> {
    try {
      const mutableClass = await this.getClass(classKey);
      await mutableClass.createPrimitiveArrayProperty(name, type);
    } catch(e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateEnumerationArrayProperty, new PropertyId(this.schemaItemType, classKey, name), e);
    }
  }

  public async createEnumerationArrayPropertyFromProps(classKey: SchemaItemKey, name: string, type: Enumeration, props: PrimitiveArrayPropertyProps): Promise<void> {
    try {
      const mutableClass = await this.getClass(classKey);
      const newProperty =  await mutableClass.createPrimitiveArrayProperty(name, type);
      await newProperty.fromJSON(props);
    } catch(e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateEnumerationArrayPropertyFromProps, new PropertyId(this.schemaItemType, classKey, name), e);
    }
  }

  public async createStructProperty(classKey: SchemaItemKey, name: string, type: StructClass): Promise<void> {
    try {
      const mutableClass = await this.getClass(classKey);
      await mutableClass.createStructProperty(name, type);
    } catch(e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateStructProperty, new PropertyId(this.schemaItemType, classKey, name), e);
    }
  }

  public async createStructPropertyFromProps(classKey: SchemaItemKey, name: string, type: StructClass, structProps: StructPropertyProps): Promise<void> {
    try {
      const mutableClass = await this.getClass(classKey);
      const newProperty =  await mutableClass.createStructProperty(name, type);
      await newProperty.fromJSON(structProps);
    } catch(e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateStructPropertyFromProps, new PropertyId(this.schemaItemType, classKey, name), e);
    }
  }

  public async createStructArrayProperty(classKey: SchemaItemKey, name: string, type: StructClass): Promise<void> {
    try {
      const mutableClass = await this.getClass(classKey);
      await mutableClass.createStructArrayProperty(name, type);
    } catch(e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateStructArrayProperty, new PropertyId(this.schemaItemType, classKey, name), e);
    }
  }

  public async createStructArrayPropertyFromProps(classKey: SchemaItemKey, name: string, type: StructClass, structProps: StructArrayPropertyProps): Promise<void> {
    try {
      const mutableClass = await this.getClass(classKey);
      const newProperty =  await mutableClass.createStructArrayProperty(name, type);
      await newProperty.fromJSON(structProps);
    } catch(e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateStructArrayPropertyFromProps, new PropertyId(this.schemaItemType, classKey, name), e);
    }
  }

  public async deleteProperty(classKey: SchemaItemKey, name: string): Promise<void> {
    try {
      const mutableClass = await this.getClass(classKey);
      await mutableClass.deleteProperty(name);
    } catch(e: any) {
      throw new SchemaEditingError(ECEditingStatus.DeleteProperty, new PropertyId(this.schemaItemType, classKey, name), e);
    }
  }

  public async delete(classKey: SchemaItemKey): Promise<void> {
    try {
      const schema = await this.getSchema(classKey.schemaKey);
      const ecClass = await schema.getItem<ECClass>(classKey.name);
      if (ecClass === undefined)
        return;

      await schema.deleteClass(ecClass.name);
    } catch(e: any) {
      throw new SchemaEditingError(ECEditingStatus.DeleteClass, new ClassId(this.schemaItemType, classKey), e);
    }
  }

  /**
   * Adds a CustomAttribute instance to the Class identified by the given SchemaItemKey
   * @param classKey The SchemaItemKey identifying the schema.
   * @param customAttribute The CustomAttribute instance to add.
   */
  public async addCustomAttribute(classKey: SchemaItemKey, customAttribute: CustomAttribute): Promise<void> {
    try {
      const mutableClass = await this.getClass(classKey);
      mutableClass.addCustomAttribute(customAttribute);

      const diagnosticIterable = Rules.validateCustomAttributeInstance(mutableClass, customAttribute);

      const diagnostics: AnyDiagnostic[] = [];
      for await (const diagnostic of diagnosticIterable) {
        diagnostics.push(diagnostic);
      }

      if (diagnostics.length > 0) {
        this.removeCustomAttribute(mutableClass, customAttribute);
        throw new SchemaEditingError(ECEditingStatus.RuleViolation, new CustomAttributeId(customAttribute.className, mutableClass), undefined, diagnostics);
      }
    } catch(e: any) {
      throw new SchemaEditingError(ECEditingStatus.AddCustomAttributeToClass, new ClassId(this.schemaItemType, classKey), e);
    }
  }

  /**
   * Sets the name of the ECClass.
   * @param classKey The SchemaItemKey of the class.
   * @param name The new name of the class.
   * @throws ECObjectsError if `name` does not meet the criteria for a valid EC name
   */
  public async setName(classKey: SchemaItemKey, name: string): Promise<SchemaItemKey> {
    try {
      const schema = await this.getSchema(classKey.schemaKey);
      const ecClass = await schema.getItem<MutableClass>(name);
      if (ecClass !== undefined)
        throw new SchemaEditingError(ECEditingStatus.SchemaItemNameAlreadyExists, new ClassId(this.schemaItemType, name, schema.schemaKey));

      const mutableClass = await this.getClass(classKey);

      const existingName = classKey.name;
      mutableClass.setName(name);

      // Must reset in schema item map
      await schema.deleteClass(existingName);
      schema.addItem(mutableClass);
      return mutableClass.key;
    } catch(e: any) {
      if (e instanceof ECObjectsError && e.errorNumber === ECObjectsStatus.InvalidECName) {
        throw new SchemaEditingError(ECEditingStatus.SetClassName, new ClassId(this.schemaItemType, classKey),
          new SchemaEditingError(ECEditingStatus.InvalidECName, new ClassId(this.schemaItemType, classKey)));
      }

      throw new SchemaEditingError(ECEditingStatus.SetClassName, new ClassId(this.schemaItemType, classKey), e);
    }
  }

  /**
   * Sets the base class of a SchemaItem.
   * @param itemKey The SchemaItemKey of the Item.
   * @param baseClassKey The SchemaItemKey of the base class. Specifying 'undefined' removes the base class.
   */
  public async setBaseClass(itemKey: SchemaItemKey, baseClassKey?: SchemaItemKey): Promise<void> {
    try {
      const classItem = await this.getSchemaItem<ECClass>(itemKey);
      if (!baseClassKey) {
        classItem.baseClass = undefined;
        return;
      }

      const baseClassSchema = !baseClassKey.schemaKey.matches(itemKey.schemaKey) ? await this.getSchema(baseClassKey.schemaKey) : classItem.schema as MutableSchema;
      const baseClassItem = await this.lookupSchemaItem<ECClass>(baseClassSchema, baseClassKey);
      if (classItem.baseClass !== undefined && !await baseClassItem.is(await classItem.baseClass))
        throw new SchemaEditingError(ECEditingStatus.InvalidBaseClass, new ClassId(this.schemaItemType, baseClassKey), undefined, undefined, `Base class ${baseClassKey.fullName} must derive from ${(await classItem.baseClass).fullName}.`);

      classItem.baseClass = new DelayedPromiseWithProps<SchemaItemKey, ECClass>(baseClassKey, async () => baseClassItem);
    } catch(e: any) {
      throw new SchemaEditingError(ECEditingStatus.SetBaseClass, new ClassId(this.schemaItemType, itemKey), e);
    }
  }

  private async getClass(classKey: SchemaItemKey): Promise<MutableClass> {
    const schema = await this.getSchema(classKey.schemaKey);

    const ecClass = await schema.getItem<MutableClass>(classKey.name);
    if (ecClass === undefined)
      throw new SchemaEditingError(ECEditingStatus.SchemaItemNotFound, new ClassId(this.schemaItemType, classKey));

    switch (ecClass.schemaItemType) {
      case SchemaItemType.EntityClass:
      case SchemaItemType.Mixin:
      case SchemaItemType.StructClass:
      case SchemaItemType.CustomAttributeClass:
      case SchemaItemType.RelationshipClass:
        break;
      default:
        throw new SchemaEditingError(ECEditingStatus.InvalidSchemaItemType, new ClassId(this.schemaItemType, classKey));
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
