/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { ECObjectsError, ECObjectsStatus, SchemaItemKey, SchemaKey, UnitSystemProps } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "./Editor";
import { MutableUnitSystem } from "./Mutable/MutableUnitSystem";
import { ECEditingError, ECEditingStatus } from "./Exception";

/**
 * @alpha
 * A class allowing you to create schema items of type UnitSystems.
 */
export class UnitSystems {
  public constructor(protected _schemaEditor: SchemaContextEditor) { }
  public async create(schemaKey: SchemaKey, name: string, displayLabel?: string): Promise<SchemaItemKey> {
    const schema = await this._schemaEditor.getSchema(schemaKey);
    if (schema === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaNotFound, `Schema Key ${schemaKey.toString(true)} not found in context`);

    let newUnitSystem: MutableUnitSystem;
    try {
      newUnitSystem = (await schema.createUnitSystem(name)) as MutableUnitSystem;
    } catch (e) {
      if (e instanceof ECObjectsError && e.errorNumber === ECObjectsStatus.DuplicateItem) {
        throw new ECEditingError(ECEditingStatus.SchemaItemNameAlreadyExists, `UnitSystem ${name} already exists in the schema ${schema.fullName}.`);
      } else {
        throw new ECEditingError(ECEditingStatus.Unknown, `Failed to create UnitSystem ${name} in schema ${schema.fullName}.`);
      }
    }

    if (displayLabel)
      newUnitSystem.setDisplayLabel(displayLabel);

    return newUnitSystem.key;
  }

  public async createFromProps(schemaKey: SchemaKey, unitSystemProps: UnitSystemProps): Promise<SchemaItemKey> {
    const schema = await this._schemaEditor.getSchema(schemaKey);
    if (schema === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaNotFound, `Schema Key ${schemaKey.toString(true)} not found in context`);

    if (unitSystemProps.name === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaItemNameNotSpecified, `No name was supplied within props.`);

    let newUnitSystem: MutableUnitSystem;
    try {
      newUnitSystem = (await schema.createUnitSystem(unitSystemProps.name)) as MutableUnitSystem;
    } catch (e) {
      if (e instanceof ECObjectsError && e.errorNumber === ECObjectsStatus.DuplicateItem) {
        throw new ECEditingError(ECEditingStatus.SchemaItemNameAlreadyExists, `UnitSystem ${unitSystemProps.name} already exists in the schema ${schema.fullName}.`);
      } else {
        throw new ECEditingError(ECEditingStatus.Unknown, `Failed to create UnitSystem ${unitSystemProps.name} in schema ${schema.fullName}.`);
      }
    }

    await newUnitSystem.fromJSON(unitSystemProps);
    return newUnitSystem.key;
  }
}
