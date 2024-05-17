/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import {
  DelayedPromiseWithProps, ECObjectsError, ECObjectsStatus, InvertedUnitProps, SchemaItemKey,
  SchemaItemType, SchemaKey, Unit, UnitSystem,
} from "@itwin/ecschema-metadata";
import { SchemaContextEditor, SchemaItemEditResults } from "./Editor";
import { MutableInvertedUnit } from "./Mutable/MutableInvertedUnit";
import { ECEditingError, ECEditingStatus } from "./Exception";

/**
 * @alpha
 * A class allowing you to create schema items of type Inverted Unit.
 */
export class InvertedUnits {
  public constructor(protected _schemaEditor: SchemaContextEditor) { }
  public async create(schemaKey: SchemaKey, name: string, invertsUnitKey: SchemaItemKey, unitSystemKey: SchemaItemKey, displayLabel?: string): Promise<SchemaItemEditResults> {
    const schema = await this._schemaEditor.getSchema(schemaKey);
    if (schema === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaNotFound, `Schema Key ${schemaKey.toString(true)} not found in context`);

    let newUnit: MutableInvertedUnit;
    try {
      newUnit = await schema.createInvertedUnit(name) as MutableInvertedUnit;
    } catch (e) {
      if (e instanceof ECObjectsError && e.errorNumber === ECObjectsStatus.DuplicateItem) {
        throw new ECEditingError(ECEditingStatus.SchemaItemNameAlreadyExists, `InvertedUnit ${name} already exists in the schema ${schema.fullName}.`);
      } else {
        throw new ECEditingError(ECEditingStatus.Unknown, `Failed to create InvertedUnit ${name} in schema ${schema.fullName}.`);
      }
    }

    const invertsUnit = await schema.lookupItem<Unit>(invertsUnitKey);
    if (invertsUnit === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaItemNotFound, `Unable to locate unit ${invertsUnitKey.fullName} in schema ${schema.fullName}.`);

    if (invertsUnit.schemaItemType !== SchemaItemType.Unit)
      throw new ECEditingError(ECEditingStatus.InvalidSchemaItemType, `${invertsUnit.fullName} is not of type Unit.`);

    newUnit.setInvertsUnit(new DelayedPromiseWithProps<SchemaItemKey, Unit>(invertsUnitKey, async () => invertsUnit));

    const unitSystem = await schema.lookupItem<UnitSystem>(unitSystemKey);
    if (unitSystem === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaItemNotFound, `Unable to locate unit system ${unitSystemKey.fullName} in schema ${schema.fullName}.`);

    if (unitSystem.schemaItemType !== SchemaItemType.UnitSystem)
      throw new ECEditingError(ECEditingStatus.InvalidSchemaItemType, `${unitSystemKey.fullName} is not of type Unit System.`);

    newUnit.setUnitSystem(new DelayedPromiseWithProps<SchemaItemKey, UnitSystem>(unitSystemKey, async () => unitSystem));

    if (displayLabel)
      newUnit.setDisplayLabel(displayLabel);

    return { itemKey: newUnit.key };
  }

  public async createFromProps(schemaKey: SchemaKey, invertedUnitProps: InvertedUnitProps): Promise<SchemaItemEditResults> {
    const schema = await this._schemaEditor.getSchema(schemaKey);
    if (schema === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaNotFound, `Schema Key ${schemaKey.toString(true)} not found in context`);

    if (invertedUnitProps.name === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaItemNameNotSpecified, `No name was supplied within props.`);

    let newUnit: MutableInvertedUnit;
    try {
      newUnit = await schema.createInvertedUnit(invertedUnitProps.name) as MutableInvertedUnit;
    } catch (e) {
      if (e instanceof ECObjectsError && e.errorNumber === ECObjectsStatus.DuplicateItem) {
        throw new ECEditingError(ECEditingStatus.SchemaItemNameAlreadyExists, `Inverted unit ${invertedUnitProps.name} already exists in the schema ${schema.fullName}.`);
      } else {
        throw new ECEditingError(ECEditingStatus.Unknown, `Failed to create inverted unit ${invertedUnitProps.name} in schema ${schema.fullName}.`);
      }
    }

    await newUnit.fromJSON(invertedUnitProps);
    return { itemKey: newUnit.key };
  }

  public async setInvertsUnit(invertedUnitKey: SchemaItemKey, invertsUnitKey: SchemaItemKey): Promise<void> {
    const invertedUnit = await this._schemaEditor.schemaContext.getSchemaItem<MutableInvertedUnit>(invertedUnitKey);

    if (invertedUnit === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaItemNotFound, `Inverted Unit ${invertedUnitKey.fullName} not found in schema context.`);

    if (invertedUnit.schemaItemType !== SchemaItemType.InvertedUnit)
      throw new ECEditingError(ECEditingStatus.InvalidSchemaItemType, `Expected ${invertedUnitKey.fullName} to be of type Inverted Unit.`);

    const invertsUnit = await this._schemaEditor.schemaContext.getSchemaItem<Unit>(invertsUnitKey);
    if (invertsUnit === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaItemNotFound, `Unit ${invertsUnitKey.fullName} not found in schema context.`);

    if (invertsUnit.schemaItemType !== SchemaItemType.Unit)
      throw new ECEditingError(ECEditingStatus.InvalidSchemaItemType, `Expected ${invertsUnitKey.fullName} to be of type Unit.`);

    invertedUnit.setInvertsUnit(new DelayedPromiseWithProps<SchemaItemKey, Unit>(invertsUnitKey, async () => invertsUnit));
  }

  public async setUnitSystem(invertedUnitKey: SchemaItemKey, unitSystemKey: SchemaItemKey): Promise<void> {
    const invertedUnit = await this._schemaEditor.schemaContext.getSchemaItem<MutableInvertedUnit>(invertedUnitKey);

    if (invertedUnit === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaItemNotFound, `Inverted Unit ${invertedUnitKey.fullName} not found in schema context.`);

    if (invertedUnit.schemaItemType !== SchemaItemType.InvertedUnit)
      throw new ECEditingError(ECEditingStatus.InvalidSchemaItemType, `Expected ${invertedUnitKey.fullName} to be of type Inverted Unit.`);

    const unitSystem = await this._schemaEditor.schemaContext.getSchemaItem<UnitSystem>(unitSystemKey);
    if (unitSystem === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaItemNotFound, `Unit ${unitSystemKey.fullName} not found in schema context.`);

    if (unitSystem.schemaItemType !== SchemaItemType.UnitSystem)
      throw new ECEditingError(ECEditingStatus.InvalidSchemaItemType, `Expected ${unitSystemKey.fullName} to be of type Unit System.`);

    invertedUnit.setUnitSystem(new DelayedPromiseWithProps<SchemaItemKey, UnitSystem>(unitSystemKey, async () => unitSystem));
  }
}
