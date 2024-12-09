/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Merging
 */
import { SchemaItemKey } from "@itwin/ecschema-metadata";

interface MappingEntry {
  readonly newName: string;
}

export class PropertyKey {
  public readonly propertyName: string;
  public readonly classKey: SchemaItemKey;

  public get fullName(): string {
    return `${this.classKey.fullName}.${this.propertyName}`;
  }

  constructor(propertyName: string, classKey: SchemaItemKey) {
    this.propertyName = propertyName;
    this.classKey = classKey;
  }
}

/**
 * @internal
 */
export class NameMapping {
  private readonly _map: Map<string, MappingEntry>;

  constructor() {
    this._map = new Map<string, MappingEntry>();
  }

  public addItemMapping(itemKey: string, newName: string) {
    this._map.set(itemKey, { newName });
  }

  public addPropertyMapping(propertyKey: string, newName: string) {
    this._map.set(propertyKey, { newName });
  }

  public resolveItemKey(itemKey: Readonly<SchemaItemKey>): Readonly<SchemaItemKey> {
    const entry = this._map.get(itemKey.fullName);
    if(entry === undefined) {
      return itemKey;
    }

    return new SchemaItemKey(entry.newName, itemKey.schemaKey);
  }

  public resolvePropertyKey(propertyKey: Readonly<PropertyKey>): Readonly<PropertyKey> {
    const entry = this._map.get(propertyKey.fullName);
    if(entry === undefined) {
      return propertyKey;
    }

    return new PropertyKey(entry.newName, propertyKey.classKey);
  }
}
