/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import {
  DelayedPromiseWithProps, InvertedUnit, InvertedUnitProps, SchemaItemKey,
  SchemaItemType, SchemaKey, Unit, UnitSystem,
} from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "./Editor";
import { MutableInvertedUnit } from "./Mutable/MutableInvertedUnit";
import { ECEditingStatus, SchemaEditingError, SchemaItemId } from "./Exception";
import { SchemaItems } from "./SchemaItems";

/**
 * @alpha
 * A class allowing you to create schema items of type Inverted Unit.
 */
export class InvertedUnits extends SchemaItems {
  public constructor(schemaEditor: SchemaContextEditor) {
    super(SchemaItemType.InvertedUnit, schemaEditor);
  }
  public async create(schemaKey: SchemaKey, name: string, invertsUnitKey: SchemaItemKey, unitSystemKey: SchemaItemKey, displayLabel?: string): Promise<SchemaItemKey> {
    try {
      const schema = await this.getSchema(schemaKey);
      const boundCreate = schema.createInvertedUnit.bind(schema);
      const newUnit = await this.createSchemaItem<InvertedUnit>(schemaKey, this.schemaItemType, boundCreate, name) as MutableInvertedUnit;

      const invertsUnit = await this.lookupSchemaItem<Unit>(schemaKey, invertsUnitKey, SchemaItemType.Unit);
      newUnit.setInvertsUnit(new DelayedPromiseWithProps<SchemaItemKey, Unit>(invertsUnitKey, async () => invertsUnit));

      const unitSystem = await this.lookupSchemaItem<UnitSystem>(schemaKey, unitSystemKey, SchemaItemType.UnitSystem);
      newUnit.setUnitSystem(new DelayedPromiseWithProps<SchemaItemKey, UnitSystem>(unitSystemKey, async () => unitSystem));

      if (displayLabel)
        newUnit.setDisplayLabel(displayLabel);

      return newUnit.key;
    } catch (e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateSchemaItemFailed, new SchemaItemId(this.schemaItemType, name, schemaKey), e);
    }
  }

  public async createFromProps(schemaKey: SchemaKey, invertedUnitProps: InvertedUnitProps): Promise<SchemaItemKey> {
    try {
      const schema = await this.getSchema(schemaKey);
      const boundCreate = schema.createInvertedUnit.bind(schema);
      const newUnit = await this.createSchemaItemFromProps(schemaKey, this.schemaItemType, boundCreate, invertedUnitProps);
      return newUnit.key;
    } catch (e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateSchemaItemFromProps, new SchemaItemId(this.schemaItemType, invertedUnitProps.name!, schemaKey), e);
    }
  }

  public async setInvertsUnit(invertedUnitKey: SchemaItemKey, invertsUnitKey: SchemaItemKey): Promise<void> {
    try {
      const invertedUnit = await this.getSchemaItem<MutableInvertedUnit>(invertedUnitKey);
      const invertsUnit = await this.getSchemaItem<Unit>(invertedUnitKey, SchemaItemType.Unit);
      invertedUnit.setInvertsUnit(new DelayedPromiseWithProps<SchemaItemKey, Unit>(invertsUnitKey, async () => invertsUnit));
    } catch(e: any) {
      throw new SchemaEditingError(ECEditingStatus.SetInvertsUnit, new SchemaItemId(this.schemaItemType, invertedUnitKey), e);
    }
  }

  public async setUnitSystem(invertedUnitKey: SchemaItemKey, unitSystemKey: SchemaItemKey): Promise<void> {
    try {
      const invertedUnit = await this.getSchemaItem<MutableInvertedUnit>(invertedUnitKey);
      const unitSystem = await this.getSchemaItem<UnitSystem>(unitSystemKey, SchemaItemType.UnitSystem);
      invertedUnit.setUnitSystem(new DelayedPromiseWithProps<SchemaItemKey, UnitSystem>(unitSystemKey, async () => unitSystem));
    } catch(e: any) {
      throw new SchemaEditingError(ECEditingStatus.SetUnitSystem, new SchemaItemId(this.schemaItemType, invertedUnitKey), e);
    }
  }
}
