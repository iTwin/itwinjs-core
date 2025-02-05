/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import {
  DelayedPromiseWithProps,
  Format, InvertedUnit, KindOfQuantity, KindOfQuantityProps, OverrideFormat,
  SchemaItemKey, SchemaItemType, SchemaKey, Unit,
} from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "./Editor";
import { MutableKindOfQuantity } from "./Mutable/MutableKindOfQuantity";
import { ECEditingStatus, SchemaEditingError, SchemaItemId } from "./Exception";
import { SchemaItems } from "./SchemaItems";

/**
 * @alpha
 * A class allowing you to create schema items of type KindOfQuantity.
 */
export class KindOfQuantities extends SchemaItems {
  public constructor(schemaEditor: SchemaContextEditor) {
    super(SchemaItemType.KindOfQuantity, schemaEditor);
  }

  public async create(schemaKey: SchemaKey, name: string, persistenceUnitKey: SchemaItemKey, displayLabel?: string): Promise<SchemaItemKey> {
    try {
      const koqItem = await this.createSchemaItem<KindOfQuantity>(schemaKey, this.schemaItemType, (schema) => schema.createKindOfQuantity.bind(schema), name) as MutableKindOfQuantity;
      const persistenceUnit = await koqItem.schema.lookupItem(persistenceUnitKey);
      if (persistenceUnit === undefined || (!Unit.isUnit(persistenceUnit) && !InvertedUnit.isInvertedUnit(persistenceUnit)))
        throw new SchemaEditingError(ECEditingStatus.SchemaItemNotFound, new SchemaItemId(SchemaItemType.Unit, persistenceUnitKey));

      if (Unit.isUnit(persistenceUnit)) {
        koqItem.persistenceUnit = new DelayedPromiseWithProps(persistenceUnit.key, async () => persistenceUnit);
      }

      if (InvertedUnit.isInvertedUnit(persistenceUnit)) {
        koqItem.persistenceUnit = new DelayedPromiseWithProps(persistenceUnit.key, async () => persistenceUnit);
      }

      if (displayLabel !== undefined) {
        koqItem.setDisplayLabel(displayLabel);
      }

      return koqItem.key;
    } catch (e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateSchemaItemFailed, new SchemaItemId(this.schemaItemType, name, schemaKey), e);
    }
  }

  public async createFromProps(schemaKey: SchemaKey, koqProps: KindOfQuantityProps): Promise<SchemaItemKey> {
    try {
      const koqItem = await this.createSchemaItemFromProps(schemaKey, this.schemaItemType, (schema) => schema.createKindOfQuantity.bind(schema), koqProps);
      return koqItem.key;
    } catch (e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateSchemaItemFromProps, new SchemaItemId(this.schemaItemType, koqProps.name!, schemaKey), e);
    }
  }

  /**
   *
   * @param koqKey A schemaItemKey of the editing KindOfQuantity.
   * @param format A schemaItemKey of a Format.
   * @param isDefault .is set to false when not explicitly passed.
   */
  public async addPresentationFormat(koqKey: SchemaItemKey, format: SchemaItemKey, isDefault: boolean = false): Promise<void> {
    try {
      const kindOfQuantity = await this.getSchemaItem(koqKey, MutableKindOfQuantity);
      const presentationFormat = await this.getSchemaItem(format, Format);
      kindOfQuantity.addPresentationFormat(presentationFormat, isDefault);
    } catch(e: any) {
      throw new SchemaEditingError(ECEditingStatus.AddPresentationUnit, new SchemaItemId(this.schemaItemType, koqKey), e);
    }
  }

  public async addPresentationOverrideFormat(koqKey: SchemaItemKey, overrideFormat: OverrideFormat, isDefault: boolean = false): Promise<void> {
    try {
      const kindOfQuantity = await this.getSchemaItem(koqKey, MutableKindOfQuantity);
      kindOfQuantity.addPresentationFormat(overrideFormat, isDefault);
    } catch(e: any) {
      throw new SchemaEditingError(ECEditingStatus.AddPresentationOverride, new SchemaItemId(this.schemaItemType, koqKey), e);
    }
  }

  /**
   * @param parent A SchemaItemKey of the parent Format.
   * @param unitLabelOverrides The list of Unit (or InvertedUnit) and label overrides. The length of list should be equal to the number of units in the parent Format.
   */
  public async createFormatOverride(parent: SchemaItemKey, precision?: number, unitLabelOverrides?: Array<[Unit | InvertedUnit, string | undefined]>): Promise<OverrideFormat> {
    try {
      const parentFormat = await this.getSchemaItem(parent, Format);
      return new OverrideFormat(parentFormat, precision, unitLabelOverrides);
    } catch(e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateFormatOverride, new SchemaItemId(this.schemaItemType, parent), e);
    }
  }
}
