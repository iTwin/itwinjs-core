/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { SchemaItemKey, SchemaItemType, parseSchemaItemType, schemaItemTypeToString } from "../ECObjects";
import { SchemaItemVisitor } from "../Interfaces";
import Schema from "./Schema";
import { ECObjectsError, ECObjectsStatus } from "../Exception";

const SCHEMAURL3_2 = "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem";

/**
 * An abstract class that supplies all of the common parts of a SchemaItem.
 */
export default abstract class SchemaItem {
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

  get fullName() { return this.key.schemaKey ? `${this.key.schemaKey}.${this.name}` : this.name; }

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

  private itemFromJson(jsonObj: any) {
    if (undefined === jsonObj.schemaItemType)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaItem ${this.name} is missing the required schemaItemType property.`);

    if (typeof (jsonObj.schemaItemType) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaItem ${this.name} has an invalid 'schemaItemType' attribute. It should be of type 'string'.`);

    if (parseSchemaItemType(jsonObj.schemaItemType) !== this.schemaItemType)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaItem ${this.name} has an incompatible schemaItemType. It must be "${schemaItemTypeToString(this.schemaItemType)}", not "${jsonObj.schemaItemType}".`);

    if (undefined !== jsonObj.name) {
      if (typeof (jsonObj.name) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaItem ${this.name} has an invalid 'name' attribute. It should be of type 'string'.`);

      if (jsonObj.name.toLowerCase() !== this.name.toLowerCase())
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
    }

    if (undefined !== jsonObj.description) {
      if (typeof (jsonObj.description) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaItem ${this.name} has an invalid 'description' attribute. It should be of type 'string'.`);
      this._description = jsonObj.description;
    }

    if (undefined !== jsonObj.label) {
      if (typeof (jsonObj.label) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaItem ${this.name} has an invalid 'label' attribute. It should be of type 'string'.`);
      this._label = jsonObj.label;
    }

    if (undefined !== jsonObj.schema) {
      if (typeof (jsonObj.schema) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaItem ${this.name} has an invalid 'schema' attribute. It should be of type 'string'.`);

      if (jsonObj.schema.toLowerCase() !== this.schema.name.toLowerCase())
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
    }

    if (undefined !== jsonObj.schemaVersion) {
      if (typeof (jsonObj.schemaVersion) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaItem ${this.name} has an invalid 'schemaVersion' attribute. It should be of type 'string'.`);

      if (jsonObj.schemaVersion !== this.key.schemaKey.version.toString())
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
    }
  }

  public async fromJson(jsonObj: any): Promise<void> {
    this.itemFromJson(jsonObj);
  }

  public fromJsonSync(jsonObj: any): void {
    this.itemFromJson(jsonObj);
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

  public abstract async accept(visitor: SchemaItemVisitor): Promise<void>;
}
