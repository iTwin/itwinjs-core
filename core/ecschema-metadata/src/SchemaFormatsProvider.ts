/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Metadata
 */

import { ISchemaLocater, SchemaContext } from "./Context";
import { SchemaItemKey, SchemaKey } from "./SchemaKey";
import { SchemaItem } from "./Metadata/SchemaItem";
import { Format } from "./Metadata/Format";
import { SchemaItemFormatProps } from "./Deserialization/JsonProps";
import { BeEvent, Logger } from "@itwin/core-bentley";
import { KindOfQuantity } from "./Metadata/KindOfQuantity";
import { getFormatProps } from "./Metadata/OverrideFormat";
import { FormatProps, FormatsChangedArgs, FormatsProvider, UnitSystemKey } from "@itwin/core-quantity";
import { Unit } from "./Metadata/Unit";
import { InvertedUnit } from "./Metadata/InvertedUnit";
import { Schema } from "./Metadata/Schema";
const loggerCategory = "SchemaFormatsProvider";
/**
 * Provides default formats and kind of quantities from a given SchemaContext or SchemaLocater.
 * @beta
 */
export class SchemaFormatsProvider implements FormatsProvider {
  private _context: SchemaContext;
  private _unitSystem: UnitSystemKey;
  private _formatsRetrieved: Set<string> = new Set();
  public onFormatsChanged = new BeEvent<(args: FormatsChangedArgs) => void>();
  /**
   *
   * @param contextOrLocater The SchemaContext or a different ISchemaLocater implementation used to retrieve the schema. The SchemaContext
   * class implements the ISchemaLocater interface. If the provided locater is not a SchemaContext instance a new SchemaContext will be
   * created and the locater will be added.
   * @param unitSystem Used to lookup a default format through a schema specific algorithm, when the format retrieved is associated with a KindOfQuantity.
   */
  constructor(contextOrLocater: ISchemaLocater, unitSystem: UnitSystemKey) {
    if (contextOrLocater instanceof SchemaContext) {
      this._context = contextOrLocater;
    } else {
      this._context = new SchemaContext();
      this._context.addLocater(contextOrLocater);
    }
    this._unitSystem = unitSystem;
  }

  public get context() { return this._context; }
  public get unitSystem() { return this._unitSystem; }

  public set unitSystem(unitSystem: UnitSystemKey) {
    this._unitSystem = unitSystem;
    this.clear();
  }

  private clear(): void {
    const formatsChanged = Array.from(this._formatsRetrieved);
    this._formatsRetrieved.clear();
    this.onFormatsChanged.raiseEvent({ formatsChanged });
  }

  private async getKindOfQuantityFormatFromSchema(itemKey: SchemaItemKey): Promise<SchemaItemFormatProps | undefined> {
    let kindOfQuantity: KindOfQuantity | undefined;
    try {
      kindOfQuantity = await this._context.getSchemaItem(itemKey, KindOfQuantity);
    } catch {
      Logger.logError(loggerCategory, `Failed to find KindOfQuantity ${itemKey.fullName}`);
      return undefined;
    }

    if (!kindOfQuantity) {
      return undefined;
    }

    // Find the first presentation format that matches the provided unit system.
    const unitSystemGroupNames = getUnitSystemGroupNames(this._unitSystem);
    const presentationFormats = kindOfQuantity.presentationFormats;
    for (const system of unitSystemGroupNames) {
      for (const lazyFormat of presentationFormats) {
        const format = await lazyFormat;
        const unit = await (format.units && format.units[0][0]);
        if (!unit) {
          continue;
        }
        const currentUnitSystem = unit.unitSystem;
        if (currentUnitSystem && currentUnitSystem.name.toUpperCase() === system) {
          this._formatsRetrieved.add(itemKey.fullName);
          return getFormatProps(format);
        }
      }
    }

    // If no matching presentation format was found, use persistence unit format if it matches unit system.
    const persistenceUnit = await kindOfQuantity.persistenceUnit;
    const persistenceUnitSystem = await persistenceUnit?.unitSystem;
    if (persistenceUnitSystem && unitSystemGroupNames.includes(persistenceUnitSystem.name.toUpperCase())) {
      this._formatsRetrieved.add(itemKey.fullName);
      return getPersistenceUnitFormatProps(persistenceUnit!);
    }

    const defaultFormat = kindOfQuantity.defaultPresentationFormat;
    if (!defaultFormat) {
      return undefined;
    }
    this._formatsRetrieved.add(itemKey.fullName);
    return getFormatProps(await defaultFormat);
  }


  /**
   * Retrieves a Format from a SchemaContext. If the format is part of a KindOfQuantity, the first presentation format in the KindOfQuantity that matches the current unit system will be retrieved.
   * If no presentation format matches the current unit system, the persistence unit format will be retrieved if it matches the current unit system.
   * Else, the default presentation format will be retrieved.
   * @param name The full name of the Format or KindOfQuantity.
   * @returns
   */
  public async getFormat(name: string): Promise<SchemaItemFormatProps | undefined> {
    const [schemaName, schemaItemName] = SchemaItem.parseFullName(name);
    const schemaKey = new SchemaKey(schemaName);
    let schema: Schema | undefined;
    try {
      schema = await this._context.getSchema(schemaKey);
    } catch {
      Logger.logError(loggerCategory, `Failed to find schema ${schemaName}`);
      return undefined;
    }
    if (!schema) {
      return undefined;
    }
    const itemKey = new SchemaItemKey(schemaItemName, schema.schemaKey);

    if (schema.name === "Formats") {
      let format: Format | undefined;
      try {
        format = await this._context.getSchemaItem(itemKey, Format);
      } catch {
        Logger.logError(loggerCategory, `Failed to find Format ${itemKey.fullName}`);
        return undefined;
      }
      if (!format) {
        return undefined;
      }
      return format.toJSON(true);
    }
    return this.getKindOfQuantityFormatFromSchema(itemKey);
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

function getPersistenceUnitFormatProps(persistenceUnit: Unit | InvertedUnit): FormatProps {
  // Same as Format "DefaultRealU" in Formats ecschema
  return {
    formatTraits: ["keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
    precision: 6,
    type: "Decimal",
    composite: {
      units: [
        {
          name: persistenceUnit.fullName,
          label: persistenceUnit.label,
        },
      ],
    },
  };
}