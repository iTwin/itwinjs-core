/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

/** One schema in a {@link SchemaManifest}: its name, version, and the entries it directly references.
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
 * meta.ECSchemaDef`, as passed to {@link SchemaManifest.fromRows}.
 * @note `ecInstanceId` is a plain number, matching SchemaView's convention for schema-related rows:
 * `ec_` metadata rowids carry no briefcase prefix, so they are exactly representable. It is used
 * only to wire reference edges and is not retained in the manifest.
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

/** The reference graph of every schema in one iModel - names, versions and reference edges, without
 * any schema data. A {@link (SchemaView:class)} husk loads it up front to answer which schemas exist
 * and which dependency-ordered set it must load to satisfy a request.
 *
 * A `SchemaViewDataProvider` builds the manifest from ECDbMeta rows via {@link SchemaManifest.fromRows}.
 * The entries are a flat array with no iModel or platform dependency; even the largest iModels hold
 * on the order of a hundred schemas, so the closure and topological walks are plain recursion.
 * @note The manifest does not track which schemas are already loaded. `SchemaViewManager` does that
 * and filters the result of {@link SchemaManifest.getSchemaClosure} itself.
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

  /** Build a manifest from raw ECDbMeta query rows, so a `SchemaViewDataProvider` only has to run
   * the two queries and hand the rows over. Reference rows whose endpoints are unknown or
   * self-referential are skipped; that cannot happen for a well-formed iModel.
   * @internal
   */
  public static fromRows(schemaRows: readonly SchemaManifestSchemaRow[], referenceRows: readonly SchemaManifestReferenceRow[]): SchemaManifest {
    // Mutable during the wiring walk below; entries are read-only once handed to the manifest.
    type MutableEntry = Omit<SchemaManifestEntry, "references"> & { references: SchemaManifestEntry[] };

    const entries: MutableEntry[] = [];
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

  /** The names of every schema in the iModel, in manifest order. */
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

  /** The transitive reference closure of the requested schemas, as a flat, duplicate-free list of
   * names: the full set that must be present to use them. The order is unspecified - run
   * {@link SchemaManifest.sortInDependencyOrder} on the result when a load order is needed.
   * @note Requested names the iModel does not contain are ignored; check
   * {@link SchemaManifest.findByName} first to detect them.
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

  /** Orders the given schema names so each appears after every schema it references, directly or
   * transitively. References through schemas not in `schemaNames` are still honored, so the order is
   * correct even when an intermediate schema is left out. Names the iModel does not contain are
   * ignored, and reference cycles - which EC forbids - are broken arbitrarily rather than looping.
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
