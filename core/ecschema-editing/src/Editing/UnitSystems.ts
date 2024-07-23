/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { SchemaItemKey, SchemaItemType, SchemaKey, UnitSystem, UnitSystemProps } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "./Editor";
import { MutableUnitSystem } from "./Mutable/MutableUnitSystem";
import { SchemaEditingError } from "./Exception";
import { SchemaItems } from "./SchemaItems";
import { SchemaItemId } from "./SchemaItemIdentifiers";
import { SchemaEditType } from "./SchmaEditType";

/**
 * @alpha
 * A class allowing you to create schema items of type UnitSystems.
 */
export class UnitSystems extends SchemaItems {
  public constructor(schemaEditor: SchemaContextEditor) {
    super(SchemaItemType.UnitSystem, schemaEditor);
  }

  public async create(schemaKey: SchemaKey, name: string, displayLabel?: string): Promise<SchemaItemKey> {

    try {
      const newUnitSystem = await this.createSchemaItem<UnitSystem>(schemaKey, this.schemaItemType, (schema) => schema.createUnitSystem.bind(schema), name) as MutableUnitSystem;

      if (displayLabel)
        newUnitSystem.setDisplayLabel(displayLabel);

      return newUnitSystem.key;
    } catch (e: any) {
      throw new SchemaEditingError(SchemaEditType.CreateSchemaItemFailed, new SchemaItemId(this.schemaItemType, name, schemaKey), e);
    }
  }

  public async createFromProps(schemaKey: SchemaKey, unitSystemProps: UnitSystemProps): Promise<SchemaItemKey> {
    try {
      const newUnitSystem = await this.createSchemaItemFromProps(schemaKey, this.schemaItemType, (schema) => schema.createUnitSystem.bind(schema), unitSystemProps);
      return newUnitSystem.key;
    } catch (e: any) {
      throw new SchemaEditingError(SchemaEditType.CreateSchemaItemFromProps, new SchemaItemId(this.schemaItemType, unitSystemProps.name!, schemaKey), e);
    }
  }
}
