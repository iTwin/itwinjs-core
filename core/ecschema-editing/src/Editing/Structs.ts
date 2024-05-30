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
import { ECEditingStatus, SchemaEditingError, schemaItemIdentifierFromName } from "./Exception";

/**
 * @alpha A class extending ECClasses allowing you to create schema items of type StructClass.
 */
export class Structs extends ECClasses {
  public constructor(schemaEditor: SchemaContextEditor) {
    super(SchemaItemType.StructClass, schemaEditor);
  }

  public async create(schemaKey: SchemaKey, name: string, displayLabel?: string, baseClassKey?: SchemaItemKey): Promise<SchemaItemKey> {
    let newClass: MutableStructClass;

    try {
      const schema = await this.getSchema(schemaKey);
      const boundCreate = schema.createStructClass.bind(schema);
      newClass = (await this.createClass<StructClass>(schemaKey, this.schemaItemType, boundCreate, name, baseClassKey)) as MutableStructClass;
    } catch (e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateSchemaItemFailed, schemaItemIdentifierFromName(schemaKey, this.schemaItemType, name), e);
    }

    if (displayLabel)
      newClass.setDisplayLabel(displayLabel);

    return newClass.key;
  }

  /**
   *  Creates a StructClass through a StructClassProps.
   * @param schemaKey a SchemaKey of the Schema that will house the new object.
   * @param structProps a json object that will be used to populate the new StructClass. Needs a name value passed in.
   */
  public async createFromProps(schemaKey: SchemaKey, structProps: StructClassProps): Promise<SchemaItemKey> {
    let newClass: MutableStructClass;
    try {
      const schema = await this.getSchema(schemaKey);
      const boundCreate = schema.createStructClass.bind(schema);
      newClass = (await this.createSchemaItemFromProps<StructClass>(schemaKey, this.schemaItemType, boundCreate, structProps)) as MutableStructClass;
    } catch (e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateSchemaItemFromPropsFailed, schemaItemIdentifierFromName(schemaKey, this.schemaItemType, structProps.name!), e);
    }

    return newClass.key;
  }
}
