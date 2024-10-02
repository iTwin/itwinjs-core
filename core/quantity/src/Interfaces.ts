/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Quantity
 */

/** This interface allows a provider to be specified that will define an array of alternate labels for a specific unit.
 * @beta
 */
export interface AlternateUnitLabelsProvider {
  getAlternateUnitLabels: (unit: UnitProps) => string[] | undefined;
}

/** This interface provides basic information about a Unit that is return from a UnitProvider. This info
 * uniquely identifies a unit by its name.
 * @beta
 */
export interface UnitProps {
  /** Unique name for unit. */
  readonly name: string;
  /** Default label for unit. */
  readonly label: string;
  /** Unique name of unit phenomenon. Example phenomenon names include 'Units.LENGTH', 'Units.AREA', and 'Units.VOLUME' */
  readonly phenomenon: string;
  /** This is set to true if the Unit is known by the UnitsProvider. */
  readonly isValid: boolean;
  /** Unique system name. Example "Units.USCUSTOM"," Units.METRIC", "Units.USSURVEY", "Units.IMPERIAL" */
  readonly system: string;
}

/** This interface defines the required properties of a Quantity.
 * @beta
 */
export interface QuantityProps {
  readonly magnitude: number;
  readonly unit: UnitProps;
  readonly isValid: boolean;
}

/** Interface that defines how to convert between a specific unit an another in synchronous formatting or parsing processing.
 * @beta
 */
export interface UnitConversionSpec {
  /** Unit name that was used to locate the unit by the Unit Provider */
  name: string;
  /** The default label that is used to display unit */
  label: string;
  /** Unit system name, used to when finding preferred parse unit */
  system: string;
  /** the information necessary to convert the unit to a specific display unit */
  conversion: UnitConversionProps;
  /** Labels that may be used to represent the unit in a string that is to be parsed. */
  parseLabels?: string[];
}

/** Indicates the way in which unit values are inverted during conversion
 * @beta
 */
export enum UnitConversionInvert {
  /** Invert value before applying the other conversion steps (the from-unit is the inverted unit) */
  InvertPreConversion = "InvertPreConversion",
  /** Invert value after applying the other conversion steps (the to-unit is the inverted unit) */
  InvertPostConversion = "InvertPostConversion"
}

/** This interface defines the properties required to convert a quantity value from one unit to another such as from meters to feet
 * or from Celsius to Fahrenheit.
 * @beta
 */
export interface UnitConversionProps {
  /** The factor to multiply the input value by to convert to the output value. */
  factor: number;
  /** The offset to add to the input value to convert to the output value. */
  offset: number;
  /** If set, inverts the unit value (1/x) before or after conversion. */
  inversion?: UnitConversionInvert;
}

/** Interface that defines potential parse units that may be found in user's string input of a quantity value.
 * @beta
 */
export interface PotentialParseUnit {
  unitName: string;
  altLabels?: string[];
}

/**
 * This interface defines extra properties to be associated with Units from Units Schema by name
 * @alpha
 */
export interface UnitExtraData {
  readonly name: string;
  readonly altDisplayLabels: string[];
}

/** This interface is implemented by the class that is responsible for locating units by name or label and providing conversion values between units.
 * The methods to be implemented are async allowing the UnitsProvider to query the backend when necessary to look up unit definition and conversion rules.
 * @beta
 */
export interface UnitsProvider {
  findUnit(unitLabel: string, schemaName?: string, phenomenon?: string, unitSystem?: string): Promise<UnitProps>;
  getUnitsByFamily(phenomenon: string): Promise<UnitProps[]>;
  findUnitByName(unitName: string): Promise<UnitProps>;
  getConversion(fromUnit: UnitProps, toUnit: UnitProps): Promise<UnitConversionProps>;
}

/**
 * Used to uniquely identify a unit system.
 * @beta
 */
export type UnitSystemKey = "metric" | "imperial" | "usCustomary" | "usSurvey";
