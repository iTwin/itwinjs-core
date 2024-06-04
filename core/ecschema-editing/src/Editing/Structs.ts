/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { SchemaItemKey, SchemaItemType, SchemaKey, StructClass, StructClassProps } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "./Editor";
import { ECClasses } from "./ECClasses";
import { MutableStructClass } from "./Mutable/MutableClass";
import { ClassId, ECEditingStatus, SchemaEditingError } from "./Exception";

/**
 * @alpha A class extending ECClasses allowing you to create schema items of type StructClass.
 */
export class Structs extends ECClasses {
  public constructor(schemaEditor: SchemaContextEditor) {
    super(SchemaItemType.StructClass, schemaEditor);
  }

  public async create(schemaKey: SchemaKey, name: string, displayLabel?: string, baseClassKey?: SchemaItemKey): Promise<SchemaItemKey> {
    try {
      const schema = await this.getSchema(schemaKey);
      const boundCreate = schema.createStructClass.bind(schema);
      const newClass = await this.createClass<StructClass>(schemaKey, this.schemaItemType, boundCreate, name, baseClassKey) as MutableStructClass;

      if (displayLabel)
        newClass.setDisplayLabel(displayLabel);

      return newClass.key;
    } catch (e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateSchemaItemFailed, new ClassId(this.schemaItemType, name, schemaKey), e);
    }
  }

  /**
   *  Creates a StructClass through a StructClassProps.
   * @param schemaKey a SchemaKey of the Schema that will house the new object.
   * @param structProps a json object that will be used to populate the new StructClass. Needs a name value passed in.
   */
  public async createFromProps(schemaKey: SchemaKey, structProps: StructClassProps): Promise<SchemaItemKey> {
    try {
      const schema = await this.getSchema(schemaKey);
      const boundCreate = schema.createStructClass.bind(schema);
      const newClass = await this.createSchemaItemFromProps(schemaKey, this.schemaItemType, boundCreate, structProps);
      return newClass.key;
    } catch (e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateSchemaItemFromProps, new ClassId(this.schemaItemType, structProps.name!, schemaKey), e);
    }
  }
}
