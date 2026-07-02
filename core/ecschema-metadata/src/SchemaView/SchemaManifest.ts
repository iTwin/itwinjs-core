/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

/** One schema in a {@link SchemaManifest}: its identity, version, and the schemas it directly
 * references. References are held as direct entry objects, so closure and dependency-ordering walks
 * follow object links with no id or index indirection.
 * @internal
 */
export interface SchemaManifestEntry {
  readonly name: string;
  readonly readVersion: number;
  readonly writeVersion: number;
  readonly minorVersion: number;
  /** The schemas this schema directly references. */
  readonly references: readonly SchemaManifestEntry[];
}

/** The reference graph of every schema in one iModel. It is the cheap stand-in a {@link SchemaView}
 * husk loads up front so it can answer "which schemas exist" and "what is the dependency-ordered set
 * I must load to satisfy a request" without hydrating any schema data.
 *
 * The graph is a flat array of {@link SchemaManifestEntry}, each holding direct references to the
 * entries it depends on. For the largest real iModels this is on the order of a hundred entries and
 * a few hundred edges, so closure and topological walks are trivial; a heavier object graph would
 * buy nothing.
 *
 * The host (see `IModelDb`) builds the entries and wires their edges from ECDbMeta and hands them to
 * the constructor; this class keeps them free of any iModel or platform dependency and just indexes
 * them by name and answers closure queries. It knows nothing about which schemas are already loaded;
 * a caller that tracks that filters the result of {@link getSchemaClosure} itself.
 * @internal
 */
export class SchemaManifest {
  private readonly _entries: readonly SchemaManifestEntry[];
  private readonly _byLowerName: ReadonlyMap<string, SchemaManifestEntry>;

  /** Wraps a set of entries whose references are already wired to one another. */
  public constructor(entries: readonly SchemaManifestEntry[]) {
    this._entries = entries;
    const byLowerName = new Map<string, SchemaManifestEntry>();
    for (const entry of entries)
      byLowerName.set(entry.name.toLowerCase(), entry);
    this._byLowerName = byLowerName;
  }

  /** The number of schemas in the iModel. */
  public get schemaCount(): number { return this._entries.length; }

  /** The names of every schema in the iModel, in manifest order. Lets a husk enumerate what exists
   * without hydrating - or minting any flyweight for - an unloaded schema. */
  public getAvailableSchemaNames(): string[] {
    return this._entries.map((entry) => entry.name);
  }

  /** The entry for a schema by name (case-insensitive), or `undefined` if the iModel has no such schema. */
  public findByName(name: string): SchemaManifestEntry | undefined {
    return this._byLowerName.get(name.toLowerCase());
  }

  /** The transitive reference closure of the requested schemas: every requested schema the iModel
   * contains, plus every schema reachable from it through references, as a flat, duplicate-free list
   * of names. This is the full set that must be present to use the requested schemas. The order is
   * unspecified - a caller that needs a load order runs {@link sortInDependencyOrder} on the result.
   *
   * The manifest does not know which schemas are already loaded; the result is the full closure and
   * a caller that tracks loaded schemas filters them out itself.
   *
   * Requested names the iModel does not contain are ignored; a caller that needs to surface them can
   * check {@link findByName} first.
   */
  public getSchemaClosure(requestedNames: Iterable<string>): string[] {
    const result: string[] = [];
    const visited = new Set<SchemaManifestEntry>();

    const visit = (entry: SchemaManifestEntry): void => {
      if (visited.has(entry))
        return;
      visited.add(entry);
      result.push(entry.name);
      for (const reference of entry.references)
        visit(reference);
    };

    for (const name of requestedNames) {
      const entry = this._byLowerName.get(name.toLowerCase());
      if (entry !== undefined)
        visit(entry);
    }
    return result;
  }

  /** Orders the given schema names so that each appears after every schema it references, directly
   * or transitively - a dependency order a caller can load front to back. References through schemas
   * not in `schemaNames` are still honored, so the result is a correct order of the subset even when
   * an intermediate schema is left out. Names the iModel does not contain are ignored, and reference
   * cycles - which EC forbids - are broken arbitrarily rather than looping.
   * @internal
   */
  public sortInDependencyOrder(schemaNames: Iterable<string>): string[] {
    const requested = new Set<SchemaManifestEntry>();
    for (const name of schemaNames) {
      const entry = this._byLowerName.get(name.toLowerCase());
      if (entry !== undefined)
        requested.add(entry);
    }

    const result: string[] = [];
    const visited = new Set<SchemaManifestEntry>();
    const visiting = new Set<SchemaManifestEntry>();

    const visit = (entry: SchemaManifestEntry): void => {
      if (visited.has(entry) || visiting.has(entry))
        return;
      visiting.add(entry);
      for (const reference of entry.references)
        visit(reference);
      visiting.delete(entry);
      visited.add(entry);
      if (requested.has(entry))
        result.push(entry.name);
    };

    for (const entry of requested)
      visit(entry);
    return result;
  }
}
