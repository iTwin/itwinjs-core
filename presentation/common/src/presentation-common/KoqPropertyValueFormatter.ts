/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { assert } from "@itwin/core-bentley";
import { Format, FormatProps, FormatsProvider, FormatterSpec, ParserSpec, UnitsProvider, UnitSystemKey } from "@itwin/core-quantity";
import { InvertedUnit, KindOfQuantity, SchemaContext, SchemaFormatsProvider, SchemaKey, SchemaMatchType, SchemaUnitProvider } from "@itwin/ecschema-metadata";

/**
 * A data structure that associates unit systems with property value formatting props. The associations are used for
 * assigning formatting props for specific phenomenon and unit system combinations (see [[FormatsMap]]).
 *
 * @public
 *
 * @deprecated in 5.1 - will not be removed until after 2026-08-08. `FormatsMap` and related APIs have been deprecated in favor of [FormatsProvider]($core-quantity).
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
 *
 * @deprecated in 5.1 - will not be removed until after 2026-08-08. `FormatsMap` and related APIs have been deprecated in favor of [FormatsProvider]($core-quantity).
 */
export interface FormatsMap {
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  [phenomenon: string]: UnitSystemFormat | UnitSystemFormat[];
}

/**
 * Options for finding a formatter spec to use in [[KoqPropertyValueFormatter]].
 * @public
 */
export interface FormatOptions {
  /** Full name of the `KindOfQuantity`, e.g. `SchemaName:KoqName`. */
  koqName: string;
  /** Unit system to use for formatting. */
  unitSystem?: UnitSystemKey;
  /** Optional overrides for the format used to parse or format values. */
  formatOverride?: Partial<Omit<FormatProps, "type">>;
}

/**
 * Props for creating [[KoqPropertyValueFormatter]].
 * @public
 */
interface KoqPropertyValueFormatterProps {
  /** Schema context to use for locating units, formats, etc. Generally retrieved through the `schemaContext` getter on an iModel. */
  schemaContext: SchemaContext;
  /** Formats provider to use for finding formatting props. Defaults to [SchemaFormatsProvider]($ecschema-metadata) when not supplied. */
  formatsProvider?: FormatsProvider;
}

/**
 * An utility for formatting property values based on `KindOfQuantity` and unit system.
 * @public
 */
export class KoqPropertyValueFormatter {
  private _schemaContext: SchemaContext;
  private _unitsProvider: UnitsProvider;
  private _formatsProvider?: FormatsProvider;
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  private _defaultFormats?: FormatsMap;

  /** @deprecated in 5.1 - will not be removed until after 2026-08-08. Use the overload that takes a props object. */
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  constructor(schemaContext: SchemaContext, defaultFormats?: FormatsMap, formatsProvider?: FormatsProvider);
  constructor(props: KoqPropertyValueFormatterProps);
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  constructor(schemaContextOrProps: SchemaContext | KoqPropertyValueFormatterProps, defaultFormats?: FormatsMap, formatsProvider?: FormatsProvider) {
    if (schemaContextOrProps instanceof SchemaContext) {
      this._schemaContext = schemaContextOrProps;
      this._formatsProvider = formatsProvider;
      this.defaultFormats = defaultFormats;
    } else {
      this._schemaContext = schemaContextOrProps.schemaContext;
      this._formatsProvider = schemaContextOrProps.formatsProvider;
    }
    this._unitsProvider = new SchemaUnitProvider(this._schemaContext);
  }

  /* c8 ignore start */
  /** @internal */
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  public get defaultFormats(): FormatsMap | undefined {
    return this._defaultFormats;
  }
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  public set defaultFormats(value: FormatsMap | undefined) {
    this._defaultFormats = value
      ? Object.entries(value).reduce((acc, [phenomenon, unitSystemFormats]) => ({ ...acc, [phenomenon.toUpperCase()]: unitSystemFormats }), {})
      : undefined;
  }
  /* c8 ignore end */

  public async format(value: number, options: FormatOptions) {
    const formatterSpec = await this.getFormatterSpec(options);
    if (!formatterSpec) {
      return undefined;
    }
    return formatterSpec.applyFormatting(value);
  }

  public async getFormatterSpec(options: FormatOptions) {
    const formattingProps = await this.#getFormattingProps(options);
    if (!formattingProps) {
      return undefined;
    }
    const { formatProps, persistenceUnitName } = formattingProps;
    const persistenceUnit = await this._unitsProvider.findUnitByName(persistenceUnitName);
    const format = await Format.createFromJSON("", this._unitsProvider, { ...formatProps, ...options.formatOverride });
    return FormatterSpec.create("", format, this._unitsProvider, persistenceUnit);
  }

  public async getParserSpec(options: FormatOptions) {
    const formattingProps = await this.#getFormattingProps(options);
    if (!formattingProps) {
      return undefined;
    }
    const { formatProps, persistenceUnitName } = formattingProps;
    const persistenceUnit = await this._unitsProvider.findUnitByName(persistenceUnitName);
    const format = await Format.createFromJSON("", this._unitsProvider, { ...formatProps, ...options.formatOverride });
    return ParserSpec.create(format, this._unitsProvider, persistenceUnit);
  }

  async #getFormattingProps(options: FormatOptions): Promise<FormattingProps | undefined> {
    const { koqName } = options;
    const koq = await getKoq(this._schemaContext, koqName);
    if (!koq) {
      return undefined;
    }
    const persistenceUnit = await koq.persistenceUnit;
    assert(!!persistenceUnit);

    // default to metric as it's the persistence unit system
    const unitSystem = options.unitSystem ?? "metric";

    const formatsProvider = this._formatsProvider ?? new SchemaFormatsProvider(this._schemaContext, unitSystem);
    const formatProps = await formatsProvider.getFormat(koqName);

    // `SchemaFormatsProvider` will fall back to default presentation format, but we want to fall back
    // to default formats' map first, and only then to the default presentation format. All of this can
    // be removed with the removal of default formats map.
    if (this._defaultFormats && (!formatProps || (await getUnitSystemKey(this._unitsProvider, formatProps)) !== unitSystem)) {
      const defaultFormatProps = await getFormatPropsFromDefaultFormats({
        schemaContext: this._schemaContext,
        formatsMap: this._defaultFormats,
        unitSystem,
        koqName,
      });
      if (defaultFormatProps) {
        return { formatProps: defaultFormatProps, persistenceUnitName: persistenceUnit.fullName };
      }
    }

    if (formatProps) {
      return { formatProps, persistenceUnitName: persistenceUnit.fullName };
    }

    return undefined;
  }
}

interface FormattingProps {
  formatProps: FormatProps;
  persistenceUnitName: string;
}

async function getKoq(schemaLocater: SchemaContext, fullName: string) {
  const [schemaName, propKoqName] = fullName.split(":");
  const schema = await schemaLocater.getSchema(new SchemaKey(schemaName), SchemaMatchType.Latest);
  if (!schema) {
    return undefined;
  }
  return schema.getItem(propKoqName, KindOfQuantity);
}

async function getUnitSystemKey(unitsProvider: UnitsProvider, formatProps: FormatProps): Promise<UnitSystemKey | undefined> {
  const unitName = formatProps.composite?.units[0].name;
  assert(!!unitName);
  const unit = await unitsProvider.findUnitByName(unitName);
  assert(!!unit);
  const [_, unitSystemName] = unit.system.split(/[\.:]/);
  switch (unitSystemName.toUpperCase()) {
    case "METRIC":
      return "metric";
    case "IMPERIAL":
      return "imperial";
    case "USCUSTOM":
      return "usCustomary";
    case "USSURVEY":
      return "usSurvey";
    /* c8 ignore next 2 */
    default:
      return undefined;
  }
}

async function getFormatPropsFromDefaultFormats({
  schemaContext,
  formatsMap,
  unitSystem,
  koqName,
}: {
  schemaContext: SchemaContext;
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  formatsMap: FormatsMap;
  unitSystem: UnitSystemKey;
  koqName: string;
}): Promise<FormatProps | undefined> {
  const koq = await getKoq(schemaContext, koqName);
  /* c8 ignore next 3 */
  if (!koq) {
    return undefined;
  }

  const persistenceUnit = await koq.persistenceUnit;
  /* c8 ignore next 3 */
  if (!persistenceUnit) {
    return undefined;
  }
  const actualPersistenceUnit = persistenceUnit instanceof InvertedUnit ? /* c8 ignore next */ await persistenceUnit.invertsUnit : persistenceUnit;
  const phenomenon = await actualPersistenceUnit?.phenomenon;
  if (phenomenon && formatsMap[phenomenon.name.toUpperCase()]) {
    const defaultPhenomenonFormats = formatsMap[phenomenon.name.toUpperCase()];
    for (const defaultUnitSystemFormat of Array.isArray(defaultPhenomenonFormats)
      ? /* c8 ignore next */ defaultPhenomenonFormats
      : [defaultPhenomenonFormats]) {
      if (defaultUnitSystemFormat.unitSystems.includes(unitSystem)) {
        return defaultUnitSystemFormat.format;
      }
    }
  }
  return undefined;
}
