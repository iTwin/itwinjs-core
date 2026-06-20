/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

/** A schema row read from `meta.ECSchemaDef`, used to build a {@link SchemaManifest}.
 * The host (backend or frontend) runs the ECSql query and feeds the rows in, keeping this
 * package free of any iModel or platform dependency.
 * @internal
 */
export interface SchemaManifestSchemaRow {
  /** `ECInstanceId` of the `ec_Schema` row, as a number. A fragment is requested by this id.
   *
   * ECSql query rows return `ECInstanceId` as a hex `Id64String` (e.g. `"0x1f"`); the host converts
   * it to a number here (`Number("0x1f") === 31`). This is safe: an iModel has few schemas with small
   * ids, far under `Number.MAX_SAFE_INTEGER`, matching SchemaView's numeric-id convention.
   */
  readonly id: number;
  readonly name: string;
  readonly versionMajor: number;
  readonly versionWrite: number;
  readonly versionMinor: number;
}

/** A reference row read from `meta.SchemaHasSchemaReferences` (the relationship over
 * `ec_SchemaReference`), used to build a {@link SchemaManifest}.
 * @internal
 */
export interface SchemaManifestReferenceRow {
  /** `SourceECInstanceId` - the schema that holds the reference. */
  readonly schemaId: number;
  /** `TargetECInstanceId` - the referenced schema. */
  readonly referencedSchemaId: number;
}

/** One schema in a {@link SchemaManifest}: its identity, version, and the schemas it directly
 * references. References are stored as manifest indices (not names or ids) so that closure and
 * dependency-ordering walks stay numeric and allocation-light.
 * @internal
 */
export interface SchemaManifestEntry {
  /** Dense, 0-based position of this entry in the manifest. Stable for the manifest's lifetime. */
  readonly index: number;
  /** `ECInstanceId` of the `ec_Schema` row. Used to request this schema's fragment. */
  readonly ecInstanceId: number;
  readonly name: string;
  readonly readVersion: number;
  readonly writeVersion: number;
  readonly minorVersion: number;
  /** Manifest indices of the schemas this schema directly references. */
  readonly references: readonly number[];
}

/** The reference graph of every schema in one iModel, built once from `meta.ECSchemaDef` plus
 * `meta.SchemaHasSchemaReferences`. It is the cheap stand-in a {@link SchemaView} husk loads
 * up front so it can answer "which schemas exist" and "what is the dependency-ordered set I must
 * load to satisfy a request" without hydrating any schema data.
 *
 * The graph is held as a flat array of {@link SchemaManifestEntry}, each carrying a small numeric
 * adjacency list (its direct references as manifest indices). For the largest real iModels this is
 * on the order of a hundred entries and a few hundred edges, so closure and topological walks are
 * trivial; a heavier object graph would buy nothing.
 *
 * The manifest is immutable. "Which schemas are already loaded" is tracked by the husk, not here,
 * and passed in to {@link computeLoadOrder}.
 * @internal
 */
export class SchemaManifest {
  private readonly _entries: readonly SchemaManifestEntry[];
  private readonly _byLowerName: ReadonlyMap<string, number>;
  private readonly _byEcInstanceId: ReadonlyMap<number, number>;

  private constructor(entries: readonly SchemaManifestEntry[], byLowerName: ReadonlyMap<string, number>, byEcInstanceId: ReadonlyMap<number, number>) {
    this._entries = entries;
    this._byLowerName = byLowerName;
    this._byEcInstanceId = byEcInstanceId;
  }

  /** Builds a manifest from the schema and reference rows of one iModel. Schema rows fix the dense
   * index order. Reference rows whose endpoints are not present in the schema rows are ignored - a
   * defensive guard against an inconsistent read; it cannot happen for a well-formed iModel. */
  public static fromRows(schemaRows: Iterable<SchemaManifestSchemaRow>, referenceRows: Iterable<SchemaManifestReferenceRow>): SchemaManifest {
    const byLowerName = new Map<string, number>();
    const byEcInstanceId = new Map<number, number>();
    const references: number[][] = [];

    const partials: Omit<SchemaManifestEntry, "references">[] = [];
    for (const row of schemaRows) {
      const index = partials.length;
      partials.push({
        index,
        ecInstanceId: row.id,
        name: row.name,
        readVersion: row.versionMajor,
        writeVersion: row.versionWrite,
        minorVersion: row.versionMinor,
      });
      byLowerName.set(row.name.toLowerCase(), index);
      byEcInstanceId.set(row.id, index);
      references.push([]);
    }

    for (const row of referenceRows) {
      const fromIndex = byEcInstanceId.get(row.schemaId);
      const toIndex = byEcInstanceId.get(row.referencedSchemaId);
      if (fromIndex === undefined || toIndex === undefined || fromIndex === toIndex)
        continue;
      const adjacency = references[fromIndex];
      if (!adjacency.includes(toIndex))
        adjacency.push(toIndex);
    }

    const entries = partials.map((partial) => ({ ...partial, references: references[partial.index] }));
    return new SchemaManifest(entries, byLowerName, byEcInstanceId);
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
    const index = this._byLowerName.get(name.toLowerCase());
    return index === undefined ? undefined : this._entries[index];
  }

  /** The entry for a schema by its `ec_Schema` `ECInstanceId`, or `undefined` if unknown. */
  public findByEcInstanceId(ecInstanceId: number): SchemaManifestEntry | undefined {
    const index = this._byEcInstanceId.get(ecInstanceId);
    return index === undefined ? undefined : this._entries[index];
  }

  /** The entry at a manifest index, or `undefined` if out of range. */
  public getEntry(index: number): SchemaManifestEntry | undefined {
    return this._entries[index];
  }

  /** Computes the transitive reference closure of the requested schemas and returns it in
   * dependency order - every entry appears after all the schemas it references - so a caller can
   * load front to back and never reference a not-yet-loaded schema.
   *
   * Entries whose index is in `loadedIndices` are treated as already present: they are excluded
   * from the result and, because a loaded schema's whole closure is loaded too, their references
   * are not walked. The result therefore contains exactly the schemas still to load.
   *
   * Requested names that the iModel does not contain are ignored; a caller that needs to surface
   * them can check {@link findByName} first.
   */
  public computeLoadOrder(requestedNames: Iterable<string>, loadedIndices: ReadonlySet<number> = new Set()): SchemaManifestEntry[] {
    const result: SchemaManifestEntry[] = [];
    const visited = new Set<number>();
    const visiting = new Set<number>();

    const visit = (index: number): void => {
      if (loadedIndices.has(index) || visited.has(index) || visiting.has(index))
        return;
      visiting.add(index);
      const entry = this._entries[index];
      for (const referenceIndex of entry.references)
        visit(referenceIndex);
      visiting.delete(index);
      visited.add(index);
      result.push(entry);
    };

    for (const name of requestedNames) {
      const index = this._byLowerName.get(name.toLowerCase());
      if (index !== undefined)
        visit(index);
    }
    return result;
  }
}
