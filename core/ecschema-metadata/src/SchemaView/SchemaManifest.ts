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
 * @beta
 */
export interface SchemaManifestEntry {
  readonly name: string;
  readonly readVersion: number;
  readonly writeVersion: number;
  readonly minorVersion: number;
  /** The schemas this schema directly references. */
  readonly references: readonly SchemaManifestEntry[];
}

/** One row of `SELECT ECInstanceId, Name, VersionMajor, VersionWrite, VersionMinor FROM
 * meta.ECSchemaDef`, as passed to {@link SchemaManifest.fromRows}. The id is a plain number,
 * matching SchemaView's convention for schema-related rows: `ec_` metadata rowids carry no
 * briefcase prefix, so they are small and exactly representable. It is used only to wire
 * reference edges and is not retained in the manifest.
 * @internal
 */
export interface SchemaManifestSchemaRow {
  readonly ecInstanceId: number;
  readonly name: string;
  readonly versionMajor: number;
  readonly versionWrite: number;
  readonly versionMinor: number;
}

/** One row of `SELECT SourceECInstanceId, TargetECInstanceId FROM meta.SchemaHasSchemaReferences`,
 * as passed to {@link SchemaManifest.fromRows}.
 * @internal
 */
export interface SchemaManifestReferenceRow {
  readonly sourceECInstanceId: number;
  readonly targetECInstanceId: number;
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
 * A `SchemaViewDataProvider` builds the manifest from ECDbMeta rows via {@link fromRows}; this class
 * keeps the entries free of any iModel or platform dependency and just indexes them by name and
 * answers closure queries. It knows nothing about which schemas are already loaded; the
 * `SchemaViewManager` tracks that and filters the result of {@link getSchemaClosure} itself.
 * @beta
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

  /** Build a manifest from raw ECDbMeta query rows. This is the one place the row-to-graph wiring
   * walk lives, so every `SchemaViewDataProvider` implementation just runs the two queries and hands
   * the rows over. The `ec_Schema` ids in the rows are used only to connect reference edges; the
   * manifest itself carries no ids.
   *
   * Reference rows whose endpoints are unknown or self-referential are skipped - a defensive guard
   * that cannot happen for a well-formed iModel.
   * @internal
   */
  public static fromRows(schemaRows: readonly SchemaManifestSchemaRow[], referenceRows: readonly SchemaManifestReferenceRow[]): SchemaManifest {
    // Mutable during the wiring walk below; the manifest treats entries as read-only once handed over.
    type MutableEntry = Omit<SchemaManifestEntry, "references"> & { references: SchemaManifestEntry[] };

    const entries: MutableEntry[] = [];
    // ec_Schema ECInstanceId -> entry, so the reference walk can look up both endpoints by id.
    const entryByECInstanceId = new Map<number, MutableEntry>();
    for (const row of schemaRows) {
      const entry: MutableEntry = {
        name: row.name,
        readVersion: row.versionMajor,
        writeVersion: row.versionWrite,
        minorVersion: row.versionMinor,
        references: [],
      };
      entries.push(entry);
      entryByECInstanceId.set(row.ecInstanceId, entry);
    }

    for (const row of referenceRows) {
      const source = entryByECInstanceId.get(row.sourceECInstanceId);
      const target = entryByECInstanceId.get(row.targetECInstanceId);
      if (source === undefined || target === undefined || source === target || source.references.includes(target))
        continue;
      source.references.push(target);
    }

    return new SchemaManifest(entries);
  }

  /** The number of schemas in the iModel. */
  public get schemaCount(): number { return this._entries.length; }

  /** The names of every schema in the iModel, in manifest order. Lets a husk enumerate what exists
   * without hydrating - or minting any flyweight for - an unloaded schema. */
  public getAvailableSchemaNames(): string[] {
    return this._entries.map((entry) => entry.name);
  }

  public get entries(): readonly SchemaManifestEntry[] {
    return this._entries;
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
