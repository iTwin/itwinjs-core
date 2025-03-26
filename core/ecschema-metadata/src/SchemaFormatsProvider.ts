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
import { UnitSystemKey } from "@itwin/core-quantity";

/**
 * Provides default formats and kind of quantities from a given SchemaContext or SchemaLocater.
 * @beta
 */
export class SchemaFormatsProvider implements FormatsProvider {
  private _context: SchemaContext;
  private _formatCache: Map<string, SchemaItemFormatProps> = new Map();
  public onFormatUpdated = new BeUiEvent<string>();
  public onFormatRemoved = new BeUiEvent<string>();
  public onCacheCleared = new BeUiEvent<void>();
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

  /**
   * Try retrieving the format from schemas. If the format is not part of the base Formats schema, but from a KindOfQuantity, the format will be constructed
   * from the default presentation format of that KindOfQuantity.
   */
  private async getFormatFromSchema(id: string, unitSystem?: UnitSystemKey): Promise<SchemaItemFormatProps | undefined> {
    const [schemaName, schemaItemName] = SchemaItem.parseFullName(id);
    const schemaKey = new SchemaKey(schemaName);
    const schema = await this._context.getSchema(schemaKey);
    if (!schema) {
      return undefined;
    }
    const itemKey = new SchemaItemKey(schemaItemName, schema.schemaKey);

    if (schema.name === "Formats") {
      const format = await this._context.getSchemaItem(itemKey, Format);
      if (!format) {
        return undefined;
      }
      return format.toJSON(true);
    }
    return this.getKindOfQuantityFormatFromSchema(itemKey, unitSystem);
  }

  private async getKindOfQuantityFormatFromSchema(itemKey: SchemaItemKey, unitSystem?: UnitSystemKey): Promise<SchemaItemFormatProps | undefined> {
    const kindOfQuantity = await this._context.getSchemaItem(itemKey, KindOfQuantity);

    if (!kindOfQuantity) {
      return undefined;
    }
    // Find the first presentation format that matches the provided unit system. Else, use the first entry.
    if (unitSystem) {
      const unitSystemGroupNames = getUnitSystemGroupNames(unitSystem);
      const presentationFormats = kindOfQuantity.presentationFormats;
      for (const system of unitSystemGroupNames) {
        for (const format of presentationFormats) {
          const unit = format.units && format.units[0][0];
          if (!unit) {
            continue;
          }
          const currentUnitSystem = await unit.unitSystem;
          if (currentUnitSystem && currentUnitSystem.name.toUpperCase() === system) {
            return getFormatProps(format);
          }
        }
      }
      return undefined;
    }
    const defaultFormat = kindOfQuantity.defaultPresentationFormat;
    if (!defaultFormat) {
      return undefined;
    }
    return getFormatProps(defaultFormat);
  }

  /**
   * Retrieves a Format from the cache or from the schema. If retrieving from the schema, and the format is part of a KindOfQuantity,
   * an optional UnitSystemKey can be provided to get the first presentation format in the KindOfQuantity that matches the unit system.
   * @param id The full name of the Format.
   * @returns
   */
  public async getFormat(id: string, unitSystem?: UnitSystemKey): Promise<SchemaItemFormatProps | undefined> {
    if (this._formatCache.has(id)) {
      return this._formatCache.get(id);
    }
    return this.getFormatFromSchema(id, unitSystem);
  }

  /**
   * Adds a format to the provider's cache. If the cache already has a format with the same name, override the format.
   */
  public async addFormat(name: string, formatProps: SchemaItemFormatProps): Promise<void> {
    this._formatCache.set(name, formatProps);
    this.onFormatUpdated.emit(name);
  }

  public async removeFormat(name: string): Promise<void> {
    this._formatCache.delete(name);
    this.onFormatRemoved.emit(name);
  }

  public async clearFormatCache(): Promise<void> {
    this._formatCache.clear();
    this.onCacheCleared.emit();
  }
}

function getUnitSystemGroupNames(unitSystem?: UnitSystemKey) {
  switch (unitSystem) {
    case "imperial":
      return ["IMPERIAL", "USCUSTOM", "INTERNATIONAL", "FINANCE"];
    case "metric":
      return ["SI", "METRIC", "INTERNATIONAL", "FINANCE"];
    case "usCustomary":
      return ["USCUSTOM", "INTERNATIONAL", "FINANCE"];
    case "usSurvey":
      return ["USSURVEY", "USCUSTOM", "INTERNATIONAL", "FINANCE"];
  }
  return [];
}
