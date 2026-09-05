/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { SchemaMatchType } from "../ECObjects";
import { ECVersion, SchemaKey } from "../SchemaKey";
import { SchemaDocument, SchemaSet } from "./SchemaDocument";
import { SchemaDocumentHeader, SchemaDocumentReadResult, SchemaDocumentTextReader } from "./SchemaDocumentIO";
import { SchemaIssueList } from "./SchemaIssues";

/** One schema a source can deliver: its header (obtained by a cheap peek, without loading the
 * content) plus the deferred load of the full document. Discovery works exclusively on headers;
 * nothing is hydrated until a {@link SchemaResolution} is loaded.
 * @alpha
 */
export interface SchemaCandidate {
  readonly header: SchemaDocumentHeader;
  /** Where the candidate comes from (file path, "iModel", ...), for issue reporting and tie-breaking transparency. */
  readonly source?: string;
  /** Loads the full document into `schemaSet`. Called at most once per resolution, and only for
   * selected candidates. */
  loadDocument(schemaSet: SchemaSet): Promise<SchemaDocumentReadResult>;
}

/** A place schemas can be discovered in: a directory of schema files, an iModel, an in-memory set.
 * A source enumerates candidates by header; it does not resolve references or chase dependencies -
 * that is {@link SchemaResolver.resolve}'s job, so the loading order stays explicit instead of
 * happening behind a locater. Implementations requiring platform access (the file system, an
 * iModel) live in the packages that have it; this package ships {@link InMemorySchemaSource}.
 * @alpha
 */
export interface SchemaSource {
  /** Enumerates everything this source offers. `issues` collects per-candidate problems (an
   * unparseable file, say) without failing the enumeration. May be called more than once;
   * implementations are free to cache. */
  discoverCandidates(issues: SchemaIssueList): Promise<SchemaCandidate[]>;
}

/** How a resolver chooses among compatible candidates supplied by several sources.
 * @alpha
 */
export enum SchemaCandidateSelectionMode {
  /** The first source containing a compatible candidate wins; the highest compatible version from
   * that source is selected. Source registration order is therefore significant. */
  FirstSource = "firstSource",
  /** The highest compatible version across every source wins. Source registration order breaks a
   * tie between otherwise equal candidates. */
  HighestVersion = "highestVersion",
}

/** A source over candidates the caller already holds in memory: pre-read texts (paired with the
 * reader that parses them) or constructed {@link SchemaDocument}s. Also the building block for
 * tests and for adapters that gather candidates by other means.
 * @alpha
 */
export class InMemorySchemaSource implements SchemaSource {
  private readonly _candidates: SchemaCandidate[] = [];
  private readonly _texts: Array<{ text: string | Uint8Array, reader: SchemaDocumentTextReader, source?: string }> = [];

  /** Adds a document already in hand. Serving its header and "load" are both immediate; loading it
   * moves it into the target schema set, since a document belongs to exactly one. */
  public addDocument(document: SchemaDocument): void {
    this._candidates.push({
      header: document,
      source: document.source,
      loadDocument: async (schemaSet: SchemaSet) => {
        const issues = new SchemaIssueList("discovery");
        const incumbent = schemaSet.getSchema(document.name);
        if (incumbent !== undefined && incumbent !== document)
          issues.addError("schema-name-duplicate", `The schema set already holds a schema named "${incumbent.name}"; the in-memory "${document.name}" was not moved in.`);
        else
          schemaSet.moveIn(document);
        return { document, issues };
      },
    });
  }

  /** Adds reusable in-memory schema text paired with the reader for its format. Its header is read
   * during discovery and the full document only when selected. Async iterables are intentionally
   * excluded because discovery and loading need to consume the input independently. */
  public addText(text: string | Uint8Array, reader: SchemaDocumentTextReader, source?: string): void {
    this._texts.push({ text, reader, source });
  }

  /** Adds a candidate with an explicit header and deferred load - the low-level adapter hook for
   * callers that have their own storage mechanism. */
  public addCandidate(candidate: SchemaCandidate): void {
    this._candidates.push(candidate);
  }

  public async discoverCandidates(issues: SchemaIssueList): Promise<SchemaCandidate[]> {
    const candidates = [...this._candidates];
    for (const { text, reader, source } of this._texts) {
      const result = await reader.readHeader(text, { source });
      issues.addAll(result.issues);
      if (result.header === undefined)
        continue;
      candidates.push({
        header: result.header,
        source,
        loadDocument: async (schemaSet) => reader.readDocument(text, { schemaSet, source }),
      });
    }
    return candidates;
  }
}

/** How one schema name was resolved (or not). Part of a {@link SchemaResolution}.
 * @alpha
 */
export interface ResolvedSchema {
  /** The schema name, as first requested. */
  readonly name: string;
  /** The chosen candidate; `undefined` for roots (the caller already holds those documents) and
   * for missing schemas. */
  readonly candidate?: SchemaCandidate;
  /** True when this entry is one of the roots passed to {@link SchemaResolver.resolve}. */
  readonly isRoot: boolean;
  /** Who asked for this schema: schema names, or `"<request>"` for the roots themselves. */
  readonly requestedBy: ReadonlyArray<string>;
}

/** The outcome of dependency resolution: every schema name the roots transitively require, each
 * either satisfied (by a root or a selected candidate) or reported missing in the issues. Entries
 * are dependency-ordered (a schema appears after everything it references), so loading or
 * compiling can walk the list front to back.
 * @alpha
 */
export class SchemaResolution {
  /** Dependency-ordered: every schema appears after its references. */
  public readonly schemas: ResolvedSchema[];
  public readonly issues: SchemaIssueList;

  /** @internal */
  public constructor(schemas: ResolvedSchema[], issues: SchemaIssueList) {
    this.schemas = schemas;
    this.issues = issues;
  }

  /** True when every required schema was satisfied and no conflicts were found. */
  public get isComplete(): boolean {
    return !this.issues.hasErrors;
  }

  /** Hydrates the full documents of every selected candidate into `schemaSet`, in dependency order,
   * and returns the documents newly added to it. Root entries are skipped - the caller already
   * holds those documents. A same-version document already in the set satisfies the plan and is
   * skipped; a different existing version is reported as a conflict. Load problems are appended to
   * {@link SchemaResolution.issues}; a candidate whose load produces no document is omitted. */
  public async loadDocuments(schemaSet: SchemaSet): Promise<SchemaDocument[]> {
    const documents: SchemaDocument[] = [];
    for (const resolved of this.schemas) {
      if (resolved.candidate === undefined)
        continue;

      const existing = schemaSet.getSchema(resolved.name);
      if (existing !== undefined) {
        const header = resolved.candidate.header;
        if (existing.readVersion !== header.readVersion || existing.writeVersion !== header.writeVersion || existing.minorVersion !== header.minorVersion) {
          this.issues.addError("schema-name-version-conflict",
            `The target schema set already holds ${existing.name}.${existing.readVersion}.${existing.writeVersion}.${existing.minorVersion}; the resolution selected ${header.name}.${header.readVersion}.${header.writeVersion}.${header.minorVersion}.`,
            existing.name);
        }
        continue;
      }

      const result = await resolved.candidate.loadDocument(schemaSet);
      this.issues.addAll(result.issues);
      if (result.document?.schemaSet === schemaSet)
        documents.push(result.document);
    }
    return documents;
  }
}

/** A schema name under resolution, before it becomes a {@link ResolvedSchema}: the header it was
 * requested with, the candidate finally selected for it, and who asked for it. Module scope so the
 * closure walk and the topological order share one declaration. */
interface ResolutionNode {
  name: string;
  header?: SchemaDocumentHeader;
  candidate?: SchemaCandidate;
  isRoot: boolean;
  requestedBy: string[];
}

/** A candidate paired with the registration order of the source that supplied it. */
interface SourcedCandidate {
  candidate: SchemaCandidate;
  sourceIndex: number;
}

/** Works out which schemas a set of root documents needs, and in what order to load them. The
 * middle of the three discovery steps: a {@link SchemaSource} says what schemas exist and what each
 * one declares about itself, this resolves the reference closure over those headers into a
 * dependency-ordered plan, and {@link SchemaResolution.loadDocuments} hydrates the plan into a
 * {@link SchemaSet}. Nothing is read until the plan exists, and the plan is inspectable first -
 * which is what the old locater chain, resolving references as it loaded them, could not offer.
 *
 * Candidate selection is explicit. The default chooses the highest compatible version across all
 * sources. {@link SchemaCandidateSelectionMode.FirstSource} instead chooses from the first source
 * that can satisfy a request, then takes that source's highest compatible version. Exactly one
 * version of a name participates in a resolution; incompatible requirements are reported.
 * @alpha
 */
export class SchemaResolver {
  private readonly _sources: SchemaSource[] = [];
  private _candidateSnapshot?: Promise<{ candidatesByName: Map<string, SourcedCandidate[]>, issues: SchemaIssueList }>;

  public constructor(private readonly _selectionMode: SchemaCandidateSelectionMode = SchemaCandidateSelectionMode.HighestVersion) { }

  /** Adds a source. Registration order is significant only in
   * {@link SchemaCandidateSelectionMode.FirstSource} mode and for equal-version ties. Adding a
   * source invalidates this resolver's cached discovery snapshot. */
  public addSource(source: SchemaSource): void {
    this._sources.push(source);
    this._candidateSnapshot = undefined;
  }

  /** Resolves the reference closure of the given roots. `matchType` is the version tolerance a
   * candidate must satisfy, defaulting to {@link SchemaMatchType.LatestWriteCompatible}. The roots
   * themselves are never looked up in the sources; they are taken as given. Candidate discovery is
   * shared by repeated resolutions on this resolver; create a new resolver after source contents
   * change. */
  public async resolve(roots: ReadonlyArray<SchemaDocumentHeader>, matchType: SchemaMatchType = SchemaMatchType.LatestWriteCompatible): Promise<SchemaResolution> {
    const issues = new SchemaIssueList("discovery");
    const candidatesByName = await this._gatherCandidates(issues);
    const nodes = new Map<string, ResolutionNode>(); // keyed by lowercased name

    // Seed the roots. Duplicate root names violate single-version-per-name immediately.
    for (const root of roots) {
      const key = root.name.toLowerCase();
      if (nodes.has(key)) {
        issues.addError("schema-root-duplicate", `Two root documents share the name "${root.name}"; a resolution holds one version per name.`);
        continue;
      }
      nodes.set(key, { name: root.name, header: root, isRoot: true, requestedBy: ["<request>"] });
    }

    this._walkDependencies(nodes, [...nodes.values()], candidatesByName, matchType, issues);
    return new SchemaResolution(this._orderByDependencies(nodes, issues), issues);
  }

  /** Resolves the reference closure of schemas named by `names`, taking every one of them from the
   * sources. This is the form to use when the caller wants schemas loaded rather than supplied:
   * asking an iModel or a directory for `["BisCore"]` yields BisCore plus everything it references,
   * dependency-ordered and ready for {@link SchemaResolution.loadDocuments}.
   *
   * A bare name carries no version constraint; the resolver's selection mode chooses among the
   * available candidates, and `matchType` governs their references. A name no source offers is
   * reported and the rest still resolve. */
  public async resolveNames(names: ReadonlyArray<string>, matchType: SchemaMatchType = SchemaMatchType.LatestWriteCompatible): Promise<SchemaResolution> {
    const issues = new SchemaIssueList("discovery");
    const candidatesByName = await this._gatherCandidates(issues);
    const nodes = new Map<string, ResolutionNode>();
    const namedNodes = this._seedNamedSchemas(names, nodes, candidatesByName, issues);
    this._walkDependencies(nodes, namedNodes, candidatesByName, matchType, issues);
    return new SchemaResolution(this._orderByDependencies(nodes, issues), issues);
  }

  /** Adds source-backed roots to an existing request without replacing held roots. */
  private _seedNamedSchemas(
    names: ReadonlyArray<string>,
    nodes: Map<string, ResolutionNode>,
    candidatesByName: Map<string, SourcedCandidate[]>,
    issues: SchemaIssueList,
  ): ResolutionNode[] {
    const added: ResolutionNode[] = [];
    for (const name of names) {
      const key = name.toLowerCase();
      const existing = nodes.get(key);
      if (existing !== undefined) {
        existing.requestedBy.push("<request>");
        continue;
      }
      const selected = this._selectCandidate(candidatesByName.get(key));
      if (selected === undefined) {
        const missing = { name, isRoot: false, requestedBy: ["<request>"] };
        nodes.set(key, missing);
        added.push(missing);
        issues.addError("schema-missing", `Schema "${name}" was not found in any source.`);
        continue;
      }
      const node = { name: selected.header.name, header: selected.header, candidate: selected, isRoot: false, requestedBy: ["<request>"] };
      nodes.set(key, node);
      added.push(node);
    }
    return added;
  }

  /** Every candidate every source offers, grouped by lowercased schema name. */
  private async _gatherCandidates(issues: SchemaIssueList): Promise<Map<string, SourcedCandidate[]>> {
    this._candidateSnapshot ??= this._discoverCandidates();
    const snapshot = await this._candidateSnapshot;
    issues.addAll(snapshot.issues);
    return snapshot.candidatesByName;
  }

  private async _discoverCandidates(): Promise<{ candidatesByName: Map<string, SourcedCandidate[]>, issues: SchemaIssueList }> {
    const issues = new SchemaIssueList("discovery");
    const candidatesByName = new Map<string, SourcedCandidate[]>();
    for (const [sourceIndex, source] of this._sources.entries()) {
      for (const candidate of await source.discoverCandidates(issues)) {
        const key = candidate.header.name.toLowerCase();
        const group = candidatesByName.get(key);
        const sourced = { candidate, sourceIndex };
        if (group === undefined)
          candidatesByName.set(key, [sourced]);
        else
          group.push(sourced);
      }
    }
    return { candidatesByName, issues };
  }

  /** Chases references from `pending`, adding every newly selected dependency to the same queue. */
  private _walkDependencies(
    nodes: Map<string, ResolutionNode>,
    pending: ResolutionNode[],
    candidatesByName: Map<string, SourcedCandidate[]>,
    matchType: SchemaMatchType,
    issues: SchemaIssueList,
  ): void {
    // The queue is appended to inside the loop; an array iterator re-reads `length` each step, so
    // those appends are visited. Not `shift()`, which would make the walk quadratic.

    for (const node of pending) {
      if (node.header === undefined)
        continue;
      for (const reference of node.header.references) {
        const key = reference.name.toLowerCase();
        const requestedKey = new SchemaKey(reference.name, new ECVersion(reference.readVersion, reference.writeVersion, reference.minorVersion));

        const existing = nodes.get(key);
        if (existing !== undefined) {
          existing.requestedBy.push(node.name);
          // Already settled - verify this request is satisfied by the settled version too.
          if (existing.header !== undefined) {
            const settledKey = new SchemaKey(existing.header.name, new ECVersion(existing.header.readVersion, existing.header.writeVersion, existing.header.minorVersion));
            if (!settledKey.matches(requestedKey, matchType)) {
              issues.addError("reference-version-conflict",
                `Conflicting requirements for schema "${reference.name}": "${node.name}" requires ${requestedKey.toString()} but version ${settledKey.toString()} was selected (requested by ${existing.requestedBy.filter((r) => r !== node.name).join(", ")}).`);
            }
          }
          continue;
        }

        const selected = this._selectCandidate(candidatesByName.get(key), requestedKey, matchType);
        const newNode: ResolutionNode = {
          name: reference.name,
          header: selected?.header,
          candidate: selected,
          isRoot: false,
          requestedBy: [node.name],
        };
        nodes.set(key, newNode);
        if (selected === undefined) {
          issues.addError("schema-missing",
            `Schema "${reference.name}" (${requestedKey.toString()} or compatible) required by "${node.name}" was not found in any source.`);
          continue;
        }
        pending.push(newNode); // chase its references in turn
      }
    }
  }

  /** Picks the best candidate, optionally constrained by a requested version. */
  private _selectCandidate(candidates: SourcedCandidate[] | undefined, requestedKey?: SchemaKey, matchType?: SchemaMatchType): SchemaCandidate | undefined {
    let best: SchemaCandidate | undefined;
    let bestKey: SchemaKey | undefined;
    let selectedSource: number | undefined;
    for (const { candidate, sourceIndex } of candidates ?? []) {
      const candidateKey = new SchemaKey(candidate.header.name,
        new ECVersion(candidate.header.readVersion, candidate.header.writeVersion, candidate.header.minorVersion));
      if (requestedKey !== undefined && !candidateKey.matches(requestedKey, matchType ?? SchemaMatchType.LatestWriteCompatible))
        continue;
      if (this._selectionMode === SchemaCandidateSelectionMode.FirstSource) {
        selectedSource ??= sourceIndex;
        if (sourceIndex !== selectedSource)
          continue;
      }
      if (bestKey === undefined || candidateKey.compareByVersion(bestKey) > 0) {
        best = candidate;
        bestKey = candidateKey;
      }
    }
    return best;
  }

  /** Topologically orders the nodes so each schema follows everything it references. Reference
   * cycles are prohibited by the spec; one is reported and broken arbitrarily so ordering still
   * terminates. */
  private _orderByDependencies(nodes: Map<string, ResolutionNode>, issues: SchemaIssueList): ResolvedSchema[] {
    const ordered: ResolvedSchema[] = [];
    const visited = new Set<string>(); // done
    const visiting = new Set<string>(); // on the current walk - re-entry means a cycle

    const visit = (key: string): void => {
      if (visited.has(key))
        return;
      if (visiting.has(key)) {
        issues.addError("reference-cycle", `Schema "${nodes.get(key)?.name}" participates in a reference cycle, which EC prohibits.`);
        return;
      }
      const node = nodes.get(key);
      if (node === undefined)
        return;
      visiting.add(key);
      if (node.header !== undefined) {
        for (const reference of node.header.references)
          visit(reference.name.toLowerCase());
      }
      visiting.delete(key);
      visited.add(key);
      ordered.push({ name: node.name, candidate: node.candidate, isRoot: node.isRoot, requestedBy: node.requestedBy });
    };

    for (const key of nodes.keys())
      visit(key);
    return ordered;
  }
}
