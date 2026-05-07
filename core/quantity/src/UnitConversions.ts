/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Quantity
 */

import unitsSchema from "./assets/Units.json";
import { QuantityError, QuantityStatus } from "./Exception";
import { type UnitConversionProps, type UnitProps, type UnitsProvider } from "./Interfaces";
import { convertValueOrThrow } from "./internal/UnitConversionMath";
import type { SerializedUnitSchema } from "./SerializedUnitSchema";
import { getBasicUnitConversion } from "./internal/BasicUnitConversionData";
import { getBasicUnitsResolvedState } from "./internal/BasicUnitsResolvedStateCache";

function resolveBasicUnit(unitName: string): UnitProps {
  const unit = getBasicUnitsResolvedState(unitsSchema as SerializedUnitSchema).nameMap.get(unitName)?.props;
  if (!unit)
    throw new QuantityError(QuantityStatus.UnknownUnit, `Unknown unit "${unitName}".`);

  return unit;
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

function getBasicConversion(fromUnit: string, toUnit: string): UnitConversionProps {
  const state = getBasicUnitsResolvedState(unitsSchema as SerializedUnitSchema);
  return getBasicUnitConversion(state, resolveBasicUnit(fromUnit), resolveBasicUnit(toUnit));
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
 * Basic conversion uses the built-in unit data shipped with `core-quantity` and resolves lazily on first use.
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
