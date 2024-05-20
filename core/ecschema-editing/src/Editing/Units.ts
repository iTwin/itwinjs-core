/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { DelayedPromiseWithProps, ECObjectsError, ECObjectsStatus, Phenomenon, SchemaItemKey, SchemaItemType, SchemaItemUnitProps, SchemaKey, UnitSystem } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "./Editor";
import { MutableUnit } from "./Mutable/MutableUnit";
import { ECEditingError, ECEditingStatus } from "./Exception";

/**
 * @alpha
 * A class allowing you to create schema items of type Unit.
 */
export class Units {
  // TODO: Add more setters for all attributes.
  public constructor(protected _schemaEditor: SchemaContextEditor) { }

  public async create(schemaKey: SchemaKey, name: string, definition: string, phenomenon: SchemaItemKey, unitSystem: SchemaItemKey, displayLabel?: string): Promise<SchemaItemKey> {
    const schema = await this._schemaEditor.getSchema(schemaKey);
    if (schema === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaNotFound, `Schema Key ${schemaKey.toString(true)} not found in context`);

    let newUnit: MutableUnit;
    try {
      newUnit = (await schema.createUnit(name)) as MutableUnit;
    } catch (e) {
      if (e instanceof ECObjectsError && e.errorNumber === ECObjectsStatus.DuplicateItem) {
        throw new ECEditingError(ECEditingStatus.SchemaItemNameAlreadyExists, `Unit ${name} already exists in the schema ${schema.fullName}.`);
      } else {
        throw new ECEditingError(ECEditingStatus.Unknown, `Failed to create Unit ${name} in schema ${schema.fullName}.`);
      }
    }

    const phenomenonItem = await schema.lookupItem<Phenomenon>(phenomenon);
    if (phenomenonItem === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaItemNotFound, `Unable to locate phenomenon ${phenomenon.fullName} in schema ${schema.fullName}.`);

    if (phenomenonItem.schemaItemType !== SchemaItemType.Phenomenon)
      throw new ECEditingError(ECEditingStatus.InvalidSchemaItemType, `${phenomenon.fullName} is not of type Phenomenon.`);

    await newUnit.setPhenomenon(new DelayedPromiseWithProps<SchemaItemKey, Phenomenon>(phenomenon, async () => phenomenonItem));

    const unitSystemItem = await schema.lookupItem<UnitSystem>(unitSystem);
    if (unitSystemItem === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaItemNotFound, `Unable to locate unit system ${unitSystem.fullName} in schema ${schema.fullName}.`);

    if (unitSystemItem.schemaItemType !== SchemaItemType.UnitSystem)
      throw new ECEditingError(ECEditingStatus.InvalidSchemaItemType, `${unitSystem.fullName} is not of type UnitSystem.`);

    await newUnit.setUnitSystem(new DelayedPromiseWithProps<SchemaItemKey, UnitSystem>(unitSystem, async () => unitSystemItem));

    await newUnit.setDefinition(definition);

    if (displayLabel)
      newUnit.setDisplayLabel(displayLabel);

    return newUnit.key;
  }

  public async createFromProps(schemaKey: SchemaKey, unitProps: SchemaItemUnitProps): Promise<SchemaItemKey> {
    const schema = await this._schemaEditor.getSchema(schemaKey);
    if (schema === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaNotFound, `Schema Key ${schemaKey.toString(true)} not found in context`);

    if (unitProps.name === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaItemNameNotSpecified, `No name was supplied within props.`);

    let newUnit: MutableUnit;
    try {
      newUnit = (await schema.createUnit(unitProps.name)) as MutableUnit;
    } catch (e) {
      if (e instanceof ECObjectsError && e.errorNumber === ECObjectsStatus.DuplicateItem) {
        throw new ECEditingError(ECEditingStatus.SchemaItemNameAlreadyExists, `Unit ${unitProps.name} already exists in the schema ${schema.fullName}.`);
      } else {
        throw new ECEditingError(ECEditingStatus.Unknown, `Failed to create Unit ${unitProps.name} in schema ${schema.fullName}.`);
      }
    }

    await newUnit.fromJSON(unitProps);
    return newUnit.key;
  }
}
