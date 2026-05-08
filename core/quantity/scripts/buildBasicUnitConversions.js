/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
"use strict";

const expressionRgx = /^(([A-Z]\w*:)?([A-Z]\w*|\[([A-Z]\w*:)?[A-Z]\w*\])(\(-?\d+\))?(\*(?!$)|$))+$/i;
const tokenRgx = /(?:(\[)?((?:[A-Z]\w*:)?[A-Z]\w*)\]?)(?:\((-?\d+)\))?/i;
const MAX_RESOLUTION_DEPTH = 30;

function assertUniqueGeneratedKeys(entries, schemaItemType) {
  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.key))
      throw new Error(`Duplicate generated key "${entry.key}" for ${schemaItemType}`);
    seen.add(entry.key);
  }
}

function almostEqual(a, b, tolerance = Number.EPSILON) {
  const absDiff = Math.abs(a - b);
  const scaledTolerance = Math.max(1, Math.abs(a), Math.abs(b)) * tolerance;
  return absDiff <= scaledTolerance;
}

class Conversion {
  constructor(factor = 1.0, offset = 0.0) {
    this.factor = factor;
    this.offset = offset;
  }

  compose(conversion) {
    return new Conversion(
      this.factor * conversion.factor,
      conversion.factor * this.offset + conversion.offset,
    );
  }

  multiply(conversion) {
    if (almostEqual(conversion.offset, 0.0) && almostEqual(this.offset, 0.0))
      return new Conversion(this.factor * conversion.factor, 0.0);

    throw new Error("Cannot multiply two maps with non-zero offsets");
  }

  raise(power) {
    if (almostEqual(power, 1.0))
      return new Conversion(this.factor, this.offset);
    if (almostEqual(power, 0.0))
      return new Conversion(1.0, 0.0);
    if (almostEqual(this.offset, 0.0))
      return new Conversion(this.factor ** power, 0.0);

    throw new Error("Cannot raise map with non-zero offset");
  }

  static identity = new Conversion();

  static from(source) {
    const offset = source.offset ?? 0;
    const hasOffset = !almostEqual(offset, 0.0);
    const factor = (source.denominator ?? 1) / (source.numerator ?? 1);
    return new Conversion(factor, hasOffset ? -offset : 0.0);
  }
}

function stripAliasPrefix(raw) {
  return raw.includes(":") ? raw.split(":")[1] : raw;
}

function qualifyItemName(raw, schemaName) {
  if (raw.includes("."))
    return raw;
  return `${schemaName}.${stripAliasPrefix(raw)}`;
}

function parseDefinition(definition) {
  const fragments = new Map();
  if (!expressionRgx.test(definition))
    throw new Error("Invalid definition expression.");

  for (const unit of definition.split("*")) {
    const tokens = unit.split(tokenRgx);
    const name = tokens[2];
    const exponent = tokens[3] ? Number(tokens[3]) : 1;
    const current = fragments.get(name);
    if (current)
      fragments.set(name, { ...current, exponent: current.exponent + exponent });
    else
      fragments.set(name, { name, exponent });
  }

  return fragments;
}

function buildResolvedUnitMap(sourceSchema) {
  const cache = new Map();

  function resolveDefinition(definition, depth) {
    const fragments = parseDefinition(definition);
    let result;

    for (const fragment of fragments.values()) {
      const fragName = stripAliasPrefix(fragment.name);
      const fragmentConversion = resolveItem(fragName, depth + 1).raise(fragment.exponent);
      result = result ? result.multiply(fragmentConversion) : fragmentConversion;
    }

    return result ?? Conversion.identity;
  }

  function resolveConstant(name, item, depth) {
    if (item.definition === name)
      return Conversion.identity;

    const selfConversion = Conversion.from({
      numerator: item.numerator ?? 1,
      denominator: item.denominator ?? 1,
    });
    return resolveDefinition(item.definition, depth + 1).compose(selfConversion);
  }

  function resolveUnit(name, item, depth) {
    if (item.definition === name)
      return Conversion.identity;

    const selfConversion = Conversion.from({
      numerator: item.numerator ?? 1,
      denominator: item.denominator ?? 1,
      offset: item.offset,
    });
    return resolveDefinition(item.definition, depth + 1).compose(selfConversion);
  }

  function resolveItem(name, depth) {
    if (depth > MAX_RESOLUTION_DEPTH)
      throw new Error(`Unit resolution depth exceeded ${MAX_RESOLUTION_DEPTH} for "${name}"`);

    const cached = cache.get(name);
    if (cached)
      return cached;

    const item = sourceSchema.items[name];
    if (!item)
      throw new Error(`Unknown schema item: "${name}"`);

    let conversion;
    if (item.schemaItemType === "Constant")
      conversion = resolveConstant(name, item, depth);
    else if (item.schemaItemType === "Unit")
      conversion = resolveUnit(name, item, depth);
    else
      throw new Error(`Cannot resolve item of type "${item.schemaItemType}": "${name}"`);

    cache.set(name, conversion);
    return conversion;
  }

  const resolved = new Map();
  for (const [name, item] of Object.entries(sourceSchema.items)) {
    if (item.schemaItemType !== "Unit")
      continue;

    const resolvedUnit = resolveItem(name, 0);
    resolved.set(name, {
      name: `${sourceSchema.name}.${name}`,
      phenomenon: item.phenomenon,
      factor: resolvedUnit.factor,
      offset: resolvedUnit.offset,
    });
  }

  return resolved;
}

function buildBasicConversionEntries(sourceSchema) {
  const resolvedUnits = buildResolvedUnitMap(sourceSchema);
  const entries = [];

  for (const unit of resolvedUnits.values()) {
    entries.push({
      key: unit.name,
      value: [unit.phenomenon, unit.factor, unit.offset],
    });
  }

  for (const [name, item] of Object.entries(sourceSchema.items)) {
    if (item.schemaItemType !== "InvertedUnit")
      continue;

    const invertsUnitName = qualifyItemName(item.invertsUnit, sourceSchema.name);
    const invertedSource = resolvedUnits.get(stripAliasPrefix(item.invertsUnit)) ?? resolvedUnits.get(invertsUnitName.slice(`${sourceSchema.name}.`.length));
    if (!invertedSource)
      throw new Error(`Cannot resolve InvertedUnit source "${item.invertsUnit}" for "${name}"`);

    entries.push({
      key: `${sourceSchema.name}.${name}`,
      value: [invertedSource.phenomenon, invertedSource.factor, invertedSource.offset, invertsUnitName],
    });
  }

  entries.sort((a, b) => a.key.localeCompare(b.key));
  assertUniqueGeneratedKeys(entries, "basic conversion data");
  return entries;
}

function buildGeneratedBasicConversionModule(sourceSchema) {
  const entries = buildBasicConversionEntries(sourceSchema);
  const lines = [
    "/*---------------------------------------------------------------------------------------------",
    "* Copyright (c) Bentley Systems, Incorporated. All rights reserved.",
    "* See LICENSE.md in the project root for license terms and full copyright notice.",
    "*--------------------------------------------------------------------------------------------*/",
    "// AUTO-GENERATED by scripts/generateUnitsJson.js. Do not edit by hand.",
    "",
    "/** @internal */",
    "export const basicUnitConversionData = {",
  ];

  for (const entry of entries) {
    const tuple = entry.value
      .map((value) => typeof value === "string" ? JSON.stringify(value) : String(value))
      .join(", ");
    lines.push(`  ${JSON.stringify(entry.key)}: [${tuple}],`);
  }

  lines.push("} as const;", "");
  return lines.join("\n");
}

module.exports = {
  buildGeneratedBasicConversionModule,
};
