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
import { ECEditingStatus, SchemaEditingError, schemaItemIdentifierFromName } from "./Exception";
import { SchemaItems } from "./SchemaItems";

/**
 * @alpha
 * A class allowing you to create schema items of type UnitSystems.
 */
export class UnitSystems extends SchemaItems {
  public constructor(schemaEditor: SchemaContextEditor) {
    super(SchemaItemType.UnitSystem, schemaEditor);
  }

  public async create(schemaKey: SchemaKey, name: string, displayLabel?: string): Promise<SchemaItemKey> {
    let newUnitSystem: MutableUnitSystem;

    try {
      const schema = await this.getSchema(schemaKey);
      const boundCreate = schema.createUnitSystem.bind(schema);
      newUnitSystem = (await this.createSchemaItem<UnitSystem>(schemaKey, this.schemaItemType, boundCreate, name)) as MutableUnitSystem;

      if (displayLabel)
        newUnitSystem.setDisplayLabel(displayLabel);

    } catch (e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateSchemaItemFailed, schemaItemIdentifierFromName(schemaKey, this.schemaItemType, name), e);
    }

    return newUnitSystem.key;
  }

  public async createFromProps(schemaKey: SchemaKey, unitSystemProps: UnitSystemProps): Promise<SchemaItemKey> {
    let newUnitSystem: MutableUnitSystem;
    try {
      const schema = await this.getSchema(schemaKey);
      const boundCreate = schema.createUnitSystem.bind(schema);
      newUnitSystem = await this.createSchemaItemFromProps<UnitSystem>(schemaKey, this.schemaItemType, boundCreate, unitSystemProps) as MutableUnitSystem;
    } catch (e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateSchemaItemFromPropsFailed, schemaItemIdentifierFromName(schemaKey, this.schemaItemType, unitSystemProps.name!), e);
    }

    return newUnitSystem.key;
  }
}
