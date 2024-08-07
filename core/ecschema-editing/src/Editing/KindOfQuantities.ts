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
import { ECEditingStatus, SchemaEditingError } from "./Exception";
import { SchemaItems } from "./SchemaItems";
import { SchemaItemId } from "./SchemaItemIdentifiers";
import { SchemaEditType } from "./SchemaEditType";

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
      const persistenceUnit = await koqItem.schema.lookupItem<Unit | InvertedUnit>(persistenceUnitKey);
      if (persistenceUnit === undefined)
        throw new SchemaEditingError(ECEditingStatus.SchemaItemNotFound, new SchemaItemId(SchemaItemType.Unit, persistenceUnitKey));

      if (persistenceUnit.schemaItemType === SchemaItemType.Unit) {
        koqItem.persistenceUnit = new DelayedPromiseWithProps(persistenceUnit.key, async () => persistenceUnit);
      }

      if (persistenceUnit.schemaItemType === SchemaItemType.InvertedUnit) {
        koqItem.persistenceUnit = new DelayedPromiseWithProps(persistenceUnit.key, async () => persistenceUnit);
      }

      if (displayLabel !== undefined) {
        koqItem.setDisplayLabel(displayLabel);
      }

      return koqItem.key;
    } catch (e: any) {
      throw new SchemaEditingError(SchemaEditType.CreateSchemaItemFailed, new SchemaItemId(this.schemaItemType, name, schemaKey), e);
    }
  }

  public async createFromProps(schemaKey: SchemaKey, koqProps: KindOfQuantityProps): Promise<SchemaItemKey> {
    try {
      const koqItem = await this.createSchemaItemFromProps(schemaKey, this.schemaItemType, (schema) => schema.createKindOfQuantity.bind(schema), koqProps);
      return koqItem.key;
    } catch (e: any) {
      throw new SchemaEditingError(SchemaEditType.CreateSchemaItemFromProps, new SchemaItemId(this.schemaItemType, koqProps.name!, schemaKey), e);
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
      const kindOfQuantity = await this.getSchemaItem<MutableKindOfQuantity>(koqKey);
      const presentationFormat = await this.getSchemaItem<Format>(format, SchemaItemType.Format);
      kindOfQuantity.addPresentationFormat(presentationFormat, isDefault);
    } catch (e: any) {
      throw new SchemaEditingError(SchemaEditType.AddPresentationUnit, new SchemaItemId(this.schemaItemType, koqKey), e);
    }
  }

  public async addPresentationOverrideFormat(koqKey: SchemaItemKey, overrideFormat: OverrideFormat, isDefault: boolean = false): Promise<void> {
    try {
      const kindOfQuantity = await this.getSchemaItem<MutableKindOfQuantity>(koqKey);
      kindOfQuantity.addPresentationFormat(overrideFormat, isDefault);
    } catch (e: any) {
      throw new SchemaEditingError(SchemaEditType.AddPresentationOverride, new SchemaItemId(this.schemaItemType, koqKey), e);
    }
  }

  /**
   * @param koqKey A schemaItemKey of the editing KindOfQuantity.
   * @param parent A SchemaItemKey of the parent Format.
   * @param unitLabelOverrides The list of Unit (or InvertedUnit) and label overrides. The length of list should be equal to the number of units in the parent Format.
   */
  public async createFormatOverride(koqKey: SchemaItemKey, parent: SchemaItemKey, precision?: number, unitLabelOverrides?: Array<[Unit | InvertedUnit, string | undefined]>): Promise<OverrideFormat> {
    try {
      await this.getSchemaItem<MutableKindOfQuantity>(koqKey);

      const parentFormat = await this.getSchemaItem<Format>(parent, SchemaItemType.Format);
      return new OverrideFormat(parentFormat, precision, unitLabelOverrides);
    } catch (e: any) {
      throw new SchemaEditingError(SchemaEditType.AddPresentationOverride, new SchemaItemId(this.schemaItemType, koqKey), e);
    }
  }
}
