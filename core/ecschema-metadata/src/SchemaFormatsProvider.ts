/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Metadata
 */

import { ISchemaLocater, SchemaContext } from "./Context";
import { FormatsProvider } from "./Interfaces";
import { SchemaItemKey, SchemaKey } from "./SchemaKey";
import { SchemaItem } from "./Metadata/SchemaItem";
import { Format } from "./Metadata/Format";
import { SchemaItemFormatProps } from "./Deserialization/JsonProps";
import { BeUiEvent } from "@itwin/core-bentley";
import { KindOfQuantity } from "./Metadata/KindOfQuantity";
import { getFormatProps } from "./Metadata/OverrideFormat";

/**
 * Provides default formats and kind of quantities coming from a given SchemaContext or SchemaLocater.
 * @beta
 */
export class SchemaFormatsProvider implements FormatsProvider {
  private _context: SchemaContext;
  private _formatCache: Map<string, SchemaItemFormatProps> = new Map();
  // Maybe add a 2nd format cache for KindOfQuantity to Format mapping?
  // private _kindOfQuantityCache: Map<string, SchemaItemFormatProps> = new Map();
  public onFormatUpdated = new BeUiEvent<string>();
  /**
   *
   * @param contextOrLocater The SchemaContext or a different ISchemaLocater implementation used to retrieve the schema. The SchemaContext
   * class implements the ISchemaLocater interface. If the provided locater is not a SchemaContext instance a new SchemaContext will be
   * created and the locater will be added.
   * @param _unitExtraData Additional data like alternate display label not found in Units Schema to match with Units; Defaults to empty array.
   */
  constructor(contextOrLocater: ISchemaLocater) {
    if (contextOrLocater instanceof SchemaContext) {
      this._context = contextOrLocater;
    } else {
      this._context = new SchemaContext();
      this._context.addLocater(contextOrLocater);
    }
  }

  private async getFormatFromSchema(id: string): Promise<SchemaItemFormatProps | undefined> {
    const [schemaName, schemaItemName] = SchemaItem.parseFullName(id);
    const schemaKey = new SchemaKey(schemaName);
    const schema = await this._context.getSchema(schemaKey);
    if (!schema) {
      return undefined;
    }
    const itemKey = new SchemaItemKey(schemaItemName, schema.schemaKey);
    const format = await this._context.getSchemaItem(itemKey, Format);
    if (!format) {
      return undefined;
    }
    return format.toJSON(true);
  }

  private async getKindOfQuantityFromSchema(id: string): Promise<KindOfQuantity | undefined> {
    const [schemaName, schemaItemName] = SchemaItem.parseFullName(id);
    const schemaKey = new SchemaKey(schemaName);
    const schema = await this._context.getSchema(schemaKey);
    if (!schema) {
      return undefined;
    }
    const itemKey = new SchemaItemKey(schemaItemName, schema.schemaKey);
    return this._context.getSchemaItem(itemKey, KindOfQuantity);
  }

  /**
   *
   * @param id The full name of the Format.
   * @returns
   */
  public async getFormat(id: string): Promise<SchemaItemFormatProps | undefined> {
    if (this._formatCache.has(id)) {
      return this._formatCache.get(id);
    }
    return this.getFormatFromSchema(id);
  }

  public async getFormatByKindOfQuantity(kindOfQuantityId: string): Promise<SchemaItemFormatProps | undefined> {
    // Lookup KindOfQuantity first.
    const kindOfQuantity = await this.getKindOfQuantityFromSchema(kindOfQuantityId);
    if (!kindOfQuantity) {
      return undefined;
    }
    const defaultFormat = kindOfQuantity.defaultPresentationFormat;
    if (!defaultFormat) {
      return undefined;
    }
    return getFormatProps(defaultFormat);
  }

  /**
   * Adds a format to the provider's cache. If the cache already has a format with the same name, override the format.
   */
  public async addFormat(name: string, formatProps: SchemaItemFormatProps): Promise<void> {
    this._formatCache.set(name, formatProps);
    this.onFormatUpdated.emit(name);
  }
}
