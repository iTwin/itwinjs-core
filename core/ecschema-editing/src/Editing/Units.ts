/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { DelayedPromiseWithProps, Phenomenon, SchemaItemKey, SchemaItemType, SchemaItemUnitProps, SchemaKey, Unit, UnitSystem } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "./Editor";
import { MutableUnit } from "./Mutable/MutableUnit";
import { ECEditingStatus, SchemaEditingError, SchemaItemId } from "./Exception";
import { SchemaItems } from "./SchemaItems";

/**
 * @alpha
 * A class allowing you to create schema items of type Unit.
 */
export class Units extends SchemaItems {
  // TODO: Add more setters for all attributes.
  public constructor(schemaEditor: SchemaContextEditor) {
    super(SchemaItemType.Unit, schemaEditor);
  }

  public async create(schemaKey: SchemaKey, name: string, definition: string, phenomenon: SchemaItemKey, unitSystem: SchemaItemKey, displayLabel?: string): Promise<SchemaItemKey> {
    try {
      const newUnit = await this.createSchemaItem<Unit>(schemaKey, this.schemaItemType, (schema) => schema.createUnit.bind(schema), name) as MutableUnit;

      const phenomenonItem = await this.lookupSchemaItem<Phenomenon>(newUnit.schema.schemaKey, phenomenon, SchemaItemType.Phenomenon);
      await newUnit.setPhenomenon(new DelayedPromiseWithProps<SchemaItemKey, Phenomenon>(phenomenon, async () => phenomenonItem));

      const unitSystemItem = await this.lookupSchemaItem<UnitSystem>(newUnit.schema.schemaKey, unitSystem, SchemaItemType.UnitSystem);
      await newUnit.setUnitSystem(new DelayedPromiseWithProps<SchemaItemKey, UnitSystem>(unitSystem, async () => unitSystemItem));

      await newUnit.setDefinition(definition);

      if (displayLabel)
        newUnit.setDisplayLabel(displayLabel);

      return newUnit.key;
    } catch (e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateSchemaItemFailed, new SchemaItemId(this.schemaItemType, name, schemaKey), e);
    }
  }

  public async createFromProps(schemaKey: SchemaKey, unitProps: SchemaItemUnitProps): Promise<SchemaItemKey> {
    try {
      const newUnit = await this.createSchemaItemFromProps(schemaKey, this.schemaItemType, (schema) => schema.createUnit.bind(schema), unitProps);
      return newUnit.key;
    } catch (e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateSchemaItemFromProps, new SchemaItemId(this.schemaItemType, unitProps.name!, schemaKey), e);
    }
  }
}
