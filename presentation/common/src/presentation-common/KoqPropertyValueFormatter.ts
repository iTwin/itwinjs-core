/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { Format, FormatProps, FormatterSpec, ParserSpec, UnitsProvider, UnitSystemKey } from "@itwin/core-quantity";
import {
  getFormatProps, InvertedUnit, KindOfQuantity, SchemaContext, SchemaKey, SchemaMatchType, SchemaUnitProvider,
  Unit,
} from "@itwin/ecschema-metadata";

/** @alpha */
export interface FormatOptions {
  koqName: string;
  unitSystem?: UnitSystemKey;
}

/** @alpha */
export class KoqPropertyValueFormatter {
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

interface FormattingProps {
  formatProps: FormatProps;
  persistenceUnitName: string;
}

async function getFormattingProps(schemaLocater: SchemaContext, options: FormatOptions): Promise<FormattingProps | undefined> {
  const { koqName, unitSystem } = options;

  const koq = await getKoq(schemaLocater, koqName);
  if (!koq)
    return undefined;

  const persistenceUnit = await koq.persistenceUnit;
  // istanbul ignore if
  if (!persistenceUnit)
    return undefined;

  const formatProps = await getKoqFormatProps(koq, persistenceUnit, unitSystem);
  if (!formatProps)
    return undefined;

  return { formatProps, persistenceUnitName: persistenceUnit.fullName };
}

async function getKoq(schemaLocater: SchemaContext, fullName: string) {
  const [schemaName, propKoqName] = fullName.split(":");
  const schema = await schemaLocater.getSchema(new SchemaKey(schemaName), SchemaMatchType.Latest);
  if (!schema)
    return undefined;

  return schema.getItem<KindOfQuantity>(propKoqName);
}

async function getKoqFormatProps(koq: KindOfQuantity, persistenceUnit: Unit | InvertedUnit, unitSystem?: UnitSystemKey) {
  const unitSystems = getUnitSystemGroupNames(unitSystem);
  // use one of KOQ presentation format that matches requested unit system
  const presentationFormat = await getKoqPresentationFormat(koq, unitSystems);
  if (presentationFormat)
    return getFormatProps(presentationFormat);

  // use persistence unit format if it matches requested unit system and matching presentation format was not found
  const persistenceUnitSystem = await persistenceUnit.unitSystem;
  if (persistenceUnitSystem && unitSystems.includes(persistenceUnitSystem.name.toUpperCase()))
    return getPersistenceUnitFormatProps(persistenceUnit);

  // use default presentation format if persistence unit does not match requested unit system
  if (koq.defaultPresentationFormat)
    return getFormatProps(koq.defaultPresentationFormat);

  return undefined;
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

function getPersistenceUnitFormatProps(persistenceUnit: Unit | InvertedUnit): FormatProps {
  // Same as Format "DefaultRealU" in Formats ecschema
  return {
    formatTraits: ["keepSingleZero", "keepDecimalPoint", "showUnitLabel"],
    precision: 6,
    type: "Decimal",
    uomSeparator: " ",
    decimalSeparator: ".",
    composite: {
      units: [{
        name: persistenceUnit.fullName,
        label: persistenceUnit.label,
      }],
    },
  };
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
