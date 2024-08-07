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
  PrimitivePropertyProps, PrimitiveType, SchemaItemKey, SchemaItemType, SchemaKey, StructArrayPropertyProps,
  StructClass, StructPropertyProps,
} from "@itwin/ecschema-metadata";
import { assert } from "@itwin/core-bentley";
import { SchemaContextEditor } from "./Editor";
import { MutableClass } from "./Mutable/MutableClass";
import * as Rules from "../Validation/ECRules";
import { ArrayProperties, EnumerationProperties, PrimitiveProperties, Properties, StructProperties } from "./Properties";
import { ECEditingStatus, SchemaEditingError } from "./Exception";
import { AnyDiagnostic } from "../Validation/Diagnostic";
import { CreateSchemaItem, SchemaItems } from "./SchemaItems";
import { MutableSchema } from "./Mutable/MutableSchema";
import { PropertyId, SchemaItemId, ClassId, CustomAttributeId } from "./SchemaItemIdentifiers";
import { SchemaEditType } from "./SchemaEditType";
import { ECElementSelection } from "./ECElementSelection";
import { ChangeOptions } from "./ChangeInfo/ChangeOptions";
import { SetBaseClassChange } from "./ChangeInfo/SetBaseClassChange";

export type ECClassSchemaItems = SchemaItemType.EntityClass | SchemaItemType.StructClass | SchemaItemType.RelationshipClass | SchemaItemType.Mixin | SchemaItemType.CustomAttributeClass;

/**
 * @alpha
 * Acts as a base class for schema class creation. Enables property creation.
 */
export class ECClasses extends SchemaItems {

  protected constructor(schemaItemType: ECClassSchemaItems, schemaEditor: SchemaContextEditor) {
    super(schemaItemType, schemaEditor);
    this.schemaItemType = schemaItemType;
  }

  protected override schemaItemType: ECClassSchemaItems;

  /**
   * Allows access for editing of base Property attributes.
   */
  public readonly properties = new Properties(this.schemaItemType, this.schemaEditor);
  /**
   * Allows access for editing of ArrayProperty attributes.
   */
  public readonly arrayProperties = new ArrayProperties(this.schemaItemType, this.schemaEditor);
  /**
   * Allows access for editing of PrimitiveProperty attributes.
   */
  public readonly primitiveProperties = new PrimitiveProperties(this.schemaItemType, this.schemaEditor);
  /**
   * Allows access for editing of EnumerationProperty attributes.
   */
  public readonly enumerationProperties = new EnumerationProperties(this.schemaItemType, this.schemaEditor);
  /**
   * Allows access for editing of StructProperty attributes.
   */
  public readonly structProperties = new StructProperties(this.schemaItemType, this.schemaEditor);

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
      throw new Error("Property creation is restricted to type Double, String, DateTime, and Integer.");

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
    } catch (e: any) {
      throw new SchemaEditingError(SchemaEditType.CreatePrimitiveProperty, new PropertyId(this.schemaItemType, classKey, name), e);
    }
  }

  public async createPrimitivePropertyFromProps(classKey: SchemaItemKey, name: string, type: PrimitiveType, primitiveProps: PrimitivePropertyProps): Promise<void> {
    try {
      const mutableClass = await this.getClass(classKey);
      const newProperty = await mutableClass.createPrimitiveProperty(name, type);
      await newProperty.fromJSON(primitiveProps);
    } catch (e: any) {
      throw new SchemaEditingError(SchemaEditType.CreatePrimitivePropertyFromProps, new PropertyId(this.schemaItemType, classKey, name), e);
    }
  }

  public async createEnumerationProperty(classKey: SchemaItemKey, name: string, type: Enumeration): Promise<void> {
    try {
      const mutableClass = await this.getClass(classKey);
      const enumSchemaItemKey = mutableClass.schema.getSchemaItemKey(type.fullName);
      if (enumSchemaItemKey === undefined)
        throw new SchemaEditingError(ECEditingStatus.SchemaItemNotFound, new SchemaItemId(SchemaItemType.Enumeration, type.name, mutableClass.schema.schemaKey));

      await mutableClass.createPrimitiveProperty(name, type);
    } catch (e: any) {
      throw new SchemaEditingError(SchemaEditType.CreateEnumerationProperty, new PropertyId(this.schemaItemType, classKey, name), e);
    }
  }

  public async createEnumerationPropertyFromProps(classKey: SchemaItemKey, name: string, type: Enumeration, enumProps: EnumerationPropertyProps): Promise<void> {
    try {
      const mutableClass = await this.getClass(classKey);
      const newProperty = await mutableClass.createPrimitiveProperty(name, type);
      await newProperty.fromJSON(enumProps);
    } catch (e: any) {
      throw new SchemaEditingError(SchemaEditType.CreateEnumerationArrayPropertyFromProps, new PropertyId(this.schemaItemType, classKey, name), e);
    }
  }

  public async createPrimitiveArrayProperty(classKey: SchemaItemKey, name: string, type: PrimitiveType): Promise<void> {
    try {
      const mutableClass = await this.getClass(classKey);
      await mutableClass.createPrimitiveArrayProperty(name, type);
    } catch (e: any) {
      throw new SchemaEditingError(SchemaEditType.CreatePrimitiveArrayProperty, new PropertyId(this.schemaItemType, classKey, name), e);
    }
  }

  public async createPrimitiveArrayPropertyFromProps(classKey: SchemaItemKey, name: string, type: PrimitiveType, primitiveProps: PrimitiveArrayPropertyProps): Promise<void> {
    try {
      const mutableClass = await this.getClass(classKey);
      const newProperty = await mutableClass.createPrimitiveArrayProperty(name, type);
      await newProperty.fromJSON(primitiveProps);
    } catch (e: any) {
      throw new SchemaEditingError(SchemaEditType.CreatePrimitiveArrayPropertyFromProps, new PropertyId(this.schemaItemType, classKey, name), e);
    }
  }

  public async createEnumerationArrayProperty(classKey: SchemaItemKey, name: string, type: Enumeration): Promise<void> {
    try {
      const mutableClass = await this.getClass(classKey);
      await mutableClass.createPrimitiveArrayProperty(name, type);
    } catch (e: any) {
      throw new SchemaEditingError(SchemaEditType.CreateEnumerationArrayProperty, new PropertyId(this.schemaItemType, classKey, name), e);
    }
  }

  public async createEnumerationArrayPropertyFromProps(classKey: SchemaItemKey, name: string, type: Enumeration, props: PrimitiveArrayPropertyProps): Promise<void> {
    try {
      const mutableClass = await this.getClass(classKey);
      const newProperty = await mutableClass.createPrimitiveArrayProperty(name, type);
      await newProperty.fromJSON(props);
    } catch (e: any) {
      throw new SchemaEditingError(SchemaEditType.CreateEnumerationArrayPropertyFromProps, new PropertyId(this.schemaItemType, classKey, name), e);
    }
  }

  public async createStructProperty(classKey: SchemaItemKey, name: string, type: StructClass): Promise<void> {
    try {
      const mutableClass = await this.getClass(classKey);
      await mutableClass.createStructProperty(name, type);
    } catch (e: any) {
      throw new SchemaEditingError(SchemaEditType.CreateStructProperty, new PropertyId(this.schemaItemType, classKey, name), e);
    }
  }

  public async createStructPropertyFromProps(classKey: SchemaItemKey, name: string, type: StructClass, structProps: StructPropertyProps): Promise<void> {
    try {
      const mutableClass = await this.getClass(classKey);
      const newProperty = await mutableClass.createStructProperty(name, type);
      await newProperty.fromJSON(structProps);
    } catch (e: any) {
      throw new SchemaEditingError(SchemaEditType.CreateStructPropertyFromProps, new PropertyId(this.schemaItemType, classKey, name), e);
    }
  }

  public async createStructArrayProperty(classKey: SchemaItemKey, name: string, type: StructClass): Promise<void> {
    try {
      const mutableClass = await this.getClass(classKey);
      await mutableClass.createStructArrayProperty(name, type);
    } catch (e: any) {
      throw new SchemaEditingError(SchemaEditType.CreateStructArrayProperty, new PropertyId(this.schemaItemType, classKey, name), e);
    }
  }

  public async createStructArrayPropertyFromProps(classKey: SchemaItemKey, name: string, type: StructClass, structProps: StructArrayPropertyProps): Promise<void> {
    try {
      const mutableClass = await this.getClass(classKey);
      const newProperty = await mutableClass.createStructArrayProperty(name, type);
      await newProperty.fromJSON(structProps);
    } catch (e: any) {
      throw new SchemaEditingError(SchemaEditType.CreateStructArrayPropertyFromProps, new PropertyId(this.schemaItemType, classKey, name), e);
    }
  }

  public async deleteProperty(classKey: SchemaItemKey, name: string): Promise<void> {
    try {
      const mutableClass = await this.getClass(classKey);
      await mutableClass.deleteProperty(name);
    } catch (e: any) {
      throw new SchemaEditingError(SchemaEditType.DeleteProperty, new PropertyId(this.schemaItemType, classKey, name), e);
    }
  }

  public async delete(classKey: SchemaItemKey): Promise<void> {
    try {
      const schema = await this.getSchema(classKey.schemaKey);
      const ecClass = await schema.getItem<ECClass>(classKey.name);
      if (ecClass === undefined)
        return;

      await schema.deleteClass(ecClass.name);
    } catch (e: any) {
      throw new SchemaEditingError(SchemaEditType.DeleteClass, new ClassId(this.schemaItemType, classKey), e);
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
    } catch (e: any) {
      throw new SchemaEditingError(SchemaEditType.AddCustomAttributeToClass, new ClassId(this.schemaItemType, classKey), e);
    }
  }

  /**
   * Sets the base class of a SchemaItem.
   * @param itemKey The SchemaItemKey of the Item.
   * @param baseClassKey The SchemaItemKey of the base class. Specifying 'undefined' removes the base class.
   */
  public async setBaseClass(itemKey: SchemaItemKey, baseClassKey: SchemaItemKey | undefined, options: ChangeOptions = ChangeOptions.default): Promise<void> {

    try {
      const classItem = await this.getSchemaItem<ECClass>(itemKey);

      if (!baseClassKey) {
        classItem.baseClass = undefined;
        return;
      }

      const baseClassSchema = !baseClassKey.schemaKey.matches(itemKey.schemaKey) ? await this.getSchema(baseClassKey.schemaKey) : classItem.schema as MutableSchema;
      const baseClassItem = await this.lookupSchemaItem<ECClass>(baseClassSchema, baseClassKey);

      if (classItem.baseClass !== undefined && !await baseClassItem.is(await classItem.baseClass))
        throw new SchemaEditingError(ECEditingStatus.InvalidBaseClass, new ClassId(this.schemaItemType, baseClassItem.key), undefined, undefined, `Base class ${baseClassItem.key.fullName} must derive from ${(await classItem.baseClass).fullName}.`);

      await this.checkForBaseClassCycles(classItem, baseClassItem);
      await this.validateBaseClass(baseClassItem, classItem);
      for await (const baseClass of baseClassItem.getAllBaseClasses()) {
        await this.validateBaseClass(baseClass, classItem);
      }

      const elements = new ECElementSelection(this.schemaEditor, classItem.schema, classItem, undefined, options);
      await ECElementSelection.gatherClassesAndPropertyOverrides(classItem, elements);

      for (const derivedClassEntry of elements.gatheredDerivedClasses) {
        await this.validateBaseClass(baseClassItem, derivedClassEntry[1]);
      }

      // Create change info object to allow for edit cancelling
      const changeInfo = new SetBaseClassChange(this.schemaEditor, classItem, baseClassItem, await classItem.baseClass, elements);

      // Callback returns false to cancel the edit.
      if (!(await changeInfo.beginChange()))
        return;

      classItem.baseClass = new DelayedPromiseWithProps<SchemaItemKey, ECClass>(baseClassKey, async () => baseClassItem);
    } catch (e: any) {
      throw new SchemaEditingError(SchemaEditType.SetBaseClass, new ClassId(this.schemaItemType, itemKey), e);
    }
  }

  private async validateBaseClass(baseClass: ECClass, derivedClass: ECClass) {
    if (!baseClass.properties)
      return;

    for (const baseProperty of baseClass.properties) {
      const derivedProperty = await derivedClass.getProperty(baseProperty.name, false);
      if (undefined === derivedProperty)
        continue;

      if (baseProperty.propertyType !== derivedProperty.propertyType) {
        throw new SchemaEditingError(ECEditingStatus.InvalidPropertyType, new PropertyId(this.schemaItemType, derivedClass.key, derivedProperty), undefined, undefined,
          `Found property '${derivedProperty.fullName}' of type '${Properties.propertyTypeToString(derivedProperty)}' which is not compatible with the base property '${baseProperty.fullName}' of type '${Properties.propertyTypeToString(baseProperty)}'.`);
      }
    }
  }

  private async checkForBaseClassCycles(ecClass: ECClass, baseClass: ECClass): Promise<boolean> {
    if (baseClass.key.matches(ecClass.key))
      throw new SchemaEditingError(ECEditingStatus.InvalidBaseClass, new ClassId(this.schemaItemType, baseClass.key), undefined, undefined, `The class ${ecClass.key.fullName} cannot derive from itself.`);

    if (!baseClass.baseClass)
      return false;

    if (baseClass.baseClass.matches(ecClass.key))
      throw new SchemaEditingError(ECEditingStatus.InvalidBaseClass, new ClassId(this.schemaItemType, baseClass.key), undefined, undefined, `Base class ${baseClass.fullName} derives from ${ecClass.fullName}.`);

    return this.checkForBaseClassCycles(ecClass, await baseClass.baseClass);
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

  private async findDerivedClasses(mutableClass: MutableClass): Promise<Array<MutableClass>> {
    const derivedClasses: Array<MutableClass> = [];
    const schemaItems = this.schemaEditor.schemaContext.getSchemaItems();
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
