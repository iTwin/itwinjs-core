/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { UnitConversionInvert, type UnitConversionProps, type UnitProps, type UnitsProvider } from "./Interfaces";
import type { SerializedInvertedUnit, SerializedUnit, SerializedUnitSchema } from "./SerializedUnitSchema";
import { type ResolvedUnit, UnitDefinitionResolver } from "./UnitConversion/UnitDefinitionResolver";
import { BadUnit } from "./Unit";
import schema from "./assets/Units.json";

interface IndexedUnit {
  readonly props: UnitProps;
  readonly resolved: ResolvedUnit;
}

interface InvertedEntry {
  readonly props: UnitProps;
  readonly invertsUnitName: string;
}

/**
 * A `UnitsProvider` backed by the full BIS `Units.ecschema.json` (492 units) bundled as a JSON asset.
 *
 * Lazy static initialization: the JSON is parsed, all units resolved, and lookup indexes built on
 * first use. Subsequent instances share the same static data.
 *
 * @beta
 */
export class BundledUnitsProvider implements UnitsProvider {
  // ── Static shared state ──────────────────────────────────────────────
  private static _initialized = false;
  private static _nameMap = new Map<string, IndexedUnit>();
  private static _labelMap = new Map<string, IndexedUnit[]>();
  private static _phenomenonMap = new Map<string, IndexedUnit[]>();
  private static _invertedUnits = new Map<string, InvertedEntry>();

  private static _ensureInitialized(): void {
    if (BundledUnitsProvider._initialized)
      return;

    const resolver = new UnitDefinitionResolver(schema as SerializedUnitSchema);
    const resolved = resolver.resolveAll();

    for (const [qualifiedName, entry] of resolved) {
      const s = schema as SerializedUnitSchema;
      const item = s.items[qualifiedName.split(":")[1]] as SerializedUnit;
      // JSON values are already in SchemaName.ItemName format (e.g. "Units.LENGTH", "Units.METRIC")
      const phenomenon = item.phenomenon;
      const unitSystem = item.unitSystem;

      // Qualified name uses schema name for external compatibility: Units.M, not u:M
      const fullName = `${s.name}.${qualifiedName.split(":")[1]}`;
      const props: UnitProps = {
        name: fullName,
        label: entry.label,
        phenomenon,
        isValid: true,
        system: unitSystem,
      };

      const indexed: IndexedUnit = { props, resolved: entry };

      BundledUnitsProvider._nameMap.set(fullName, indexed);
      // Label index — lowercase for case-insensitive lookup
      const lowerLabel = entry.label.toLowerCase();
      const byLabel = BundledUnitsProvider._labelMap.get(lowerLabel) ?? [];
      byLabel.push(indexed);
      BundledUnitsProvider._labelMap.set(lowerLabel, byLabel);

      // Phenomenon index
      const byPhen = BundledUnitsProvider._phenomenonMap.get(phenomenon) ?? [];
      byPhen.push(indexed);
      BundledUnitsProvider._phenomenonMap.set(phenomenon, byPhen);
    }

    // Handle InvertedUnit items (3 in current schema)
    const s2 = schema as SerializedUnitSchema;
    for (const [name, item] of Object.entries(s2.items)) {
      if (item.schemaItemType !== "InvertedUnit")
        continue;
      const inv: SerializedInvertedUnit = item;
      const fullName = `${s2.name}.${name}`;
      const invertsName = inv.invertsUnit.includes(".") ? inv.invertsUnit : `${s2.name}.${inv.invertsUnit.includes(":") ? inv.invertsUnit.split(":")[1] : inv.invertsUnit}`;
      const unitSystem = inv.unitSystem;

      // Derive phenomenon from the unit it inverts
      const invertedSource = BundledUnitsProvider._nameMap.get(invertsName);
      const phenomenon = invertedSource?.props.phenomenon ?? "";

      const props: UnitProps = {
        name: fullName,
        label: inv.label ?? name,
        phenomenon,
        isValid: true,
        system: unitSystem,
      };

      BundledUnitsProvider._invertedUnits.set(fullName, { props, invertsUnitName: invertsName });

      // Also index the inverted unit by name for findUnitByName
      // We'll create a synthetic IndexedUnit with identity conversion — actual conversion is handled in getConversion
      if (invertedSource) {
        const indexed: IndexedUnit = {
          props,
          resolved: { ...invertedSource.resolved, name: fullName, label: props.label, unitSystem },
        };
        BundledUnitsProvider._nameMap.set(fullName, indexed);

        const lowerLabel = props.label.toLowerCase();
        const byLabel = BundledUnitsProvider._labelMap.get(lowerLabel) ?? [];
        byLabel.push(indexed);
        BundledUnitsProvider._labelMap.set(lowerLabel, byLabel);

        const byPhen = BundledUnitsProvider._phenomenonMap.get(phenomenon) ?? [];
        byPhen.push(indexed);
        BundledUnitsProvider._phenomenonMap.set(phenomenon, byPhen);
      }
    }

    BundledUnitsProvider._initialized = true;
  }

  // ── UnitsProvider implementation ─────────────────────────────────────

  /** Find a unit by its display label, optionally filtering by schema name, phenomenon, and unit system.
   * @param unitLabel - The display label to search for (case-insensitive).
   * @param schemaName - Optional schema name filter (currently unused).
   * @param phenomenon - Optional phenomenon filter (e.g. `"Units.LENGTH"`).
   * @param unitSystem - Optional unit system filter (e.g. `"Units.METRIC"`).
   * @returns The matching `UnitProps`, or a `BadUnit` if no match is found.
   */
  public async findUnit(unitLabel: string, schemaName?: string, phenomenon?: string, unitSystem?: string): Promise<UnitProps> {
    void schemaName; // Reserved for future schema-scoped filtering
    BundledUnitsProvider._ensureInitialized();

    const candidates = BundledUnitsProvider._labelMap.get(unitLabel.toLowerCase());
    if (!candidates || candidates.length === 0)
      return new BadUnit();

    // Filter by optional constraints
    for (const c of candidates) {
      if (phenomenon && c.props.phenomenon !== phenomenon)
        continue;
      if (unitSystem && c.props.system !== unitSystem)
        continue;
      return c.props;
    }

    // If no match with filters, return BadUnit
    return new BadUnit();
  }

  /** Return all units belonging to the given phenomenon (unit family).
   * @param phenomenon - The phenomenon full name (e.g. `"Units.LENGTH"`).
   * @returns An array of matching `UnitProps`, or an empty array if none.
   */
  public async getUnitsByFamily(phenomenon: string): Promise<UnitProps[]> {
    BundledUnitsProvider._ensureInitialized();
    const entries = BundledUnitsProvider._phenomenonMap.get(phenomenon);
    return entries ? entries.map((e) => e.props) : [];
  }

  /** Find a unit by its fully-qualified name (e.g. `"Units.M"`).
   * @param unitName - The qualified unit name.
   * @returns The matching `UnitProps`, or a `BadUnit` if not found.
   */
  public async findUnitByName(unitName: string): Promise<UnitProps> {
    BundledUnitsProvider._ensureInitialized();
    const entry = BundledUnitsProvider._nameMap.get(unitName);
    return entry ? entry.props : new BadUnit();
  }

  /** Compute the conversion factors from `fromUnit` to `toUnit`.
   * Handles normal units, inverted units, and mixed (inverted ↔ non-inverted) conversions.
   * @param fromUnit - The source unit.
   * @param toUnit - The target unit.
   * @returns A `UnitConversionProps` with `factor`, `offset`, and optionally `inversion` and `error`.
   */
  public async getConversion(fromUnit: UnitProps, toUnit: UnitProps): Promise<UnitConversionProps> {
    BundledUnitsProvider._ensureInitialized();

    const from = BundledUnitsProvider._nameMap.get(fromUnit.name);
    const to = BundledUnitsProvider._nameMap.get(toUnit.name);

    if (!from || !to)
      return { factor: 1.0, offset: 0.0, error: true };

    const fromInverted = BundledUnitsProvider._invertedUnits.get(fromUnit.name);
    const toInverted = BundledUnitsProvider._invertedUnits.get(toUnit.name);

    // Validate dimensional compatibility — reject cross-phenomenon conversions
    const fromPhenomenon = fromInverted
      ? BundledUnitsProvider._nameMap.get(fromInverted.invertsUnitName)?.props.phenomenon
      : from.props.phenomenon;
    const toPhenomenon = toInverted
      ? BundledUnitsProvider._nameMap.get(toInverted.invertsUnitName)?.props.phenomenon
      : to.props.phenomenon;
    if (fromPhenomenon !== toPhenomenon)
      return { factor: 1.0, offset: 0.0, error: true };

    // Case: both are inverted units
    if (fromInverted && toInverted) {
      const innerFrom = BundledUnitsProvider._nameMap.get(fromInverted.invertsUnitName);
      const innerTo = BundledUnitsProvider._nameMap.get(toInverted.invertsUnitName);
      if (innerFrom && innerTo) {
        const c = innerFrom.resolved.conversion.inverse().compose(innerTo.resolved.conversion);
        return { factor: c.factor, offset: c.offset };
      }
    }

    // Case: from is an inverted unit
    if (fromInverted) {
      const innerFrom = BundledUnitsProvider._nameMap.get(fromInverted.invertsUnitName);
      if (innerFrom) {
        const c = innerFrom.resolved.conversion.inverse().compose(to.resolved.conversion);
        return { factor: c.factor, offset: c.offset, inversion: UnitConversionInvert.InvertPreConversion };
      }
    }

    // Case: to is an inverted unit
    if (toInverted) {
      const innerTo = BundledUnitsProvider._nameMap.get(toInverted.invertsUnitName);
      if (innerTo) {
        const c = from.resolved.conversion.inverse().compose(innerTo.resolved.conversion);
        return { factor: c.factor, offset: c.offset, inversion: UnitConversionInvert.InvertPostConversion };
      }
    }

    // Normal case: inverse(from) ∘ to
    const conv = from.resolved.conversion.inverse().compose(to.resolved.conversion);
    return { factor: conv.factor, offset: conv.offset };
  }

  /** Reset all static state for testing purposes.
   * @internal
   */
  public static resetForTesting(): void {
    BundledUnitsProvider._initialized = false;
    BundledUnitsProvider._nameMap.clear();
    BundledUnitsProvider._labelMap.clear();
    BundledUnitsProvider._phenomenonMap.clear();
    BundledUnitsProvider._invertedUnits.clear();
  }
}
