/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BasicUnitsProvider } from "./BasicUnitsProvider";
import type { UnitConversionProps, UnitProps, UnitsProvider } from "./Interfaces";

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
   * When `true`, the basic BIS units win on conflict; `primary` is only consulted when the
   * basic provider can't answer. Defaults to `false` (primary wins).
   *
   * Only affects `findUnit`, `findUnitByName`, and `getConversion`. `getUnitsByFamily` always
   * merges results from both providers, deduplicated by fully-qualified unit name, with the
   * first-consulted provider winning ties.
   */
  preferBasic?: boolean;
}

/**
 * Returns a `UnitsProvider` that layers the basic BIS units under (or over) an optional
 * `primary` provider. Typical use: layer an iModel's schema units on top of the bundled
 * defaults from `@itwin/core-quantity`.
 *
 * Precedence rules:
 * - When `primary` is supplied and `preferBasic` is `false` (the default): `primary` wins;
 *   basic BIS units fill any gaps where `primary` returns an invalid unit or throws.
 * - When `preferBasic` is `true`: basic BIS units win; `primary` is consulted only when the
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
  if (!primary)
    return basic;

  const [first, second] = options.preferBasic ? [basic, primary] : [primary, basic];
  return new CompositeUnitsProvider(first, second);
}

class CompositeUnitsProvider implements UnitsProvider {
  constructor(private readonly _first: UnitsProvider, private readonly _second: UnitsProvider) {}

  public async findUnit(label: string, schemaName?: string, phenomenon?: string, unitSystem?: string): Promise<UnitProps> {
    const hit = await tryFind(() => this._first.findUnit(label, schemaName, phenomenon, unitSystem));
    if (hit?.isValid)
      return hit;
    return this._second.findUnit(label, schemaName, phenomenon, unitSystem);
  }

  public async findUnitByName(name: string): Promise<UnitProps> {
    const hit = await tryFind(() => this._first.findUnitByName(name));
    if (hit?.isValid)
      return hit;
    return this._second.findUnitByName(name);
  }

  public async getUnitsByFamily(phenomenon: string): Promise<UnitProps[]> {
    const [a, b] = await Promise.all([
      tryList(() => this._first.getUnitsByFamily(phenomenon)),
      tryList(() => this._second.getUnitsByFamily(phenomenon)),
    ]);
    // Merge, dedupe by UnitProps.name (fully-qualified), first-seen wins (order reflects preferBasic).
    const seen = new Set<string>();
    const out: UnitProps[] = [];
    for (const u of [...a, ...b]) {
      if (!seen.has(u.name)) {
        seen.add(u.name);
        out.push(u);
      }
    }
    return out;
  }

  public async getConversion(from: UnitProps, to: UnitProps): Promise<UnitConversionProps> {
    try {
      return await this._first.getConversion(from, to);
    } catch {
      return this._second.getConversion(from, to);
    }
  }
}

async function tryFind(fn: () => Promise<UnitProps>): Promise<UnitProps | undefined> {
  try { return await fn(); } catch { return undefined; }
}

async function tryList(fn: () => Promise<UnitProps[]>): Promise<UnitProps[]> {
  try { return await fn(); } catch { return []; }
}
