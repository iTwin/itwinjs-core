/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { ECObjectsError, ECObjectsStatus, PhenomenonProps, SchemaKey } from "@itwin/ecschema-metadata";
import { SchemaContextEditor, SchemaItemEditResults } from "./Editor";
import { MutablePhenomenon } from "./Mutable/MutablePhenomenon";
import { ECEditingError, ECEditingStatus } from "./Exception";

/**
 * @alpha
 * A class allowing you to create schema items of type Phenomenon.
 */
export class Phenomena {
  public constructor(protected _schemaEditor: SchemaContextEditor) { }

  public async create(schemaKey: SchemaKey, name: string, definition: string, displayLabel?: string): Promise<SchemaItemEditResults> {
    const schema = await this._schemaEditor.getSchema(schemaKey);
    if (schema === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaNotFound, `Schema Key ${schemaKey.toString(true)} not found in context`);

    let newPhenomenon: MutablePhenomenon;
    try {
      newPhenomenon = await schema.createPhenomenon(name) as MutablePhenomenon;
    } catch (e) {
      if (e instanceof ECObjectsError && e.errorNumber === ECObjectsStatus.DuplicateItem) {
        throw new ECEditingError(ECEditingStatus.SchemaItemNameAlreadyExists, `Phenomenon ${name} already exists in the schema ${schema.fullName}.`);
      } else {
        throw new ECEditingError(ECEditingStatus.Unknown, `Failed to create Phenomenon ${name} in schema ${schema.fullName}.`);
      }
    }

    if (displayLabel)
      newPhenomenon.setDisplayLabel(displayLabel);

    await newPhenomenon.setDefinition(definition);

    return { itemKey: newPhenomenon.key };
  }

  public async createFromProps(schemaKey: SchemaKey, phenomenonProps: PhenomenonProps): Promise<SchemaItemEditResults> {
    const schema = await this._schemaEditor.getSchema(schemaKey);
    if (schema === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaNotFound, `Schema Key ${schemaKey.toString(true)} not found in context`);

    if (phenomenonProps.name === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaItemNameNotSpecified, `No name was supplied within props.`);

    let newPhenomenon: MutablePhenomenon;
    try {
      newPhenomenon = await schema.createPhenomenon(phenomenonProps.name) as MutablePhenomenon;
    } catch (e) {
      if (e instanceof ECObjectsError && e.errorNumber === ECObjectsStatus.DuplicateItem) {
        throw new ECEditingError(ECEditingStatus.SchemaItemNameAlreadyExists, `Phenomenon ${phenomenonProps.name} already exists in the schema ${schema.fullName}.`);
      } else {
        throw new ECEditingError(ECEditingStatus.Unknown, `Failed to create Phenomenon ${phenomenonProps.name} in schema ${schema.fullName}.`);
      }
    }

    await newPhenomenon.fromJSON(phenomenonProps);
    return { itemKey: newPhenomenon.key };
  }
}
