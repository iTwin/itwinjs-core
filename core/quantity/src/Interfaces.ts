/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
/** This interface provides basic information about a Unit that is return from a UnitProvider. This info
 * uniquely identifies a unit by its name.
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
}

/** This interface defines the required properties of a Quantity.
 */
export interface QuantityProps {
  readonly magnitude: number;
  readonly unit: UnitProps;
  readonly isValid: boolean;
}

/** This interface defines the properties required to convert a quantity value from one unit to another such as from meters to feet
 * or from Celsius to Fahrenheit.
 */
export interface UnitConversion {
  factor: number;
  offset: number;
}

/** This abstract class must be implemented and passed into methods that require locating a Unit by name or label or require converting values between units.
 * The methods to be implemented are async allowing the UnitsProvider to query the backend when necessary to look up unit definition and conversion rules.
 */
export abstract class UnitsProvider {
  public abstract findUnit(unitLabel: string, unitFamily?: string): Promise<UnitProps>;
  public abstract findUnitByName(unitName: string): Promise<UnitProps>;
  public abstract getConversion(fromUnit: UnitProps, toUnit: UnitProps): Promise<UnitConversion>;
}

/** This class is a convenience class that can be returned when a valid Unit cannot be determined.
 */
export class BadUnit implements UnitProps {
  public name = "";
  public label = "";
  public unitFamily = "";
  public isValid = false;
}
