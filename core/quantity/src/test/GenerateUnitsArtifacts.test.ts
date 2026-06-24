/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import unitsSchema from "../assets/Units.json";
import { basicUnitConversionData } from "../internal/BasicUnitConversions.generated";

import {
  buildGeneratedBasicConversionModule,
  buildGeneratedDefaultPersistenceModule,
  buildGeneratedUnitsModule,
  buildSerializedUnitsJson,
} from "../../scripts/generatedModuleBuilders";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const sourceUnitsSchema = require("@bentley/units-schema/Units.ecschema.json") as typeof unitsSchema;

const generatedIdentifiersSource = readFileSync(require.resolve("../generated/Units.generated.ts"), "utf8");
const generatedBasicConversionsSource = readFileSync(require.resolve("../internal/BasicUnitConversions.generated.ts"), "utf8");
const generatedDefaultPersistenceSource = readFileSync(require.resolve("../internal/DefaultPersistenceUnits.generated.ts"), "utf8");

function normalizeLineEndings(source: string): string {
  return source.replace(/\r\n/g, "\n");
}

function assertUniqueGeneratedKeys(entries: ReadonlyArray<{ key: string }>, description: string): void {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.key))
      throw new Error(`Duplicate ${description} key generated: ${entry.key}`);
    seen.add(entry.key);
  }
}

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

  it("exports grouped Units plus flat Phenomena and UnitSystems", () => {
    expect(generatedIdentifiersSource).toContain("export const Units = {");
    expect(generatedIdentifiersSource).toContain("  LENGTH: {");
    expect(generatedIdentifiersSource).toContain("export const Phenomena = {");
    expect(generatedIdentifiersSource).toContain("export const UnitSystems = {");
    expect(generatedIdentifiersSource).toContain('import type { NestedValueOf, ValueOf } from "@itwin/core-bentley";');
    expect(generatedIdentifiersSource).toContain("export type UnitName = NestedValueOf<typeof Units>;");
    expect(generatedIdentifiersSource).toContain("export type PhenomenonName = ValueOf<typeof Phenomena>;");
    expect(generatedIdentifiersSource).toContain("export type UnitSystemName = ValueOf<typeof UnitSystems>;");
  });

  it("emits representative canonical identifiers in the generated module", () => {
    expect(generatedIdentifiersSource).toContain('    M: "Units.M"');
    expect(generatedIdentifiersSource).toContain('    HORIZONTAL_PER_VERTICAL: "Units.HORIZONTAL_PER_VERTICAL"');
    expect(generatedIdentifiersSource).toContain('    M_PER_DAY: "Units.M_PER_DAy"');
    expect(generatedIdentifiersSource).toContain('  LENGTH: "Units.LENGTH"');
    expect(generatedIdentifiersSource).toContain('  SI: "Units.SI"');
  });

  it("does not emit unrelated schema item types into grouped Units", () => {
    expect(generatedIdentifiersSource).not.toContain('PI: "Units.PI"');
    expect(generatedIdentifiersSource).not.toContain('MILLI: "Units.MILLI"');
  });

  it("emits representative pre-resolved basic conversion entries", () => {
    expect(generatedBasicConversionsSource).toContain('"Units.M": ["Units.LENGTH", 1, 0]');
    expect(generatedBasicConversionsSource).toContain('"Units.FT": ["Units.LENGTH"');
    expect(generatedBasicConversionsSource).toContain('"Units.CELSIUS": ["Units.TEMPERATURE"');
    expect(generatedBasicConversionsSource).toContain('"Units.HORIZONTAL_PER_VERTICAL": ["Units.SLOPE"');
    expect(basicUnitConversionData["Units.HORIZONTAL_PER_VERTICAL"]).toEqual(["Units.SLOPE", 1, 0, "Units.VERTICAL_PER_HORIZONTAL"]);
  });

  it("emits representative default persistence entries and omits LENGTH_RATIO", () => {
    expect(generatedDefaultPersistenceSource).toContain("[Phenomena.LENGTH]: Units.LENGTH.M");
    expect(generatedDefaultPersistenceSource).toContain("[Phenomena.CURRENCY]: Units.CURRENCY.US_DOLLAR");
    expect(generatedDefaultPersistenceSource).toContain("[Phenomena.SLOPE]: Units.SLOPE.M_PER_M");
    expect(generatedDefaultPersistenceSource).toContain("Phenomena.LENGTH_RATIO is intentionally omitted");
    expect(generatedDefaultPersistenceSource).not.toContain("[Phenomena.LENGTH_RATIO]");
  });

  it("rebuilds the checked-in Units identifiers artifact exactly from Units.json", () => {
    expect(normalizeLineEndings(buildGeneratedUnitsModule(unitsSchema))).toBe(normalizeLineEndings(generatedIdentifiersSource));
  });

  it("rebuilds the checked-in Units.json artifact exactly from the source schema", () => {
    const rebuiltUnitsJson = `${JSON.stringify(buildSerializedUnitsJson(sourceUnitsSchema, unitsSchema.version), null, 2)}\n`;
    expect(rebuiltUnitsJson).toBe(`${JSON.stringify(unitsSchema, null, 2)}\n`);
  });

  it("canonicalizes generated conversion values that drift across Node runtimes", () => {
    const generatedSource = buildGeneratedBasicConversionModule(unitsSchema, assertUniqueGeneratedKeys);

    expect(generatedSource).toContain('"Units.AT": ["Units.PRESSURE", 0.0000101971621297793, 0]');
    expect(generatedSource).toContain('"Units.AT_GAUGE": ["Units.PRESSURE", 0.0000101971621297793, -1.03322745279989]');
    expect(generatedSource).toContain('"Units.FT_TO_THE_FOURTH": ["Units.AREA_MOMENT_INERTIA", 115.861767458952, 0]');
    expect(generatedSource).toContain('"Units.N_CM_PER_SQ_CM": ["Units.AREA_TORQUE", 0.01, 0]');
    expect(generatedSource).toContain('"Units.PER_FT": ["Units.LINEAR_RATE", 0.3048, 0]');
  });

  it("rebuilds the checked-in basic conversion artifact exactly from Units.json", () => {
    expect(normalizeLineEndings(buildGeneratedBasicConversionModule(unitsSchema, assertUniqueGeneratedKeys))).toBe(normalizeLineEndings(generatedBasicConversionsSource));
  });

  it("fails generation when a unit numerator is zero", () => {
    const invalidSchema = JSON.parse(JSON.stringify(unitsSchema)) as typeof unitsSchema;
    (invalidSchema.items as Record<string, unknown>).FT = { ...invalidSchema.items.FT, numerator: 0 };

    expect(() => buildGeneratedBasicConversionModule(invalidSchema, assertUniqueGeneratedKeys)).toThrow(/Invalid numerator for "FT"/);
  });

  it("fails generation when a unit denominator is zero", () => {
    const invalidSchema = JSON.parse(JSON.stringify(unitsSchema)) as typeof unitsSchema;
    (invalidSchema.items as Record<string, unknown>).FT = { ...invalidSchema.items.FT, denominator: 0 };

    expect(() => buildGeneratedBasicConversionModule(invalidSchema, assertUniqueGeneratedKeys)).toThrow(/Invalid denominator for "FT"/);
  });

  it("rebuilds the checked-in default persistence artifact exactly from Units.json", () => {
    expect(normalizeLineEndings(buildGeneratedDefaultPersistenceModule(unitsSchema, assertUniqueGeneratedKeys))).toBe(normalizeLineEndings(generatedDefaultPersistenceSource));
  });
});
