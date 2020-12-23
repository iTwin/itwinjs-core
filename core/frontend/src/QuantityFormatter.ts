/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

import { BeUiEvent } from "@bentley/bentleyjs-core";
import {
  BadUnit, BasicUnit, Format, FormatProps, FormatterSpec, ParseResult, ParserSpec, QuantityStatus, UnitConversion, UnitProps, UnitsProvider,
} from "@bentley/imodeljs-quantity";
import { IModelApp } from "./IModelApp";

/** Defines standard format types for tools that need to display measurements to user.
 * @beta
 */
export enum QuantityType { Length = 1, Angle = 2, Area = 3, Volume = 4, LatLong = 5, Coordinate = 6, Stationing = 7, LengthSurvey = 8, LengthEngineering = 9 }

/** String used to uniquely identify a Quantity. See `QuantityFormatter.getQuantityTypeKey`.
 * @internal
 */
type QuantityTypeKey = string;

// cSpell:ignore FORMATPROPS FORMATKEY ussurvey uscustomary

// ========================================================================================================================================
// Default Data
// ========================================================================================================================================

// cSpell:ignore MILLIINCH, MICROINCH, MILLIFOOT
// Set of supported units - this information will come from Schema-based units once the EC package is ready to provide this information.
const UNIT_DATA: UnitDefinition[] = [
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
  { name: "Units.IN", unitFamily: "Units.LENGTH", conversion: { numerator: 1.0, denominator: 0.0254, offset: 0.0 }, displayLabel: "in", altDisplayLabels: ["IN", "\""] },
  { name: "Units.FT", unitFamily: "Units.LENGTH", conversion: { numerator: 1.0, denominator: 0.3048, offset: 0.0 }, displayLabel: "ft", altDisplayLabels: ["F", "FT", "'"] },
  { name: "Units.CHAIN", unitFamily: "Units.LENGTH", conversion: { numerator: 1.0, denominator: 66.0 * 0.3048, offset: 0.0 }, displayLabel: "chain", altDisplayLabels: ["CHAIN"] },
  { name: "Units.YRD", unitFamily: "Units.LENGTH", conversion: { numerator: 1.0, denominator: 0.9144, offset: 0.0 }, displayLabel: "yd", altDisplayLabels: ["YRD", "yrd"] },
  { name: "Units.MILE", unitFamily: "Units.LENGTH", conversion: { numerator: 1.0, denominator: 1609.344, offset: 0.0 }, displayLabel: "mi", altDisplayLabels: ["mile", "Miles", "Mile"] },
  { name: "Units.US_SURVEY_FT", unitFamily: "Units.LENGTH", conversion: { numerator: 3937.0, denominator: 1200.0, offset: 0.0 }, displayLabel: "ft (US Survey)", altDisplayLabels: ["ft", "SF", "USF", "ft (US Survey)"] },
  { name: "Units.US_SURVEY_YRD", unitFamily: "Units.LENGTH", conversion: { numerator: 3937.0, denominator: 3.0 * 1200.0, offset: 0.0 }, displayLabel: "yrd (US Survey)", altDisplayLabels: ["USY", "yards (US Survey)"] },
  { name: "Units.US_SURVEY_IN", unitFamily: "Units.LENGTH", conversion: { numerator: 3937.0, denominator: 100.0, offset: 0.0 }, displayLabel: "in (US Survey)", altDisplayLabels: ["USI", "inches (US Survey)"] },
  { name: "Units.US_SURVEY_MILE", unitFamily: "Units.LENGTH", conversion: { numerator: 3937.0, denominator: 5280.0 * 1200.0, offset: 0.0 }, displayLabel: "mi (US Survey)", altDisplayLabels: ["miles (US Survey)", "mile (US Survey)", "USM"] },
  { name: "Units.US_SURVEY_CHAIN", unitFamily: "Units.LENGTH", conversion: { numerator: 1.0, denominator: 20.11684, offset: 0.0 }, displayLabel: "chain (US Survey)", altDisplayLabels: ["chains (US Survey)"] },
  // conversion => specified unit to base unit of m²
  { name: "Units.SQ_FT", unitFamily: "Units.AREA", conversion: { numerator: 1.0, denominator: .09290304, offset: 0.0 }, displayLabel: "ft²", altDisplayLabels: ["sf"] },
  { name: "Units.SQ_US_SURVEY_FT", unitFamily: "Units.AREA", conversion: { numerator: 15499969.0, denominator: 1440000, offset: 0.0 }, displayLabel: "ft² (US Survey)", altDisplayLabels: ["sussf"] },
  { name: "Units.SQ_M", unitFamily: "Units.AREA", conversion: { numerator: 1.0, denominator: 1.0, offset: 0.0 }, displayLabel: "m²", altDisplayLabels: ["sm"] },
  // conversion => specified unit to base unit m³
  { name: "Units.CUB_FT", unitFamily: "Units.VOLUME", conversion: { numerator: 1.0, denominator: 0.028316847, offset: 0.0 }, displayLabel: "ft³", altDisplayLabels: ["cf"] },
  { name: "Units.CUB_US_SURVEY_FT", unitFamily: "Units.VOLUME", conversion: { numerator: 1, denominator: 0.0283170164937591, offset: 0.0 }, displayLabel: "ft³", altDisplayLabels: ["cf"] },
  { name: "Units.CUB_YD", unitFamily: "Units.VOLUME", conversion: { numerator: 1.0, denominator: 0.76455486, offset: 0.0 }, displayLabel: "yd³", altDisplayLabels: ["cy"] },
  { name: "Units.CUB_M", unitFamily: "Units.VOLUME", conversion: { numerator: 1.0, denominator: 1.0, offset: 0.0 }, displayLabel: "m³", altDisplayLabels: ["cm"] },
];

/** Used to uniquely identify a unit system. There should be an entry for each entry in `PresentationUnitSystem` @presentation-common package
 * Note: The exact string values from PresentationUnitSystem are not used because hyphenated names, used in PresentationUnitSystem,
 * cannot be used as object keys.
 * "metric" -> PresentationUnitSystem.Metric ("metric")
 * "imperial" -> PresentationUnitSystem.BritishImperial ("british-imperial")
 * "usCustomary" -> PresentationUnitSystem.UsCustomary ("us-customary")
 * "usSurvey" -> PresentationUnitSystem.UsSurvey ("us-survey")
 * @alpha
 */
export type UnitSystemKey = "metric" | "imperial" | "usCustomary" | "usSurvey";

/** Represents both standard and custom quantity types
 * @alpha
 */
export type QuantityTypeArg = QuantityType | string;

function getQuantityTypeKey(type: QuantityTypeArg): string {
  // For QuantityType enum values, build a string that shouldn't collide with anything a user may come up with
  if (typeof type === "number")
    return `QuantityTypeEnumValue-${type.toString()}`;
  return type;
}

const DEFAULT_FORMATKEY_BY_UNIT_SYSTEM = [
  {
    system: "metric",  // PresentationUnitSystem.Metric,
    entries: [
      { type: getQuantityTypeKey(QuantityType.Length), formatKey: "[units:length]meter4" },
      { type: getQuantityTypeKey(QuantityType.Angle), formatKey: "[units:angle]degree2" },
      { type: getQuantityTypeKey(QuantityType.Area), formatKey: "[units:area]mSquared4" },
      { type: getQuantityTypeKey(QuantityType.Volume), formatKey: "[units:volume]mCubed4" },
      { type: getQuantityTypeKey(QuantityType.LatLong), formatKey: "[units:angle]dms" },
      { type: getQuantityTypeKey(QuantityType.Coordinate), formatKey: "[units:length]meter2" },
      { type: getQuantityTypeKey(QuantityType.Stationing), formatKey: "[units:length]m-sta2" },
      { type: getQuantityTypeKey(QuantityType.LengthSurvey), formatKey: "[units:length]meter4" },
      { type: getQuantityTypeKey(QuantityType.LengthEngineering), formatKey: "[units:length]meter4" },
    ],
  },
  {
    system: "imperial", // PresentationUnitSystem.BritishImperial,
    entries: [
      { type: getQuantityTypeKey(QuantityType.Length), formatKey: "[units:length]fi8" },
      { type: getQuantityTypeKey(QuantityType.Angle), formatKey: "[units:angle]dms2" },
      { type: getQuantityTypeKey(QuantityType.Area), formatKey: "[units:area]fSquared4" },
      { type: getQuantityTypeKey(QuantityType.Volume), formatKey: "[units:volume]fCubed4" },
      { type: getQuantityTypeKey(QuantityType.LatLong), formatKey: "[units:angle]dms" },
      { type: getQuantityTypeKey(QuantityType.Coordinate), formatKey: "[units:length]feet2" },
      { type: getQuantityTypeKey(QuantityType.Stationing), formatKey: "[units:length]f-sta2" },
      { type: getQuantityTypeKey(QuantityType.LengthSurvey), formatKey: "[units:length]f-survey-4-labeled" },
      { type: getQuantityTypeKey(QuantityType.LengthEngineering), formatKey: "[units:length]feet4" },
    ],
  },
  {
    system: "usCustomary",  // PresentationUnitSystem.UsCustomary
    entries: [
      { type: getQuantityTypeKey(QuantityType.Length), formatKey: "[units:length]fi8" },
      { type: getQuantityTypeKey(QuantityType.Angle), formatKey: "[units:angle]dms2" },
      { type: getQuantityTypeKey(QuantityType.Area), formatKey: "[units:area]fSquared4" },
      { type: getQuantityTypeKey(QuantityType.Volume), formatKey: "[units:volume]fCubed4" },
      { type: getQuantityTypeKey(QuantityType.LatLong), formatKey: "[units:angle]dms" },
      { type: getQuantityTypeKey(QuantityType.Coordinate), formatKey: "[units:length]feet2" },
      { type: getQuantityTypeKey(QuantityType.Stationing), formatKey: "[units:length]f-sta2" },
      { type: getQuantityTypeKey(QuantityType.LengthSurvey), formatKey: "[units:length]f-survey-4" },
      { type: getQuantityTypeKey(QuantityType.LengthEngineering), formatKey: "[units:length]feet4" },
    ],
  },
  {
    system: "usSurvey",  // PresentationUnitSystem.UsSurvey
    entries: [
      { type: getQuantityTypeKey(QuantityType.Length), formatKey: "[units:length]f-survey-4" },
      { type: getQuantityTypeKey(QuantityType.Angle), formatKey: "[units:angle]dms2" },
      { type: getQuantityTypeKey(QuantityType.Area), formatKey: "[units:area]usSurveyFtSquared4" },
      { type: getQuantityTypeKey(QuantityType.Volume), formatKey: "[units:volume]usSurveyFtCubed4" },
      { type: getQuantityTypeKey(QuantityType.LatLong), formatKey: "[units:angle]dms" },
      { type: getQuantityTypeKey(QuantityType.Coordinate), formatKey: "[units:length]f-survey-2" },
      { type: getQuantityTypeKey(QuantityType.Stationing), formatKey: "[units:length]f-survey-sta2" },
      { type: getQuantityTypeKey(QuantityType.LengthSurvey), formatKey: "[units:length]f-survey-4" },
      { type: getQuantityTypeKey(QuantityType.LengthEngineering), formatKey: "[units:length]f-survey-4" },
    ],
  },
];

// Temporary interface use to define structure of the unit definitions in this example.
interface UniqueFormatsProps {
  readonly key: string;
  readonly description?: string;
  readonly format: FormatProps;
}

const DEFAULT_FORMATPROPS: UniqueFormatsProps[] = [
  {
    key: "[units:length]meter4",
    description: "meters (labeled) 4 decimal places",
    format: {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [{ label: "m", name: "Units.M" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    },
  },
  {
    key: "[units:length]meter2",
    description: "meters (labeled) 2 decimal places",
    format: {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [{ label: "m", name: "Units.M" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 2,
      type: "Decimal",
    },
  },

  {
    key: "[units:length]feet4",
    description: "feet (labeled) 4 decimal places",
    format: {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [{ label: "ft", name: "Units.FT" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    },
  },
  {
    key: "[units:length]feet2",
    description: "feet (labeled) 2 decimal places",
    format: {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [{ label: "ft", name: "Units.FT" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 2,
      type: "Decimal",
    },
  },
  {
    key: "[units:length]fi8",
    description: "feet-inch 1/8 (labeled)",
    format: {
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
  },
  {
    key: "[units:length]f-sta2",
    description: "stationing feet-2 decimal places ",
    format: {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [{ label: "ft", name: "Units.FT" }],
      },
      formatTraits: ["trailZeroes", "keepSingleZero"],
      stationOffsetSize: 2,
      precision: 2,
      type: "Station",
    },
  },
  {
    key: "[units:length]f-survey-sta2",
    description: "stationing feet-2 decimal places ",
    format: {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [{ label: "ft", name: "Units.US_SURVEY_FT" }],
      },
      formatTraits: ["trailZeroes", "keepSingleZero"],
      stationOffsetSize: 2,
      precision: 2,
      type: "Station",
    },
  },

  {
    key: "[units:length]m-sta2",
    description: "stationing meters-2 decimal places ",
    format: {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [{ label: "m", name: "Units.M" }],
      },
      formatTraits: ["trailZeroes", "keepSingleZero"],
      stationOffsetSize: 3,
      precision: 2,
      type: "Station",
    },
  },
  {
    key: "[units:length]f-survey-2",
    description: "survey feet (labeled)-2 decimal places ",
    format: {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [{ label: "ft", name: "Units.US_SURVEY_FT" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 2,
      type: "Decimal",
    },
  },
  {
    key: "[units:length]f-survey-4-labeled",
    description: "survey feet (labeled)-4 decimal places ",
    format: {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [{ label: "ft (US Survey)", name: "Units.US_SURVEY_FT" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    },
  },

  {
    key: "[units:length]f-survey-4",
    description: "survey feet (labeled)-4 decimal places ",
    format: {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [{ label: "ft", name: "Units.US_SURVEY_FT" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    },
  },
  {
    key: "[units:angle]degree2",
    description: "degrees (labeled) 2 decimal places",
    format: {
      composite: {
        includeZero: true,
        spacer: "",
        units: [{ label: "°", name: "Units.ARC_DEG" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 2,
      type: "Decimal",
      uomSeparator: "",
    },
  },
  {
    key: "[units:angle]dms",
    description: "degrees minutes seconds (labeled) 0 decimal places",
    format: {
      composite: {
        includeZero: true,
        spacer: "",
        units: [{ label: "°", name: "Units.ARC_DEG" }, { label: "'", name: "Units.ARC_MINUTE" }, { label: "\"", name: "Units.ARC_SECOND" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 0,
      type: "Decimal",
      uomSeparator: "",
    },
  },
  {
    key: "[units:angle]dms2",
    description: "degrees minutes seconds (labeled) 2 decimal places",
    format: {
      composite: {
        includeZero: true,
        spacer: "",
        units: [{ label: "°", name: "Units.ARC_DEG" }, { label: "'", name: "Units.ARC_MINUTE" }, { label: "\"", name: "Units.ARC_SECOND" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 2,
      type: "Decimal",
      uomSeparator: "",
    },
  },
  {
    key: "[units:area]mSquared4",
    description: "square meters (labeled) 4 decimal places",
    format: {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [{ label: "m²", name: "Units.SQ_M" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    },
  },
  {
    key: "[units:area]fSquared4",
    description: "square feet (labeled) 4 decimal places",
    format: {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [{ label: "ft²", name: "Units.SQ_FT" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    },
  },
  {
    key: "[units:area]usSurveyFtSquared4",
    description: "square survey feet (labeled) 4 decimal places",
    format: {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [{ label: "ft²", name: "Units.SQ_US_SURVEY_FT" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    },
  },
  {
    key: "[units:volume]mCubed4",
    description: "cubic meters (labeled) 4 decimal places",
    format: {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [{ label: "m³", name: "Units.CUB_M" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    },
  },
  {
    key: "[units:volume]fCubed4",
    description: "cubic feet (labeled) 4 decimal places",
    format: {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [{ label: "ft³", name: "Units.CUB_FT" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    },
  },
  {
    key: "[units:volume]usSurveyFtCubed4",
    description: "cubic survey feet (labeled) 4 decimal places",
    format: {
      composite: {
        includeZero: true,
        spacer: " ",
        units: [{ label: "ft³", name: "Units.CUB_US_SURVEY_FT" }],
      },
      formatTraits: ["keepSingleZero", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
    },
  },
];

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

/** Override format entries must define formats for imperial and metric.
 * @alpha
 */
export interface OverrideFormatEntry {
  imperial?: FormatProps;
  metric?: FormatProps;
  usCustomary?: FormatProps;
  usSurvey?: FormatProps;
}

/** Interface that defines the functions required to be implemented to provide custom formatting and parsing of a custom quantity type.
 * @alpha
 */
export interface FormatterParserSpecsProvider {
  quantityType: QuantityTypeArg;
  createFormatterSpec: (unitSystem: UnitSystemKey) => Promise<FormatterSpec>;
  createParserSpec: (unitSystem: UnitSystemKey) => Promise<ParserSpec>;
}

// ====================================== END OF DEFAULT DATA ======================================

/** Mapping of FormatterSpecs by QuantityType. A FormatterSpec contains unit conversion factors for all composite units to go from the "persistence unit" to the
 * display format without requiring an async unit look up. See method `getPersistenceUnitByQuantityType` for default persistence units.
 * @internal
 */
export type FormatterSpecByQuantityType = Map<QuantityTypeKey, FormatterSpec>;

/** Mapping of FormatterSpecs by QuantityType. A FormatterSpec contains unit conversion factors for all composite units to go from the "persistence unit" to the
 * display format without requiring an async unit look up. See method `getPersistenceUnitByQuantityType` for default persistence units.
 * @internal
 */
export type FormatPropsByUnitSystem = Map<UnitSystemKey, FormatProps>;

/** Arguments sent to FormattingUnitSystemChanged event listeners.
 * @alpha
 */
export interface FormattingUnitSystemChangedArgs {
  // string that defines unit system activated.
  readonly system: UnitSystemKey;
}

/** Arguments sent to QuantityFormatsChanged event listeners.
 * @alpha
 */
export interface QuantityFormatsChangedArgs {
  // string that represents the QuantityType that has been overriden or the overrides cleared.
  readonly quantityType: string;
}

/** Formats quantity values into strings.
 * @alpha
 */
export class QuantityFormatter implements UnitsProvider {
  protected _activeUnitSystem: UnitSystemKey = "imperial";
  protected _formatSpecsByKoq = new Map<string, FormatterSpec[]>();
  protected _activeFormatSpecsByType = new Map<QuantityTypeKey, FormatterSpec>();
  protected _activeParserSpecsByType = new Map<QuantityTypeKey, ParserSpec>();
  protected _overrideFormatPropsByQuantityType = new Map<QuantityTypeKey, OverrideFormatEntry>();
  protected _formatSpecProviders = new Array<FormatterParserSpecsProvider>();

  /** Called after the active unit system is changed.
   * The useImperial argument should not be relied on now that multiple systems are supported. It will
   * only return true if unit system is explicitly set to "imperial"
   * @deprecated use onActiveFormattingUnitSystemChanged event for multiple unit system support.
   */
  public readonly onActiveUnitSystemChanged = new BeUiEvent<{ useImperial: boolean }>();

  /** Called after the active unit system is changed.
  * The system will report the UnitSystemKey/name of the the system that was activated.
  */
  public readonly onActiveFormattingUnitSystemChanged = new BeUiEvent<FormattingUnitSystemChangedArgs>();

  /** Called when the format of a QuantityType is overriden or the override is cleared. The string returned will
   * be a QuantityTypeKey generated by method `getQuantityTypeKey`.
   */
  public readonly onQuantityFormatsChanged = new BeUiEvent<QuantityFormatsChangedArgs>();

  /**
   * constructor
   * @param showMetricOrUnitSystem - Pass in `true` to show Metric formatted quantity values. Defaults to Imperial. To explicitly
   * set it to a specific unit system pass a UnitSystemKey.
   */
  constructor(showMetricOrUnitSystem?: boolean | UnitSystemKey) {
    if (undefined !== showMetricOrUnitSystem) {
      if (typeof showMetricOrUnitSystem === "boolean")
        this._activeUnitSystem = showMetricOrUnitSystem ? "metric" : "imperial";
      else
        this._activeUnitSystem = showMetricOrUnitSystem;
    }
  }

  private getOverrideFormatPropsByQuantityType(quantityType: QuantityTypeKey, systemType: UnitSystemKey): FormatProps | undefined {
    const overrideEntry = this._overrideFormatPropsByQuantityType.get(quantityType);
    if (overrideEntry) {
      const entryForActiveUnitSystem = Object.entries(overrideEntry).find((entry) => this.getUnitSystemFromString(entry[0]) === systemType);
      if (entryForActiveUnitSystem)
        return entryForActiveUnitSystem[1];
    }
    return undefined;
  }

  private async loadSpecs(systemKey: UnitSystemKey, provider: FormatterParserSpecsProvider) {
    const formatterSpec = await provider.createFormatterSpec(systemKey);
    const parserSpec = await provider.createParserSpec(systemKey);
    this._activeFormatSpecsByType.set(this.getQuantityTypeKey(provider.quantityType), formatterSpec);
    this._activeParserSpecsByType.set(this.getQuantityTypeKey(provider.quantityType), parserSpec);
  }

  /** Asynchronous call to load Formatting and ParsingSpecs for a unit system. This method ends up caching FormatterSpecs and ParserSpecs
   *  so they can be quickly accessed.
   * @internal public for unit test usage
   */
  protected async loadFormatAndParsingMapsForSystem(systemType?: UnitSystemKey): Promise<void> {
    const systemKey = (undefined !== systemType) ? systemType : this._activeUnitSystem;
    const formatPropsByType = new Map<QuantityTypeKey, FormatProps>();

    // First get default formats
    const defaultUnitSystemData = DEFAULT_FORMATKEY_BY_UNIT_SYSTEM.find((value) => value.system === systemKey);
    if (defaultUnitSystemData) {
      defaultUnitSystemData.entries.forEach((entry) => {
        const defaultFormatEntry = DEFAULT_FORMATPROPS.find((props) => props.key === entry.formatKey);
        if (defaultFormatEntry) {
          formatPropsByType.set(entry.type, defaultFormatEntry.format);
        } else {
          throw new Error(`Default quantity format named ${entry.formatKey} is not found`);
        }
      });
    } else {
      throw new Error(`Default formatting data for unit system '${systemKey}' was not found`);
    }

    // Override with any registered overrides
    for (const [typeKey, overrideEntry] of this._overrideFormatPropsByQuantityType) {
      const entryForActiveUnitSystem = Object.entries(overrideEntry).find((entry) => entry[0] === systemType);
      if (entryForActiveUnitSystem)
        formatPropsByType.set(typeKey, entryForActiveUnitSystem[1]);
    }

    const formatPropPromises = new Array<Promise<void>>();
    for (const [typeKey, formatProps] of formatPropsByType) {
      formatPropPromises.push(this.loadFormatAndParserSpec(typeKey, formatProps));
    }
    await Promise.all(formatPropPromises);

    const specPromises = new Array<Promise<void>>();
    for (const provider of this._formatSpecProviders) {
      specPromises.push(this.loadSpecs(systemKey, provider));
    }
    await Promise.all(specPromises);
  }

  public async onInitialized() {
    // initialize default format and parsing specs
    await this.loadFormatAndParsingMapsForSystem();
  }

  /** Set the Active unit system to one of the supported types. This will asynchronously load the formatter and parser specs for the activated system. */
  public async setActiveUnitSystem(isImperialOrUnitSystem: UnitSystemKey | boolean, restartActiveTool?: boolean): Promise<void> {
    let systemType: UnitSystemKey;
    if (typeof isImperialOrUnitSystem === "boolean")
      systemType = isImperialOrUnitSystem ? "imperial" : "metric";
    else
      systemType = isImperialOrUnitSystem;

    if (this._activeUnitSystem === systemType)
      return;

    this._activeUnitSystem = systemType;
    await this.loadFormatAndParsingMapsForSystem(systemType);
    // fire deprecated event
    this.onActiveUnitSystemChanged.emit({ useImperial: systemType === "imperial" }); // eslint-disable-line deprecation/deprecation
    // fire current event
    this.onActiveFormattingUnitSystemChanged.emit({ system: systemType });
    if (IModelApp.toolAdmin && restartActiveTool)
      IModelApp.toolAdmin.startDefaultTool();
  }

  /** True if tool quantity values should be displayed in imperial units; false for metric. Changing this flag triggers an asynchronous request to refresh the cached formats. */
  public get activeUnitSystem(): UnitSystemKey { return this._activeUnitSystem; }

  /** @deprecated use setActiveUnitSystem method and activeUnitSystem property */
  public get useImperialFormats(): boolean { return this._activeUnitSystem === "imperial"; }
  public set useImperialFormats(useImperial: boolean) {
    this.setActiveUnitSystem(useImperial ? "imperial" : "metric", true); // eslint-disable-line @typescript-eslint/no-floating-promises
  }

  // ===============================================================================================================
  // Internal Unit Provider implementation
  // ===============================================================================================================
  /** Find a unit given the unitLabel. */
  public async findUnit(unitLabel: string, unitFamily?: string): Promise<UnitProps> {
    for (const entry of UNIT_DATA) {
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
    for (const entry of UNIT_DATA) {
      if (entry.unitFamily !== unitFamily)
        continue;
      units.push(new BasicUnit(entry.name, entry.displayLabel, entry.unitFamily, entry.altDisplayLabels));
    }
    return units;
  }

  protected findUnitDefinition(name: string): UnitDefinition | undefined {
    for (const entry of UNIT_DATA) {
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

  // ===============================================================================================================
  // End of Internal Unit Provider implementation
  // ===============================================================================================================

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

  private async loadFormatAndParserSpec(typeKey: QuantityTypeKey, formatProps: FormatProps) {
    const format = new Format("stdFormat");
    await format.fromJSON(this, formatProps);
    const unit = await this.getPersistenceUnitByQuantityType(typeKey);
    const formatterSpec = await FormatterSpec.create(format.name, format, this, unit);
    const parserSpec = await ParserSpec.create(format, this, unit);
    this._activeFormatSpecsByType.set(typeKey, formatterSpec);
    this._activeParserSpecsByType.set(typeKey, parserSpec);
  }

  private async loadDefaultFormatAndParserSpecForQuantity(typeKey: QuantityTypeKey) {
    // repopulate formatSpec and parserSpec entries
    const defaultFormatsForSystem = DEFAULT_FORMATKEY_BY_UNIT_SYSTEM.find((value) => value.system === this.activeUnitSystem);
    if (defaultFormatsForSystem?.entries) {
      const defaultFormatByType = defaultFormatsForSystem?.entries.find((props) => props.type === typeKey);
      if (defaultFormatByType) {
        const defaultFormatEntry = DEFAULT_FORMATPROPS.find((props) => props.key === defaultFormatByType.formatKey);
        if (defaultFormatEntry?.format) {
          await this.loadFormatAndParserSpec(typeKey, defaultFormatEntry.format);
        }
      }
    }
  }

  /** Method called to clear override and restore defaults formatter and parser spec */
  private async clearOverrideFormatsByQuantityTypeKey(type: QuantityTypeKey) {
    if (this.getOverrideFormatPropsByQuantityType(type, this.activeUnitSystem)) {
      this._overrideFormatPropsByQuantityType.delete(type);
      await this.loadDefaultFormatAndParserSpecForQuantity(type);
      // trigger a message to let callers know the format has changed.
      this.onQuantityFormatsChanged.emit({ quantityType: type });
    }
  }

  public async clearOverrideFormats(type: QuantityType) {
    await this.clearOverrideFormatsByQuantityTypeKey(this.getQuantityTypeKey(type));
  }

  private async setOverrideFormatsByQuantityTypeKey(typeKey: QuantityTypeKey, overrideEntry: OverrideFormatEntry) {
    this._overrideFormatPropsByQuantityType.set(typeKey, overrideEntry);
    const formatProps = this.getOverrideFormatPropsByQuantityType(typeKey, this.activeUnitSystem);
    if (formatProps) {
      await this.loadFormatAndParserSpec(typeKey, formatProps);
      // trigger a message to let callers know the format has changed.
      this.onQuantityFormatsChanged.emit({ quantityType: typeKey });
    }
  }

  public async setOverrideFormats(type: QuantityType, overrideEntry: OverrideFormatEntry) {
    await this.setOverrideFormatsByQuantityTypeKey(this.getQuantityTypeKey(type), overrideEntry);
  }

  public async clearAllOverrideFormats() {
    const promises = new Array<Promise<void>>();
    this._overrideFormatPropsByQuantityType.forEach(async (_value, type) => {
      promises.push(this.clearOverrideFormatsByQuantityTypeKey(type));
    });

    if (promises.length)
      await Promise.all(promises);
  }

  /** Converts a QuantityTypeArg into a QuantityTypeKey/string value. */
  public getQuantityTypeKey(type: QuantityTypeArg): string {
    return getQuantityTypeKey(type);
  }

  /** Async request to get the 'persistence' unit from the UnitsProvider. For a tool this 'persistence' unit is the unit being used by the tool internally. */
  protected async getPersistenceUnitByQuantityType(type: QuantityTypeKey): Promise<UnitProps> {
    if ((this.getQuantityTypeKey(QuantityType.Angle) === type) || (this.getQuantityTypeKey(QuantityType.LatLong) === type))
      return this.findUnitByName("Units.RAD");

    if (this.getQuantityTypeKey(QuantityType.Area) === type)
      return this.findUnitByName("Units.SQ_M");

    if (this.getQuantityTypeKey(QuantityType.Volume) === type)
      return this.findUnitByName("Units.CUB_M");

    // all other default quantity types are persisted/processed in meters
    // QuantityType.Coordinate, QuantityType.Length, QuantityType.Stationing, QuantityType.LengthSurvey, QuantityType.LengthEngineering:
    return this.findUnitByName("Units.M");
  }

  /** Async request to get the 'persistence' unit from the UnitsProvider. For a tool this 'persistence' unit is the unit being used by the tool internally. */
  protected async getUnitByQuantityType(type: QuantityType): Promise<UnitProps> {
    return this.getPersistenceUnitByQuantityType(this.getQuantityTypeKey(type));
  }

  /** Synchronous call to get a FormatterSpec of a QuantityType. If the FormatterSpec is not yet cached an undefined object is returned. The
   * cache is populated by the async call loadFormatSpecsForQuantityTypes.
   */
  public findFormatterSpecByQuantityType(type: QuantityTypeArg, _unused?: boolean): FormatterSpec | undefined {
    return this._activeFormatSpecsByType.get(this.getQuantityTypeKey(type));
  }

  /** Asynchronous Call to get a FormatterSpec of a QuantityType.
   * @param type        One of the built-in quantity types supported.
   * @param isImperial  deprecated argument that should not be used - use setActiveUnitSystem to set unit system.
   * @return A FormatterSpec Promise.
   */
  public async getFormatterSpecByQuantityType(type: QuantityTypeArg, isImperial?: boolean): Promise<FormatterSpec | undefined> {
    let requestedSystem = this.activeUnitSystem;
    if (undefined !== isImperial)
      requestedSystem = isImperial ? "imperial" : "metric";

    if (requestedSystem !== this.activeUnitSystem)
      await this.setActiveUnitSystem(requestedSystem);

    const typeKey = this.getQuantityTypeKey(type);
    return this._activeFormatSpecsByType.get(typeKey);
  }

  /** Synchronous call to get a ParserSpec for a QuantityType. If the ParserSpec is not yet cached an undefined object is returned. The
   * cache is populated by the async call loadFormatSpecsForQuantityTypes.
   */
  public findParserSpecByQuantityType(type: QuantityTypeArg, _unused?: boolean): ParserSpec | undefined {
    return this._activeParserSpecsByType.get(this.getQuantityTypeKey(type));
  }

  /** Asynchronous Call to get a ParserSpec for a QuantityType.
   * @param type        either a default quantity type or one from a registered provider.
   * @param isImperial  deprecated argument that should not be used - use setActiveUnitSystem to set unit system.

   * @return A promise to return a ParserSpec.
   */
  public async getParserSpecByQuantityType(type: QuantityTypeArg, isImperial?: boolean): Promise<ParserSpec | undefined> {
    let requestedSystem = this.activeUnitSystem;
    if (undefined !== isImperial)
      requestedSystem = isImperial ? "imperial" : "metric";

    if (requestedSystem !== this.activeUnitSystem)
      await this.setActiveUnitSystem(requestedSystem);

    const typeKey = this.getQuantityTypeKey(type);
    return this._activeParserSpecsByType.get(typeKey);
  }

  /** Generates a formatted string for a quantity given its format spec.
   * @param magnitude       The magnitude of the quantity.
   * @param formatSpec      The format specification. See methods getFormatterSpecByQuantityType and findFormatterSpecByQuantityType.
   * @return the formatted string.
   */
  public formatQuantity(magnitude: number, formatSpec: FormatterSpec | undefined): string {
    /** Format a quantity value. Default FormatterSpec implementation uses Formatter.formatQuantity. */
    if (formatSpec)
      return formatSpec.applyFormatting(magnitude);
    return magnitude.toString();
  }

  /** Parse input string into quantity given the ParserSpec
   * @param inString       The magnitude of the quantity.
   * @param parserSpec     The parse specification the defines the expected format of the string and the conversion to the output unit.
   * @return ParseResult object containing either the parsed value or an error value if unsuccessful.
   */
  public parseIntoQuantityValue(inString: string, parserSpec: ParserSpec | undefined): ParseResult {
    if (parserSpec)
      return parserSpec.parseIntoQuantityValue(inString);
    return { status: QuantityStatus.UnknownUnit };
  }

  /** Set the flag to return either metric or imperial formats. This call also makes an async request to refresh the cached formats.
   * @deprecated use setActiveUnitSystem;
   */
  public async loadFormatAndParsingMaps(useImperial: boolean, _restartActiveTool?: boolean): Promise<void> {
    await this.loadFormatAndParsingMapsForSystem(useImperial ? "imperial" : "metric");
  }

  /** Get a UnitSystemKey from a string that may have been entered via a key-in. Support different variation of unit system names.
   */
  public getUnitSystemFromString(inputSystem: string, fallback?: UnitSystemKey): UnitSystemKey {
    switch (inputSystem.toLowerCase()) {
      case "metric":
      case "si":
        return "metric";
      case "imperial":
      case "british-imperial":
        return "imperial";
      case "uscustomary":
      case "us-customary":
      case "us":
        return "usCustomary";
      case "ussurvey":
      case "us-survey":
      case "survey":
        return "usSurvey";
      default:
        if (undefined !== fallback)
          return fallback;
        break;
    }
    return "imperial";
  }

  /** Register a FormatterSpec provider. */
  public async registerFormatterParserSpecsProviders(provider: FormatterParserSpecsProvider): Promise<boolean> {
    if (undefined !== this._formatSpecProviders.find((p) => p.quantityType === provider.quantityType))
      return false;

    this._formatSpecProviders.push(provider);
    const providerQuantityType = this.getQuantityTypeKey(provider.quantityType);

    // If the FormatSpec are already loaded for the active unit, add it now.
    if (this._activeFormatSpecsByType.size > 0) {
      const spec = await provider.createFormatterSpec(this.activeUnitSystem);
      this._activeFormatSpecsByType.set(providerQuantityType, spec);
    }

    // If the ParserSpecs are already loaded for the active unit, add it now.
    if (this._activeParserSpecsByType.size > 0) {
      const spec = await provider.createParserSpec(this.activeUnitSystem);
      this._activeParserSpecsByType.set(providerQuantityType, spec);
    }

    return true;
  }

  public hasActiveOverride(type: QuantityTypeArg, checkOnlyActiveUnitSystem?: boolean): boolean {
    const quantityTypeKey = this.getQuantityTypeKey(type);
    const override = this._overrideFormatPropsByQuantityType.get(quantityTypeKey);
    if (override) {
      if (!checkOnlyActiveUnitSystem)
        return true;

      if (this.getOverrideFormatPropsByQuantityType(quantityTypeKey, this.activeUnitSystem))
        return true;
    }

    return false;
  }
}
