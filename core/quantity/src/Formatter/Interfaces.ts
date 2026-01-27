/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Quantity
 */

import { BeEvent } from "@itwin/core-bentley";
import { UnitProps } from "../Interfaces";
import { DecimalPrecision, FormatTraits, FormatType, FractionalPrecision } from "./FormatEnums";

/** Defines a unit specification with a name and optional label override.
 * Used in composite formats and ratio unit specifications.
 * @beta
 */
export interface FormatUnitSpec {
  /** The name of the unit (e.g., "Units.FT", "Units.IN") */
  readonly name: string;
  /** Optional custom label that overrides the unit's default label (e.g., '"' for inches, "'" for feet) */
  readonly label?: string;
}

/** A resolved [[FormatUnitSpec]] with the unit name replaced with the resolved UnitProps.
 * @beta
 */
export interface ResolvedFormatUnitSpec {
  /** The resolved unit */
  readonly unit: UnitProps;
  /** Optional custom label that overrides the unit's default label */
  readonly label?: string;
}

/** Defines the units that make up a composite format and their display properties.
 * A composite format allows displaying a single quantity value across multiple units,
 * such as displaying length as "5 feet 6 inches" or angle as "45° 30' 15"".
 * @beta
 */
export interface FormatCompositeProps {
  /** Separator character between unit values when formatting composite strings. Must be empty or single character. */
  readonly spacer?: string;
  /** Whether to include unit segments with zero magnitude in the formatted output. */
  readonly includeZero?: boolean;
  /** Array of units this format is comprised of. Each unit specifies the unit name and
   * an optional custom label that will override the unit's default label when displaying values. */
  readonly units: FormatUnitSpec[];
}

/** This interface defines the persistence format for describing the formatting of quantity values.
 * @beta
 */
export interface FormatProps {
  /** The format type. See [[FormatType]] */
  readonly type: string;

  /** The precision for the format. Must be an integer. See [[DecimalPrecision]] and [[FractionalPrecision]] */
  readonly precision?: number;

  /** Value is rounded to a multiple of this factor if nonzero and the `applyRounding` trait is set. */
  readonly roundFactor?: number;

  /** Minimum width of the formatted output including digits and separators. Must be a positive integer (≥ 0). */
  readonly minWidth?: number;

  /** How and when positive and negative signs are displayed. See [[ShowSignOption]] */
  readonly showSignOption?: string;

  /** Array of format traits controlling display behavior. See [[FormatTraits]] */
  readonly formatTraits?: string | string[];

  /** Character separating integer from fractional part. Must be empty or single character. */
  readonly decimalSeparator?: string;

  /** Character separating thousands in the integer part. Must be empty or single character. */
  readonly thousandSeparator?: string;

  /** Character separating the magnitude from the unit label. Must be empty or single character. */
  readonly uomSeparator?: string;

  /** Required when type is Scientific. See [[ScientificType]] */
  readonly scientificType?: string;

  /** Required when type is Ratio. See [[RatioType]]*/
  readonly ratioType?: string;
  /** The separator character for ratio formatting. Defaults to ':' if not specified. */
  readonly ratioSeparator?: string;
   /** The format type for the numbers within a ratio. Defaults to "Decimal". */
  readonly ratioFormatType?: string;

  /** Required when type is Station. Number of decimal places for calculating station offset magnitude. Must be a positive integer > 0. */
  readonly stationOffsetSize?: number;

  /** Character separating station and offset portions of a Station formatted value. Must be empty or single character. */
  readonly stationSeparator?: string;

  /** Optional base factor for station formatting. A positive integer, defaults to 1. */
  readonly stationBaseFactor?: number;

  /** The base value for azimuth, specified from east counter-clockwise. */
  readonly azimuthBase?: number;

  /** The name of the unit for the azimuth base value. Required if azimuthBase is set. */
  readonly azimuthBaseUnit?: string;

  /** If set to true, azimuth values are returned counter-clockwise from the base. */
  readonly azimuthCounterClockwise?: boolean;

  /** The name of the unit that represents a revolution/perigon. Required for bearing or azimuth types. */
  readonly revolutionUnit?: string;

  /** Enables calculating mathematic operations during parsing, only addition and subtraction are supported. */
  readonly allowMathematicOperations?: boolean;

  /** Composite format specification for multi-unit display. */
  readonly composite?: FormatCompositeProps;
}

/** This interface is used when supporting Custom Formatters that need more than the standard set of properties.
 * @beta
 */
export interface CustomFormatProps extends FormatProps {
  readonly custom: any;
}

/** CustomFormatProps type guard.
 * @beta
 */
export const isCustomFormatProps = (item: FormatProps): item is CustomFormatProps => {
  return (item as CustomFormatProps).custom !== undefined;
};

/** A [[FormatCompositeProps]] with unit names replaced with JSON representations of those units.
 * @beta
 */
export type ResolvedFormatCompositeProps = Omit<FormatCompositeProps, "units"> & {
  readonly units: ResolvedFormatUnitSpec[];
};

/** A [[FormatProps]] with all the references to units replaced with JSON representations of those units.
 * @beta
 */
export type ResolvedFormatProps = Omit<FormatDefinition, "azimuthBaseUnit" | "revolutionUnit" | "composite"> & {
  readonly azimuthBaseUnit?: UnitProps;
  readonly revolutionUnit?: UnitProps;
  readonly composite?: ResolvedFormatCompositeProps;
  readonly custom?: any;
};

/** CloneFormat defines unit and label specification if primary unit is to be set during clone.
 * @beta
 */
export interface CloneUnit {
  unit?: UnitProps;
  label?: string;
}

/** CloneOptions that define modifications that can be made during the cloning of a Format.
 * @beta
 */
export interface CloneOptions {
  /** allows composite formats to be converted to only show primary unit */
  showOnlyPrimaryUnit?: boolean;
  /** allow format traits to be set */
  traits?: FormatTraits;
  /** allows new FormatType to be specified */
  type?: FormatType;
  /** allows precision to be set, this will throw if value is not valid for FormatType */
  precision?: DecimalPrecision | FractionalPrecision;
  /** allows primary unit and label to be specified */
  primaryUnit?: CloneUnit;
}

/** An extension of FormatProps to help identify formats.
 * @beta
 */
export interface FormatDefinition extends FormatProps {
  readonly name?: string;
  readonly label?: string;
  readonly description?: string;
}

/** Argument for [[FormatsProvider.onFormatsChanged]]
 * @beta
 */
export interface FormatsChangedArgs {
  /**
   * If `all` - all formats within the `FormatsProvider` have changed.
   * If array, the array items list the names of formats that were changed or removed.
   */
  formatsChanged: "all" | string[];
}

/** This interface is implemented by a class that would provide formats for use in formatting quantities.
 * @beta
 */
export interface FormatsProvider {
  /**
   * @param name The full name of the Format or KindOfQuantity.
   */
  getFormat(name: string): Promise<FormatDefinition | undefined>;

  /**
   * Fired when formats are added, removed, or changed.
   * If all formats are changed, a single string "all" is emitted. Else, an array of changed format names is emitted.
   */
  onFormatsChanged: BeEvent<(args: FormatsChangedArgs) => void>;
}

/** This interface is implemented by a class that would provide and allow creating formats for use in formatting quantities.
 * @beta
 */
export interface MutableFormatsProvider extends FormatsProvider {
  /**
   * Adds a new format or updates an existing format associated with the specified name.
   */
  addFormat(name: string, format: FormatDefinition): Promise<void>;
  /**
   * Removes the format associated with the specified name.
   * @param name The name of the format to remove.
   */
  removeFormat(name: string): Promise<void>;
}
