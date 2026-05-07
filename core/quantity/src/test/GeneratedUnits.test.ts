/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import unitsSchema from "../assets/Units.json";
import { BasicUnitsProvider } from "../BasicUnitsProvider";
import { UnitSchemaNames } from "../generated/Units.generated";

const unitsSchemaItems = unitsSchema.items as Record<string, { schemaItemType: string }>;

function expectedNames(schemaItemType: "Unit" | "Phenomenon" | "UnitSystem"): string[] {
  return Object.entries(unitsSchemaItems)
    .filter(([, item]) => item.schemaItemType === schemaItemType)
    .map(([name]) => name)
    .sort((a, b) => a.localeCompare(b));
}

function expectedUnitNames(): string[] {
  return Object.entries(unitsSchemaItems)
    .filter(([, item]) => item.schemaItemType === "Unit" || item.schemaItemType === "InvertedUnit")
    .map(([name]) => name)
    .sort((a, b) => a.localeCompare(b));
}

describe("Generated Units identifiers", () => {
  it("exposes representative canonical values", () => {
    expect(UnitSchemaNames.Units.M).toBe("Units.M");
    expect(UnitSchemaNames.Units.HORIZONTAL_PER_VERTICAL).toBe("Units.HORIZONTAL_PER_VERTICAL");
    expect(UnitSchemaNames.Phenomena.LENGTH).toBe("Units.LENGTH");
    expect(UnitSchemaNames.UnitSystems.USCUSTOM).toBe("Units.USCUSTOM");
  });

  it("covers every bundled Unit and InvertedUnit item", () => {
    expect(Object.keys(UnitSchemaNames.Units)).toEqual(expectedUnitNames());
  });

  it("covers every bundled Phenomenon item", () => {
    expect(Object.keys(UnitSchemaNames.Phenomena)).toEqual(expectedNames("Phenomenon"));
  });

  it("covers every bundled UnitSystem item", () => {
    expect(Object.keys(UnitSchemaNames.UnitSystems)).toEqual(expectedNames("UnitSystem"));
  });

  it("maps every generated identifier back to a real schema item", () => {
    for (const section of [UnitSchemaNames.Units, UnitSchemaNames.Phenomena, UnitSchemaNames.UnitSystems]) {
      for (const value of Object.values(section)) {
        const itemName = value.slice(`${unitsSchema.name}.`.length);
        expect(unitsSchemaItems[itemName]).toBeDefined();
      }
    }
  });

  it("works with BasicUnitsProvider.findUnitByName", async () => {
    const provider = new BasicUnitsProvider();
    const unit = await provider.findUnitByName(UnitSchemaNames.Units.M);
    expect(unit.isValid).toBe(true);
    expect(unit.name).toBe("Units.M");
  });

  it("works with BasicUnitsProvider.getUnitsByFamily", async () => {
    const provider = new BasicUnitsProvider();
    const units = await provider.getUnitsByFamily(UnitSchemaNames.Phenomena.LENGTH);
    expect(units.length).toBeGreaterThan(0);
    expect(units.some((unit) => unit.name === UnitSchemaNames.Units.M)).toBe(true);
  });
});
