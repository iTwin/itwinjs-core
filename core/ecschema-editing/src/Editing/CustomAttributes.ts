/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import {
  CustomAttributeClass,
  CustomAttributeClassProps, CustomAttributeContainerType,
  SchemaItemKey, SchemaItemType, SchemaKey,
} from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "./Editor";
import { ECClasses } from "./ECClasses";
import { MutableCAClass } from "./Mutable/MutableCAClass";
import { ClassId, ECEditingStatus, SchemaEditingError } from "./Exception";

/**
 * @alpha
 * A class extending ECClasses allowing you to create schema items of type CustomAttributeClass.
 */
export class CustomAttributes extends ECClasses {
  public constructor(schemaEditor: SchemaContextEditor) {
    super(SchemaItemType.CustomAttributeClass, schemaEditor);
  }

  public async create(schemaKey: SchemaKey, name: string, containerType: CustomAttributeContainerType, displayLabel?: string, baseClassKey?: SchemaItemKey): Promise<SchemaItemKey> {
    try {
      const schema = await this.getSchema(schemaKey);
      const boundCreate = schema.createCustomAttributeClass.bind(schema);
      const newClass = await this.createClass<CustomAttributeClass>(schemaKey, this.schemaItemType, boundCreate, name, baseClassKey) as MutableCAClass;

      if (displayLabel)
        newClass.setDisplayLabel(displayLabel);

      newClass.setContainerType(containerType);
      return newClass.key;
    } catch (e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateSchemaItemFailed, new ClassId(this.schemaItemType, name, schemaKey), e);
    }
  }

  /**
   * Creates a CustomAttributeClass through a CustomAttributeClassProps.
   * @param schemaKey a SchemaKey of the Schema that will house the new object.
   * @param caProps a json object that will be used to populate the new CustomAttributeClass. Needs a name value passed in.
   */
  public async createFromProps(schemaKey: SchemaKey, caProps: CustomAttributeClassProps): Promise<SchemaItemKey> {
    try {
      const schema = await this.getSchema(schemaKey);
      const boundCreate = schema.createCustomAttributeClass.bind(schema);
      const newClass = await this.createSchemaItemFromProps(schemaKey, this.schemaItemType, boundCreate, caProps);
      return newClass.key;
    } catch (e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateSchemaItemFromProps, new ClassId(this.schemaItemType, caProps.name!, schemaKey), e);
    }
  }
}
