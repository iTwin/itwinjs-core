/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { Constant, ConstantProps, DelayedPromiseWithProps, Phenomenon, SchemaItemKey, SchemaItemType, SchemaKey } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "./Editor";
import { MutableConstant } from "./Mutable/MutableConstant";
import { ECEditingStatus, SchemaEditingError, SchemaItemId } from "./Exception";
import { SchemaItems } from "./SchemaItems";

/**
 * @alpha
 * A class allowing you to create schema items of type Constant.
 */
export class Constants extends SchemaItems {
  public constructor(schemaEditor: SchemaContextEditor) {
    super(SchemaItemType.Constant, schemaEditor);
  }

  public async create(schemaKey: SchemaKey, name: string, phenomenon: SchemaItemKey, definition: string, displayLabel?: string, numerator?: number, denominator?: number): Promise<SchemaItemKey> {
    try {
      const schema = await this.getSchema(schemaKey);
      const boundCreate = schema.createConstant.bind(schema);
      const newConstant = await this.createSchemaItem<Constant>(schemaKey, this.schemaItemType, boundCreate, name) as MutableConstant;

      const newPhenomenon = (await this.getSchemaItem<Phenomenon>(phenomenon, SchemaItemType.Phenomenon));
      newConstant.setPhenomenon(new DelayedPromiseWithProps<SchemaItemKey, Phenomenon>(newPhenomenon.key, async () => newPhenomenon));

      newConstant.setDefinition(definition);

      if (numerator)
        newConstant.setNumerator(numerator);

      if (denominator)
        newConstant.setDenominator(denominator);

      if (displayLabel)
        newConstant.setDisplayLabel(displayLabel);

      return newConstant.key;
    } catch (e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateSchemaItemFailed, new SchemaItemId(this.schemaItemType, name, schemaKey), e);
    }
  }

  /**
   * Creates a Constant through a ConstantProps.
   * @param schemaKey a SchemaKey of the Schema that will house the new object.
   * @param relationshipProps a json object that will be used to populate the new RelationshipClass. Needs a name value passed in.
   */
  public async createFromProps(schemaKey: SchemaKey, constantProps: ConstantProps): Promise<SchemaItemKey> {
    try {
      const schema = await this.getSchema(schemaKey);
      const boundCreate = schema.createConstant.bind(schema);
      const newConstant = await this.createSchemaItemFromProps(schemaKey, this.schemaItemType, boundCreate, constantProps);
      return newConstant.key;
    } catch (e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateSchemaItemFromProps, new SchemaItemId(this.schemaItemType, constantProps.name!, schemaKey), e);
    }
  }
}
