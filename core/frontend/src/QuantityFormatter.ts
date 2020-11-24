/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

import { BentleyError, BentleyStatus, BeUiEvent } from "@bentley/bentleyjs-core";
import {
  BadUnit, BasicUnit, Format, Formatter, FormatterSpec, Parser, ParseResult, ParserSpec, UnitConversion, UnitProps, UnitsProvider,
} from "@bentley/imodeljs-quantity";
import { IModelApp } from "./IModelApp";

/** Class that implements the minimum UnitConversion interface to provide information needed to convert unit values.
 * @alpha
 */
export class ConversionData implements UnitConversion {
  public factor: number = 1.0;
  public offset: number = 0.0;
}

// interface use to define unit conversions to a base used for a unitFamily
interface ConversionDef {
  numerator: number;
  denominator: number;
  offset: number;
}

// Temporary interface use to define structure of the unit definitions in this example.
interface UnitDefinition {
  readonly name: string;
  readonly unitFamily: string;
  readonly displayLabel: string;
  readonly altDisplayLabels: string[];
  readonly conversion: ConversionDef;
}

// cSpell:ignore MILLIINCH, MICROINCH, MILLIFOOT
// Set of supported units - this information will come from Schema-based units once the EC package is ready to provide this information.
const unitData: UnitDefinition[] = [
  // Angles ( base unit radian )
  { name: "Units.RAD", unitFamily: "Units.ANGLE", conversion: { numerator: 1.0, denominator: 1.0, offset: 0.0 }, displayLabel: "rad", altDisplayLabels: ["radian"] },
  // 1 rad = 180.0/PI °
  { name: "Units.ARC_DEG", unitFamily: "Units.ANGLE", conversion: { numerator: 180.0, denominator: 3.1415926535897932384626433832795, offset: 0.0 }, displayLabel: "°", altDisplayLabels: ["deg", "^"] },
  { name: "Units.ARC_MINUTE", unitFamily: "Units.ANGLE", conversion: { numerator: 10800.0, denominator: 3.14159265358979323846264338327950, offset: 0.0 }, displayLabel: "'", altDisplayLabels: ["min"] },
  { name: "Units.ARC_SECOND", unitFamily: "Units.ANGLE", conversion: { numerator: 648000.0, denominator: 3.1415926535897932384626433832795, offset: 0.0 }, displayLabel: '"', altDisplayLabels: ["sec"] },
  { name: "Units.GRAD", unitFamily: "Units.ANGLE", conversion: { numerator: 200, denominator: 3.1415926535897932384626433832795, offset: 0.0 }, displayLabel: "grad", altDisplayLabels: ["gd"] },
  // Time ( base unit second )
  { name: "Units.S", unitFamily: "Units.TIME", conversion: { numerator: 1.0, denominator: 1.0, offset: 0.0 }, displayLabel: "s", altDisplayLabels: ["sec"] },
  { name: "Units.MIN", unitFamily: "Units.TIME", conversion: { numerator: 1.0, denominator: 60.0, offset: 0.0 }, displayLabel: "min", altDisplayLabels: [] },
  { name: "Units.HR", unitFamily: "Units.TIME", conversion: { numerator: 1.0, denominator: 3600.0, offset: 0.0 }, displayLabel: "h", altDisplayLabels: ["hr"] },
  { name: "Units.DAY", unitFamily: "Units.TIME", conversion: { numerator: 1.0, denominator: 86400.0, offset: 0.0 }, displayLabel: "days", altDisplayLabels: ["day"] },
  { name: "Units.WEEK", unitFamily: "Units.TIME", conversion: { numerator: 1.0, denominator: 604800.0, offset: 0.0 }, displayLabel: "weeks", altDisplayLabels: ["week"] },
  // 1 sec = 1/31536000.0 yr
  { name: "Units.YR", unitFamily: "Units.TIME", conversion: { numerator: 1.0, denominator: 31536000.0, offset: 0.0 }, displayLabel: "years", altDisplayLabels: ["year"] },
  // conversion => specified unit to base unit of m
  { name: "Units.M", unitFamily: "Units.LENGTH", conversion: { numerator: 1.0, denominator: 1.0, offset: 0.0 }, displayLabel: "m", altDisplayLabels: ["meter"] },
  { name: "Units.MM", unitFamily: "Units.LENGTH", conversion: { numerator: 1000.0, denominator: 1.0, offset: 0.0 }, displayLabel: "mm", altDisplayLabels: ["MM"] },
  { name: "Units.CM", unitFamily: "Units.LENGTH", conversion: { numerator: 100.0, denominator: 1.0, offset: 0.0 }, displayLabel: "cm", altDisplayLabels: ["CM"] },
  { name: "Units.DM", unitFamily: "Units.LENGTH", conversion: { numerator: 10.0, denominator: 1.0, offset: 0.0 }, displayLabel: "dm", altDisplayLabels: ["DM"] },
  { name: "Units.KM", unitFamily: "Units.LENGTH", conversion: { numerator: 1.0, denominator: 1000.0, offset: 0.0 }, displayLabel: "km", altDisplayLabels: ["KM"] },
  { name: "Units.UM", unitFamily: "Units.LENGTH", conversion: { numerator: 1000000.0, denominator: 1.0, offset: 0.0 }, displayLabel: "µm", altDisplayLabels: [] },
  { name: "Units.MILLIINCH", unitFamily: "Units.LENGTH", conversion: { numerator: 1000.0, denominator: 0.0254, offset: 0.0 }, displayLabel: "mil", altDisplayLabels: [] },
  { name: "Units.MICROINCH", unitFamily: "Units.LENGTH", conversion: { numerator: 1000000.0, denominator: 0.0254, offset: 0.0 }, displayLabel: "µin", altDisplayLabels: [] },
  { name: "Units.MILLIFOOT", unitFamily: "Units.LENGTH", conversion: { numerator: 1000.0, denominator: 0.3048, offset: 0.0 }, displayLabel: "mft", altDisplayLabels: [] },
  // 1 m = 1/0.0254"
  { name: "Units.IN", unitFamily: "Units.LENGTH", conversion: { numerator: 1.0, denominator: 0.0254, offset: 0.0 }, displayLabel: "in", altDisplayLabels: ["IN", "\""] },
  { name: "Units.FT", unitFamily: "Units.LENGTH", conversion: { numerator: 1.0, denominator: 0.3048, offset: 0.0 }, displayLabel: "ft", altDisplayLabels: ["F", "FT", "'"] },
  { name: "Units.YRD", unitFamily: "Units.LENGTH", conversion: { numerator: 1.0, denominator: 0.9144, offset: 0.0 }, displayLabel: "yd", altDisplayLabels: ["YRD", "yrd"] },
  { name: "Units.MILE", unitFamily: "Units.LENGTH", conversion: { numerator: 1.0, denominator: 1609.344, offset: 0.0 }, displayLabel: "mi", altDisplayLabels: ["mile", "Miles", "Mile"] },
  { name: "Units.SURVEY_FT", unitFamily: "Units.LENGTH", conversion: { numerator: 1.0, denominator: 0.3048006096, offset: 0.0 }, displayLabel: "ft", altDisplayLabels: ["F", "FT", "'"] },
  // conversion => specified unit base unit of m²
  { name: "Units.SQ_FT", unitFamily: "Units.AREA", conversion: { numerator: 1.0, denominator: .09290304, offset: 0.0 }, displayLabel: "ft²", altDisplayLabels: ["sf"] },
  { name: "Units.SQ_M", unitFamily: "Units.AREA", conversion: { numerator: 1.0, denominator: 1.0, offset: 0.0 }, displayLabel: "m²", altDisplayLabels: ["sm"] },
  // conversion => specified unit to base unit m³
  { name: "Units.CUB_FT", unitFamily: "Units.VOLUME", conversion: { numerator: 1.0, denominator: 0.028316847, offset: 0.0 }, displayLabel: "ft³", altDisplayLabels: ["cf"] },
  { name: "Units.CUB_YD", unitFamily: "Units.VOLUME", conversion: { numerator: 1.0, denominator: 0.76455486, offset: 0.0 }, displayLabel: "yd³", altDisplayLabels: ["cy"] },
  { name: "Units.CUB_M", unitFamily: "Units.VOLUME", conversion: { numerator: 1.0, denominator: 1.0, offset: 0.0 }, displayLabel: "m³", altDisplayLabels: ["cm"] },
];

/** Defines standard format types for tools that need to display measurements to user.
 * @beta
 */
export enum QuantityType { Length = 1, Angle = 2, Area = 3, Volume = 4, LatLong = 5, Coordinate = 6, Stationing = 7, LengthSurvey = 8, LengthEngineering = 9 }

// The following provide default formats for different the QuantityTypes. It is important to note that these default should reference
// units that are available from the registered units provider.
const defaultsFormats = {
  metric: [{
    type: 1 /* Length */, format: {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [
          {
            label: "m",
            name: "Units.M",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    },
  }, {
    type: 2 /* Angle */, format: {
      composite: {
        includeZero: true,
        spacer: "",
        units: [
          {
            label: "°",
            name: "Units.ARC_DEG",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 2,
      type: "Decimal",
      uomSeparator: "",
    },
  }, {
    type: 3 /* Area */, format: {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [
          {
            label: "m²",
            name: "Units.SQ_M",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    },
  }, {
    type: 4 /* Volume */, format: {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [
          {
            label: "m³",
            name: "Units.CUB_M",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    },
  }, {
    type: 5 /* LatLong */, format: {
      composite: {
        includeZero: true,
        spacer: "",
        units: [
          {
            label: "°",
            name: "Units.ARC_DEG",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 6,
      type: "Decimal",
      uomSeparator: "",
    },
  }, {
    type: 6 /* Coordinate */, format: {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [
          {
            label: "m",
            name: "Units.M",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 2,
      type: "Decimal",
    },
  }, {
    type: 7 /* Stationing */, format: {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [
          {
            label: "m",
            name: "Units.M",
          },
        ],
      },
      formatTraits: ["trailZeroes", "keepSingleZero"],
      stationOffsetSize: 3,
      precision: 2,
      type: "Station",
    },
  }, {
    type: 8 /* LengthSurvey */, format: {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [
          {
            label: "m",
            name: "Units.M",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    },
  }, {
    type: 9 /* LengthEngineering */, format: {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [
          {
            label: "m",
            name: "Units.M",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    },
  },
  ],
  imperial: [{
    type: 1 /* Length */, format: {
      composite: {
        includeZero: true,
        spacer: "-",
        units: [{ label: "'", name: "Units.FT" }, { label: "\"", name: "Units.IN" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 8,
      type: "Fractional",
      uomSeparator: "",
    },
  }, {
    type: 2 /* Angle */, format: {
      composite: {
        includeZero: true,
        spacer: "",
        units: [
          {
            label: "°",
            name: "Units.ARC_DEG",
          },
          {
            label: "'",
            name: "Units.ARC_MINUTE",
          },
          {
            label: "\"",
            name: "Units.ARC_SECOND",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 2,
      type: "Decimal",
      uomSeparator: "",
    },
  }, {
    type: 3 /* Area */, format: {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [
          {
            label: "ft²",
            name: "Units.SQ_FT",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    },
  }, {
    type: 4 /* Volume */, format: {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [
          {
            label: "ft³",
            name: "Units.CUB_FT",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    },
  }, {
    type: 5 /* LatLong */, format: {
      composite: {
        includeZero: true,
        spacer: "",
        units: [
          {
            label: "°",
            name: "Units.ARC_DEG",
          },
          {
            label: "'",
            name: "Units.ARC_MINUTE",
          },
          {
            label: "\"",
            name: "Units.ARC_SECOND",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 0,
      type: "Decimal",
      uomSeparator: "",
    },
  }, {
    type: 6 /* Coordinate */, format: {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [
          {
            label: "ft",
            name: "Units.FT",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 2,
      type: "Decimal",
    },
  }, {
    type: 7 /* Stationing */, format: {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [
          {
            label: "ft",
            name: "Units.FT",
          },
        ],
      },
      formatTraits: ["trailZeroes", "keepSingleZero"],
      stationOffsetSize: 2,
      precision: 2,
      type: "Station",
    },
  }, {
    type: 8 /* LengthSurvey */, format: {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [
          {
            label: "ft",
            name: "Units.SURVEY_FT",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    },
  }, {
    type: 9 /* LengthEngineering */, format: {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [
          {
            label: "ft",
            name: "Units.FT",
          },
        ],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    },
  },
  ],
};

/** Formats quantity values into strings.
 * @alpha
 */
export class QuantityFormatter implements UnitsProvider {
  protected _activeSystemIsImperial = true;
  protected _formatSpecsByKoq = new Map<string, FormatterSpec[]>();
  protected _imperialFormatsByType = new Map<QuantityType, Format>();
  protected _metricFormatsByType = new Map<QuantityType, Format>();
  protected _imperialFormatSpecsByType = new Map<QuantityType, FormatterSpec>();
  protected _metricFormatSpecsByType = new Map<QuantityType, FormatterSpec>();
  protected _imperialParserSpecsByType = new Map<QuantityType, ParserSpec>();
  protected _metricUnitParserSpecsByType = new Map<QuantityType, ParserSpec>();

  /**
   * constructor
   * @param showMetricValues - Pass in `true` to show Metric formatted quantity values. Defaults to Imperial. This setting can be changed at
   *                           runtime using `IModelApp.quantityFormatter.useImperialFormats`.
   */
  constructor(showMetricValues?: boolean) {
    this._activeSystemIsImperial = !showMetricValues;
  }

  /** Called after the active unit system is changed.
   */
  public readonly onActiveUnitSystemChanged = new BeUiEvent<{ useImperial: boolean }>();

  public onInitialized() {
    // initialize default format and parsing specs
    this.loadFormatAndParsingMaps(this._activeSystemIsImperial); // eslint-disable-line @typescript-eslint/no-floating-promises
  }

  /** Find a unit given the unitLabel. */
  public async findUnit(unitLabel: string, unitFamily?: string): Promise<UnitProps> {
    for (const entry of unitData) {
      if (unitFamily) {
        if (entry.unitFamily !== unitFamily)
          continue;
      }
      if (entry.displayLabel === unitLabel || entry.name === unitLabel) {
        const unitProps = new BasicUnit(entry.name, entry.displayLabel, entry.unitFamily, entry.altDisplayLabels);
        return unitProps;
      }

      if (entry.altDisplayLabels && entry.altDisplayLabels.length > 0) {
        if (entry.altDisplayLabels.findIndex((ref) => ref === unitLabel) !== -1) {
          const unitProps = new BasicUnit(entry.name, entry.displayLabel, entry.unitFamily, entry.altDisplayLabels);
          return unitProps;
        }
      }
    }

    return new BadUnit();
  }

  /** find all units given unitFamily */
  public async getUnitsByFamily(unitFamily: string): Promise<UnitProps[]> {
    const units: UnitProps[] = [];
    for (const entry of unitData) {
      if (entry.unitFamily !== unitFamily)
        continue;
      units.push(new BasicUnit(entry.name, entry.displayLabel, entry.unitFamily, entry.altDisplayLabels));
    }
    return units;
  }

  protected findUnitDefinition(name: string): UnitDefinition | undefined {
    for (const entry of unitData) {
      if (entry.name === name)
        return entry;
    }

    return undefined;
  }

  /** Find a unit given the unit's unique name. */
  public async findUnitByName(unitName: string): Promise<UnitProps> {
    const unitDataEntry = this.findUnitDefinition(unitName);
    if (unitDataEntry) {
      return new BasicUnit(unitDataEntry.name, unitDataEntry.displayLabel, unitDataEntry.unitFamily, unitDataEntry.altDisplayLabels);
    }
    return new BadUnit();
  }

  /** Return the information needed to convert a value between two different units.  The units should be from the same unitFamily. */
  public async getConversion(fromUnit: UnitProps, toUnit: UnitProps): Promise<UnitConversion> {
    const fromUnitData = this.findUnitDefinition(fromUnit.name);
    const toUnitData = this.findUnitDefinition(toUnit.name);

    if (fromUnitData && toUnitData) {
      const deltaOffset = toUnitData.conversion.offset - fromUnitData.conversion.offset;
      const deltaNumerator = toUnitData.conversion.numerator * fromUnitData.conversion.denominator;
      const deltaDenominator = toUnitData.conversion.denominator * fromUnitData.conversion.numerator;

      const conversion = new ConversionData();
      conversion.factor = deltaNumerator / deltaDenominator;
      conversion.offset = deltaOffset;
      return conversion;
    }

    return new ConversionData();
  }

  /** method used to load format for KOQ into cache */
  protected async loadKoqFormatSpecs(koq: string): Promise<void> {
    if (koq.length === 0)
      throw new Error("bad koq specification");

    if (!this._formatSpecsByKoq.has(koq)) {
      // get koq and get formats from it
    }

    throw new Error("not yet implemented");
  }

  /** Async method to return the array of presentation formats for the specified KOQ */
  protected async getKoqFormatterSpecsAsync(koq: string, useImperial: boolean): Promise<FormatterSpec[] | undefined> {
    if (koq.length === 0 && useImperial)
      throw new Error("bad koq specification");

    return this._formatSpecsByKoq.get(koq);
  }

  /** Async method to return the 'active' FormatSpec for the specified KOQ */
  protected async getKoqFormatterSpec(koq: string, useImperial: boolean): Promise<FormatterSpec | undefined> {
    if (koq.length === 0 && useImperial)
      throw new Error("bad koq specification");

    const formatterSpecArray = await Promise.resolve(this._formatSpecsByKoq.get(koq));
    if (formatterSpecArray && formatterSpecArray.length > 0) {
      const activeFormatIndex = 0; // TODO - get active format based on user selected format or default format
      return formatterSpecArray[activeFormatIndex];
    }

    throw new Error("not yet implemented");
  }

  /** Method used to get cached FormatterSpec or undefined if FormatterSpec is unavailable */
  protected findKoqFormatterSpec(koq: string, useImperial: boolean): FormatterSpec | undefined {
    if (koq.length === 0 && useImperial)
      return undefined;

    throw new Error("not yet implemented");
  }

  protected async loadStdFormat(type: QuantityType, imperial: boolean): Promise<Format> {
    let formatData: any;

    const formatArray = imperial ? defaultsFormats.imperial : defaultsFormats.metric;
    for (const entry of formatArray) {
      if (entry.type === type as number) {
        formatData = entry.format;
        const format = new Format("stdFormat");
        await format.fromJson(this, formatData);
        return format;
      }
    }
    throw new BentleyError(BentleyStatus.ERROR, "IModelApp must define a formatsProvider class to provide formats for tools");
  }

  protected async getFormatByQuantityType(type: QuantityType, imperial: boolean): Promise<Format> {
    const activeMap = imperial ? this._imperialFormatsByType : this._metricFormatsByType;

    let format = activeMap.get(type);
    if (format)
      return format;

    format = await this.loadStdFormat(type, imperial);
    if (format) {
      activeMap.set(type, format);
      return format;
    }

    throw new BentleyError(BentleyStatus.ERROR, "IModelApp must define a formatsProvider class to provide formats for tools");
  }

  /** Async request to get the 'persistence' unit from the UnitsProvider. For a tool this 'persistence' unit is the unit being used by the tool internally. */
  protected async getUnitByQuantityType(type: QuantityType): Promise<UnitProps> {
    switch (type) {
      case QuantityType.Angle:
      case QuantityType.LatLong:
        return this.findUnitByName("Units.RAD");
      case QuantityType.Area:
        return this.findUnitByName("Units.SQ_M");
      case QuantityType.Volume:
        return this.findUnitByName("Units.CUB_M");
      case QuantityType.Coordinate:
      case QuantityType.Length:
      case QuantityType.Stationing:
      case QuantityType.LengthSurvey:
      case QuantityType.LengthEngineering:
      default:
        return this.findUnitByName("Units.M");
    }
  }

  /** Asynchronous call to loadParsingSpecsForQuantityTypes. This method caches all the ParserSpecs so they can be quickly accessed. */
  protected async loadParsingSpecsForQuantityTypes(useImperial: boolean): Promise<void> {
    const typeArray: QuantityType[] = [QuantityType.Length, QuantityType.Angle, QuantityType.Area, QuantityType.Volume, QuantityType.LatLong, QuantityType.Coordinate, QuantityType.Stationing, QuantityType.LengthSurvey, QuantityType.LengthEngineering];
    const activeMap = useImperial ? this._imperialParserSpecsByType : this._metricUnitParserSpecsByType;
    activeMap.clear();

    for (const quantityType of typeArray) {
      const formatPromise = this.getFormatByQuantityType(quantityType, useImperial);
      const unitPromise = this.getUnitByQuantityType(quantityType);
      const [format, outUnit] = await Promise.all([formatPromise, unitPromise]);
      const parserSpec = await ParserSpec.create(format, this, outUnit);
      activeMap.set(quantityType, parserSpec);
    }
  }

  /** Asynchronous call to loadFormatSpecsForQuantityTypes. This method caches all the FormatSpec so they can be quickly accessed. */
  protected async loadFormatSpecsForQuantityTypes(useImperial: boolean): Promise<void> {
    const typeArray: QuantityType[] = [QuantityType.Length, QuantityType.Angle, QuantityType.Area, QuantityType.Volume, QuantityType.LatLong, QuantityType.Coordinate, QuantityType.Stationing, QuantityType.LengthSurvey, QuantityType.LengthEngineering];
    const activeMap = useImperial ? this._imperialFormatSpecsByType : this._metricFormatSpecsByType;
    activeMap.clear();

    for (const quantityType of typeArray) {
      const formatPromise = this.getFormatByQuantityType(quantityType, useImperial);
      const unitPromise = this.getUnitByQuantityType(quantityType);
      const [format, unit] = await Promise.all([formatPromise, unitPromise]);
      const spec = await FormatterSpec.create(format.name, format, this, unit);
      activeMap.set(quantityType, spec);
    }
  }

  /** Synchronous call to get a FormatterSpec of a QuantityType. If the FormatterSpec is not yet cached an undefined object is returned. The
   * cache is populated by the async call loadFormatSpecsForQuantityTypes.
   */
  public findFormatterSpecByQuantityType(type: QuantityType, imperial?: boolean): FormatterSpec | undefined {
    const useImperial = undefined !== imperial ? imperial : this._activeSystemIsImperial;
    const activeMap = useImperial ? this._imperialFormatSpecsByType : this._metricFormatSpecsByType;
    if (activeMap.size === 0) {
      // trigger a load so it will become available
      this.loadFormatSpecsForQuantityTypes(useImperial); // eslint-disable-line @typescript-eslint/no-floating-promises
      return undefined;
    }

    return activeMap.get(type);
  }

  /** Asynchronous Call to get a FormatterSpec of a QuantityType.
   * @param type        One of the built-in quantity types supported.
   * @param imperial    Optional parameter to determine if the imperial or metric format should be returned. If undefined then the setting is taken from the formatter.
   * @return A promise to return a FormatterSpec.
   */
  public async getFormatterSpecByQuantityType(type: QuantityType, imperial?: boolean): Promise<FormatterSpec> {
    const useImperial = undefined !== imperial ? imperial : this._activeSystemIsImperial;
    const activeMap = useImperial ? this._imperialFormatSpecsByType : this._metricFormatSpecsByType;
    if (activeMap.size > 0)
      return activeMap.get(type) as FormatterSpec;

    await this.loadFormatSpecsForQuantityTypes(useImperial);
    if (activeMap.size > 0) {
      const spec = activeMap.get(type);
      if (spec)
        return spec;
    }
    throw new BentleyError(BentleyStatus.ERROR, "Unable to load FormatSpecs");
  }

  /** Synchronous call to get a ParserSpec for a QuantityType. If the ParserSpec is not yet cached an undefined object is returned. The
   * cache is populated by the async call loadFormatSpecsForQuantityTypes.
   */
  public findParserSpecByQuantityType(type: QuantityType, imperial?: boolean): ParserSpec | undefined {
    const useImperial = undefined !== imperial ? imperial : this._activeSystemIsImperial;
    const activeMap = useImperial ? this._imperialParserSpecsByType : this._metricUnitParserSpecsByType;
    if (activeMap.size === 0) {
      // trigger a load so it will become available
      this.loadParsingSpecsForQuantityTypes(useImperial); // eslint-disable-line @typescript-eslint/no-floating-promises
      return undefined;
    }
    return activeMap.get(type);
  }

  /** Asynchronous Call to get a ParserSpec for a QuantityType.
   * @param type        One of the built-in quantity types supported.
   * @param imperial    Optional parameter to determine if the imperial or metric format should be returned. If undefined then the setting is taken from the formatter.
   * @return A promise to return a ParserSpec.
   */
  public async getParserSpecByQuantityType(type: QuantityType, imperial?: boolean): Promise<ParserSpec> {
    const useImperial = undefined !== imperial ? imperial : this._activeSystemIsImperial;
    const activeMap = useImperial ? this._imperialParserSpecsByType : this._metricUnitParserSpecsByType;
    if (activeMap.size > 0)
      return activeMap.get(type) as ParserSpec;

    await this.loadParsingSpecsForQuantityTypes(useImperial);
    if (activeMap.size > 0) {
      const spec = activeMap.get(type);
      if (spec)
        return spec;
    }
    throw new BentleyError(BentleyStatus.ERROR, "Unable to load ParserSpec");
  }

  /** Generates a formatted string for a quantity given its format spec.
   * @param magnitude       The magnitude of the quantity.
   * @param formatSpec      The format specification. See methods getFormatterSpecByQuantityType and findFormatterSpecByQuantityType.
   * @return the formatted string.
   */
  public formatQuantity(magnitude: number, formatSpec: FormatterSpec): string {
    return Formatter.formatQuantity(magnitude, formatSpec);
  }

  /** Parse input string into quantity given the ParserSpec
   * @param inString       The magnitude of the quantity.
   * @param parserSpec     The parse specification the defines the expected format of the string and the conversion to the output unit.
   * @return ParseResult object containing either the parsed value or an error value if unsuccessful.
   */
  public parseIntoQuantityValue(inString: string, parserSpec: ParserSpec): ParseResult {
    return Parser.parseQuantityString(inString, parserSpec);
  }

  /** Set the flag to return either metric or imperial formats. This call also makes an async request to refresh the cached formats. */
  public async loadFormatAndParsingMaps(useImperial: boolean): Promise<void> {
    const formatPromise = this.loadFormatSpecsForQuantityTypes(useImperial);
    const parsePromise = this.loadParsingSpecsForQuantityTypes(useImperial);
    await Promise.all([formatPromise, parsePromise]);
    this._activeSystemIsImperial = useImperial;
    this.onActiveUnitSystemChanged.emit({ useImperial });
    if (IModelApp.toolAdmin)
      IModelApp.toolAdmin.startDefaultTool();
  }

  /** True if tool quantity values should be displayed in imperial units; false for metric. Changing this flag triggers an asynchronous request to refresh the cached formats. */
  public get useImperialFormats(): boolean { return this._activeSystemIsImperial; }
  public set useImperialFormats(useImperial: boolean) {
    if (this._activeSystemIsImperial === useImperial)
      return;

    this.loadFormatAndParsingMaps(useImperial); // eslint-disable-line @typescript-eslint/no-floating-promises
  }
}
