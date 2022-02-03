/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import type {
  ECClass, Enumeration, EnumerationPropertyProps, PrimitiveArrayPropertyProps,
  PrimitivePropertyProps, SchemaItemKey, StructArrayPropertyProps,
  StructClass, StructPropertyProps} from "@itwin/ecschema-metadata";
import { ECObjectsError, ECObjectsStatus, PrimitiveType, SchemaItemType,
} from "@itwin/ecschema-metadata";
import type { PropertyEditResults, SchemaContextEditor, SchemaItemEditResults } from "./Editor";
import type { MutableClass } from "./Mutable/MutableClass";

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
      mutableClass = await this.getClass(classKey, prefixedName);
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
      mutableClass = await this.getClass(classKey, name);
    } catch (e: any) {
      return { errorMessage: e.message };
    }

    await mutableClass.createPrimitiveProperty(name, type);
    return { itemKey: classKey, propertyName: name };
  }

  public async createPrimitivePropertyFromProps(classKey: SchemaItemKey, name: string, type: PrimitiveType, primitiveProps: PrimitivePropertyProps): Promise<PropertyEditResults> {
    let mutableClass: MutableClass;
    try {
      mutableClass = await this.getClass(classKey, name);
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
      mutableClass = await this.getClass(classKey, name);
    } catch (e: any) {
      return { errorMessage: e.message };
    }

    const enumSchemaItemKey = mutableClass.schema.getSchemaItemKey(type.fullName);
    if (enumSchemaItemKey === undefined) throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate the enumeration ${type.fullName}.`);

    await mutableClass.createPrimitiveProperty(name, type);
    return { itemKey: classKey, propertyName: name };
  }
  public async createEnumerationPropertyFromProps(classKey: SchemaItemKey, name: string, type: Enumeration, enumProps: EnumerationPropertyProps): Promise<PropertyEditResults> {
    let mutableClass: MutableClass;
    try {
      mutableClass = await this.getClass(classKey, name);
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
      mutableClass = await this.getClass(classKey, name);
    } catch (e: any) {
      return { errorMessage: e.message };
    }

    await mutableClass.createPrimitiveArrayProperty(name, type);
    return { itemKey: classKey, propertyName: name };
  }

  public async createPrimitiveArrayPropertyFromProps(classKey: SchemaItemKey, name: string, type: PrimitiveType, primitiveProps: PrimitiveArrayPropertyProps): Promise<PropertyEditResults> {
    let mutableClass: MutableClass;
    try {
      mutableClass = await this.getClass(classKey, name);
    } catch (e: any) {
      return { errorMessage: e.message };
    }

    const newProperty = await mutableClass.createPrimitiveArrayProperty(name, type);
    await newProperty.fromJSON(primitiveProps);
    return { itemKey: classKey, propertyName: name };
  }

  public async createStructProperty(classKey: SchemaItemKey, name: string, type: StructClass): Promise<PropertyEditResults> {
    let mutableClass: MutableClass;
    try {
      mutableClass = await this.getClass(classKey, name);
    } catch (e: any) {
      return { errorMessage: e.message };
    }

    await mutableClass.createStructProperty(name, type);
    return { itemKey: classKey, propertyName: name };
  }

  public async createStructPropertyFromProps(classKey: SchemaItemKey, name: string, type: StructClass, structProps: StructPropertyProps): Promise<PropertyEditResults> {
    let mutableClass: MutableClass;
    try {
      mutableClass = await this.getClass(classKey, name);
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
      mutableClass = await this.getClass(classKey, name);
    } catch (e: any) {
      return { errorMessage: e.message };
    }

    await mutableClass.createStructArrayProperty(name, type);
    return { itemKey: classKey, propertyName: name };
  }

  public async createStructArrayPropertyFromProps(classKey: SchemaItemKey, name: string, type: StructClass, structProps: StructArrayPropertyProps): Promise<PropertyEditResults> {
    let mutableClass: MutableClass;
    try {
      mutableClass = await this.getClass(classKey, name);
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
      mutableClass = await this.getClass(classKey, name);
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

  private async getClass(classKey: SchemaItemKey, name: string): Promise<MutableClass> {
    const schema = await this._schemaEditor.getSchema(classKey.schemaKey);
    if (schema === undefined)
      throw new Error(`Failed to create property ${name} because the schema ${classKey.schemaKey.toString(true)} could not be found`);

    const ecClass = await schema.getItem<MutableClass>(classKey.name);
    if (ecClass === undefined)
      throw new Error(`Failed to create property ${name} because the class ${classKey.name} was not found in ${classKey.schemaKey.toString(true)}`);

    switch (ecClass.schemaItemType) {
      case SchemaItemType.EntityClass:
      case SchemaItemType.Mixin:
      case SchemaItemType.StructClass:
      case SchemaItemType.CustomAttributeClass:
      case SchemaItemType.RelationshipClass:
        break;
      default:
        throw new Error(`Schema item type not supported`);
    }

    return ecClass;
  }
}

