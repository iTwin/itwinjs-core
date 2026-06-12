/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Schema
 */

import { SchemaMatchType } from "../ECObjects";
import { ECVersion, SchemaKey } from "../SchemaKey";
import { SchemaDocument } from "./SchemaDocument";
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
  /** Loads the full document. Called at most once per resolution, only for selected candidates. */
  loadDocument(): Promise<SchemaDocumentReadResult>;
}

/** A place schemas can be discovered in: a directory of schema files, an iModel, an in-memory set.
 * A source enumerates candidates by header; it does not resolve references or chase dependencies -
 * that is {@link SchemaSourceSet.resolve}'s job, so the loading order stays explicit instead of
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

  /** Adds a document already in hand. Serving its header and "load" are both immediate. */
  public addDocument(document: SchemaDocument): void {
    this._candidates.push({
      header: document,
      source: document.source,
      loadDocument: async () => ({ document, issues: new SchemaIssueList() }),
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
  /** True when this entry is one of the roots passed to {@link SchemaSourceSet.resolve}. */
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

  /** Hydrates the full documents of every selected candidate, in dependency order. Root entries
   * are skipped - the caller already holds those documents. Load problems are appended to
   * {@link SchemaResolution.issues}; a candidate whose load produces no document is omitted. */
  public async loadDocuments(): Promise<SchemaDocument[]> {
    const documents: SchemaDocument[] = [];
    for (const resolved of this.schemas) {
      if (resolved.candidate === undefined)
        continue;
      const result = await resolved.candidate.loadDocument();
      this.issues.addAll(result.issues);
      if (result.document !== undefined)
        documents.push(result.document);
    }
    return documents;
  }
}

/** The schema discovery mechanism: "here are my documents, here is where schemas live - work out
 * what needs to be loaded." Sources are added explicitly; {@link resolve} walks the references of
 * the given root documents against every source's candidates and produces a complete, dependency-
 * ordered load plan, with issues for anything missing or conflicting. Discovery happens entirely
 * before loading or compiling - no reference is chased implicitly mid-load.
 *
 * Selection: among the candidates whose version satisfies a request under the match tolerance, the
 * **highest version across all sources** wins - sources are a pool, not a priority order. Exactly
 * one version of a name participates in a resolution; two requesters whose requests cannot be
 * satisfied by one version is a conflict, reported as an error.
 * @alpha
 */
export class SchemaSourceSet {
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
    const issues = new SchemaIssueList();

    // Gather the candidate pool, grouped by lowercased name.
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

    interface ResolutionNode {
      name: string;
      header?: SchemaDocumentHeader;
      candidate?: SchemaCandidate;
      isRoot: boolean;
      requestedBy: string[];
    }
    const nodes = new Map<string, ResolutionNode>(); // keyed by lowercased name

    // Seed the roots. Duplicate root names violate single-version-per-name immediately.
    for (const root of roots) {
      const key = root.name.toLowerCase();
      if (nodes.has(key)) {
        issues.addError("SchemaSources-0001", `Two root documents share the name "${root.name}"; a resolution holds one version per name.`);
        continue;
      }
      nodes.set(key, { name: root.name, header: root, isRoot: true, requestedBy: ["<request>"] });
    }

    // Walk the reference closure breadth-first over headers.
    const pending: ResolutionNode[] = [...nodes.values()];
    while (pending.length > 0) {
      const node = pending.shift()!;
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
              issues.addError("SchemaSources-0002",
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
          issues.addError("SchemaSources-0003",
            `Schema "${reference.name}" (${requestedKey.toString()} or compatible) required by "${node.name}" was not found in any source.`);
          continue;
        }
        pending.push(newNode); // chase its references in turn
      }
    }

    return new SchemaResolution(this._orderByDependencies(nodes, issues), issues);
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
  private _orderByDependencies(nodes: Map<string, { name: string, header?: SchemaDocumentHeader, candidate?: SchemaCandidate, isRoot: boolean, requestedBy: string[] }>, issues: SchemaIssueList): ResolvedSchema[] {
    const ordered: ResolvedSchema[] = [];
    const visited = new Set<string>(); // done
    const visiting = new Set<string>(); // on the current walk - re-entry means a cycle

    const visit = (key: string): void => {
      if (visited.has(key))
        return;
      if (visiting.has(key)) {
        issues.addError("SchemaSources-0004", `Schema "${nodes.get(key)?.name}" participates in a reference cycle, which EC prohibits.`);
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
