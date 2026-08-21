/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { Authoring, SchemaItemType } from "@itwin/ecschema-metadata";
import { IModelSchemaSource, readSchemaFromIModel, readSchemasFromIModel } from "../../IModelSchemaSource";
import { IModelHost } from "../../IModelHost";
import { SnapshotDb } from "../../IModelDb";
import { KnownTestLocations } from "../KnownTestLocations";
import { TestUtils } from "../TestUtils";

describe("Reading an iModel's schemas into an authoring SchemaSet", () => {
  let iModel: SnapshotDb;

  before(async () => {
    if (!IModelHost.isValid)
      await TestUtils.startBackend();
    iModel = SnapshotDb.openFile(path.join(KnownTestLocations.assetsDir, "sim-master.bim"));
  });

  after(() => {
    iModel?.close();
  });

  it("discovers every schema by header without reading any content", async () => {
    const source = new IModelSchemaSource(iModel);
    const issues = new Authoring.SchemaIssueList();
    const candidates = await source.discoverCandidates(issues);

    assert.isFalse(issues.hasErrors, [...issues].map((i) => i.message).join("; "));
    assert.isAtLeast(candidates.length, 5);

    const bisCore = candidates.find((c) => c.header.name === "BisCore");
    assert.isDefined(bisCore);
    assert.equal(bisCore!.header.readVersion, 1);
    assert.isDefined(bisCore!.header.alias);
    // A schema's references are part of the header, which is what dependency resolution runs on.
    const withReferences = candidates.filter((c) => c.header.references.length > 0);
    assert.isNotEmpty(withReferences);
    assert.isTrue(withReferences.some((c) => c.header.references.some((r) => r.name === "BisCore")));
  });

  it("reads every schema in the iModel, in dependency order", async () => {
    const { schemaSet, documents, issues } = await readSchemasFromIModel(iModel);

    assert.deepEqual(issues.errors.map((e) => e.message), []);
    assert.equal(documents.length, schemaSet.size);
    assert.isAtLeast(schemaSet.size, 5);
    assert.isDefined(schemaSet.getSchema("BisCore"));

    // Every document belongs to the set, and every reference it names is already in it - which is
    // what dependency order buys.
    const position = new Map(documents.map((document, index) => [document.name.toLowerCase(), index]));
    for (const [index, document] of documents.entries()) {
      assert.strictEqual(document.schemaSet, schemaSet, document.name);
      for (const reference of document.references) {
        const referencedIndex = position.get(reference.name.toLowerCase());
        assert.isDefined(referencedIndex, `${document.name} references ${reference.name}, which was not read`);
        assert.isBelow(referencedIndex!, index, `${document.name} was read before ${reference.name}`);
      }
    }
  });

  it("reads a named schema together with what it references, and nothing else", async () => {
    const { schemaSet, documents, issues } = await readSchemasFromIModel(iModel, { schemaNames: ["BisCore"] });

    assert.deepEqual(issues.errors.map((e) => e.message), []);
    const names = documents.map((d) => d.name);
    assert.include(names, "BisCore");
    assert.include(names, "CoreCustomAttributes"); // BisCore references it
    assert.notInclude(names, "Generic"); // references BisCore, so it must not be pulled in
    assert.equal(schemaSet.size, documents.length);
  });

  it("resolves references through the set once the schemas are in it", async () => {
    const { schemaSet } = await readSchemasFromIModel(iModel, { schemaNames: ["BisCore"] });
    const bisCore = schemaSet.getSchema("BisCore")!;

    // A cross-schema item reference resolves, since the referenced document is in the same set.
    const physicalElement = bisCore.getEntity("PhysicalElement")!;
    assert.isDefined(physicalElement.getBaseClass(), "PhysicalElement's base class did not resolve");

    // Effective properties walk the real base chain, which needs the whole hierarchy present.
    const effective = physicalElement.getEffectiveProperties();
    assert.isAtLeast(effective.length, 5);
    assert.isDefined(effective.find((p) => p.name === "Model"));

    // A custom attribute of a class in another schema materializes, which is the thing that needs
    // the set rather than the document.
    const mixins = [...bisCore.getItemsOfType(SchemaItemType.Mixin)];
    assert.isNotEmpty(mixins, "BisCore should hold mixins, which are IsMixin custom attributes on the wire");
  });

  it("reads into a set the caller already owns, and reports a name it already holds", async () => {
    const schemaSet = new Authoring.SchemaSet();
    schemaSet.createSchema("BisCore", "bis", 9, 9, 9);

    const { documents, issues } = await readSchemasFromIModel(iModel, { schemaSet, schemaNames: ["BisCore"] });

    // The caller's own BisCore is not evicted; the iModel's is reported instead.
    assert.equal(schemaSet.getSchema("BisCore")!.readVersion, 9);
    assert.isTrue(issues.hasErrors);
    assert.notInclude(documents.filter((d) => d.schemaSet === schemaSet).map((d) => d.name), "BisCore");
  });

  it("reports a schema the iModel does not have without failing the rest", async () => {
    const { schemaSet, issues } = await readSchemasFromIModel(iModel, { schemaNames: ["BisCore", "NoSuchSchema"] });
    assert.isTrue(issues.hasErrors);
    assert.include(issues.errors.map((e) => e.message).join("\n"), "NoSuchSchema");
    assert.isDefined(schemaSet.getSchema("BisCore"), "the schemas that do exist were still read");
  });

  it("reads one schema on its own for a caller that wants no closure", () => {
    const schemaSet = new Authoring.SchemaSet();
    const result = readSchemaFromIModel(iModel, "BisCore", schemaSet);
    assert.isDefined(result.document);
    assert.equal(schemaSet.size, 1);

    const missing = readSchemaFromIModel(iModel, "NoSuchSchema", new Authoring.SchemaSet());
    assert.isUndefined(missing.document);
    assert.isTrue(missing.issues.hasErrors);
  });

  it("writes back what it read", async () => {
    const { schemaSet } = await readSchemasFromIModel(iModel, { schemaNames: ["BisCore"] });
    const written = new Authoring.SchemaXmlWriter().writeDocument(schemaSet.getSchema("BisCore")!);
    assert.isDefined(written.text);
    assert.deepEqual(written.issues.errors.map((e) => e.message), [], "custom attributes should all resolve through the set");

    const reread = await new Authoring.SchemaXmlReader().readDocument(written.text!);
    assert.isDefined(reread.document);
    assert.equal(reread.document!.items.length, schemaSet.getSchema("BisCore")!.items.length);
  });
});
