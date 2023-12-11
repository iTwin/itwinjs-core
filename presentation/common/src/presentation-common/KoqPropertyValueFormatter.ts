/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { Format, FormatProps, FormatterSpec, ParserSpec, UnitsProvider, UnitSystemKey } from "@itwin/core-quantity";
import {
  getFormatProps,
  InvertedUnit,
  KindOfQuantity,
  SchemaContext,
  SchemaKey,
  SchemaMatchType,
  SchemaUnitProvider,
  Unit,
  UnitSystem,
} from "@itwin/ecschema-metadata";

/**
 * A data structure that associates unit systems with property value formatting props. The associations are used for
 * assigning formatting props for specific phenomenon and unit system combinations (see [[FormatsMap]]).
 *
 * @public
 */
export interface UnitSystemFormat {
  unitSystems: UnitSystemKey[];
  format: FormatProps;
}

/**
 * A data structure that associates specific phenomenon with one or more formatting props for specific unit system.
 *
 * Example:
 * ```json
 * {
 *   length: [{
 *     unitSystems: ["metric"],
 *     format: formatForCentimeters,
 *   }, {
 *     unitSystems: ["imperial", "usCustomary"],
 *     format: formatForInches,
 *   }, {
 *     unitSystems: ["usSurvey"],
 *     format: formatForUsSurveyInches,
 *   }]
 * }
 * ```
 *
 * @public
 */
export interface FormatsMap {
  [phenomenon: string]: UnitSystemFormat | UnitSystemFormat[];
}

/** @alpha */
export interface FormatOptions {
  koqName: string;
  unitSystem?: UnitSystemKey;
}

/** @alpha */
export class KoqPropertyValueFormatter {
  private _unitsProvider: UnitsProvider;
  private _defaultFormats?: FormatsMap;

  constructor(private _schemaContext: SchemaContext, defaultFormats?: FormatsMap) {
    this._unitsProvider = new SchemaUnitProvider(_schemaContext);
    this._defaultFormats = defaultFormats
      ? Object.entries(defaultFormats).reduce((acc, [phenomenon, unitSystemFormats]) => ({ ...acc, [phenomenon.toUpperCase()]: unitSystemFormats }), {})
      : /* istanbul ignore next */ undefined;
  }

  public async format(value: number, options: FormatOptions) {
    const formatterSpec = await this.getFormatterSpec(options);
    if (!formatterSpec) {
      return undefined;
    }
    return formatterSpec.applyFormatting(value);
  }

  public async getFormatterSpec(options: FormatOptions) {
    const formattingProps = await getFormattingProps(this._schemaContext, this._defaultFormats, options);
    if (!formattingProps) {
      return undefined;
    }
    const { formatProps, persistenceUnitName } = formattingProps;
    const persistenceUnit = await this._unitsProvider.findUnitByName(persistenceUnitName);
    const format = await Format.createFromJSON("", this._unitsProvider, formatProps);
    return FormatterSpec.create("", format, this._unitsProvider, persistenceUnit);
  }

  public async getParserSpec(options: FormatOptions) {
    const formattingProps = await getFormattingProps(this._schemaContext, this._defaultFormats, options);
    if (!formattingProps) {
      return undefined;
    }
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

async function getFormattingProps(
  schemaLocater: SchemaContext,
  defaultFormats: FormatsMap | undefined,
  options: FormatOptions,
): Promise<FormattingProps | undefined> {
  const { koqName, unitSystem } = options;

  const koq = await getKoq(schemaLocater, koqName);
  if (!koq) {
    return undefined;
  }

  const persistenceUnit = await koq.persistenceUnit;
  // istanbul ignore if
  if (!persistenceUnit) {
    return undefined;
  }

  const formatProps = await getKoqFormatProps(koq, persistenceUnit, defaultFormats, unitSystem);
  if (!formatProps) {
    return undefined;
  }

  return { formatProps, persistenceUnitName: persistenceUnit.fullName };
}

async function getKoq(schemaLocater: SchemaContext, fullName: string) {
  const [schemaName, propKoqName] = fullName.split(":");
  const schema = await schemaLocater.getSchema(new SchemaKey(schemaName), SchemaMatchType.Latest);
  if (!schema) {
    return undefined;
  }
  return schema.getItem<KindOfQuantity>(propKoqName);
}

async function getKoqFormatProps(
  koq: KindOfQuantity,
  persistenceUnit: Unit | InvertedUnit,
  defaultFormats: FormatsMap | undefined,
  unitSystem?: UnitSystemKey,
) {
  const unitSystemMatchers = getUnitSystemGroupMatchers(unitSystem);
  // use one of KOQ presentation format that matches requested unit system
  const presentationFormat = await getKoqPresentationFormat(koq, unitSystemMatchers);
  if (presentationFormat) {
    return getFormatProps(presentationFormat);
  }

  // use one of the formats in default formats map if there is one for matching phenomena and requested unit
  // system combination
  if (defaultFormats && unitSystem) {
    const actualPersistenceUnit = persistenceUnit instanceof InvertedUnit ? /* istanbul ignore next */ await persistenceUnit.invertsUnit : persistenceUnit;
    const phenomenon = await actualPersistenceUnit?.phenomenon;
    // istanbul ignore else
    if (phenomenon && defaultFormats[phenomenon.name.toUpperCase()]) {
      const defaultPhenomenonFormats = defaultFormats[phenomenon.name.toUpperCase()];
      for (const defaultUnitSystemFormat of Array.isArray(defaultPhenomenonFormats)
        ? /* istanbul ignore next */ defaultPhenomenonFormats
        : [defaultPhenomenonFormats]) {
        if (defaultUnitSystemFormat.unitSystems.includes(unitSystem)) {
          return defaultUnitSystemFormat.format;
        }
      }
    }
  }

  // use persistence unit format if it matches requested unit system and matching presentation format was not found
  const persistenceUnitSystem = await persistenceUnit.unitSystem;
  if (persistenceUnitSystem && unitSystemMatchers.some((matcher) => matcher(persistenceUnitSystem))) {
    return getPersistenceUnitFormatProps(persistenceUnit);
  }

  // use default presentation format if persistence unit does not match requested unit system
  if (koq.defaultPresentationFormat) {
    return getFormatProps(koq.defaultPresentationFormat);
  }

  return undefined;
}

async function getKoqPresentationFormat(koq: KindOfQuantity, unitSystemMatchers: Array<(unitSystem: UnitSystem) => boolean>) {
  const presentationFormats = koq.presentationFormats;
  for (const matcher of unitSystemMatchers) {
    for (const format of presentationFormats) {
      const unit = format.units && format.units[0][0];
      // istanbul ignore if
      if (!unit) {
        continue;
      }
      const currentUnitSystem = await unit.unitSystem;
      if (currentUnitSystem && matcher(currentUnitSystem)) {
        return format;
      }
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
      units: [
        {
          name: persistenceUnit.fullName,
          label: persistenceUnit.label,
        },
      ],
    },
  };
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
