/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { Phenomenon, PhenomenonProps, SchemaItemKey, SchemaItemType, SchemaKey } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "./Editor";
import { MutablePhenomenon } from "./Mutable/MutablePhenomenon";
import { ECEditingStatus, SchemaEditingError, SchemaItemId } from "./Exception";
import { SchemaItems } from "./SchemaItems";

/**
 * @alpha
 * A class allowing you to create schema items of type Phenomenon.
 */
export class Phenomena extends SchemaItems {
  public constructor(schemaEditor: SchemaContextEditor) {
    super(SchemaItemType.Phenomenon, schemaEditor);
  }

  public async create(schemaKey: SchemaKey, name: string, definition: string, displayLabel?: string): Promise<SchemaItemKey> {
    let newPhenomenon: MutablePhenomenon;

    try {
      const schema = await this.getSchema(schemaKey);
      const boundCreate = schema.createPhenomenon.bind(schema);
      newPhenomenon = (await this.createSchemaItem<Phenomenon>(schemaKey, this.schemaItemType, boundCreate, name)) as MutablePhenomenon;

      if (displayLabel)
        newPhenomenon.setDisplayLabel(displayLabel);

      await newPhenomenon.setDefinition(definition);
    } catch (e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateSchemaItemFailed, new SchemaItemId(this.schemaItemType, name, schemaKey), e);
    }

    return newPhenomenon.key;
  }

  public async createFromProps(schemaKey: SchemaKey, phenomenonProps: PhenomenonProps): Promise<SchemaItemKey> {
    let newPhenomenon: MutablePhenomenon;
    try {
      const schema = await this.getSchema(schemaKey);
      const boundCreate = schema.createPhenomenon.bind(schema);
      newPhenomenon = await this.createSchemaItemFromProps<Phenomenon>(schemaKey, this.schemaItemType, boundCreate, phenomenonProps) as MutablePhenomenon;
    } catch (e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateSchemaItemFromProps, new SchemaItemId(this.schemaItemType, phenomenonProps.name!, schemaKey), e);
    }

    return newPhenomenon.key;
  }
}
