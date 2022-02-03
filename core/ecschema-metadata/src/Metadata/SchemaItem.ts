/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Metadata
 */

import type { SchemaItemProps } from "../Deserialization/JsonProps";
import type { SchemaItemType} from "../ECObjects";
import { schemaItemTypeToString, schemaItemTypeToXmlString } from "../ECObjects";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { ECVersion, SchemaItemKey } from "../SchemaKey";
import type { Schema } from "./Schema";

const SCHEMAURL3_2 = "https://dev.bentley.com/json_schemas/ec/32/schemaitem";

/**
 * An abstract class that supplies all of the common parts of a SchemaItem.
 * @beta
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

  public get name() { return this.key.name; }
  public get fullName() { return this.key.schemaKey ? `${this.key.schemaName}.${this.name}` : this.name; }
  public get key() { return this._key; }
  public get label() { return this._label; }
  public get description() { return this._description; }

  // Proposal: Create protected setter methods for description and label? For UnitSystems as an example, where using createFromProps isn't that necessary and can just use basic create().
  /**
   * Save this SchemaItem's properties to an object for serializing to JSON.
   * @param standalone Serialization includes only this object (as opposed to the full schema).
   * @param includeSchemaVersion Include the Schema's version information in the serialized object.
   */
  public toJSON(standalone: boolean = false, includeSchemaVersion: boolean = false) {
    const itemJson: { [value: string]: any } = {};
    if (standalone) {
      itemJson.$schema = SCHEMAURL3_2; // $schema is required
      itemJson.schema = this.schema.name;
      itemJson.name = this.name; // name is required
      if (includeSchemaVersion) // check flag to see if we should output version
        itemJson.schemaVersion = this.key.schemaKey.version.toString();
    }
    itemJson.schemaItemType = schemaItemTypeToString(this.schemaItemType);
    if (undefined !== this.label)
      itemJson.label = this.label;
    if (undefined !== this.description)
      itemJson.description = this.description;

    return itemJson as SchemaItemProps;
  }

  /** @internal */
  public async toXml(schemaXml: Document): Promise<Element> {
    const itemType = schemaItemTypeToXmlString(this.schemaItemType);
    const itemElement = schemaXml.createElement(itemType);
    itemElement.setAttribute("typeName", this.name);
    if (undefined !== this.label)
      itemElement.setAttribute("displayLabel", this.label);
    if (undefined !== this.description)
      itemElement.setAttribute("description", this.description);

    // When all schema items support custom attributes they should be added here rather than in ECClass

    return itemElement;
  }

  public fromJSONSync(schemaItemProps: SchemaItemProps) {
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

  public async fromJSON(schemaItemProps: SchemaItemProps) {
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
   * Parses the given full name, {schemaName}.{schemaItemName} or {schemaName}:{schemaItemName}, into two separate strings.
   * @note  The schema name can be a schema alias.
   * @param fullName The full name to be parsed.
   * @returns A tuple of the parsed Schema name and Schema Item name.  If the full name does not contain a '.' or ':', the second string in the tuple will returned the exact string pass in.
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
   * @param thatSchemaItemOrKey The second SchemaItem or SchemaItemKey.
   */
  public static equalByKey(thisSchemaItem: SchemaItem, thatSchemaItemOrKey?: SchemaItem | SchemaItemKey): boolean {
    if (!thatSchemaItemOrKey)
      return true;

    const key = SchemaItem.isSchemaItem(thatSchemaItemOrKey) ? thatSchemaItemOrKey.key : thatSchemaItemOrKey;
    return thisSchemaItem.key.matches(key);
  }

  /**
  * @internal
  */
  public static isSchemaItem(object: any): object is SchemaItem {
    const schemaItem = object as SchemaItem;

    return schemaItem !== undefined && schemaItem.key !== undefined && schemaItem.schema !== undefined
             && schemaItem.schemaItemType !== undefined;
  }

  /**
   * @alpha
   * Used for schema editing.
   */
  protected setDisplayLabel(displayLabel: string) {
    this._label = displayLabel;
  }

  /**
   * @alpha
   * Used for schema editing.
   */
  protected setDescription(description: string) {
    this._description = description;
  }
}
