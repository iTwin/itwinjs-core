/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import unitsSchema from "../assets/Units.json";

const generatedIdentifiersSource = readFileSync(require.resolve("../generated/Units.generated.ts"), "utf8");

describe("Generated Units artifacts", () => {
  it("keeps Units.json aligned with the expected serialized schema envelope", () => {
    expect(unitsSchema.version).toBeDefined();
    expect(unitsSchema.sourceEcSchemaVersion).toBeDefined();
    expect(unitsSchema.name).toBe("Units");
    expect(Object.keys(unitsSchema.items).length).toBeGreaterThan(0);
  });

  it("includes representative built-in items in Units.json", () => {
    expect(unitsSchema.items.M.schemaItemType).toBe("Unit");
    expect(unitsSchema.items.LENGTH.schemaItemType).toBe("Phenomenon");
    expect(unitsSchema.items.SI.schemaItemType).toBe("UnitSystem");
  });

  it("exports UnitSchemaNames with pluralized section names", () => {
    expect(generatedIdentifiersSource).toContain("export const UnitSchemaNames = {");
    expect(generatedIdentifiersSource).toContain("  Units: {");
    expect(generatedIdentifiersSource).toContain("  Phenomena: {");
    expect(generatedIdentifiersSource).toContain("  UnitSystems: {");
  });

  it("emits representative canonical identifiers in the generated module", () => {
    expect(generatedIdentifiersSource).toContain('M: "Units.M"');
    expect(generatedIdentifiersSource).toContain('HORIZONTAL_PER_VERTICAL: "Units.HORIZONTAL_PER_VERTICAL"');
    expect(generatedIdentifiersSource).toContain('LENGTH: "Units.LENGTH"');
    expect(generatedIdentifiersSource).toContain('SI: "Units.SI"');
  });

  it("does not emit unrelated schema item types into UnitSchemaNames", () => {
    expect(generatedIdentifiersSource).not.toContain('PI: "Units.PI"');
    expect(generatedIdentifiersSource).not.toContain('MILLI: "Units.MILLI"');
  });
});
