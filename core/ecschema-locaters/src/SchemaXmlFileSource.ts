/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Locaters
 */

import { createReadStream } from "node:fs";
import { readdir } from "node:fs/promises";
import * as path from "node:path";
import { Authoring } from "@itwin/ecschema-metadata";

/** A schema source that discovers ECXML files in a list of directories.
 *
 * Discovery reads only each file's header. Full documents are read on demand after a
 * {@link Authoring.SchemaResolver} selects them. Directories are searched non-recursively and files
 * must end in `.ecschema.xml`.
 * @alpha
 */
export class SchemaXmlFileSource implements Authoring.SchemaSource {
  private readonly _directories: string[] = [];
  private readonly _reader = new Authoring.SchemaXmlReader();

  /** Creates a source over `directories`, in the order supplied. */
  public constructor(directories?: Iterable<string>) {
    if (directories !== undefined)
      this.addDirectories(directories);
  }

  /** Directories searched by this source, in order. */
  public get directories(): ReadonlyArray<string> {
    return this._directories;
  }

  /** Adds one directory unless its resolved path is already present. */
  public addDirectory(directory: string): void {
    const resolved = path.resolve(directory);
    if (!this._directories.includes(resolved))
      this._directories.push(resolved);
  }

  /** Adds several directories in iteration order. */
  public addDirectories(directories: Iterable<string>): void {
    for (const directory of directories)
      this.addDirectory(directory);
  }

  public async discoverCandidates(issues: Authoring.SchemaIssueList): Promise<Authoring.SchemaCandidate[]> {
    const candidates: Authoring.SchemaCandidate[] = [];
    for (const directory of this._directories) {
      let fileNames: string[];
      try {
        const entries = await readdir(directory, { withFileTypes: true });
        fileNames = entries
          .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".ecschema.xml"))
          .map((entry) => entry.name)
          .sort();
      } catch (error) {
        issues.addWarning("schema-directory-unreadable", errorMessage(error, `Cannot read schema directory "${directory}".`), directory);
        continue;
      }

      for (const fileName of fileNames) {
        const filePath = path.join(directory, fileName);
        try {
          const result = await this._reader.readHeader(createReadStream(filePath), { source: filePath });
          for (const issue of result.issues) {
            // A bad unrelated file must not prevent resolution from the rest of the directory. If
            // its schema is requested, the resolver will also report that no candidate exists.
            issues.add(issue.severity === "error" ? { ...issue, severity: "warning", group: "discovery" } : issue);
          }
          if (result.header === undefined)
            continue;
          candidates.push({
            header: result.header,
            source: filePath,
            loadDocument: async (schemaSet) => this._loadDocument(filePath, schemaSet),
          });
        } catch (error) {
          issues.addWarning("schema-file-unreadable", errorMessage(error, `Cannot read schema file "${filePath}".`), filePath);
        }
      }
    }
    return candidates;
  }

  private async _loadDocument(filePath: string, schemaSet: Authoring.SchemaSet): Promise<Authoring.SchemaDocumentReadResult> {
    try {
      return await this._reader.readDocument(createReadStream(filePath), { schemaSet, source: filePath });
    } catch (error) {
      const issues = new Authoring.SchemaIssueList("discovery");
      issues.addError("schema-file-unreadable", errorMessage(error, `Cannot read schema file "${filePath}".`), filePath);
      return { issues };
    }
  }
}

function errorMessage(error: unknown, prefix: string): string {
  return error instanceof Error ? `${prefix} ${error.message}` : `${prefix} ${String(error)}`;
}
