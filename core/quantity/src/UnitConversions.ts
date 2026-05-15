/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Quantity
 */

import { QuantityError, QuantityStatus } from "./Exception";
import { UnitConversionInvert, type UnitConversionProps } from "./Interfaces";
import { Phenomena, type PhenomenonName, type UnitName } from "./generated/Units.generated";
import { basicUnitConversionData } from "./internal/BasicUnitConversions.generated";
import { defaultPersistenceUnits } from "./internal/DefaultPersistenceUnits.generated";
import { convertValueOrThrow } from "./internal/UnitConversionMath";

type BasicUnitConversionEntry = readonly [
  phenomenon: string,
  factor: number,
  offset: number,
  invertsUnitName?: string,
];

const basicUnitConversionLookup = basicUnitConversionData as Record<string, BasicUnitConversionEntry>;

function throwUnknownUnit(unitName: string): never {
  throw new QuantityError(QuantityStatus.UnknownUnit, `Unknown unit "${unitName}".`);
}

function getUnitEntry(unitName: string): BasicUnitConversionEntry {
  if (!Object.prototype.hasOwnProperty.call(basicUnitConversionLookup, unitName))
    return throwUnknownUnit(unitName);

  return basicUnitConversionLookup[unitName];
}

function getComparableEntry(unit: BasicUnitConversionEntry): BasicUnitConversionEntry {
  return unit[3] ? getUnitEntry(unit[3]) : unit;
}

function composeConversion(fromUnit: BasicUnitConversionEntry, toUnit: BasicUnitConversionEntry): UnitConversionProps {
  return {
    factor: toUnit[1] / fromUnit[1],
    offset: toUnit[2] - ((toUnit[1] * fromUnit[2]) / fromUnit[1]),
  };
}

function getConversion(fromUnit: UnitName, toUnit: UnitName): UnitConversionProps {
  const from = getUnitEntry(fromUnit);
  const to = getUnitEntry(toUnit);
  const comparableFrom = getComparableEntry(from);
  const comparableTo = getComparableEntry(to);

  if (comparableFrom[0] !== comparableTo[0])
    return { factor: 1.0, offset: 0.0, error: true };

  if (from[3] && to[3])
    return composeConversion(comparableFrom, comparableTo);

  if (from[3]) {
    return {
      ...composeConversion(comparableFrom, to),
      inversion: UnitConversionInvert.InvertPreConversion,
    };
  }

  if (to[3]) {
    return {
      ...composeConversion(from, comparableTo),
      inversion: UnitConversionInvert.InvertPostConversion,
    };
  }

  return composeConversion(from, to);
}

function convert(fromUnit: UnitName, toUnit: UnitName, value: number): number {
  const conversion = getConversion(fromUnit, toUnit);
  if (conversion.error)
    throw new QuantityError(QuantityStatus.InvalidUnitConversion, `Cannot convert value from "${fromUnit}" to "${toUnit}" using invalid conversion metadata.`);

  return convertValueOrThrow(value, conversion);
}

function isCompatible(fromUnit: UnitName, toUnit: UnitName): boolean {
  const from = getComparableEntry(getUnitEntry(fromUnit));
  const to = getComparableEntry(getUnitEntry(toUnit));
  return from[0] === to[0];
}

/** Returns the recommended built-in default persistence unit for a bundled built-in phenomenon.
 *
 * This helper is intentionally limited to the built-in canonical unit set shipped with `@itwin/core-quantity`.
 * `Phenomena.LENGTH_RATIO` is intentionally excluded until the built-in default length-ratio unit is settled.
 * For schema-defined, custom, or iModel-specific persistence units, use a `UnitsProvider`-based workflow instead.
 *
 * @beta
 */
export function getDefaultPersistenceUnit(
  phenomenon: Exclude<PhenomenonName, typeof Phenomena.LENGTH_RATIO>,
): UnitName {
  return defaultPersistenceUnits[phenomenon];
}

/** One-stop unit conversion helpers for the built-in canonical unit set generated from `@bentley/units-schema`.
 * This surface is synchronous and only supports built-in canonical unit names shipped with `core-quantity`.
 * For schema-defined, custom, or provider-resolved units outside that built-in set, use a `UnitsProvider`-based workflow instead.
 * Exported as a plain module value so related helpers are discoverable from one ESM/CJS-friendly surface
 * without introducing a TypeScript namespace or static utility class.
 * @beta
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const UnitConversions: {
  readonly getConversion: (fromUnit: UnitName, toUnit: UnitName) => UnitConversionProps;
  readonly convert: (fromUnit: UnitName, toUnit: UnitName, value: number) => number;
  readonly convertValue: (value: number, conversion: UnitConversionProps) => number;
  readonly isCompatible: (fromUnit: UnitName, toUnit: UnitName) => boolean;
} = {
  getConversion,
  convert,
  convertValue: convertValueOrThrow,
  isCompatible,
};
