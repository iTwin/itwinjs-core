/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Metadata
 */

import { ISchemaLocater, SchemaContext } from "../Context";
import { SchemaItemKey, SchemaKey } from "../SchemaKey";
import { SchemaItem } from "../Metadata/SchemaItem";
import { Format } from "../Metadata/Format";
import { SchemaItemFormatProps } from "../Deserialization/JsonProps";
import { BeEvent, Logger } from "@itwin/core-bentley";
import { KindOfQuantity } from "../Metadata/KindOfQuantity";
import { getFormatProps } from "../Metadata/OverrideFormat";
import { FormatDefinition, FormatProps, FormatsChangedArgs, FormatsProvider, UnitSystemKey } from "@itwin/core-quantity";
import { Unit } from "../Metadata/Unit";
import { InvertedUnit } from "../Metadata/InvertedUnit";
import { Schema } from "../Metadata/Schema";
import { UnitSystem } from "../Metadata/UnitSystem";
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

  /** When using a presentation unit from a KindOfQuantity, the label and description should come from the KindOfQuantity */
  private convertToFormatDefinition(format: SchemaItemFormatProps, kindOfQuantity: KindOfQuantity): FormatDefinition {
    // Destructure all properties except 'rest'
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { name, label, description, $schema, schema, schemaVersion, schemaItemType,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      customAttributes, originalECSpecMajorVersion, originalECSpecMinorVersion, ...rest } = format;

    return {
      ...rest,
      name: kindOfQuantity.fullName,
      label: kindOfQuantity.label ?? format.label,
      description: kindOfQuantity.description ?? format.description,
    }
  }

  private async getKindOfQuantityFormatFromSchema(itemKey: SchemaItemKey): Promise<FormatDefinition | undefined> {
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
    const unitSystemMatchers = getUnitSystemGroupMatchers(this._unitSystem);
    const presentationFormats = kindOfQuantity.presentationFormats;
    const persistenceUnit = await kindOfQuantity.persistenceUnit;
    const persistenceUnitSystem = await persistenceUnit?.unitSystem;

    for (const matcher of unitSystemMatchers) {
      for (const lazyFormat of presentationFormats) {
        const format = await lazyFormat;
        // Get the first unit from composite units array
        let unit: Unit | InvertedUnit | undefined;
        if (format.units?.[0] && format.units[0].length > 0) {
          unit = await format.units[0][0];
        }
        // If the format has no units, check if the persistence unit matches the unit system
        const unitSystem = unit ? await unit.unitSystem : persistenceUnitSystem;
        if (!unitSystem) {
          continue;
        }
        if (matcher(unitSystem)) {
          this._formatsRetrieved.add(itemKey.fullName);
          const props = getFormatProps(format);
          return this.convertToFormatDefinition(props, kindOfQuantity);
        }
      }
    }

    // If no matching presentation format was found, use persistence unit format if it matches unit system.
    if (persistenceUnit && persistenceUnitSystem && unitSystemMatchers.some((matcher) => matcher(persistenceUnitSystem))) {
      this._formatsRetrieved.add(itemKey.fullName);
      const props = getPersistenceUnitFormatProps(persistenceUnit);
      return this.convertToFormatDefinition(props, kindOfQuantity);
    }

    const defaultFormat = kindOfQuantity.defaultPresentationFormat;
    if (!defaultFormat) {
      return undefined;
    }
    this._formatsRetrieved.add(itemKey.fullName);
    const defaultProps = getFormatProps(await defaultFormat);
    return this.convertToFormatDefinition(defaultProps, kindOfQuantity);
  }


  /**
   * Retrieves a Format from a SchemaContext. If the format is part of a KindOfQuantity, the first presentation format in the KindOfQuantity that matches the current unit system will be retrieved.
   * If no presentation format matches the current unit system, the persistence unit format will be retrieved if it matches the current unit system.
   * Else, the default presentation format will be retrieved.
   * @param name The full name of the Format or KindOfQuantity.
   * @returns
   */
  public async getFormat(name: string): Promise<FormatDefinition | undefined> {
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

function getUnitSystemGroupMatchers(groupKey?: UnitSystemKey) {
  function createMatcher(name: string | string[]) {
    const names = Array.isArray(name) ? name : [name];
    return (unitSystem: UnitSystem) => names.some((n) => n === unitSystem.name.toUpperCase());
  }
  switch (groupKey) {
    case "imperial":
      return ["IMPERIAL", "USCUSTOM", "INTERNATIONAL", "FINANCE"].map(createMatcher);
    case "metric":
      return [["SI", "METRIC"], "INTERNATIONAL", "FINANCE"].map(createMatcher);
    case "usCustomary":
      return ["USCUSTOM", "INTERNATIONAL", "FINANCE"].map(createMatcher);
    case "usSurvey":
      return ["USSURVEY", "USCUSTOM", "INTERNATIONAL", "FINANCE"].map(createMatcher);
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