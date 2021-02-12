/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** This interface provides basic information about a Unit that is return from a UnitProvider. This info
 * uniquely identifies a unit by its name.
 * @alpha
 */
export interface UnitProps {
  /** Unique name for unit. */
  readonly name: string;
  /** Default label for unit. */
  readonly label: string;
  /** Unique name of unit family, in the ECMetaData world this is equivalent to Phenomenon. Example family names include 'Units.LENGTH', 'Units.AREA', and 'Units.VOLUME' */
  readonly unitFamily: string;
  /** This is set to true if the Unit is known by the UnitsProvider. */
  readonly isValid: boolean;
  /** Optionally defined set of unit labels that can be used to represent the unit. This is helpful when parsing quantity value strings */
  readonly alternateLabels?: string[];
  /** Unique system name. Example "Units.USCUSTOM"," Units.METRIC", "Units.USSURVEY", "Units.IMPERIAL" */
  readonly system: string;
}

/** This interface defines the required properties of a Quantity.
 * @alpha
 */
export interface QuantityProps {
  readonly magnitude: number;
  readonly unit: UnitProps;
  readonly isValid: boolean;
}

/** Interface that defines how to convert between a specific unit an another in synchronous formatting or parsing processing.
 * @alpha
 */
export interface UnitConversionSpec {
  /** Unit name that was used to locate the unit by the Unit Provider */
  name: string;
  /** The default label that is used to display unit */
  label: string;
  /** the information necessary to convert the unit to a specific display unit */
  conversion: UnitConversion;
  /** Labels that may be used to represent the unit in a string that is to be parsed. */
  parseLabels?: string[];
}

/** This interface defines the properties required to convert a quantity value from one unit to another such as from meters to feet
 * or from Celsius to Fahrenheit.
 * @alpha
 */
export interface UnitConversion {
  factor: number;
  offset: number;
}

/** Interface that defines potential parse units that may be found in user's string input of a quantity value.
 * @alpha
 */
export interface PotentialParseUnit {
  unitName: string;
  altLabels?: string[];
}

/** This interface is implemented by the class that is responsible for locating units by name or label and providing conversion values between units.
 * The methods to be implemented are async allowing the UnitsProvider to query the backend when necessary to look up unit definition and conversion rules.
 * @alpha
 */
export interface UnitsProvider {
  findUnit(unitLabel: string, unitFamily?: string): Promise<UnitProps>;
  getUnitsByFamily(unitFamily: string): Promise<UnitProps[]>;
  findUnitByName(unitName: string): Promise<UnitProps>;
  getConversion(fromUnit: UnitProps, toUnit: UnitProps): Promise<UnitConversion>;
}
