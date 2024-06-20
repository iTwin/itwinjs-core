/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { Format, InvertedUnit, SchemaItem, SchemaItemFormatProps, SchemaItemKey, SchemaItemType, SchemaKey, Unit } from "@itwin/ecschema-metadata";
import { FormatType } from "@itwin/core-quantity";
import { SchemaContextEditor } from "./Editor";
import { MutableFormat } from "./Mutable/MutableFormat";
import { ECEditingStatus, SchemaEditingError, SchemaItemId } from "./Exception";
import { SchemaItems } from "./SchemaItems";

/**
 * @alpha
 * A class allowing you to create schema items of type Format.
 */
export class Formats extends SchemaItems {
  public constructor(schemaEditor: SchemaContextEditor) {
    super(SchemaItemType.Format, schemaEditor);
  }

  public async create(schemaKey: SchemaKey, name: string, formatType: FormatType, displayLabel?: string, units?: SchemaItemKey[]): Promise<SchemaItemKey> {
    try {
      const newFormat = await this.createSchemaItem<Format>(schemaKey, this.schemaItemType, (schema) => schema.createFormat.bind(schema), name) as MutableFormat;

      if (units !== undefined) {
        for (const unit of units) {
          const unitItem =  await this.schemaEditor.schemaContext.getSchemaItem<Unit | InvertedUnit>(unit);
          if (!unitItem) {
            throw new SchemaEditingError(ECEditingStatus.SchemaItemNotFoundInContext, new SchemaItemId(SchemaItemType.Unit, unit));
          }

          if (unitItem.schemaItemType !== SchemaItemType.Unit && unitItem.schemaItemType !== SchemaItemType.InvertedUnit)
            throw new SchemaEditingError(ECEditingStatus.InvalidFormatUnitsSpecified, new SchemaItemId((unitItem as SchemaItem).schemaItemType, (unitItem as SchemaItem).key));

          newFormat.addUnit(unitItem);
        }
      }

      if (displayLabel)
        newFormat.setDisplayLabel(displayLabel);

      // TODO: Handle the setting of format traits, separators, etc....
      newFormat.setFormatType(formatType);
      return newFormat.key;
    } catch (e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateSchemaItemFailed, new SchemaItemId(this.schemaItemType, name, schemaKey), e);
    }
  }

  /**
   * Creates a format through a SchemaItemFormatProps.
   * @param schemaKey a SchemaKey of the Schema that will house the new object.
   * @param relationshipProps a json object that will be used to populate the new RelationshipClass. Needs a name value passed in.
   */
  public async createFromProps(schemaKey: SchemaKey, formatProps: SchemaItemFormatProps): Promise<SchemaItemKey> {
    try {
      const newFormat = await this.createSchemaItemFromProps(schemaKey, this.schemaItemType, (schema) => schema.createFormat.bind(schema), formatProps);
      return newFormat.key;
    } catch (e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateSchemaItemFromProps, new SchemaItemId(this.schemaItemType, formatProps.name!, schemaKey), e);
    }
  }
}
