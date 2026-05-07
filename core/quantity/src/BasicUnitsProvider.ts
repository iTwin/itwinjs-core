/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { UnitProps, UnitsProvider } from "./Interfaces";
import type { SerializedUnitSchema } from "./SerializedUnitSchema";
import { BadUnit } from "./Unit";
import { getBasicUnitConversion } from "./internal/BasicUnitConversionData";
import { _testResetBasicUnitsResolvedStateCache, resolveBasicUnitsResolvedState } from "./internal/BasicUnitsResolvedStateCache";

async function resolveState() {
  return resolveBasicUnitsResolvedState(async () => {
    // First caller pays the dynamic-import + schema-index build cost.
    // Concurrent callers await the same promise, and later callers reuse the resolved state.
    const { default: schema } = await import("./assets/Units.json");
    return schema as SerializedUnitSchema;
  });
}

/** @internal — test use only. Resets the shared module-level lazy cache. */
export function _testResetUnitsCache(): void {
  _testResetBasicUnitsResolvedStateCache();
}

/**
 * A `UnitsProvider` backed by the full BIS `Units.ecschema.json` bundled as a JSON asset.
 *
 * The bundled JSON is loaded lazily via dynamic `import()` on the first provider call and cached
 * at module scope — construction is essentially free, and multiple instances
 * share the same immutable lookup indexes.
 *
 * This is the zero-dependency default for backends, tools, and any frontend that doesn't need
 * iModel overrides. Equivalent to calling `createUnitsProvider()` with no arguments.
 *
 * @see createUnitsProvider for layering schema-defined units on top of basic BIS units.
 * @beta
 */
export class BasicUnitsProvider implements UnitsProvider {

  // ── UnitsProvider implementation ─────────────────────────────────────

  /** Find a unit by its display label, optionally filtering by schema name, phenomenon, and unit system.
   * @param unitLabel - The display label to search for (case-insensitive).
   * @param schemaName - Optional schema name filter. Returns `BadUnit` if provided and not `"Units"`.
   * @param phenomenon - Optional phenomenon filter (e.g. `"Units.LENGTH"`).
   * @param unitSystem - Optional unit system filter (e.g. `"Units.METRIC"`).
   * @returns The matching `UnitProps`, or a `BadUnit` if no match is found.
   */
  public async findUnit(unitLabel: string, schemaName?: string, phenomenon?: string, unitSystem?: string): Promise<UnitProps> {
    const state = await resolveState();
    if (schemaName && schemaName !== state.schemaName) {
      return new BadUnit();
    }
    const candidates = state.labelMap.get(unitLabel.toLowerCase());
    if (!candidates || candidates.length === 0) {
      return new BadUnit();
    }

    for (const c of candidates) {
      if (phenomenon && c.props.phenomenon !== phenomenon) {
        continue;
      }
      if (unitSystem && c.props.system !== unitSystem) {
        continue;
      }
      return c.props;
    }

    return new BadUnit();
  }

  /** Return all units belonging to the given phenomenon (unit family).
   * @param phenomenon - The phenomenon full name (e.g. `"Units.LENGTH"`).
   * @returns An array of matching `UnitProps`, or an empty array if none.
   */
  public async getUnitsByFamily(phenomenon: string): Promise<UnitProps[]> {
    const state = await resolveState();
    const entries = state.phenomenonMap.get(phenomenon);
    return entries ? entries.map((e) => e.props) : [];
  }

  /** Find a unit by its fully-qualified name (e.g. `"Units.M"`).
   * @param unitName - The qualified unit name.
   * @returns The matching `UnitProps`, or a `BadUnit` if not found.
   */
  public async findUnitByName(unitName: string): Promise<UnitProps> {
    const state = await resolveState();
    const entry = state.nameMap.get(unitName);
    return entry ? entry.props : new BadUnit();
  }

  /** Compute the conversion factors from `fromUnit` to `toUnit`.
   * Handles normal units, inverted units, and mixed (inverted ↔ non-inverted) conversions.
   * @param fromUnit - The source unit.
   * @param toUnit - The target unit.
   * @returns A `UnitConversionProps` with `factor`, `offset`, and optionally `inversion` and `error`.
   */
  public async getConversion(fromUnit: UnitProps, toUnit: UnitProps) {
    const state = await resolveState();
    return getBasicUnitConversion(state, fromUnit, toUnit);
  }
}
