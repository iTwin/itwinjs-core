/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import unitsSchema from "../assets/Units.json";
import { BasicUnitsProvider } from "../BasicUnitsProvider";
import { Phenomena, Units, UnitSystems } from "../generated/Units.generated";

const unitsSchemaItems = unitsSchema.items as Record<string, {
  schemaItemType: string;
  phenomenon?: string;
  invertsUnit?: string;
}>;
const groupedUnits = Units as Record<string, Record<string, string>>;

function expectedNames(schemaItemType: "Phenomenon" | "UnitSystem"): string[] {
  return Object.entries(unitsSchemaItems)
    .filter(([, item]) => item.schemaItemType === schemaItemType)
    .map(([name]) => name)
    .sort((a, b) => a.localeCompare(b));
}

function stripReferenceName(fullName: string): string {
  return fullName.includes(".") ? fullName.split(".").pop()! : fullName;
}

function resolveUnitPhenomenon(name: string): string {
  const item = unitsSchemaItems[name];
  if (!item)
    throw new Error(`Unknown schema item: ${name}`);

  if (item.schemaItemType === "Unit")
    return stripReferenceName(item.phenomenon!);

  if (item.schemaItemType === "InvertedUnit")
    return resolveUnitPhenomenon(stripReferenceName(item.invertsUnit!));

  throw new Error(`Cannot resolve phenomenon for schema item type ${item.schemaItemType}: ${name}`);
}

function normalizeGeneratedUnitKey(name: string): string {
  return name === "M_PER_DAy" ? "M_PER_DAY" : name;
}

function expectedGroupedUnitNames(): Record<string, string[]> {
  const grouped = new Map<string, string[]>();

  for (const [name, item] of Object.entries(unitsSchemaItems)) {
    if (item.schemaItemType !== "Unit" && item.schemaItemType !== "InvertedUnit")
      continue;

    const phenomenon = resolveUnitPhenomenon(name);
    const names = grouped.get(phenomenon) ?? [];
    names.push(normalizeGeneratedUnitKey(name));
    grouped.set(phenomenon, names);
  }

  return Object.fromEntries(
    [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([phenomenon, names]) => [phenomenon, names.sort((a, b) => a.localeCompare(b))]),
  );
}

describe("Generated Units identifiers", () => {
  it("exposes representative canonical values", () => {
    expect(Units.LENGTH.M).toBe("Units.M");
    expect(Units.SLOPE.HORIZONTAL_PER_VERTICAL).toBe("Units.HORIZONTAL_PER_VERTICAL");
    expect(Units.VELOCITY.M_PER_DAY).toBe("Units.M_PER_DAy");
    expect(Phenomena.LENGTH).toBe("Units.LENGTH");
    expect(UnitSystems.USCUSTOM).toBe("Units.USCUSTOM");
  });

  it("covers every bundled Unit and InvertedUnit item grouped by phenomenon", () => {
    const expectedGroups = expectedGroupedUnitNames();
    expect(Object.keys(groupedUnits)).toEqual(Object.keys(expectedGroups));

    for (const [phenomenon, expectedUnitNames] of Object.entries(expectedGroups))
      expect(Object.keys(groupedUnits[phenomenon])).toEqual(expectedUnitNames);
  });

  it("covers every bundled Phenomenon item", () => {
    expect(Object.keys(Phenomena)).toEqual(expectedNames("Phenomenon"));
  });

  it("covers every bundled UnitSystem item", () => {
    expect(Object.keys(UnitSystems)).toEqual(expectedNames("UnitSystem"));
  });

  it("maps every generated identifier back to a real schema item", () => {
    const generatedValues = [
      ...Object.values(groupedUnits).flatMap((section) => Object.values(section)),
      ...Object.values(Phenomena),
      ...Object.values(UnitSystems),
    ];

    for (const value of generatedValues) {
      const itemName = value.slice(`${unitsSchema.name}.`.length);
      expect(unitsSchemaItems[itemName]).toBeDefined();
    }
  });

  it("works with BasicUnitsProvider.findUnitByName", async () => {
    const provider = new BasicUnitsProvider();
    const unit = await provider.findUnitByName(Units.LENGTH.M);
    expect(unit.isValid).toBe(true);
    expect(unit.name).toBe("Units.M");
  });

  it("works with BasicUnitsProvider.getUnitsByFamily", async () => {
    const provider = new BasicUnitsProvider();
    const units = await provider.getUnitsByFamily(Phenomena.LENGTH);
    expect(units.length).toBeGreaterThan(0);
    expect(units.some((unit) => unit.name === Units.LENGTH.M)).toBe(true);
  });
});
