/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Quantity
 */

import { QuantityError, QuantityStatus } from "./Exception";
import { QuantityProps, UnitConversionInvert, UnitConversionProps, UnitProps } from "./Interfaces";

/**
 * Checks if two numbers are approximately equal within given relative tolerance.
 * @param a - The first number to compare.
 * @param b - The second number to compare.
 * @param tolerance - Tolerance, scales based on the input number values (multiplied by 1, abs(a) or abs(b), whichever is biggest).
 * @returns True if the numbers are approximately equal, false otherwise.
 * @internal
 */
export function almostEqual(a: number, b: number, tolerance: number = 2.2204460492503131e-16): boolean {
  const absDiff = Math.abs(a - b);
  const scaledTolerance = Math.max(1, Math.abs(a), Math.abs(b)) * tolerance;
  return absDiff <= scaledTolerance;
}

/** The Quantity class is convenient container to specify both the magnitude and unit of a quantity. This class is commonly
 * returned as the result of parsing a string that represents a quantity.
 * @beta
 */
export class Quantity implements QuantityProps {
  protected _magnitude: number = 0.0;
  protected _unit: UnitProps;
  protected _isValid: boolean = false;

  public get unit(): UnitProps { return this._unit; }
  public get magnitude(): number { return this._magnitude; }
  public get isValid(): boolean { return this._isValid; }

  /** Constructor. The Quantity will only be set as valid if a unit is specified.
   *  @param unit     Defines the quantity's unit.
   *  @param magnitude   Defines the magnitude of the quantity.
   */
  public constructor(unit?: UnitProps, magnitude?: number) {
    if (undefined !== unit) {
      this._unit = unit;
      this._isValid = true;
    } else {
      this._unit = { name: "unknown", label: "unknown", phenomenon: "unknown", isValid: false, system: "unknown" };
    }

    if (undefined !== magnitude)
      this._magnitude = magnitude;
  }

  /** Convert a Quantity to the specified unit given the UnitConversion.
   *  @param toUnit   The new unit for the quantity.
   *  @param conversion  Defines the information needed to convert the Quantity's magnitude from the current unit to another unit. This conversion info is usually
   *                     returned from the UnitsProvider.
   */
  public convertTo(toUnit: UnitProps, conversion: UnitConversionProps): Quantity | undefined {
    const newMagnitude = applyConversion(this.magnitude, conversion);
    return new Quantity(toUnit, newMagnitude);
  }
}

function invert(input: number): number {
  if (almostZero(input)) // mimic the behavior of native here. We don't want to invert those very small values
    throw new QuantityError(QuantityStatus.InvertingZero, "Cannot invert zero value");
  return 1 / input;
}

/** Determines if a value is almost zero. (less than 1e-16)
 * @param value - The value to be checked.
 * @returns `true` if the value is almost zero, `false` otherwise.
 * @internal
 */
export function almostZero(value: number): boolean {
  return almostEqual(value, 0.0);
}

/**
 * Applies a unit conversion to a given value.
 * @param value - The value to be converted.
 * @param props - The unit conversion properties.
 * @returns The converted value.
 * @internal
 */
export function applyConversion(value: number, props: UnitConversionProps): number {
  let convertedValue = value;

  // Apply pre-conversion inversion if specified
  if (props.inversion === UnitConversionInvert.InvertPreConversion) {
    convertedValue = invert(convertedValue);
  }

  // Apply the conversion factor and offset
  convertedValue = (convertedValue * props.factor) + props.offset;

  // Apply post-conversion inversion if specified
  if (props.inversion === UnitConversionInvert.InvertPostConversion) {
    convertedValue = invert(convertedValue);
  }

  return convertedValue;
}
