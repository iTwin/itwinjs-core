/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import unitsSchema from "../assets/Units.json";
import { Phenomena, Units } from "../generated/Units.generated";
import { defaultPersistenceUnits } from "../internal/DefaultPersistenceUnits.generated";
import { getDefaultPersistenceUnit } from "../PersistenceUnits";

const unitsSchemaItems = unitsSchema.items as Record<string, {
  schemaItemType: string;
  phenomenon?: string;
  invertsUnit?: string;
}>;

function stripReferenceName(fullName: string): string {
  return fullName.includes(".") ? fullName.split(".").pop()! : fullName;
}

function resolveUnitPhenomenon(fullUnitName: string): string {
  const itemName = stripReferenceName(fullUnitName);
  const item = unitsSchemaItems[itemName];
  if (!item)
    throw new Error(`Unknown schema item: ${fullUnitName}`);

  if (item.schemaItemType === "Unit")
    return item.phenomenon!;

  if (item.schemaItemType === "InvertedUnit")
    return resolveUnitPhenomenon(item.invertsUnit!);

  throw new Error(`Cannot resolve phenomenon for schema item type ${item.schemaItemType}: ${fullUnitName}`);
}

describe("PersistenceUnits", () => {
  it("returns representative built-in default persistence units", () => {
    expect(getDefaultPersistenceUnit(Phenomena.LENGTH)).toBe(Units.LENGTH.M);
    expect(getDefaultPersistenceUnit(Phenomena.CURRENCY)).toBe(Units.CURRENCY.US_DOLLAR);
    expect(getDefaultPersistenceUnit(Phenomena.NUMBER)).toBe(Units.NUMBER.ONE);
    expect(getDefaultPersistenceUnit(Phenomena.PERCENTAGE)).toBe(Units.PERCENTAGE.DECIMAL_PERCENT);
    expect(getDefaultPersistenceUnit(Phenomena.SLOPE)).toBe(Units.SLOPE.M_PER_M);
  });

  it("covers every bundled phenomenon except LENGTH_RATIO", () => {
    const expectedPhenomena = Object.values(Phenomena)
      .filter((phenomenon) => phenomenon !== Phenomena.LENGTH_RATIO)
      .sort((a, b) => a.localeCompare(b));

    expect(Object.keys(defaultPersistenceUnits).sort((a, b) => a.localeCompare(b))).toEqual(expectedPhenomena);
    expect(Phenomena.LENGTH_RATIO in defaultPersistenceUnits).toBe(false);
  });

  it("maps each supported phenomenon to a built-in unit in the same phenomenon", () => {
    for (const [phenomenon, unitName] of Object.entries(defaultPersistenceUnits))
      expect(resolveUnitPhenomenon(unitName)).toBe(phenomenon);
  });
});
