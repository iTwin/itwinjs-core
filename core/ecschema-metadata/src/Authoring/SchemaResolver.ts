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
import { SchemaDocumentHeader, SchemaDocumentReadResult } from "./SchemaDocumentIO";
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

/** A source over candidates the caller already holds in memory: pre-read texts (paired with the
 * reader that parses them) or constructed {@link SchemaDocument}s. Also the building block for
 * tests and for adapters that gather candidates by other means.
 * @alpha
 */
export class InMemorySchemaSource implements SchemaSource {
  private readonly _candidates: SchemaCandidate[] = [];

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

  /** Adds a candidate with an explicit header and deferred load - the adapter hook for callers
   * that peeked the header themselves (e.g. via a text reader's `readHeader`). */
  public addCandidate(candidate: SchemaCandidate): void {
    this._candidates.push(candidate);
  }

  public async discoverCandidates(_issues: SchemaIssueList): Promise<SchemaCandidate[]> {
    return [...this._candidates];
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
   * and returns them. Root entries are skipped - the caller already holds those documents, and
   * moving them into the set is the caller's decision. Load problems are appended to
   * {@link SchemaResolution.issues}; a candidate whose load produces no document is omitted. */
  public async loadDocuments(schemaSet: SchemaSet): Promise<SchemaDocument[]> {
    const documents: SchemaDocument[] = [];
    for (const resolved of this.schemas) {
      if (resolved.candidate === undefined)
        continue;
      const result = await resolved.candidate.loadDocument(schemaSet);
      this.issues.addAll(result.issues);
      if (result.document !== undefined)
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

/** Works out which schemas a set of root documents needs, and in what order to load them. The
 * middle of the three discovery steps: a {@link SchemaSource} says what schemas exist and what each
 * one declares about itself, this resolves the reference closure over those headers into a
 * dependency-ordered plan, and {@link SchemaResolution.loadDocuments} hydrates the plan into a
 * {@link SchemaSet}. Nothing is read until the plan exists, and the plan is inspectable first -
 * which is what the old locater chain, resolving references as it loaded them, could not offer.
 *
 * Selection: among the candidates whose version satisfies a request under the match tolerance, the
 * **highest version across all sources** wins - sources are a pool, not a priority order. Exactly
 * one version of a name participates in a resolution; two requesters whose requests cannot be
 * satisfied by one version is a conflict, reported as an error.
 * @alpha
 */
export class SchemaResolver {
  private readonly _sources: SchemaSource[] = [];

  /** Adds a source. Order does not grant priority (see selection rule above). */
  public addSource(source: SchemaSource): void {
    this._sources.push(source);
  }

  /** Resolves the reference closure of the given roots. `matchType` is the version tolerance a
   * candidate must satisfy, defaulting to {@link SchemaMatchType.LatestWriteCompatible} - the
   * tolerance schema references resolve with today (same read.write, any equal-or-newer minor).
   * The roots themselves are never looked up in the sources; they are taken as given. */
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

    return this._walkClosure(nodes, candidatesByName, matchType, issues);
  }

  /** Resolves the reference closure of schemas named by `names`, taking every one of them from the
   * sources. This is the form to use when the caller wants schemas loaded rather than supplied:
   * asking an iModel or a directory for `["BisCore"]` yields BisCore plus everything it references,
   * dependency-ordered and ready for {@link SchemaResolution.loadDocuments}.
   *
   * Each name is satisfied by the highest version any source offers, since a bare name carries no
   * version to match against; from there `matchType` governs the references. A name no source
   * offers is reported and the rest still resolve. */
  public async resolveNames(names: ReadonlyArray<string>, matchType: SchemaMatchType = SchemaMatchType.LatestWriteCompatible): Promise<SchemaResolution> {
    const issues = new SchemaIssueList("discovery");
    const candidatesByName = await this._gatherCandidates(issues);
    const nodes = new Map<string, ResolutionNode>();

    for (const name of names) {
      const key = name.toLowerCase();
      const existing = nodes.get(key);
      if (existing !== undefined) {
        existing.requestedBy.push("<request>");
        continue;
      }
      const selected = this._highestVersion(candidatesByName.get(key));
      if (selected === undefined) {
        nodes.set(key, { name, isRoot: false, requestedBy: ["<request>"] });
        issues.addError("schema-missing", `Schema "${name}" was not found in any source.`);
        continue;
      }
      nodes.set(key, { name: selected.header.name, header: selected.header, candidate: selected, isRoot: false, requestedBy: ["<request>"] });
    }

    return this._walkClosure(nodes, candidatesByName, matchType, issues);
  }

  /** Every candidate every source offers, grouped by lowercased schema name. */
  private async _gatherCandidates(issues: SchemaIssueList): Promise<Map<string, SchemaCandidate[]>> {
    const candidatesByName = new Map<string, SchemaCandidate[]>();
    for (const source of this._sources) {
      for (const candidate of await source.discoverCandidates(issues)) {
        const key = candidate.header.name.toLowerCase();
        const group = candidatesByName.get(key);
        if (group === undefined)
          candidatesByName.set(key, [candidate]);
        else
          group.push(candidate);
      }
    }
    return candidatesByName;
  }

  /** Chases the references of every seeded node until the closure is complete, then orders it. */
  private _walkClosure(nodes: Map<string, ResolutionNode>, candidatesByName: Map<string, SchemaCandidate[]>, matchType: SchemaMatchType, issues: SchemaIssueList): SchemaResolution {
    // Walk the reference closure breadth-first over headers. The queue is appended to inside the
    // loop; an array iterator re-reads `length` each step, so those appends are visited. Not
    // `shift()`, which would make the walk quadratic in the queue length.
    const pending: ResolutionNode[] = [...nodes.values()];
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

    return new SchemaResolution(this._orderByDependencies(nodes, issues), issues);
  }

  /** The newest of a name's candidates, for a request that carries no version to match against. */
  private _highestVersion(candidates: SchemaCandidate[] | undefined): SchemaCandidate | undefined {
    let best: SchemaCandidate | undefined;
    let bestKey: SchemaKey | undefined;
    for (const candidate of candidates ?? []) {
      const candidateKey = new SchemaKey(candidate.header.name,
        new ECVersion(candidate.header.readVersion, candidate.header.writeVersion, candidate.header.minorVersion));
      if (bestKey === undefined || candidateKey.compareByVersion(bestKey) > 0) {
        best = candidate;
        bestKey = candidateKey;
      }
    }
    return best;
  }

  /** Picks the best candidate for a request: filter by match tolerance, then highest version wins. */
  private _selectCandidate(candidates: SchemaCandidate[] | undefined, requestedKey: SchemaKey, matchType: SchemaMatchType): SchemaCandidate | undefined {
    if (candidates === undefined)
      return undefined;
    let best: SchemaCandidate | undefined;
    let bestKey: SchemaKey | undefined;
    for (const candidate of candidates) {
      const candidateKey = new SchemaKey(candidate.header.name,
        new ECVersion(candidate.header.readVersion, candidate.header.writeVersion, candidate.header.minorVersion));
      if (!candidateKey.matches(requestedKey, matchType))
        continue;
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
