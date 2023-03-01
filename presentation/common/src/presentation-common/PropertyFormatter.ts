/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { assert } from "@itwin/core-bentley";
import { Format, FormatProps, FormatterSpec, ParserSpec, UnitsProvider, UnitSystemKey } from "@itwin/core-quantity";
import {
  Format as ECFormat, ISchemaLocater, KindOfQuantity, OverrideFormat, SchemaContext, SchemaKey, SchemaMatchType, SchemaUnitProvider,
} from "@itwin/ecschema-metadata";
import { Content } from "./content/Content";
import { Field, PropertiesField } from "./content/Fields";
import { DisplayValue, NestedContentValue, Value } from "./content/Value";
import { KindOfQuantityInfo, PropertyInfo } from "./EC";
import { ValuesDictionary } from "./Utils";

/** @alpha */
export interface FormatOptions {
  koqName: string;
  unitSystem: UnitSystemKey;
}

/** @alpha */
export class PropertyValueFormatter {
  private _unitsProvider: UnitsProvider;

  constructor(private _schemaContext: SchemaContext) {
    this._unitsProvider = new SchemaUnitProvider(_schemaContext);
  }

  public async format(value: number, options: FormatOptions) {
    const formatterSpec = await this.getFormatterSpec(options);
    if (!formatterSpec)
      return undefined;
    return formatterSpec.applyFormatting(value);
  }

  public async getFormatterSpec(options: FormatOptions) {
    const formattingProps = await getFormattingProps(this._schemaContext, options);
    if (!formattingProps)
      return undefined;
    const { formatProps, persistenceUnitName } = formattingProps;
    const persistenceUnit = await this._unitsProvider.findUnitByName(persistenceUnitName);
    const format = await Format.createFromJSON("", this._unitsProvider, formatProps);
    return FormatterSpec.create("", format, this._unitsProvider, persistenceUnit);
  }

  public async getParserSpec(options: FormatOptions) {
    const formattingProps = await getFormattingProps(this._schemaContext, options);
    if (!formattingProps)
      return undefined;
    const { formatProps, persistenceUnitName } = formattingProps;
    const persistenceUnit = await this._unitsProvider.findUnitByName(persistenceUnitName);
    const format = await Format.createFromJSON("", this._unitsProvider, formatProps);
    return ParserSpec.create(format, this._unitsProvider, persistenceUnit);
  }
}

/** @alpha */
export class ContentPropertyValueFormatter {
  constructor(private _propertyValueFormatter: PropertyValueFormatter, private _unitSystem: UnitSystemKey) { }

  public async formatContent(content: Content) {
    const descriptor = content.descriptor;
    for (const item of content.contentSet) {
      await this.formatValues(item.values, item.displayValues, descriptor.fields, item.mergedFieldNames);
    }
    return content;
  }

  private async formatValues(values: ValuesDictionary<Value>, displayValues: ValuesDictionary<DisplayValue>, fields: Field[], mergedFields: string[]) {
    for (const field of fields) {
      const value = values[field.name];
      if (field.isNestedContentField() && !mergedFields.includes(field.name)) {
        assert(Value.isNestedContent(value));
        await this.formatNestedContentDisplayValues(value, field.nestedFields);
        continue;
      }

      if (!this.isFormattable(field) || typeof value !== "number")
        continue;

      const koq = field.properties[0].property.kindOfQuantity;
      const formattedValue = await this._propertyValueFormatter.format(value, { koqName: koq.name, unitSystem: this._unitSystem });
      if (!formattedValue)
        continue;

      displayValues[field.name] = formattedValue;
    }
  }

  private async formatNestedContentDisplayValues(nestedValues: NestedContentValue[], fields: Field[]) {
    for (const nestedValue of nestedValues) {
      await this.formatValues(nestedValue.values, nestedValue.displayValues, fields, nestedValue.mergedFieldNames);
    }
  }

  private isFormattable(field: Field): field is FormattableField {
    return field.isPropertiesField()
      && field.properties.length > 0
      && field.properties[0].property.kindOfQuantity !== undefined;
  }
}

type FormattableField = PropertiesField & {
  properties: [{
    property: PropertyInfo & {
      kindOfQuantity: KindOfQuantityInfo;
    };
  }];
};

interface FormattingProps {
  formatProps: FormatProps;
  persistenceUnitName: string;
}

async function getFormattingProps(schemaLocater: ISchemaLocater, options: FormatOptions): Promise<FormattingProps | undefined> {
  const { koqName, unitSystem } = options;

  const koq = await getKoq(schemaLocater, koqName);
  if (!koq)
    return undefined;

  const persistenceUnit = await koq.persistenceUnit;
  // istanbul ignore if
  if (!persistenceUnit)
    return undefined;

  const format = await getKoqFormat(koq, unitSystem);
  if (!format)
    return undefined;

  return { formatProps: formatToFormatProps(format), persistenceUnitName: persistenceUnit.fullName };
}

async function getKoq(schemaLocater: ISchemaLocater, fullName: string) {
  const [schemaName, propKoqName] = fullName.split(":");
  const schema = await schemaLocater.getSchema(new SchemaKey(schemaName), SchemaMatchType.Latest);
  if (!schema)
    return undefined;

  return schema.getItem<KindOfQuantity>(propKoqName);
}

async function getKoqFormat(koq: KindOfQuantity, unitSystem: UnitSystemKey) {
  const unitSystems = getUnitSystemGroupNames(unitSystem);
  const presentationFormat = await getKoqPresentationFormat(koq, unitSystems);
  if (presentationFormat)
    return presentationFormat;

  return koq.defaultPresentationFormat;
}

async function getKoqPresentationFormat(koq: KindOfQuantity, unitSystems: string[]) {
  const presentationFormats = koq.presentationFormats;
  for (const system of unitSystems) {
    for (const format of presentationFormats) {
      const unit = format.units && format.units[0][0];
      // istanbul ignore if
      if (!unit)
        continue;

      const currentUnitSystem = await unit.unitSystem;
      if (currentUnitSystem && currentUnitSystem.name.toUpperCase() === system)
        return format;
    }
  }
  return undefined;
}

function formatToFormatProps(format: ECFormat | OverrideFormat): FormatProps {
  // istanbul ignore if
  if (OverrideFormat.isOverrideFormat(format)) {
    const baseFormat = baseFormatToFormatProps(format.parent);
    return {
      ...baseFormat,
      composite: format.units
        ? {
          ...baseFormat.composite,
          units: format.units.map(([unit, _]) => ({ name: unit.fullName, label: unit.label })),
          spacer: format.spacer,
          includeZero: format.includeZero,
        }
        : baseFormat.composite,
    };
  }
  return baseFormatToFormatProps(format);
}

function baseFormatToFormatProps(format: ECFormat): FormatProps {
  const json = format.toJSON();
  return {
    ...json,
    composite: json.composite
      ? {
        ...json.composite,
        spacer: format.spacer,
        includeZero: format.includeZero,
      }
      : /* istanbul ignore next */ undefined,
  };
}

function getUnitSystemGroupNames(unitSystem: UnitSystemKey) {
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
}
