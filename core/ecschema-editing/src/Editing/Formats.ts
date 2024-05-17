/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { ECObjectsError, ECObjectsStatus, InvertedUnit, SchemaItem, SchemaItemFormatProps, SchemaItemKey, SchemaItemType, SchemaKey, Unit } from "@itwin/ecschema-metadata";
import { FormatType } from "@itwin/core-quantity";
import { SchemaContextEditor, SchemaItemEditResults } from "./Editor";
import { MutableFormat } from "./Mutable/MutableFormat";
import { ECEditingError, ECEditingStatus } from "./Exception";

/**
 * @alpha
 * A class allowing you to create schema items of type Format.
 */
export class Formats {
  public constructor(protected _schemaEditor: SchemaContextEditor) { }
  public async create(schemaKey: SchemaKey, name: string, formatType: FormatType, displayLabel?: string, units?: SchemaItemKey[]): Promise<SchemaItemEditResults> {
    const schema = await this._schemaEditor.getSchema(schemaKey);
    if (schema === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaNotFound, `Schema Key ${schemaKey.toString(true)} not found in context`);

    let newFormat: MutableFormat;
    try {
      newFormat = await schema.createFormat(name) as MutableFormat;
    } catch (e) {
      if (e instanceof ECObjectsError && e.errorNumber === ECObjectsStatus.DuplicateItem) {
        throw new ECEditingError(ECEditingStatus.SchemaItemNameAlreadyExists, `Format ${name} already exists in the schema ${schema.fullName}.`);
      } else {
        throw new ECEditingError(ECEditingStatus.Unknown, `Failed to create Format ${name} in schema ${schema.fullName}.`);
      }
    }

    if (units !== undefined) {
      for (const unit of units) {
        const unitItem = await this._schemaEditor.schemaContext.getSchemaItem<Unit | InvertedUnit>(unit);
        if (unitItem === undefined) {
          throw new ECEditingError(ECEditingStatus.SchemaItemNotFound, `Failed to locate unit ${unit.name} in Schema Context.`);
        }

        if (unitItem.schemaItemType !== SchemaItemType.Unit && unitItem.schemaItemType !== SchemaItemType.InvertedUnit)
          throw new ECEditingError(ECEditingStatus.InvalidSchemaItemType, `${(unitItem as SchemaItem).fullName} is not of type Unit or InvertedUnit.`);
        newFormat.addUnit(unitItem);
      }
    }
    if (displayLabel)
      newFormat.setDisplayLabel(displayLabel);

    // TODO: Handle the setting of format traits, separators, etc....
    newFormat.setFormatType(formatType);
    return { itemKey: newFormat.key };
  }

  /**
   * Creates a format through a SchemaItemFormatProps.
   * @param schemaKey a SchemaKey of the Schema that will house the new object.
   * @param relationshipProps a json object that will be used to populate the new RelationshipClass. Needs a name value passed in.
   */
  public async createFromProps(schemaKey: SchemaKey, formatProps: SchemaItemFormatProps): Promise<SchemaItemEditResults> {
    const schema = await this._schemaEditor.getSchema(schemaKey);
    if (schema === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaNotFound, `Schema Key ${schemaKey.toString(true)} not found in context`);

    if (formatProps.name === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaItemNameNotSpecified, `No name was supplied within props.`);

    let newFormat: MutableFormat;
    try {
      newFormat = await schema.createFormat(formatProps.name) as MutableFormat;
    } catch (e) {
      if (e instanceof ECObjectsError && e.errorNumber === ECObjectsStatus.DuplicateItem) {
        throw new ECEditingError(ECEditingStatus.SchemaItemNameAlreadyExists, `Class ${formatProps.name} already exists in the schema ${schema.fullName}.`);
      } else {
        throw new ECEditingError(ECEditingStatus.Unknown, `Failed to create class ${formatProps.name} in schema ${schema.fullName}.`);
      }
    }

    await newFormat.fromJSON(formatProps);
    return { itemKey: newFormat.key };
  }
}
