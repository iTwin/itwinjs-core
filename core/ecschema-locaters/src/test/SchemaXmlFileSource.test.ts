/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { Authoring } from "@itwin/ecschema-metadata";
import { SchemaXmlFileSource } from "../SchemaXmlFileSource";

function schemaXml(name: string, alias: string): string {
  return `<ECSchema schemaName="${name}" alias="${alias}" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2"/>`;
}

describe("SchemaXmlFileSource", () => {
  const directories: string[] = [];

  afterEach(() => {
    for (const directory of directories)
      rmSync(directory, { recursive: true, force: true });
    directories.length = 0;
  });

  function makeDirectory(): string {
    const directory = mkdtempSync(path.join(tmpdir(), "schema-xml-source-"));
    directories.push(directory);
    return directory;
  }

  it("discovers ECXML files from multiple directories and loads a selected document", async () => {
    const first = makeDirectory();
    const second = makeDirectory();
    writeFileSync(path.join(first, "A.ecschema.xml"), schemaXml("A", "a"));
    writeFileSync(path.join(first, "ignored.txt"), schemaXml("Ignored", "ignored"));
    writeFileSync(path.join(second, "B.ECSCHEMA.XML"), schemaXml("B", "b"));

    const source = new SchemaXmlFileSource([first, second]);
    const issues = new Authoring.SchemaIssueList("discovery");
    const candidates = await source.discoverCandidates(issues);

    assert.isFalse(issues.hasErrors);
    assert.deepEqual(candidates.map((candidate) => candidate.header.name), ["A", "B"]);
    assert.deepEqual(source.directories, [first, second]);

    const set = new Authoring.SchemaSet();
    const result = await candidates[0].loadDocument(set);
    assert.isFalse(result.issues.hasErrors);
    assert.strictEqual(result.document, set.getSchema("A"));
  });

  it("reports an unreadable directory without throwing", async () => {
    const directory = path.join(makeDirectory(), "missing");
    const source = new SchemaXmlFileSource([directory]);
    const issues = new Authoring.SchemaIssueList("discovery");

    const candidates = await source.discoverCandidates(issues);

    assert.isEmpty(candidates);
    assert.isFalse(issues.hasErrors);
    assert.strictEqual(issues.warnings[0].name, "schema-directory-unreadable");
  });
});
