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

// cSpell:ignore FORMATPROPS FORMATKEY ussurvey uscustomary

/** String used to uniquely identify a Quantity. See function `getQuantityTypeKey`.
 * @beta
 */
export type QuantityTypeKey = string;

/** Defines standard format types for tools that need to display measurements to user. Kept only to provide compatibility for existing API.
 * @beta
 */
export enum QuantityType { Length = 1, Angle = 2, Area = 3, Volume = 4, LatLong = 5, Coordinate = 6, Stationing = 7, LengthSurvey = 8, LengthEngineering = 9 }

/** Type the can be used to uniquely identify a Quantity Type.
 * @beta
 */
export type QuantityTypeArg = QuantityType | string;

/** Function to return a QuantityTypeKey given either a QuantityType or a string */
export function getQuantityTypeKey(type: QuantityTypeArg): string {
  // For QuantityType enum values, build a string that shouldn't collide with anything a user may come up with
  if (typeof type === "number")
    return `QuantityTypeEnumValue-${type.toString()}`;
  return type;
}

export interface QuantityTypeEntry {
  readonly key: QuantityTypeKey;
  readonly type: QuantityTypeArg;
  readonly persistenceUnit: UnitProps;
  label?: string;
  labelKey?: string;
  description?: string;
  descriptionKey?: string;
}

export interface CustomQuantityTypeEntry extends QuantityTypeEntry {
  // to be implemented by custom Quantity Types
  generateFormatterSpec: (formatProps: FormatProps, unitsProvider: UnitsProvider) => Promise<FormatterSpec>;
  // to be implemented by custom Quantity Types
  generateParserSpec: (formatProps: FormatProps, unitsProvider: UnitsProvider) => Promise<ParserSpec>;
  // to be implemented by custom Quantity Types
  getFormatPropsBySystem: (requestedSystem: UnitSystemKey) => FormatProps;
}

/** CustomQuantityTypeEntry type guard. */
export function isCustomQuantityTypeEntry(item: QuantityTypeEntry): item is CustomQuantityTypeEntry {
  return !!(item as CustomQuantityTypeEntry).generateFormatterSpec;
}

// ========================================================================================================================================
// Default Data
// ========================================================================================================================================

// cSpell:ignore MILLIINCH, MICROINCH, MILLIFOOT
// Set of supported units - this information will come from Schema-based units once the EC package is ready to provide this information.
const UNIT_DATA: UnitDefinition[] = [
  // Angles ( base unit radian )
  { name: "Units.RAD", unitFamily: "Units.ANGLE", system: "Units.SI", conversion: { numerator: 1.0, denominator: 1.0, offset: 0.0 }, displayLabel: "rad", altDisplayLabels: ["radian"] },
  // 1 rad = 180.0/PI °
  { name: "Units.ARC_DEG", unitFamily: "Units.ANGLE", system: "Units.METRIC", conversion: { numerator: 180.0, denominator: 3.1415926535897932384626433832795, offset: 0.0 }, displayLabel: "°", altDisplayLabels: ["deg", "^"] },
  { name: "Units.ARC_MINUTE", unitFamily: "Units.ANGLE", system: "Units.METRIC", conversion: { numerator: 10800.0, denominator: 3.14159265358979323846264338327950, offset: 0.0 }, displayLabel: "'", altDisplayLabels: ["min"] },
  { name: "Units.ARC_SECOND", unitFamily: "Units.ANGLE", system: "Units.METRIC", conversion: { numerator: 648000.0, denominator: 3.1415926535897932384626433832795, offset: 0.0 }, displayLabel: '"', altDisplayLabels: ["sec"] },
  { name: "Units.GRAD", unitFamily: "Units.ANGLE", system: "Units.METRIC", conversion: { numerator: 200, denominator: 3.1415926535897932384626433832795, offset: 0.0 }, displayLabel: "grad", altDisplayLabels: ["gd"] },
  // Time ( base unit second )
  { name: "Units.S", unitFamily: "Units.TIME", system: "Units.SI", conversion: { numerator: 1.0, denominator: 1.0, offset: 0.0 }, displayLabel: "s", altDisplayLabels: ["sec"] },
  { name: "Units.MIN", unitFamily: "Units.TIME", system: "Units.INTERNATIONAL", conversion: { numerator: 1.0, denominator: 60.0, offset: 0.0 }, displayLabel: "min", altDisplayLabels: [] },
  { name: "Units.HR", unitFamily: "Units.TIME", system: "Units.INTERNATIONAL", conversion: { numerator: 1.0, denominator: 3600.0, offset: 0.0 }, displayLabel: "h", altDisplayLabels: ["hr"] },
  { name: "Units.DAY", unitFamily: "Units.TIME", system: "Units.INTERNATIONAL", conversion: { numerator: 1.0, denominator: 86400.0, offset: 0.0 }, displayLabel: "days", altDisplayLabels: ["day"] },
  { name: "Units.WEEK", unitFamily: "Units.TIME", system: "Units.INTERNATIONAL", conversion: { numerator: 1.0, denominator: 604800.0, offset: 0.0 }, displayLabel: "weeks", altDisplayLabels: ["week"] },
  // 1 sec = 1/31536000.0 yr
  { name: "Units.YR", unitFamily: "Units.TIME", system: "Units.INTERNATIONAL", conversion: { numerator: 1.0, denominator: 31536000.0, offset: 0.0 }, displayLabel: "years", altDisplayLabels: ["year"] },
  // conversion => specified unit to base unit of m
  { name: "Units.M", unitFamily: "Units.LENGTH", system: "Units.SI", conversion: { numerator: 1.0, denominator: 1.0, offset: 0.0 }, displayLabel: "m", altDisplayLabels: ["meter"] },
  { name: "Units.MM", unitFamily: "Units.LENGTH", system: "Units.INTERNATIONAL", conversion: { numerator: 1000.0, denominator: 1.0, offset: 0.0 }, displayLabel: "mm", altDisplayLabels: ["MM"] },
  { name: "Units.CM", unitFamily: "Units.LENGTH", system: "Units.INTERNATIONAL", conversion: { numerator: 100.0, denominator: 1.0, offset: 0.0 }, displayLabel: "cm", altDisplayLabels: ["CM"] },
  { name: "Units.DM", unitFamily: "Units.LENGTH", system: "Units.INTERNATIONAL", conversion: { numerator: 10.0, denominator: 1.0, offset: 0.0 }, displayLabel: "dm", altDisplayLabels: ["DM"] },
  { name: "Units.KM", unitFamily: "Units.LENGTH", system: "Units.INTERNATIONAL", conversion: { numerator: 1.0, denominator: 1000.0, offset: 0.0 }, displayLabel: "km", altDisplayLabels: ["KM"] },
  { name: "Units.UM", unitFamily: "Units.LENGTH", system: "Units.INTERNATIONAL", conversion: { numerator: 1000000.0, denominator: 1.0, offset: 0.0 }, displayLabel: "µm", altDisplayLabels: [] },
  { name: "Units.MILLIINCH", unitFamily: "Units.LENGTH", system: "Units.USCUSTOM", conversion: { numerator: 1000.0, denominator: 0.0254, offset: 0.0 }, displayLabel: "mil", altDisplayLabels: [] },
  { name: "Units.MICROINCH", unitFamily: "Units.LENGTH", system: "Units.USCUSTOM", conversion: { numerator: 1000000.0, denominator: 0.0254, offset: 0.0 }, displayLabel: "µin", altDisplayLabels: [] },
  { name: "Units.MILLIFOOT", unitFamily: "Units.LENGTH", system: "Units.USCUSTOM", conversion: { numerator: 1000.0, denominator: 0.3048, offset: 0.0 }, displayLabel: "mft", altDisplayLabels: [] },
  { name: "Units.IN", unitFamily: "Units.LENGTH", system: "Units.USCUSTOM", conversion: { numerator: 1.0, denominator: 0.0254, offset: 0.0 }, displayLabel: "in", altDisplayLabels: ["IN", "\""] },
  { name: "Units.FT", unitFamily: "Units.LENGTH", system: "Units.USCUSTOM", conversion: { numerator: 1.0, denominator: 0.3048, offset: 0.0 }, displayLabel: "ft", altDisplayLabels: ["F", "FT", "'"] },
  { name: "Units.CHAIN", unitFamily: "Units.LENGTH", system: "Units.USCUSTOM", conversion: { numerator: 1.0, denominator: 66.0 * 0.3048, offset: 0.0 }, displayLabel: "chain", altDisplayLabels: ["CHAIN"] },
  { name: "Units.YRD", unitFamily: "Units.LENGTH", system: "Units.USCUSTOM", conversion: { numerator: 1.0, denominator: 0.9144, offset: 0.0 }, displayLabel: "yd", altDisplayLabels: ["YRD", "yrd"] },
  { name: "Units.MILE", unitFamily: "Units.LENGTH", system: "Units.USCUSTOM", conversion: { numerator: 1.0, denominator: 1609.344, offset: 0.0 }, displayLabel: "mi", altDisplayLabels: ["mile", "Miles", "Mile"] },
  { name: "Units.US_SURVEY_FT", unitFamily: "Units.LENGTH", system: "Units.USSURVEY", conversion: { numerator: 3937.0, denominator: 1200.0, offset: 0.0 }, displayLabel: "ft (US Survey)", altDisplayLabels: ["ft", "SF", "USF", "ft (US Survey)"] },
  { name: "Units.US_SURVEY_YRD", unitFamily: "Units.LENGTH", system: "Units.USSURVEY", conversion: { numerator: 3937.0, denominator: 3.0 * 1200.0, offset: 0.0 }, displayLabel: "yrd (US Survey)", altDisplayLabels: ["USY", "yards (US Survey)"] },
  { name: "Units.US_SURVEY_IN", unitFamily: "Units.LENGTH", system: "Units.USSURVEY", conversion: { numerator: 3937.0, denominator: 100.0, offset: 0.0 }, displayLabel: "in (US Survey)", altDisplayLabels: ["USI", "inches (US Survey)"] },
  { name: "Units.US_SURVEY_MILE", unitFamily: "Units.LENGTH", system: "Units.USSURVEY", conversion: { numerator: 3937.0, denominator: 5280.0 * 1200.0, offset: 0.0 }, displayLabel: "mi (US Survey)", altDisplayLabels: ["miles (US Survey)", "mile (US Survey)", "USM"] },
  { name: "Units.US_SURVEY_CHAIN", unitFamily: "Units.LENGTH", system: "Units.USSURVEY", conversion: { numerator: 1.0, denominator: 20.11684, offset: 0.0 }, displayLabel: "chain (US Survey)", altDisplayLabels: ["chains (US Survey)"] },
  // conversion => specified unit to base unit of m²
  { name: "Units.SQ_FT", unitFamily: "Units.AREA", system: "Units.USCUSTOM", conversion: { numerator: 1.0, denominator: .09290304, offset: 0.0 }, displayLabel: "ft²", altDisplayLabels: ["sf"] },
  { name: "Units.SQ_US_SURVEY_FT", unitFamily: "Units.AREA", system: "Units.USCUSTOM", conversion: { numerator: 15499969.0, denominator: 1440000, offset: 0.0 }, displayLabel: "ft² (US Survey)", altDisplayLabels: ["sussf"] },
  { name: "Units.SQ_M", unitFamily: "Units.AREA", system: "Units.SI", conversion: { numerator: 1.0, denominator: 1.0, offset: 0.0 }, displayLabel: "m²", altDisplayLabels: ["sm"] },
  // conversion => specified unit to base unit m³
  { name: "Units.CUB_FT", unitFamily: "Units.VOLUME", system: "Units.USCUSTOM", conversion: { numerator: 1.0, denominator: 0.028316847, offset: 0.0 }, displayLabel: "ft³", altDisplayLabels: ["cf"] },
  { name: "Units.CUB_US_SURVEY_FT", unitFamily: "Units.VOLUME", system: "Units.USSURVEY", conversion: { numerator: 1, denominator: 0.0283170164937591, offset: 0.0 }, displayLabel: "ft³", altDisplayLabels: ["cf"] },
  { name: "Units.CUB_YD", unitFamily: "Units.VOLUME", system: "Units.USCUSTOM", conversion: { numerator: 1.0, denominator: 0.76455486, offset: 0.0 }, displayLabel: "yd³", altDisplayLabels: ["cy"] },
  { name: "Units.CUB_M", unitFamily: "Units.VOLUME", system: "Units.SI", conversion: { numerator: 1.0, denominator: 1.0, offset: 0.0 }, displayLabel: "m³", altDisplayLabels: ["cm"] },
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
        spacer: "",
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
        spacer: "",
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
        spacer: "",
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
        spacer: "",
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
        spacer: "",
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
        spacer: "",
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
        spacer: "",
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
        spacer: "",
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
        spacer: "",
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
        spacer: "",
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
        spacer: "",
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
        spacer: "",
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
        spacer: "",
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
        spacer: "",
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
        spacer: "",
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
        spacer: "",
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
 */export class ConversionData implements UnitConversion {
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
  readonly system: string;
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
  protected _quantityTypeRegistry: Map<QuantityTypeKey, QuantityTypeEntry> = new Map<QuantityTypeKey, QuantityTypeEntry>();
  protected _activeUnitSystem: UnitSystemKey = "imperial";
  protected _formatSpecsByKoq = new Map<string, FormatterSpec[]>();
  protected _activeFormatSpecsByType = new Map<QuantityTypeKey, FormatterSpec>();
  protected _activeParserSpecsByType = new Map<QuantityTypeKey, ParserSpec>();
  protected _overrideFormatPropsByUnitSystem = new Map<UnitSystemKey, Map<QuantityTypeKey, FormatProps>>();

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

  private getOverrideFormatPropsByQuantityType(quantityTypeKey: QuantityTypeKey, unitSystem?: UnitSystemKey): FormatProps | undefined {
    const requestedUnitSystem = unitSystem??this.activeUnitSystem;
    const overrideMap = this._overrideFormatPropsByUnitSystem.get(requestedUnitSystem);
    if (!overrideMap)
      return undefined;

    return overrideMap.get(quantityTypeKey);
  }

  private async loadSpecs(systemKey: UnitSystemKey, provider: FormatterParserSpecsProvider) {
    const formatterSpec = await provider.createFormatterSpec(systemKey);
    const parserSpec = await provider.createParserSpec(systemKey);
    this._activeFormatSpecsByType.set(this.getQuantityTypeKey(provider.quantityType), formatterSpec);
    this._activeParserSpecsByType.set(this.getQuantityTypeKey(provider.quantityType), parserSpec);
  }

  public get quantityTypesRegistry() {
    return this._quantityTypeRegistry;
  }

  public async registerQuantityType(entry: CustomQuantityTypeEntry) {
    if (this._quantityTypeRegistry.has(entry.key))
      return false;

    this._quantityTypeRegistry.set(entry.key, entry);
    if (entry.getFormatPropsBySystem) {
      const formatProps = entry.getFormatPropsBySystem(this.activeUnitSystem);
      await this.loadFormatAndParserSpec(entry, formatProps);
      return true;
    }
    return false;
  }

  protected async initializeQuantityTypesRegistry() {
    // QuantityType.Length
    const lengthUnit = await this.findUnitByName("Units.M");
    let key = this.getQuantityTypeKey(QuantityType.Length);
    this._quantityTypeRegistry.set(key, {
      key,
      type: QuantityType.Length,
      labelKey: "iModelJs:QuantityType.Length.label",
      descriptionKey: "iModelJs:QuantityType.Length.description",
      persistenceUnit: lengthUnit,
    });

    // QuantityType.LengthEngineering
    key = this.getQuantityTypeKey(QuantityType.LengthEngineering);
    this._quantityTypeRegistry.set(key, {
      key,
      type: QuantityType.LengthEngineering,
      labelKey: "iModelJs:QuantityType.LengthEngineering.label",
      descriptionKey: "iModelJs:QuantityType.LengthEngineering.description",
      persistenceUnit: lengthUnit,
    });

    // QuantityType.Coordinate
    key = this.getQuantityTypeKey(QuantityType.Coordinate);
    this._quantityTypeRegistry.set(key, {
      key,
      type: QuantityType.Coordinate,
      labelKey: "iModelJs:QuantityType.Coordinate.label",
      descriptionKey: "iModelJs:QuantityType.Coordinate.description",
      persistenceUnit: lengthUnit,
    });

    // QuantityType.Stationing
    key = this.getQuantityTypeKey(QuantityType.Stationing);
    this._quantityTypeRegistry.set(key, {
      key,
      type: QuantityType.Stationing,
      labelKey: "iModelJs:QuantityType.Stationing.label",
      descriptionKey: "iModelJs:QuantityType.Stationing.description",
      persistenceUnit: lengthUnit,
    });

    // QuantityType.LengthSurvey
    key = this.getQuantityTypeKey(QuantityType.LengthSurvey);
    this._quantityTypeRegistry.set(key, {
      key,
      type: QuantityType.LengthSurvey,
      labelKey: "iModelJs:QuantityType.LengthSurvey.label",
      descriptionKey: "iModelJs:QuantityType.LengthSurvey.description",
      persistenceUnit: lengthUnit,
    });

    // QuantityType.Angle
    const radUnit = await this.findUnitByName("Units.RAD");
    key = this.getQuantityTypeKey(QuantityType.Angle);
    this._quantityTypeRegistry.set(key, {
      key,
      type: QuantityType.Angle,
      labelKey: "iModelJs:QuantityType.Angle.label",
      descriptionKey: "iModelJs:QuantityType.Angle.description",
      persistenceUnit: radUnit,
    });

    // QuantityType.LatLong
    key = this.getQuantityTypeKey(QuantityType.LatLong);
    this._quantityTypeRegistry.set(key, {
      key,
      type: QuantityType.LatLong,
      labelKey: "iModelJs:QuantityType.LatLong.label",
      descriptionKey: "iModelJs:QuantityType.LatLong.description",
      persistenceUnit: radUnit,
    });

    // QuantityType.Area
    const sqMetersUnit = await this.findUnitByName("Units.SQ_M");
    key = this.getQuantityTypeKey(QuantityType.Area);
    this._quantityTypeRegistry.set(key, {
      key,
      type: QuantityType.Area,
      labelKey: "iModelJs:QuantityType.Area.label",
      descriptionKey: "iModelJs:QuantityType.Area.description",
      persistenceUnit: sqMetersUnit,
    });

    // QuantityType.Volume
    const cubicMetersUnit = await this.findUnitByName("Units.CUB_M");
    key = this.getQuantityTypeKey(QuantityType.Volume);
    this._quantityTypeRegistry.set(key, {
      key,
      type: QuantityType.Volume,
      labelKey: "iModelJs:QuantityType.Volume.label",
      descriptionKey: "iModelJs:QuantityType.Volume.description",
      persistenceUnit: cubicMetersUnit,
    });
  }

  /** Asynchronous call to load Formatting and ParsingSpecs for a unit system. This method ends up caching FormatterSpecs and ParserSpecs
   *  so they can be quickly accessed.
   * @internal public for unit test usage
   */
  protected async loadFormatAndParsingMapsForSystem(systemType?: UnitSystemKey, ignoreOverrides?: boolean): Promise<void> {
    const systemKey = (undefined !== systemType) ? systemType : this._activeUnitSystem;
    const formatPropsByType = new Map<QuantityTypeEntry, FormatProps>();

    // load cache for every registered QuantityType
    [...IModelApp.quantityFormatter.quantityTypesRegistry.keys()].forEach((key) => {
      const entry = this.quantityTypesRegistry.get(key)!;
      formatPropsByType.set(entry, this.getFormatPropsByQuantityTypeEntyAndSystem(entry, systemKey, ignoreOverrides));
    });

    const formatPropPromises = new Array<Promise<void>>();
    for (const [entry, formatProps] of formatPropsByType) {
      formatPropPromises.push(this.loadFormatAndParserSpec(entry, formatProps));
    }
    await Promise.all(formatPropPromises);
  }

  public async onInitialized() {
    await this.initializeQuantityTypesRegistry();

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
        const unitProps = new BasicUnit(entry.name, entry.displayLabel, entry.unitFamily, entry.altDisplayLabels, entry.system);
        return unitProps;
      }

      if (entry.altDisplayLabels && entry.altDisplayLabels.length > 0) {
        if (entry.altDisplayLabels.findIndex((ref) => ref === unitLabel) !== -1) {
          const unitProps = new BasicUnit(entry.name, entry.displayLabel, entry.unitFamily, entry.altDisplayLabels, entry.system);
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
      units.push(new BasicUnit(entry.name, entry.displayLabel, entry.unitFamily, entry.altDisplayLabels, entry.system));
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
      return new BasicUnit(unitDataEntry.name, unitDataEntry.displayLabel, unitDataEntry.unitFamily, unitDataEntry.altDisplayLabels, unitDataEntry.system);
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

  private async loadFormatAndParserSpec(quantityTypeEntry: QuantityTypeEntry, formatProps: FormatProps) {
    const formatterSpec = await this.generateFormatterSpec(quantityTypeEntry, formatProps);
    const parserSpec = await this.generateParserSpec(quantityTypeEntry, formatProps);
    this._activeFormatSpecsByType.set(quantityTypeEntry.key, formatterSpec);
    this._activeParserSpecsByType.set(quantityTypeEntry.key, parserSpec);
  }

  // repopulate formatSpec and parserSpec entries using only default format
  private async loadDefaultFormatAndParserSpecForQuantity(typeKey: QuantityTypeKey) {
    const quantityTypeEntry = this.quantityTypesRegistry.get(typeKey);
    if (!quantityTypeEntry)
      throw new Error (`Unable to locate QuantityType by key ${typeKey}`);

    const defaultFormat = this.getFormatPropsByQuantityTypeEntyAndSystem(quantityTypeEntry, this.activeUnitSystem, true);
    await this.loadFormatAndParserSpec(quantityTypeEntry, defaultFormat);
  }

  /** Method called to clear override and restore defaults formatter and parser spec */
  private async clearOverrideFormatsByQuantityTypeKey(type: QuantityTypeKey) {
    const unitSystem = this.activeUnitSystem;
    if (this.getOverrideFormatPropsByQuantityType(type, unitSystem)) {
      const overrideMap = this._overrideFormatPropsByUnitSystem.get(unitSystem);
      if (overrideMap && overrideMap.has(type)) {
        overrideMap.delete(type);

        await this.loadDefaultFormatAndParserSpecForQuantity(type);
        // trigger a message to let callers know the format has changed.
        this.onQuantityFormatsChanged.emit({ quantityType: type });
      }
    }
  }

  public async clearOverrideFormats(type: QuantityTypeArg) {
    await this.clearOverrideFormatsByQuantityTypeKey(this.getQuantityTypeKey(type));
  }

  private async setOverrideFormatsByQuantityTypeKey(typeKey: QuantityTypeKey, overrideEntry: OverrideFormatEntry) {
    // extract overrides and insert into appropriate override map entry
    Object.keys(overrideEntry).forEach ((systemKey) => {
      const unitSystemKey = systemKey as UnitSystemKey;
      const props = overrideEntry[unitSystemKey];
      if (props) {
        if (this._overrideFormatPropsByUnitSystem.has(unitSystemKey)) {
          this._overrideFormatPropsByUnitSystem.get(unitSystemKey)!.set(typeKey, props);
        } else {
          const newMap = new Map<string, FormatProps>();
          newMap.set(typeKey, props);
          this._overrideFormatPropsByUnitSystem.set(unitSystemKey, newMap);
        }
      }
    });

    const formatProps = this.getOverrideFormatPropsByQuantityType(typeKey, this.activeUnitSystem);
    if (formatProps) {
      const typeEntry = this.quantityTypesRegistry.get (typeKey);
      if (typeEntry) {
        await this.loadFormatAndParserSpec(typeEntry, formatProps);
        // trigger a message to let callers know the format has changed.
        this.onQuantityFormatsChanged.emit({ quantityType: typeKey });
      }
    }
  }

  public async setOverrideFormats(type: QuantityTypeArg, overrideEntry: OverrideFormatEntry) {
    await this.setOverrideFormatsByQuantityTypeKey(this.getQuantityTypeKey(type), overrideEntry);
  }

  // TODO: make more generic to support "named" systems.
  public async setOverrideFormat(type: QuantityTypeArg, overrideFormat: FormatProps) {
    const typeKey = this.getQuantityTypeKey(type);
    let overrideEntry: OverrideFormatEntry = {};
    if (this.activeUnitSystem === "imperial")
      overrideEntry = { imperial: overrideFormat };
    else if (this.activeUnitSystem === "metric")
      overrideEntry = { metric: overrideFormat };
    else if (this.activeUnitSystem === "usCustomary")
      overrideEntry = { usCustomary: overrideFormat };
    else
      overrideEntry = { usSurvey: overrideFormat };

    await this.setOverrideFormatsByQuantityTypeKey(typeKey, overrideEntry);
  }

  public async clearAllOverrideFormats() {
    if (0 === this._overrideFormatPropsByUnitSystem.size)
      return;

    if (this._overrideFormatPropsByUnitSystem.has(this.activeUnitSystem)) {
      const overrides = this._overrideFormatPropsByUnitSystem.get(this.activeUnitSystem);
      const typesRemoved: string[] = [];
      if (overrides && overrides.size) {
        overrides.forEach((_props, typeKey) => typesRemoved.push(typeKey));
      }

      if (typesRemoved.length) {
        const promises = new Array<Promise<void>>();
        typesRemoved.forEach((typeRemoved)=> promises.push(this.loadDefaultFormatAndParserSpecForQuantity(typeRemoved)));
        await Promise.all(promises);
        // trigger a message to let callers know the format has changed.
        this.onQuantityFormatsChanged.emit({ quantityType: typesRemoved.join("|") });
      }
    }
  }

  /** Converts a QuantityTypeArg into a QuantityTypeKey/string value. */
  public getQuantityTypeKey(type: QuantityTypeArg): string {
    return getQuantityTypeKey(type);
  }

  /** Get the 'persistence' unit from the UnitsProvider. For a tool this 'persistence' unit is the unit being used by the tool internally. */
  protected async getPersistenceUnitByQuantityType(type: QuantityTypeKey) {
    if (this.quantityTypesRegistry.has(type)) {
      const entry = this.quantityTypesRegistry.get(type);
      if (entry)
        return entry.persistenceUnit;
    }
    throw new Error(`Cannot find quantityType with key ${type} in QuantityTypesRegistry`);
  }

  /** get the 'persistence' unit from the UnitsProvider. For a tool this 'persistence' unit is the unit being used by the tool internally. */
  protected  async getUnitByQuantityType(type: QuantityTypeArg) {
    return this.getPersistenceUnitByQuantityType(this.getQuantityTypeKey(type));
  }

  /** Synchronous call to get a FormatterSpec of a QuantityType. If the FormatterSpec is not yet cached an undefined object is returned. The
   * cache is populated by the async call loadFormatAndParsingMapsForSystem.
   */
  public findFormatterSpecByQuantityType(type: QuantityTypeArg, _unused?: boolean): FormatterSpec | undefined {
    return this._activeFormatSpecsByType.get(this.getQuantityTypeKey(type));
  }

  public async generateFormatterSpec(quantityEntry: QuantityTypeEntry, formatProps: FormatProps) {
    if (isCustomQuantityTypeEntry(quantityEntry))
      return quantityEntry.generateFormatterSpec (formatProps, this as UnitsProvider);

    const format = await Format.createFromJSON(quantityEntry.key, this, formatProps);
    return FormatterSpec.create(format.name, format, this as UnitsProvider, quantityEntry.persistenceUnit);
  }

  public async generateFormatterSpecByType(type: QuantityTypeArg, formatProps: FormatProps) {
    const quantityTypeEntry = this.quantityTypesRegistry.get(this.getQuantityTypeKey(type));
    if (quantityTypeEntry)
      return this.generateFormatterSpec(quantityTypeEntry, formatProps);

    throw new Error(`Unable to generate FormatSpec for QuantityType ${type}`);
  }

  protected async generateParserSpec(quantityEntry: QuantityTypeEntry, formatProps: FormatProps) {
    const unitsProvider = this as UnitsProvider;
    if (isCustomQuantityTypeEntry(quantityEntry))
      return quantityEntry.generateParserSpec (formatProps, unitsProvider);

    const format = await Format.createFromJSON(quantityEntry.key, this, formatProps);
    return ParserSpec.create(format, unitsProvider, quantityEntry.persistenceUnit);
  }

  /** Asynchronous Call to get a FormatterSpec of a QuantityType.
   * @param type        One of the built-in quantity types supported.
   * @param system  deprecated argument that should not be used - use setActiveUnitSystem to set unit system.
   * @return A FormatterSpec Promise.
   */
  protected async getFormatterSpecByQuantityTypeEntryAndSystem(quantityTypeEntry: QuantityTypeEntry, system?: UnitSystemKey): Promise<FormatterSpec | undefined> {
    const requestedSystem = system ?? this.activeUnitSystem;
    const formatProps = this.getFormatPropsByQuantityTypeEntyAndSystem (quantityTypeEntry, requestedSystem);
    return this.generateFormatterSpec (quantityTypeEntry, formatProps);
  }

  /** Asynchronous Call to get a FormatterSpec of a QuantityType.
   * @param type        One of the built-in quantity types supported.
   * @param system  deprecated argument that should not be used - use setActiveUnitSystem to set unit system.
   * @return A FormatterSpec Promise.
   */
  public async getFormatterSpecByQuantityTypeAndSystem(type: QuantityTypeArg, system?: UnitSystemKey): Promise<FormatterSpec | undefined> {
    const quantityKey = this.getQuantityTypeKey(type);
    const requestedSystem = system ?? this.activeUnitSystem;

    if (requestedSystem === this.activeUnitSystem) {
      const formatterSpec = this._activeFormatSpecsByType.get(quantityKey);
      if (formatterSpec)
        return formatterSpec;
    }

    const entry = this.quantityTypesRegistry.get(quantityKey);
    if (!entry)
      throw new Error (`Unable to find registered quantity type with key ${quantityKey}`);
    return this.getFormatterSpecByQuantityTypeEntryAndSystem(entry, requestedSystem);
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

    return this.getFormatterSpecByQuantityTypeAndSystem (type, requestedSystem);
  }

  /** Synchronous call to get a ParserSpec for a QuantityType. If the ParserSpec is not yet cached an undefined object is returned. The
   * cache is populated by the async call loadFormatAndParsingMapsForSystem.
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
  public parseToQuantityValue(inString: string, parserSpec: ParserSpec | undefined): ParseResult {
    if (parserSpec)
      return parserSpec.parseToQuantityValue(inString);
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

  public hasActiveOverride(type: QuantityTypeArg, checkOnlyActiveUnitSystem?: boolean): boolean {
    const quantityTypeKey = this.getQuantityTypeKey(type);

    if (checkOnlyActiveUnitSystem){
      const overrides = this._overrideFormatPropsByUnitSystem.get(this.activeUnitSystem);
      if (overrides && overrides.has(quantityTypeKey))
        return true;
      return false;
    }

    for (const [_key, overrideMap] of this._overrideFormatPropsByUnitSystem) {
      if (overrideMap.has(quantityTypeKey))
        return true;
    }
    return false;
  }

  public getQuantityLabel(entry: QuantityTypeEntry): string {
    if (entry.label)
      return entry.label;
    if (entry.labelKey) {
      const label = IModelApp.i18n.translate(entry.labelKey);
      entry.label = label;
      return entry.label;
    }
    return entry.key;
  }

  public getQuantityDescription(entry: QuantityTypeEntry): string {
    if (entry.description)
      return entry.description;
    if (entry.descriptionKey) {
      const description = IModelApp.i18n.translate(entry.descriptionKey);
      entry.description = description;
      return entry.description;
    }
    return this.getQuantityLabel(entry);
  }

  protected getFormatPropsByQuantityTypeEntyAndSystem(quantityEntry: QuantityTypeEntry, requestedSystem: UnitSystemKey, ignoreOverrides?: boolean): FormatProps {
    const fallbackProps: FormatProps = {
      formatTraits: ["keepSingleZero", "applyRounding", "showUnitLabel"],
      precision: 4,
      type: "Decimal",
      uomSeparator: " ",
      decimalSeparator: ".",
    };

    if (!ignoreOverrides) {
      const overrideProps = this.getOverrideFormatPropsByQuantityType (quantityEntry.key, requestedSystem);
      if (overrideProps)
        return overrideProps;
    }

    if (isCustomQuantityTypeEntry(quantityEntry))
      return quantityEntry.getFormatPropsBySystem(requestedSystem);

    const defaultUnitSystemData = DEFAULT_FORMATKEY_BY_UNIT_SYSTEM.find((value) => value.system === requestedSystem);
    if (defaultUnitSystemData) {
      const defaultFormatEntry = defaultUnitSystemData.entries.find ((value) => value.type === quantityEntry.key);
      if (defaultFormatEntry) {
        const defaultFormatPropsEntry = DEFAULT_FORMATPROPS.find((props) => props.key === defaultFormatEntry.formatKey);
        if (defaultFormatPropsEntry)
          return defaultFormatPropsEntry.format;
      }
    }
    return fallbackProps;
  }

  public getFormatPropsByQuantityType(quantityType: QuantityTypeArg, requestedSystem?: UnitSystemKey, ignoreOverrides?: boolean) {
    const quantityEntry=this.quantityTypesRegistry.get (this.getQuantityTypeKey(quantityType));
    if (quantityEntry)
      return this.getFormatPropsByQuantityTypeEntyAndSystem(quantityEntry,requestedSystem ?? this.activeUnitSystem, ignoreOverrides);
    return undefined;
  }

}
