/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Quantity
 */

import { QuantityError, QuantityStatus } from "./Exception";
import { UnitConversionInvert, type UnitConversionProps, type UnitProps, type UnitsProvider } from "./Interfaces";
import { basicUnitConversionData } from "./generated/BasicUnitConversions.generated";
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

function getBasicUnitEntry(unitName: string): BasicUnitConversionEntry {
  return basicUnitConversionLookup[unitName] ?? throwUnknownUnit(unitName);
}

function composeConversion(fromUnit: BasicUnitConversionEntry, toUnit: BasicUnitConversionEntry): UnitConversionProps {
  return {
    factor: toUnit[1] / fromUnit[1],
    offset: toUnit[2] - ((toUnit[1] * fromUnit[2]) / fromUnit[1]),
  };
}

function getBasicConversion(fromUnit: string, toUnit: string): UnitConversionProps {
  const from = getBasicUnitEntry(fromUnit);
  const to = getBasicUnitEntry(toUnit);
  const innerFrom = from[3] ? getBasicUnitEntry(from[3]) : from;
  const innerTo = to[3] ? getBasicUnitEntry(to[3]) : to;

  if (innerFrom[0] !== innerTo[0])
    return { factor: 1.0, offset: 0.0, error: true };

  if (from[3] && to[3])
    return composeConversion(innerFrom, innerTo);

  if (from[3]) {
    return {
      ...composeConversion(innerFrom, to),
      inversion: UnitConversionInvert.InvertPreConversion,
    };
  }

  if (to[3]) {
    return {
      ...composeConversion(from, innerTo),
      inversion: UnitConversionInvert.InvertPostConversion,
    };
  }

  return composeConversion(from, to);
}

async function resolveProviderUnit(unitsProvider: UnitsProvider, unitOrName: string | UnitProps): Promise<UnitProps> {
  if (typeof unitOrName !== "string") {
    if (!unitOrName.isValid)
      throw new QuantityError(QuantityStatus.UnknownUnit, `Unknown unit "${unitOrName.name || "<invalid>"}".`);

    return unitOrName;
  }

  const unit = await unitsProvider.findUnitByName(unitOrName);
  if (!unit.isValid)
    throw new QuantityError(QuantityStatus.UnknownUnit, `Unknown unit "${unitOrName}".`);

  return unit;
}

async function getProviderConversion(
  unitsProvider: UnitsProvider,
  fromUnit: string | UnitProps,
  toUnit: string | UnitProps,
): Promise<UnitConversionProps> {
  const [from, to] = await Promise.all([
    resolveProviderUnit(unitsProvider, fromUnit),
    resolveProviderUnit(unitsProvider, toUnit),
  ]);
  return unitsProvider.getConversion(from, to);
}

async function convert(
  unitsProvider: UnitsProvider,
  fromUnit: string | UnitProps,
  toUnit: string | UnitProps,
  value: number,
): Promise<number> {
  return convertValueOrThrow(value, await getProviderConversion(unitsProvider, fromUnit, toUnit));
}

function convertBasic(fromUnit: string, toUnit: string, value: number): number {
  return convertValueOrThrow(value, getBasicConversion(fromUnit, toUnit));
}

/** One-stop unit conversion helpers for provider-backed async conversion and built-in basic sync conversion.
 * Exported as a plain module value so related helpers are discoverable from one ESM/CJS-friendly surface
 * without introducing a TypeScript namespace or static utility class.
 * Provider-backed lookup remains async because `UnitsProvider` is async by contract.
 * Basic conversion uses pre-resolved built-in conversion data generated from the bundled Units schema,
 * so it stays synchronous without needing app startup/init hooks.
 * @beta
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export const UnitConversions: {
  readonly getConversion: (unitsProvider: UnitsProvider, fromUnit: string | UnitProps, toUnit: string | UnitProps) => Promise<UnitConversionProps>;
  readonly getBasicConversion: (fromUnit: string, toUnit: string) => UnitConversionProps;
  readonly convert: (unitsProvider: UnitsProvider, fromUnit: string | UnitProps, toUnit: string | UnitProps, value: number) => Promise<number>;
  readonly convertBasic: (fromUnit: string, toUnit: string, value: number) => number;
  readonly convertValue: (value: number, conversion: UnitConversionProps) => number;
} = {
  getConversion: getProviderConversion,
  getBasicConversion,
  convert,
  convertBasic,
  convertValue: convertValueOrThrow,
};
