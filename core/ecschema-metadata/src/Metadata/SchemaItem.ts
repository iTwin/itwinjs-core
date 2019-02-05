/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Schema } from "./Schema";
import { SchemaItemProps } from "./../Deserialization/JsonProps";
import { SchemaItemType, schemaItemTypeToString } from "./../ECObjects";
import { ECObjectsError, ECObjectsStatus } from "./../Exception";
import { SchemaItemVisitor } from "./../Interfaces";
import { SchemaItemKey, ECVersion } from "./../SchemaKey";

const SCHEMAURL3_2 = "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem";

/**
 * An abstract class that supplies all of the common parts of a SchemaItem.
 */
export abstract class SchemaItem {
  public readonly schemaItemType!: SchemaItemType; // allow the derived classes to define their own schemaItemType
  public readonly schema: Schema;
  protected _key: SchemaItemKey;
  protected _description?: string;
  protected _label?: string;

  constructor(schema: Schema, name: string) {
    this._key = new SchemaItemKey(name, schema.schemaKey);
    this.schema = schema;
  }

  get name() { return this.key.name; }

  get fullName() { return this.key.schemaKey ? `${this.key.schemaName}.${this.name}` : this.name; }

  get key() { return this._key; }

  get label() { return this._label; }

  get description() { return this._description; }

  public toJson(standalone: boolean, includeSchemaVersion: boolean) {
    const itemJson: { [value: string]: any } = {};
    if (standalone) {
      itemJson.$schema = SCHEMAURL3_2; // $schema is required
      itemJson.schema = this.schema.name;
      itemJson.name = this.name; // name is required
      if (includeSchemaVersion) // check flag to see if we should output version
        itemJson.schemaVersion = this.key.schemaKey.version.toString();
    }
    itemJson.schemaItemType = schemaItemTypeToString(this.schemaItemType);
    if (this.label !== undefined)
      itemJson.label = this.label;
    if (this.description !== undefined)
      itemJson.description = this.description;
    return itemJson;
  }

  public deserializeSync(schemaItemProps: SchemaItemProps) {
    if (undefined !== schemaItemProps.label)
      this._label = schemaItemProps.label;

    this._description = schemaItemProps.description;

    if (undefined !== schemaItemProps.schema) {
      if (schemaItemProps.schema.toLowerCase() !== this.schema.name.toLowerCase())
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to deserialize the SchemaItem '${this.fullName}' with a different schema name, ${schemaItemProps.schema}, than the current Schema of this SchemaItem, ${this.schema.fullName}.`);
    }

    if (undefined !== schemaItemProps.schemaVersion) {
      if (this.key.schemaKey.version.compare(ECVersion.fromString(schemaItemProps.schemaVersion)))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to deserialize the SchemaItem '${this.fullName}' with a different schema version, ${schemaItemProps.schemaVersion}, than the current Schema version of this SchemaItem, ${this.key.schemaKey.version}.`);
    }
  }

  public async deserialize(schemaItemProps: SchemaItemProps) {
    if (undefined !== schemaItemProps.label)
      this._label = schemaItemProps.label;

    this._description = schemaItemProps.description;

    if (undefined !== schemaItemProps.schema) {
      if (schemaItemProps.schema.toLowerCase() !== this.schema.name.toLowerCase())
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to deserialize the SchemaItem ${this.fullName}' with a different schema name, ${schemaItemProps.schema}, than the current Schema of this SchemaItem, ${this.schema.fullName}`);
    }

    if (undefined !== schemaItemProps.schemaVersion) {
      if (this.key.schemaKey.version.compare(ECVersion.fromString(schemaItemProps.schemaVersion)))
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to deserialize the SchemaItem '${this.fullName}' with a different schema version, ${schemaItemProps.schemaVersion}, than the current Schema version of this SchemaItem, ${this.key.schemaKey.version}.`);
    }
  }

  /**
   * Parses the given full name, {schemaName}.{schemaItemName}, into two separate strings.
   * If the name is not a string with a '.' in it than the second string in the tuple will be the name provided.
   * @param fullName The full name to be parsed.
   */
  public static parseFullName(fullName: string): [string, string] {
    const matches = /^([a-zA-Z_]+[a-zA-Z0-9_]*(\.\d+\.\d+\.\d+)?)[.:]([a-zA-Z_]+[a-zA-Z0-9_]*)$/.exec(fullName);

    // The first match will be the full string match, the second three will be the three groups
    if (matches === null || matches.length !== 4)
      return ["", fullName];

    return [matches[1], matches[3]];
  }

  /**
   * Indicates if the two SchemaItem objects are equal by comparing their respective [[key]] properties.
   * @param thisSchemaItem The first SchemaItem.
   * @param thatSchemaItem The second SchemaItem.
   */
  public static equalByKey(thisSchemaItem: SchemaItem, thatSchemaItem?: SchemaItem) {
    if (!thatSchemaItem)
      return true;

    return thisSchemaItem.key.matches(thatSchemaItem.key);
  }

  public abstract async accept(visitor: SchemaItemVisitor): Promise<void>;
  public abstract acceptSync(visitor: SchemaItemVisitor): void;
}
