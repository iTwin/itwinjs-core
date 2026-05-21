/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { almostEqual } from "../src/internal/UnitConversionMath";
import { SERIALIZED_UNIT_SCHEMA_VERSION, type SerializedUnitSchema } from "../src/SerializedUnitSchema";
import { UnitDefinitionResolver, type ResolvedUnit } from "../src/UnitConversion/UnitDefinitionResolver";
import { qualifyItemName, stripAliasPrefix } from "../src/UnitConversion/nameUtils";

/** Loose schema shape accepted by the generators. Both the raw EC schema JSON and the
 * serialized envelope satisfy it. Field shape on `items` matches in both forms.
 */
export interface SourceSchemaLike {
  readonly name: string;
  readonly alias?: string;
  readonly version?: string;
  readonly sourceEcSchemaVersion?: string;
  readonly label?: string;
  readonly description?: string;
  readonly items: { readonly [name: string]: any };
}

export interface GeneratedEntry {
  readonly key: string;
  readonly value: any;
}

export type AssertUniqueGeneratedKeys = (entries: ReadonlyArray<{ key: string }>, description: string) => void;

function asSerializedSchema(source: SourceSchemaLike): SerializedUnitSchema {
  // UnitDefinitionResolver requires the SerializedUnitSchema envelope and validates `version`.
  // Wrap the raw EC schema into that envelope before resolution.
  if (source.version === SERIALIZED_UNIT_SCHEMA_VERSION)
    return source as SerializedUnitSchema;

  return {
    version: SERIALIZED_UNIT_SCHEMA_VERSION,
    name: source.name,
    alias: source.alias ?? "",
    sourceEcSchemaVersion: source.sourceEcSchemaVersion ?? "",
    items: source.items,
  } as SerializedUnitSchema;
}

function validateConversionFactors(source: SourceSchemaLike): void {
  // Validate every Unit item plus any Constant that is referenced by some Unit's definition.
  // Constants that are declared but unused (e.g. SI prefix multipliers like ATTO with sub-EPSILON
  // numerators) are skipped because the resolver never touches them and the EC schema treats them
  // as forward-compatible reserved identifiers.
  const referencedConstants = new Set<string>();
  for (const item of Object.values(source.items)) {
    if (item.schemaItemType !== "Unit" || typeof item.definition !== "string")
      continue;
    for (const token of item.definition.split("*")) {
      const match = token.match(/\[((?:[A-Z]\w*:)?[A-Z]\w*)\]/i);
      if (match)
        referencedConstants.add(stripAliasPrefix(match[1]));
    }
  }

  for (const [name, item] of Object.entries(source.items)) {
    const isUnit = item.schemaItemType === "Unit";
    const isReferencedConstant = item.schemaItemType === "Constant" && referencedConstants.has(name);
    if (!isUnit && !isReferencedConstant)
      continue;

    const numerator = item.numerator ?? 1;
    const denominator = item.denominator ?? 1;

    if (!Number.isFinite(numerator) || almostEqual(numerator, 0.0))
      throw new Error(`Invalid numerator for "${name}": expected a finite non-zero number, got ${String(numerator)}`);
    if (!Number.isFinite(denominator) || almostEqual(denominator, 0.0))
      throw new Error(`Invalid denominator for "${name}": expected a finite non-zero number, got ${String(denominator)}`);

    const factor = denominator / numerator;
    if (!Number.isFinite(factor))
      throw new Error(`Invalid conversion factor for "${name}": expected a finite number, got ${String(factor)}`);
  }
}

function resolveAll(source: SourceSchemaLike): Map<string, ResolvedUnit> {
  validateConversionFactors(source);
  const resolver = new UnitDefinitionResolver(asSerializedSchema(source));
  return resolver.resolveAll();
}

function isValidIdentifierKey(name: string): boolean {
  return /^[$A-Z_][0-9A-Z_$]*$/i.test(name);
}

function stripSchemaPrefix(fullName: string, schemaName: string): string {
  return fullName.slice(`${schemaName}.`.length);
}

function invertsUnitToLocalName(invertsUnit: string, schemaName: string): string {
  // `invertsUnit` may be alias-prefixed (`u:M`), schema-qualified (`Units.M`), or unqualified (`M`).
  // Resolved-unit map keys are unqualified, so normalize to that form here.
  const aliasStripped = stripAliasPrefix(invertsUnit);
  if (aliasStripped.startsWith(`${schemaName}.`))
    return aliasStripped.slice(`${schemaName}.`.length);
  return aliasStripped;
}

function normalizeGeneratedUnitKey(name: string): string {
  // Temporary shim for a typo currently present in @bentley/units-schema.
  // Keep the emitted runtime value schema-faithful for lookup parity, but fix the generated
  // property name so the beta identifier surface does not freeze the typo into call sites.
  return name === "M_PER_DAy" ? "M_PER_DAY" : name;
}

export function buildBasicConversionEntries(
  source: SourceSchemaLike,
  assertUniqueGeneratedKeys: AssertUniqueGeneratedKeys,
): GeneratedEntry[] {
  const resolved = resolveAll(source);
  const entries: GeneratedEntry[] = [];

  for (const [unqualifiedName, unit] of resolved) {
    entries.push({
      key: `${source.name}.${unqualifiedName}`,
      value: [unit.phenomenon, unit.conversion.factor, unit.conversion.offset],
    });
  }

  for (const [name, item] of Object.entries(source.items)) {
    if (item.schemaItemType !== "InvertedUnit")
      continue;

    const invertsUnitUnqualified = invertsUnitToLocalName(item.invertsUnit, source.name);
    const invertedSource = resolved.get(invertsUnitUnqualified);
    if (!invertedSource)
      throw new Error(`Cannot resolve InvertedUnit source "${item.invertsUnit}" for "${name}"`);

    const invertsUnitQualified = qualifyItemName(item.invertsUnit, source.name);
    entries.push({
      key: `${source.name}.${name}`,
      value: [
        invertedSource.phenomenon,
        invertedSource.conversion.factor,
        invertedSource.conversion.offset,
        invertsUnitQualified,
      ],
    });
  }

  entries.sort((a, b) => a.key.localeCompare(b.key));
  assertUniqueGeneratedKeys(entries, "basic conversion data");
  return entries;
}

export function buildDefaultPersistenceUnitEntries(
  source: SourceSchemaLike,
  assertUniqueGeneratedKeys: AssertUniqueGeneratedKeys,
): GeneratedEntry[] {
  const resolved = resolveAll(source);
  const qualifiedSchemaItemName = (name: string) => `${source.name}.${name}`;
  // Default persistence units are generated when a phenomenon has exactly one built-in SI candidate.
  // The explicit policy layer below covers the remaining cases where the built-in schema either has
  // multiple plausible candidates (e.g. FORCE, SLOPE), has no SI-tagged candidate (e.g. CURRENCY,
  // NUMBER, PERCENTAGE), or has no built-in unit yet (LENGTH_RATIO).
  const unsupportedPhenomena = new Set(["LENGTH_RATIO"]);
  const overrides = new Map<string, string>([
    ["CURRENCY", "US_DOLLAR"],
    ["FORCE", "N"],
    ["NUMBER", "ONE"],
    ["PERCENTAGE", "DECIMAL_PERCENT"],
    ["SLOPE", "M_PER_M"],
  ]);

  const unitsByPhenomenon = new Map<string, Array<{ name: string; unitSystem: string }>>();

  for (const [name, item] of Object.entries(source.items)) {
    if (item.schemaItemType !== "Unit" && item.schemaItemType !== "InvertedUnit")
      continue;

    let phenomenon: string;
    let unitSystem: string;

    if (item.schemaItemType === "Unit") {
      phenomenon = qualifyItemName(item.phenomenon, source.name);
      unitSystem = qualifyItemName(item.unitSystem, source.name);
    } else {
      const invertsUnitUnqualified = invertsUnitToLocalName(item.invertsUnit, source.name);
      const invertedSource = resolved.get(invertsUnitUnqualified);
      if (!invertedSource)
        throw new Error(`Cannot resolve InvertedUnit source "${item.invertsUnit}" for "${name}"`);
      phenomenon = invertedSource.phenomenon;
      unitSystem = qualifyItemName(item.unitSystem, source.name);
    }

    const bucket = unitsByPhenomenon.get(phenomenon) ?? [];
    bucket.push({ name: qualifiedSchemaItemName(name), unitSystem });
    unitsByPhenomenon.set(phenomenon, bucket);
  }

  const entries: GeneratedEntry[] = [];
  const unresolved: Array<{ phenomenon: string; candidates: string[] }> = [];

  for (const [name, item] of Object.entries(source.items).sort(([a], [b]) => a.localeCompare(b))) {
    if (item.schemaItemType !== "Phenomenon" || unsupportedPhenomena.has(name))
      continue;

    const qualifiedPhenomenonName = qualifiedSchemaItemName(name);
    const units = unitsByPhenomenon.get(qualifiedPhenomenonName) ?? [];
    const override = overrides.get(name);
    let chosenUnitName: string;

    if (override) {
      chosenUnitName = qualifiedSchemaItemName(override);
    } else {
      const siCandidates = units.filter((unit) => unit.unitSystem === qualifiedSchemaItemName("SI"));
      if (siCandidates.length !== 1) {
        unresolved.push({ phenomenon: qualifiedPhenomenonName, candidates: siCandidates.map((candidate) => candidate.name) });
        continue;
      }
      chosenUnitName = siCandidates[0].name;
    }

    if (!units.some((unit) => unit.name === chosenUnitName))
      throw new Error(`Default persistence unit "${chosenUnitName}" does not belong to phenomenon "${qualifiedPhenomenonName}"`);

    entries.push({ key: qualifiedPhenomenonName, value: chosenUnitName });
  }

  if (unresolved.length > 0) {
    const details = unresolved
      .map(({ phenomenon, candidates }) => `${phenomenon}: [${candidates.join(", ")}]`)
      .join("; ");
    throw new Error(`Unresolved default persistence unit phenomena: ${details}`);
  }

  assertUniqueGeneratedKeys(entries, "default persistence units");
  return entries;
}

export function buildGeneratedBasicConversionModule(
  source: SourceSchemaLike,
  assertUniqueGeneratedKeys: AssertUniqueGeneratedKeys,
): string {
  const entries = buildBasicConversionEntries(source, assertUniqueGeneratedKeys);
  const lines = [
    "/*---------------------------------------------------------------------------------------------",
    "* Copyright (c) Bentley Systems, Incorporated. All rights reserved.",
    "* See LICENSE.md in the project root for license terms and full copyright notice.",
    "*--------------------------------------------------------------------------------------------*/",
    "// AUTO-GENERATED by scripts/generateUnitsJson.ts. Do not edit by hand.",
    "",
    "/** @internal */",
    "export const basicUnitConversionData = {",
  ];

  for (const entry of entries) {
    const tuple = (entry.value as unknown[])
      .map((value) => typeof value === "string" ? JSON.stringify(value) : String(value))
      .join(", ");
    lines.push(`  ${JSON.stringify(entry.key)}: [${tuple}],`);
  }

  lines.push("} as const;", "");
  return lines.join("\n");
}

export function buildGeneratedDefaultPersistenceModule(
  source: SourceSchemaLike,
  assertUniqueGeneratedKeys: AssertUniqueGeneratedKeys,
): string {
  const entries = buildDefaultPersistenceUnitEntries(source, assertUniqueGeneratedKeys);
  const lines = [
    "/*---------------------------------------------------------------------------------------------",
    "* Copyright (c) Bentley Systems, Incorporated. All rights reserved.",
    "* See LICENSE.md in the project root for license terms and full copyright notice.",
    "*--------------------------------------------------------------------------------------------*/",
    "// AUTO-GENERATED by scripts/generateUnitsJson.ts. Do not edit by hand.",
    'import { Phenomena, type PhenomenonName, type UnitName, Units } from "../generated/Units.generated";',
    "",
    "/** @internal */",
    "export const defaultPersistenceUnits = {",
  ];

  for (const entry of entries) {
    const phenomenonName = stripSchemaPrefix(entry.key, source.name);
    const unitName = stripSchemaPrefix(entry.value as string, source.name);
    lines.push(`  [Phenomena.${phenomenonName}]: Units.${phenomenonName}.${unitName},`);
  }

  lines.push(
    "  // Phenomena.LENGTH_RATIO is intentionally omitted because the bundled built-in unit set does not yet provide an agreed default for that phenomenon.",
    "} as const satisfies Record<Exclude<PhenomenonName, typeof Phenomena.LENGTH_RATIO>, UnitName>;",
    "",
  );
  return lines.join("\n");
}

interface SerializedUnitsJson {
  version: string;
  sourceEcSchemaVersion: string;
  name: string;
  alias?: string;
  label?: string;
  description?: string;
  items: SourceSchemaLike["items"];
}

export function buildSerializedUnitsJson(
  source: SourceSchemaLike & { version: string },
  serializationVersion: string,
): SerializedUnitsJson {
  return {
    version: serializationVersion,
    sourceEcSchemaVersion: source.version,
    name: source.name,
    alias: source.alias,
    label: source.label,
    description: source.description,
    items: source.items,
  };
}

function assertUniqueOrThrow(entries: ReadonlyArray<{ key: string }>, schemaItemType: string): void {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.key))
      throw new Error(`Duplicate generated key "${entry.key}" for ${schemaItemType}`);
    seen.add(entry.key);
  }
}

function collectGeneratedSection(source: SourceSchemaLike, schemaItemTypes: string | string[]): Array<{ key: string; value: string }> {
  const itemTypes = Array.isArray(schemaItemTypes) ? schemaItemTypes : [schemaItemTypes];
  const entries = Object.entries(source.items)
    .filter(([, item]) => itemTypes.includes(item.schemaItemType))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, item]) => {
      if (!isValidIdentifierKey(name))
        throw new Error(`Cannot emit invalid TypeScript identifier key "${name}" for ${item.schemaItemType}`);
      return { key: name, value: `${source.name}.${name}` };
    });

  assertUniqueOrThrow(entries, itemTypes.join("/"));
  return entries;
}

function renderSection(indent: string, entries: Array<{ key: string; value: string }>): string {
  if (entries.length === 0)
    return `${indent}{}`;

  const lines = [`${indent}{`];
  for (const entry of entries) {
    lines.push(`${indent}  ${entry.key}: "${entry.value}",`);
  }
  lines.push(`${indent}}`);
  return lines.join("\n");
}

function collectGroupedUnitSections(source: SourceSchemaLike): Array<{ key: string; entries: Array<{ key: string; value: string }> }> {
  const groupedUnits = new Map<string, Array<{ key: string; value: string }>>();
  const unitEntries = buildBasicConversionEntries(source, assertUniqueOrThrow)
    .map((entry) => ({
      key: normalizeGeneratedUnitKey(stripSchemaPrefix(entry.key, source.name)),
      value: entry.key,
      phenomenon: stripSchemaPrefix((entry.value as unknown[])[0] as string, source.name),
    }));

  for (const entry of unitEntries) {
    if (!isValidIdentifierKey(entry.phenomenon))
      throw new Error(`Cannot emit invalid TypeScript identifier key "${entry.phenomenon}" for grouped Units section`);

    const bucket = groupedUnits.get(entry.phenomenon) ?? [];
    bucket.push({ key: entry.key, value: entry.value });
    groupedUnits.set(entry.phenomenon, bucket);
  }

  const groupedSections = [...groupedUnits.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([phenomenon, entries]) => ({
      key: phenomenon,
      entries: entries.sort((a, b) => a.key.localeCompare(b.key)),
    }));

  assertUniqueOrThrow(groupedSections, "grouped Units sections");
  for (const section of groupedSections)
    assertUniqueOrThrow(section.entries, `Units.${section.key}`);

  return groupedSections;
}

export function buildGeneratedUnitsModule(source: SourceSchemaLike): string {
  const groupedUnitSections = collectGroupedUnitSections(source);
  const phenomenonEntries = collectGeneratedSection(source, "Phenomenon");
  const unitSystemEntries = collectGeneratedSection(source, "UnitSystem");
  const renderedGroupedSections = groupedUnitSections.map((section) => `  ${section.key}: ${renderSection("  ", section.entries).slice(2)},`);

  return `${[
    "/*---------------------------------------------------------------------------------------------",
    "* Copyright (c) Bentley Systems, Incorporated. All rights reserved.",
    "* See LICENSE.md in the project root for license terms and full copyright notice.",
    "*--------------------------------------------------------------------------------------------*/",
    "/* eslint-disable @typescript-eslint/naming-convention */",
    "// AUTO-GENERATED by scripts/generateUnitsJson.ts. Do not edit by hand.",
    'import type { NestedValueOf, ValueOf } from "@itwin/core-bentley";',
    "",
    "/** Canonical bundled unit identifiers grouped by phenomenon from the bundled Units.json asset.",
    " * @beta",
    " */",
    "export const Units = {",
    ...renderedGroupedSections,
    "} as const;",
    "",
    "/** Canonical bundled phenomenon identifiers from the bundled Units.json asset.",
    " * @beta",
    " */",
    `export const Phenomena = ${renderSection("", phenomenonEntries)} as const;`,
    "",
    "/** Canonical bundled unit system identifiers from the bundled Units.json asset.",
    " * @beta",
    " */",
    `export const UnitSystems = ${renderSection("", unitSystemEntries)} as const;`,
    "",
    "/** Bundled canonical unit-name identifiers generated from Units.",
    " * @beta",
    " */",
    "export type UnitName = NestedValueOf<typeof Units>;",
    "",
    "/** Bundled canonical phenomenon-name identifiers generated from Phenomena.",
    " * @beta",
    " */",
    "export type PhenomenonName = ValueOf<typeof Phenomena>;",
    "",
    "/** Bundled canonical unit-system identifiers generated from UnitSystems.",
    " * @beta",
    " */",
    "export type UnitSystemName = ValueOf<typeof UnitSystems>;",
    "",
  ].join("\n")}`;
}
