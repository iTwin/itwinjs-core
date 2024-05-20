/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import {
  DelayedPromiseWithProps,
  ECObjectsError, ECObjectsStatus, Format, InvertedUnit, KindOfQuantityProps, OverrideFormat,
  SchemaItemKey, SchemaItemType, SchemaKey, Unit,
} from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "./Editor";
import { MutableKindOfQuantity } from "./Mutable/MutableKindOfQuantity";
import { ECEditingError, ECEditingStatus } from "./Exception";

/**
 * @alpha
 * A class allowing you to create schema items of type KindOfQuantity.
 */
export class KindOfQuantities {
  public constructor(protected _schemaEditor: SchemaContextEditor) { }

  public async create(schemaKey: SchemaKey, name: string, persistenceUnitKey: SchemaItemKey, displayLabel?: string): Promise<SchemaItemKey> {
    const schema = await this._schemaEditor.getSchema(schemaKey);
    if (schema === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaNotFound, `Schema Key ${schemaKey.toString(true)} not found in context`);

    let koqItem: MutableKindOfQuantity;
    try {
      koqItem = await schema.createKindOfQuantity(name) as MutableKindOfQuantity;
    } catch (e) {
      if (e instanceof ECObjectsError && e.errorNumber === ECObjectsStatus.DuplicateItem) {
        throw new ECEditingError(ECEditingStatus.SchemaItemNameAlreadyExists, `KindOfQuantity ${name} already exists in the schema ${schema.fullName}.`);
      } else {
        throw new ECEditingError(ECEditingStatus.Unknown, `Failed to create KindOfQuantity ${name} in schema ${schema.fullName}.`);
      }
    }

    const persistenceUnit = await schema.lookupItem<Unit | InvertedUnit>(persistenceUnitKey);
    if (persistenceUnit === undefined) {
      throw new ECEditingError(ECEditingStatus.SchemaItemNotFound, `Unable to locate unit ${persistenceUnitKey.fullName} in schema ${schema.fullName}.`);
    }

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
  }

  public async createFromProps(schemaKey: SchemaKey, koqProps: KindOfQuantityProps): Promise<SchemaItemKey> {
    const schema = await this._schemaEditor.getSchema(schemaKey);
    if (schema === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaNotFound, `Schema Key ${schemaKey.toString(true)} not found in context`);

    if (koqProps.name === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaItemNameNotSpecified, `No name was supplied within props.`);

    let koqItem: MutableKindOfQuantity;
    try {
      koqItem = await schema.createKindOfQuantity(koqProps.name) as MutableKindOfQuantity;
    } catch (e) {
      if (e instanceof ECObjectsError && e.errorNumber === ECObjectsStatus.DuplicateItem) {
        throw new ECEditingError(ECEditingStatus.SchemaItemNameAlreadyExists, `KindOfQuantity ${koqProps.name} already exists in the schema ${schema.fullName}.`);
      } else {
        throw new ECEditingError(ECEditingStatus.Unknown, `Failed to create KindOfQuantity ${koqProps.name} in schema ${schema.fullName}.`);
      }
    }

    await koqItem.fromJSON(koqProps);
    return koqItem.key;
  }

  /**
   *
   * @param koqKey A schemaItemKey of the editing KindOfQuantity.
   * @param format A schemaItemKey of a Format.
   * @param isDefault .is set to false when not explicitly passed.
   */
  public async addPresentationFormat(koqKey: SchemaItemKey, format: SchemaItemKey, isDefault: boolean = false): Promise<void> {
    const kindOfQuantity = (await this._schemaEditor.schemaContext.getSchemaItem<MutableKindOfQuantity>(koqKey));

    if (kindOfQuantity === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaItemNotFound, `Entity Class ${koqKey.fullName} not found in schema context.`);

    if (kindOfQuantity.schemaItemType !== SchemaItemType.KindOfQuantity)
      throw new ECEditingError(ECEditingStatus.InvalidSchemaItemType, `Expected ${koqKey.fullName} to be of type Kind Of Quantity.`);

    const presentationFormat = await (this._schemaEditor.schemaContext.getSchemaItem<Format>(format));
    if (undefined === presentationFormat)
      throw new ECEditingError(ECEditingStatus.SchemaItemNotFound, `Unable to locate format '${format.fullName}' for the presentation unit on KindOfQuantity ${koqKey.fullName}.`);

    if (presentationFormat.schemaItemType !== SchemaItemType.Format)
      throw new ECEditingError(ECEditingStatus.InvalidSchemaItemType, `Expected ${presentationFormat.fullName} to be of type Format.`);

    kindOfQuantity.addPresentationFormat(presentationFormat, isDefault);
  }

  public async addPresentationOverrideFormat(koqKey: SchemaItemKey, overrideFormat: OverrideFormat, isDefault: boolean = false): Promise<void> {
    const kindOfQuantity = (await this._schemaEditor.schemaContext.getSchemaItem<MutableKindOfQuantity>(koqKey));

    if (kindOfQuantity === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaItemNotFound, `Entity Class ${koqKey.fullName} not found in schema context.`);

    if (kindOfQuantity.schemaItemType !== SchemaItemType.KindOfQuantity)
      throw new ECEditingError(ECEditingStatus.InvalidSchemaItemType, `Expected ${koqKey.fullName} to be of type Kind Of Quantity.`);

    kindOfQuantity.addPresentationFormat(overrideFormat, isDefault);
  }

  /**
   * @param koqKey A schemaItemKey of the editing KindOfQuantity.
   * @param parent A SchemaItemKey of the parent Format.
   * @param unitLabelOverrides The list of Unit (or InvertedUnit) and label overrides. The length of list should be equal to the number of units in the parent Format.
   */
  public async createFormatOverride(koqKey: SchemaItemKey, parent: SchemaItemKey, precision?: number, unitLabelOverrides?: Array<[Unit | InvertedUnit, string | undefined]>): Promise<OverrideFormat> {
    const kindOfQuantity = (await this._schemaEditor.schemaContext.getSchemaItem<MutableKindOfQuantity>(koqKey));

    if (kindOfQuantity === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaItemNotFound, `Entity Class ${koqKey.fullName} not found in schema context.`);

    if (kindOfQuantity.schemaItemType !== SchemaItemType.KindOfQuantity)
      throw new ECEditingError(ECEditingStatus.InvalidSchemaItemType, `Expected ${koqKey.fullName} to be of type Kind Of Quantity.`);

    const parentFormat = await (this._schemaEditor.schemaContext.getSchemaItem<Format>(parent));
    if (undefined === parentFormat)
      throw new ECEditingError(ECEditingStatus.SchemaItemNotFound, `Unable to locate format '${parent.fullName}' for the presentation unit on KindOfQuantity ${koqKey.fullName}.`);

    if (parentFormat.schemaItemType !== SchemaItemType.Format)
      throw new ECEditingError(ECEditingStatus.InvalidSchemaItemType, `Expected ${parentFormat.fullName} to be of type Format.`);

    return new OverrideFormat(parentFormat, precision, unitLabelOverrides);
  }
}
