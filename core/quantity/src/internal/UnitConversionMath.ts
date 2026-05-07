/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { QuantityError, QuantityStatus } from "../Exception";
import { UnitConversionInvert, type UnitConversionProps } from "../Interfaces";

/**
 * Checks if two numbers are approximately equal within given relative tolerance.
 * @internal
 */
export function almostEqual(a: number, b: number, tolerance: number = 2.2204460492503131e-16): boolean {
  const absDiff = Math.abs(a - b);
  const scaledTolerance = Math.max(1, Math.abs(a), Math.abs(b)) * tolerance;
  return absDiff <= scaledTolerance;
}

/** Determines if a value is almost zero. (less than 1e-16)
 * @internal
 */
export function almostZero(value: number): boolean {
  return almostEqual(value, 0.0);
}

function invert(input: number): number {
  if (almostZero(input))
    throw new QuantityError(QuantityStatus.InvertingZero, "Cannot invert zero value");
  return 1 / input;
}

/** Shared numeric conversion core used by both legacy `applyConversion(...)` and safe public helpers.
 * The `failOnInvalidConversion` switch preserves legacy compatibility while letting newer APIs throw
 * when conversion metadata is explicitly marked invalid.
 * @internal
 */
export function applyConversionCore(value: number, props: UnitConversionProps, failOnInvalidConversion: boolean): number {
  if (failOnInvalidConversion && props.error)
    throw new QuantityError(QuantityStatus.InvalidUnitConversion, "Cannot apply an invalid unit conversion.");

  let convertedValue = value;

  if (props.inversion === UnitConversionInvert.InvertPreConversion)
    convertedValue = invert(convertedValue);

  convertedValue = (convertedValue * props.factor) + props.offset;

  if (props.inversion === UnitConversionInvert.InvertPostConversion)
    convertedValue = invert(convertedValue);

  return convertedValue;
}

/** Applies a unit conversion while throwing on invalid conversion metadata.
 * @internal
 */
export function convertValueOrThrow(value: number, conversion: UnitConversionProps): number {
  return applyConversionCore(value, conversion, true);
}
