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
import { ECEditingStatus, SchemaEditingError, schemaItemIdentifierFromName } from "./Exception";

/**
 * @alpha
 * A class extending ECClasses allowing you to create schema items of type CustomAttributeClass.
 */
export class CustomAttributes extends ECClasses {
  public constructor(schemaEditor: SchemaContextEditor) {
    super(SchemaItemType.CustomAttributeClass, schemaEditor);
  }

  public async create(schemaKey: SchemaKey, name: string, containerType: CustomAttributeContainerType, displayLabel?: string, baseClassKey?: SchemaItemKey): Promise<SchemaItemKey> {
    let newClass: MutableCAClass;

    try {
      const schema = await this.getSchema(schemaKey);
      const boundCreate = schema.createCustomAttributeClass.bind(schema);
      newClass = (await this.createClass<CustomAttributeClass>(schemaKey, this.schemaItemType, boundCreate, name, baseClassKey)) as MutableCAClass;
    } catch (e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateSchemaItemFailed, schemaItemIdentifierFromName(schemaKey, this.schemaItemType, name), e);
    }

    if (displayLabel)
      newClass.setDisplayLabel(displayLabel);

    newClass.setContainerType(containerType);

    return newClass.key;
  }

  /**
   * Creates a CustomAttributeClass through a CustomAttributeClassProps.
   * @param schemaKey a SchemaKey of the Schema that will house the new object.
   * @param caProps a json object that will be used to populate the new CustomAttributeClass. Needs a name value passed in.
   */
  public async createFromProps(schemaKey: SchemaKey, caProps: CustomAttributeClassProps): Promise<SchemaItemKey> {
    let newClass: MutableCAClass;
    try {
      const schema = await this.getSchema(schemaKey);
      const boundCreate = schema.createCustomAttributeClass.bind(schema);
      newClass = (await this.createSchemaItemFromProps<CustomAttributeClass>(schemaKey, this.schemaItemType, boundCreate, caProps)) as MutableCAClass;
    } catch (e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateSchemaItemFromPropsFailed, schemaItemIdentifierFromName(schemaKey, this.schemaItemType, caProps.name!), e);
    }

    return newClass.key;
  }
}
