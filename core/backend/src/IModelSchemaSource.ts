/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { Authoring, SchemaManifestEntry } from "@itwin/ecschema-metadata";
import { IModelDb } from "./IModelDb";
import { querySchemaManifest } from "./internal/SchemaManifestQuery";

/**
 * Reading the schemas of an iModel into an authoring {@link Authoring.SchemaSet}.
 *
 * This is deliberately not a member of {@link IModelDb}. A schema set is an authoring workspace with
 * an owner and a lifetime, unlike the old `SchemaContext` an iModel handed out - so the caller
 * decides when one exists, what goes in it, and when it goes away. Nothing is cached on the iModel.
 *
 * Reading happens in two phases, and both are visible:
 *
 * 1. **Discovery.** {@link IModelSchemaSource.discoverCandidates} lists what the iModel holds, by
 *    name, version, alias and reference list, without reading any schema content. It is the same
 *    schema manifest SchemaView's fragment loading is built on - two ECDbMeta queries answering
 *    "what schemas does this iModel have, and how do they depend on each other".
 * 2. **Load.** {@link Authoring.SchemaResolver} turns those headers into a dependency-ordered plan,
 *    and the plan hydrates the documents it names into the set.
 *
 * {@link readSchemasFromIModel} runs both for the common cases - everything in the iModel, or a few
 * named schemas plus what they reference. Use {@link IModelSchemaSource} directly when the iModel is
 * one of several places schemas come from; a resolver takes any number of sources and treats them
 * as one pool.
 */

/** A {@link Authoring.SchemaSource} over the schemas one iModel holds.
 *
 * Discovery costs the two ECDbMeta queries behind the schema manifest and reads no schema content.
 * Loading a document goes through `IModelDb.getSchemaProps`, which crosses the native boundary as a
 * live JavaScript object rather than as text, so the largest schemas are neither stringified nor
 * parsed on the way in.
 * @alpha
 */
export class IModelSchemaSource implements Authoring.SchemaSource {
  private readonly _iModel: IModelDb;
  private _candidates?: Authoring.SchemaCandidate[];

  public constructor(iModel: IModelDb) {
    this._iModel = iModel;
  }

  /** The names of every schema in the iModel. Cheap - it is the discovery pass, so it costs one
   * manifest query and is cached with it. */
  public async getSchemaNames(): Promise<string[]> {
    const issues = new Authoring.SchemaIssueList("discovery");
    const candidates = await this.discoverCandidates(issues);
    return candidates.map((candidate) => candidate.header.name);
  }

  /** Every schema in the iModel, as a header plus a deferred load. Cached after the first call;
   * a schema import invalidates it, so make a new source rather than reusing one across an import. */
  public async discoverCandidates(_issues: Authoring.SchemaIssueList): Promise<Authoring.SchemaCandidate[]> {
    if (this._candidates !== undefined)
      return [...this._candidates];

    const iModel = this._iModel;
    const manifest = await querySchemaManifest((ecsql) => iModel.createQueryReader(ecsql));
    const source = `${iModel.name} (${iModel.pathName})`;

    this._candidates = manifest.entries.map((entry) => ({
      header: {
        name: entry.name,
        readVersion: entry.readVersion,
        writeVersion: entry.writeVersion,
        minorVersion: entry.minorVersion,
        alias: entry.alias,
        references: entry.references.map(toSchemaReference),
      },
      source,
      loadDocument: async (schemaSet: Authoring.SchemaSet) => readSchemaFromIModel(iModel, entry.name, schemaSet),
    }));
    return [...this._candidates];
  }
}

/** A manifest entry as the reference a referencing schema makes to it. The alias is the referenced
 * schema's own, which is what native writes when it serializes a reference; a loaded document
 * carries whatever its own reference list really says. */
function toSchemaReference(entry: SchemaManifestEntry): Authoring.SchemaReference {
  return {
    name: entry.name,
    readVersion: entry.readVersion,
    writeVersion: entry.writeVersion,
    minorVersion: entry.minorVersion,
    alias: entry.alias ?? null,
  };
}

/** Reads one schema out of an iModel into `schemaSet`, without touching its references. The
 * building block {@link readSchemasFromIModel} calls once per schema in dependency order; use it
 * directly only when the references are already in the set or genuinely not wanted.
 * @alpha
 */
export function readSchemaFromIModel(iModel: IModelDb, schemaName: string, schemaSet: Authoring.SchemaSet): Authoring.SchemaDocumentReadResult {
  const source = `${schemaName} (${iModel.pathName})`;
  let props: object;
  try {
    props = iModel.getSchemaProps(schemaName);
  } catch (error) {
    const issues = new Authoring.SchemaIssueList("discovery");
    issues.addError("schema-missing", `The iModel has no schema named "${schemaName}": ${error instanceof Error ? error.message : String(error)}`, source);
    return { issues };
  }
  // ECJSON props cross the native boundary as an object, so this is the object-in entry point
  // rather than the text one - no stringify, no parse, no string-length ceiling.
  return new Authoring.SchemaJsonReader().readObject(props, { schemaSet, source });
}

/** What {@link readSchemasFromIModel} accepts.
 * @alpha
 */
export interface ReadSchemasFromIModelOptions {
  /** The set to read into. A new one is created when this is left out. The set may already hold
   * schemas; a name it already holds is reported and that schema is not re-read. */
  schemaSet?: Authoring.SchemaSet;
  /** Which schemas to read. Every schema in the iModel when left out. Named schemas are read
   * together with everything they reference, transitively. */
  schemaNames?: ReadonlyArray<string>;
}

/** What {@link readSchemasFromIModel} returns.
 * @alpha
 */
export interface ReadSchemasFromIModelResult {
  /** The set the documents were read into - the one passed in, or a new one. */
  schemaSet: Authoring.SchemaSet;
  /** The documents read, in dependency order (a schema follows everything it references). Does not
   * include schemas the set already held. */
  documents: Authoring.SchemaDocument[];
  /** The plan the read followed, with per-schema provenance. Worth inspecting when a read is
   * incomplete: it says which schema asked for a missing one. */
  resolution: Authoring.SchemaResolution;
  /** Discovery, planning and read problems together. A read that reports errors still returns
   * whatever it could produce. */
  issues: Authoring.SchemaIssueList;
}

/** Reads schemas out of an iModel into an authoring {@link Authoring.SchemaSet}.
 *
 * ```ts
 * // Everything the iModel holds.
 * const { schemaSet } = await readSchemasFromIModel(iModel);
 *
 * // One schema and its reference closure, into a set the caller owns.
 * const set = new Authoring.SchemaSet();
 * await readSchemasFromIModel(iModel, { schemaSet: set, schemaNames: ["BisCore"] });
 * ```
 *
 * Documents arrive in dependency order, so every reference a document makes resolves against a set
 * that already holds its target - which is what makes custom attributes readable and
 * {@link Authoring.ECClass.getExpandedProperties} walk the real base classes. The reference aliases
 * ECJSON does not carry are filled in from the set, so what is read can be written back as ECXML.
 *
 * Never throws on schema data. Everything that went wrong is in `issues`.
 * @alpha
 */
export async function readSchemasFromIModel(iModel: IModelDb, options?: ReadSchemasFromIModelOptions): Promise<ReadSchemasFromIModelResult> {
  const schemaSet = options?.schemaSet ?? new Authoring.SchemaSet();
  const source = new IModelSchemaSource(iModel);
  const resolver = new Authoring.SchemaResolver();
  resolver.addSource(source);

  const names = options?.schemaNames ?? await source.getSchemaNames();
  const resolution = await resolver.resolveNames(names);
  const documents = await resolution.loadDocuments(schemaSet);

  // The documents come from ECJSON, which carries no reference aliases; the iModel knows them, and
  // now so does the set. Without this the documents could not be written as ECXML.
  for (const document of documents)
    document.fillMissingReferenceAliases();

  return { schemaSet, documents, resolution, issues: resolution.issues };
}
