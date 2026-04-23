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

/** Immutable lookup indexes resolved from the bundled Units.json. */
interface ResolvedState {
  readonly nameMap: Map<string, IndexedUnit>;
  readonly labelMap: Map<string, IndexedUnit[]>;
  readonly phenomenonMap: Map<string, IndexedUnit[]>;
  readonly invertedUnits: Map<string, InvertedEntry>;
}

// Module-level cache: the unit data is derived deterministically from the static Units.json
// import, so the resolved indexes are effectively an immutable constant. Caching at module
// scope avoids redundant work when multiple BasicUnitsProvider instances are created (e.g.
// in tests or when composed inside CompositeUnitsProvider).
let cachedState: ResolvedState | undefined;

function resolveState(): ResolvedState {
  if (cachedState)
    return cachedState;

  const nameMap = new Map<string, IndexedUnit>();
  const labelMap = new Map<string, IndexedUnit[]>();
  const phenomenonMap = new Map<string, IndexedUnit[]>();
  const invertedUnits = new Map<string, InvertedEntry>();

  const s = schema as SerializedUnitSchema;
  const resolver = new UnitDefinitionResolver(s);
  const resolved = resolver.resolveAll();

  for (const [name, entry] of resolved) {
    const item = s.items[name] as SerializedUnit;
    const phenomenon = item.phenomenon;
    const unitSystem = item.unitSystem;

    const fullName = `${s.name}.${name}`;
    const props: UnitProps = {
      name: fullName,
      label: entry.label,
      phenomenon,
      isValid: true,
      system: unitSystem,
    };

    const indexed: IndexedUnit = { props, resolved: entry };

    nameMap.set(fullName, indexed);
    const lowerLabel = entry.label.toLowerCase();
    const byLabel = labelMap.get(lowerLabel) ?? [];
    byLabel.push(indexed);
    labelMap.set(lowerLabel, byLabel);

    const byPhen = phenomenonMap.get(phenomenon) ?? [];
    byPhen.push(indexed);
    phenomenonMap.set(phenomenon, byPhen);
  }

  // Handle InvertedUnit items
  for (const [name, item] of Object.entries(s.items)) {
    if (item.schemaItemType !== "InvertedUnit")
      continue;
    const inv: SerializedInvertedUnit = item;
    const fullName = `${s.name}.${name}`;
    const invertsName = inv.invertsUnit.includes(".") ? inv.invertsUnit : `${s.name}.${inv.invertsUnit.includes(":") ? inv.invertsUnit.split(":")[1] : inv.invertsUnit}`;
    const unitSystem = inv.unitSystem;

    const invertedSource = nameMap.get(invertsName);
    const phenomenon = invertedSource?.props.phenomenon ?? "";

    const props: UnitProps = {
      name: fullName,
      label: inv.label ?? name,
      phenomenon,
      isValid: true,
      system: unitSystem,
    };

    invertedUnits.set(fullName, { props, invertsUnitName: invertsName });

    if (invertedSource) {
      const indexed: IndexedUnit = {
        props,
        resolved: { ...invertedSource.resolved, name: fullName, label: props.label, unitSystem },
      };
      nameMap.set(fullName, indexed);

      const lowerLabel = props.label.toLowerCase();
      const byLabel = labelMap.get(lowerLabel) ?? [];
      byLabel.push(indexed);
      labelMap.set(lowerLabel, byLabel);

      const byPhen = phenomenonMap.get(phenomenon) ?? [];
      byPhen.push(indexed);
      phenomenonMap.set(phenomenon, byPhen);
    }
  }

  cachedState = { nameMap, labelMap, phenomenonMap, invertedUnits };
  return cachedState;
}

/**
 * A `UnitsProvider` backed by the full BIS `Units.ecschema.json` bundled as a JSON asset.
 *
 * Unit data is resolved lazily on first use and cached at module scope — construction is
 * essentially free, and multiple instances share the same immutable lookup indexes.
 *
 * This is the zero-dependency default for backends, tools, and any frontend that doesn't need
 * iModel overrides. Equivalent to calling `createUnitsProvider()` with no arguments.
 *
 * @see createUnitsProvider for layering schema-defined units on top of basic BIS units.
 * @beta
 */
export class BasicUnitsProvider implements UnitsProvider {
  private readonly _nameMap: Map<string, IndexedUnit>;
  private readonly _labelMap: Map<string, IndexedUnit[]>;
  private readonly _phenomenonMap: Map<string, IndexedUnit[]>;
  private readonly _invertedUnits: Map<string, InvertedEntry>;

  constructor() {
    const state = resolveState();
    this._nameMap = state.nameMap;
    this._labelMap = state.labelMap;
    this._phenomenonMap = state.phenomenonMap;
    this._invertedUnits = state.invertedUnits;
  }

  // ── UnitsProvider implementation ─────────────────────────────────────

  /** Find a unit by its display label, optionally filtering by schema name, phenomenon, and unit system.
   * @param unitLabel - The display label to search for (case-insensitive).
   * @param schemaName - Optional schema name filter. Returns `BadUnit` if provided and not `"Units"`.
   * @param phenomenon - Optional phenomenon filter (e.g. `"Units.LENGTH"`).
   * @param unitSystem - Optional unit system filter (e.g. `"Units.METRIC"`).
   * @returns The matching `UnitProps`, or a `BadUnit` if no match is found.
   */
  public async findUnit(unitLabel: string, schemaName?: string, phenomenon?: string, unitSystem?: string): Promise<UnitProps> {
    if (schemaName && schemaName !== "Units")
      return new BadUnit();

    const candidates = this._labelMap.get(unitLabel.toLowerCase());
    if (!candidates || candidates.length === 0)
      return new BadUnit();

    for (const c of candidates) {
      if (phenomenon && c.props.phenomenon !== phenomenon)
        continue;
      if (unitSystem && c.props.system !== unitSystem)
        continue;
      return c.props;
    }

    return new BadUnit();
  }

  /** Return all units belonging to the given phenomenon (unit family).
   * @param phenomenon - The phenomenon full name (e.g. `"Units.LENGTH"`).
   * @returns An array of matching `UnitProps`, or an empty array if none.
   */
  public async getUnitsByFamily(phenomenon: string): Promise<UnitProps[]> {
    const entries = this._phenomenonMap.get(phenomenon);
    return entries ? entries.map((e) => e.props) : [];
  }

  /** Find a unit by its fully-qualified name (e.g. `"Units.M"`).
   * @param unitName - The qualified unit name.
   * @returns The matching `UnitProps`, or a `BadUnit` if not found.
   */
  public async findUnitByName(unitName: string): Promise<UnitProps> {
    const entry = this._nameMap.get(unitName);
    return entry ? entry.props : new BadUnit();
  }

  /** Compute the conversion factors from `fromUnit` to `toUnit`.
   * Handles normal units, inverted units, and mixed (inverted ↔ non-inverted) conversions.
   * @param fromUnit - The source unit.
   * @param toUnit - The target unit.
   * @returns A `UnitConversionProps` with `factor`, `offset`, and optionally `inversion` and `error`.
   */
  public async getConversion(fromUnit: UnitProps, toUnit: UnitProps): Promise<UnitConversionProps> {
    const from = this._nameMap.get(fromUnit.name);
    const to = this._nameMap.get(toUnit.name);

    if (!from || !to)
      return { factor: 1.0, offset: 0.0, error: true };

    const fromInverted = this._invertedUnits.get(fromUnit.name);
    const toInverted = this._invertedUnits.get(toUnit.name);

    const fromPhenomenon = fromInverted
      ? this._nameMap.get(fromInverted.invertsUnitName)?.props.phenomenon
      : from.props.phenomenon;
    const toPhenomenon = toInverted
      ? this._nameMap.get(toInverted.invertsUnitName)?.props.phenomenon
      : to.props.phenomenon;
    if (fromPhenomenon !== toPhenomenon)
      return { factor: 1.0, offset: 0.0, error: true };

    if (fromInverted && toInverted) {
      const innerFrom = this._nameMap.get(fromInverted.invertsUnitName);
      const innerTo = this._nameMap.get(toInverted.invertsUnitName);
      if (innerFrom && innerTo) {
        const c = innerFrom.resolved.conversion.inverse().compose(innerTo.resolved.conversion);
        return { factor: c.factor, offset: c.offset };
      }
    }

    if (fromInverted) {
      const innerFrom = this._nameMap.get(fromInverted.invertsUnitName);
      if (innerFrom) {
        const c = innerFrom.resolved.conversion.inverse().compose(to.resolved.conversion);
        return { factor: c.factor, offset: c.offset, inversion: UnitConversionInvert.InvertPreConversion };
      }
    }

    if (toInverted) {
      const innerTo = this._nameMap.get(toInverted.invertsUnitName);
      if (innerTo) {
        const c = from.resolved.conversion.inverse().compose(innerTo.resolved.conversion);
        return { factor: c.factor, offset: c.offset, inversion: UnitConversionInvert.InvertPostConversion };
      }
    }

    const conv = from.resolved.conversion.inverse().compose(to.resolved.conversion);
    return { factor: conv.factor, offset: conv.offset };
  }
}
