/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BasicUnitsProvider } from "./BasicUnitsProvider";
import type { UnitConversionProps, UnitProps, UnitsProvider } from "./Interfaces";
import { BadUnit } from "./Unit";

/**
 * Options for [[createUnitsProvider]].
 * @beta
 */
export interface CreateUnitsProviderOptions {
  /**
   * A `UnitsProvider` consulted before the basic BIS units (e.g. a `SchemaUnitProvider`
   * for an open iModel's `SchemaContext`). When omitted, the returned provider behaves
   * exactly like `new BasicUnitsProvider()`.
   */
  primary?: UnitsProvider;

  /**
   * Controls which provider is consulted first and wins ties.
   * - `"preferSchema"` (default): `primary` is authoritative; bundled BIS units are fallback.
   * - `"preferBundled"`: bundled BIS units win; `primary` is consulted only for units not in
   *   the bundled set. Use when the iModel's schema may be stale.
   *
   * Affects `findUnit`, `findUnitByName`, and `getConversion` (first-consulted wins or
   * falls through). `getUnitsByFamily` always merges both providers — the first-consulted
   * provider wins name collisions.
   *
   * Has no effect when `primary` is omitted — the returned provider is a plain `BasicUnitsProvider`.
   */
  bisUnitsPolicy?: "preferSchema" | "preferBundled";
}

/**
 * Returns a `UnitsProvider` that layers the basic BIS units under (or over) an optional
 * `primary` provider. Typical use: layer an iModel's schema units on top of the bundled
 * defaults from `@itwin/core-quantity`.
 *
 * Precedence rules:
 * - When `primary` is supplied and `bisUnitsPolicy` is `"preferSchema"` (the default): `primary` wins;
 *   basic BIS units fill any gaps where `primary` returns an invalid unit or throws.
 * - When `bisUnitsPolicy` is `"preferBundled"`: basic BIS units win; `primary` is consulted only when the
 *   basic provider can't answer.
 * - `getUnitsByFamily` always merges results from both providers, deduplicated by
 *   `UnitProps.name` (fully-qualified). The first-consulted provider wins ties.
 * - When no `primary` is supplied, the returned provider is exactly `new BasicUnitsProvider()`
 *   (no wrapper), preserving `instanceof` checks and keeping the hot path fast.
 *
 * @beta
 */
export function createUnitsProvider(options: CreateUnitsProviderOptions = {}): UnitsProvider {
  const basic = new BasicUnitsProvider();
  const primary = options.primary;
  // NOTE: returns BasicUnitsProvider directly when no primary is provided.
  // QuantityFormatter.resetToUseInternalUnitsProvider uses instanceof BasicUnitsProvider to detect this.
  // If this fast-path is ever wrapped (e.g. for telemetry), that guard must be updated.
  if (!primary) {
    return basic;
  }

  const providers = options.bisUnitsPolicy === "preferBundled" ? [basic, primary] : [primary, basic];
  return new CompositeUnitsProvider(providers);
}

class CompositeUnitsProvider implements UnitsProvider {
  constructor(private readonly _providers: UnitsProvider[]) {}

  public async findUnit(label: string, schemaName?: string, phenomenon?: string, unitSystem?: string): Promise<UnitProps> {
    for (let i = 0; i < this._providers.length - 1; i++) {
      const hit = await tryFind(async () => this._providers[i].findUnit(label, schemaName, phenomenon, unitSystem));
      if (hit?.isValid) {
        return hit;
      }
    }
    return tryFind(async () => this._providers[this._providers.length - 1].findUnit(label, schemaName, phenomenon, unitSystem)).then((hit) => hit ?? new BadUnit());
  }

  public async findUnitByName(name: string): Promise<UnitProps> {
    for (let i = 0; i < this._providers.length - 1; i++) {
      const hit = await tryFind(async () => this._providers[i].findUnitByName(name));
      if (hit?.isValid) {
        return hit;
      }
    }
    return tryFind(async () => this._providers[this._providers.length - 1].findUnitByName(name)).then((hit) => hit ?? new BadUnit());
  }

  public async getUnitsByFamily(phenomenon: string): Promise<UnitProps[]> {
    const seen = new Set<string>();
    const out: UnitProps[] = [];
    // Query all providers in parallel; process results in declaration order to honour precedence.
    const results = await Promise.all(this._providers.map(async (p) => tryList(async () => p.getUnitsByFamily(phenomenon))));
    for (const units of results) {
      for (const u of units) {
        if (!seen.has(u.name)) {
          seen.add(u.name);
          out.push(u);
        }
      }
    }
    return out;
  }

  public async getConversion(from: UnitProps, to: UnitProps): Promise<UnitConversionProps> {
    for (let i = 0; i < this._providers.length - 1; i++) {
      try {
        const result = await this._providers[i].getConversion(from, to);
        if (!result.error) {
          return result;
        }
      } catch { /* fall through to next provider */ }
    }
    try {
      return await this._providers[this._providers.length - 1].getConversion(from, to);
    } catch {
      return { factor: 1.0, offset: 0.0, error: true };
    }
  }
}

async function tryFind(fn: () => Promise<UnitProps>): Promise<UnitProps | undefined> {
  try { return await fn(); } catch { return undefined; }
}

async function tryList(fn: () => Promise<UnitProps[]>): Promise<UnitProps[]> {
  try { return await fn(); } catch { return []; }
}
