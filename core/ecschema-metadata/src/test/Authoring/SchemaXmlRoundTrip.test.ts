/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { SchemaItemType, SchemaMatchType } from "../../ECObjects";
import * as Authoring from "../../Authoring/SchemaDocument";
import { SchemaIssueList } from "../../Authoring/SchemaIssues";
import { SchemaXmlReader } from "../../Authoring/SchemaXmlReader";
import { SchemaXmlWriter } from "../../Authoring/SchemaXmlWriter";
import { InMemorySchemaSource, SchemaCandidateSelectionMode, SchemaResolver } from "../../Authoring/SchemaResolver";
import { composeFullDocument } from "./FullDocumentFixture";

describe("SchemaXmlWriter / SchemaXmlReader", () => {
  it("round-trips a document with every item kind to stable XML", async () => {
    const original = composeFullDocument();
    const writer = new SchemaXmlWriter();

    const firstWrite = writer.writeDocument(original);
    expect(firstWrite.issues.hasErrors, JSON.stringify(firstWrite.issues)).to.be.false;
    expect(firstWrite.text).to.be.a("string");

    const readBack = await new SchemaXmlReader().readDocument(firstWrite.text!, { source: "fixture" });
    expect(readBack.issues.hasErrors, JSON.stringify(readBack.issues)).to.be.false;
    expect(readBack.document).to.not.be.undefined;

    // Write -> read -> write is the stability check: the second output must equal the first.
    const secondWrite = writer.writeDocument(readBack.document!);
    expect(secondWrite.issues.hasErrors, JSON.stringify(secondWrite.issues)).to.be.false;
    expect(secondWrite.text).to.equal(firstWrite.text);
  });

  it("prefers a referenced schema name over another reference's same-spelled alias", () => {
    const set = new Authoring.SchemaSet();
    const legacyUnits = set.createSchema("Units_Schema", "Units", 1, 0, 0);
    const units = set.createSchema("Units", "u", 1, 0, 0);
    const domain = set.createSchema("Domain", "d", 1, 0, 0, { references: [legacyUnits, units] });
    domain.createEntity("E", { baseClass: "Units:Thing" });

    const result = new SchemaXmlWriter().writeDocument(domain);

    expect(result.issues.hasErrors, JSON.stringify(result.issues)).to.be.false;
    expect(result.text).to.contain("<BaseClass>u:Thing</BaseClass>");
  });

  it("streams the same bytes writeDocument materializes", async () => {
    const document = composeFullDocument();
    const writer = new SchemaXmlWriter();

    const materialized = writer.writeDocument(document);
    expect(materialized.issues.hasErrors, JSON.stringify(materialized.issues)).to.be.false;

    const chunks: string[] = [];
    const streamed = await writer.writeDocumentTo(document, (chunk) => { chunks.push(chunk); });
    expect(streamed.issues.hasErrors, JSON.stringify(streamed.issues)).to.be.false;
    expect(chunks.length).to.be.greaterThan(0);
    // Concatenating the streamed chunks must reproduce the materialized text exactly.
    expect(chunks.join("")).to.equal(materialized.text);
  });

  it("hydrates the document shape from XML", async () => {
    const xml = new SchemaXmlWriter().writeDocument(composeFullDocument()).text!;
    const doc = (await new SchemaXmlReader().readDocument(xml, { source: "fixture" })).document!;

    expect(doc.name).to.equal("TestDomain");
    expect(doc.alias).to.equal("td");
    expect(doc.readVersion).to.equal(1);
    expect(doc.writeVersion).to.equal(2);
    expect(doc.minorVersion).to.equal(3);
    expect(doc.originalECXmlVersionMajor).to.equal(3);
    expect(doc.originalECXmlVersionMinor).to.equal(2);
    expect(doc.source).to.equal("fixture");
    expect(doc.references).to.have.lengthOf(2);

    // The schema CA is initially unmaterialized. Reading its values resolves the class and converts
    // the XML scalars to their declared types.
    expect(doc.customAttributes.has("CoreCustomAttributes:DynamicSchema")).to.be.true;
    const tagged = doc.customAttributes.get("TestDomain.Tagged") ?? doc.customAttributes.get("Tagged");
    expect(tagged).to.not.be.undefined;
    expect(tagged!.isMaterialized).to.be.false;
    expect(tagged!.values.Note).to.equal("hello & <welcome>");
    expect(tagged!.values.Tags).to.deep.equal(["a", "b"]);

    // The mixin is promoted to a first-class item; IsMixin is consumed, not kept as a CA.
    const mixin = doc.getItemOfType("IMonitored", SchemaItemType.Mixin);
    expect(mixin).to.not.be.undefined;
    expect(mixin!.appliesTo).to.equal("Pump");
    expect(mixin!.customAttributes.has("IsMixin")).to.be.false;

    // The entity keeps its base class and gets the extra BaseClass entry as a mixin.
    const pump = doc.getEntity("Pump")!;
    expect(pump.baseClass).to.equal("BisCore:PhysicalElement");
    expect(pump.mixins).to.deep.equal(["IMonitored"]);

    const serial = pump.getProperty("SerialNumber")!;
    expect(serial.customAttributes.has("CoreCustomAttributes:HiddenProperty")).to.be.true;
    expect(serial.category).to.equal("Main");

    const state = pump.getProperty("State")!;
    expect(state.isEnumeration()).to.be.true;

    const notes = pump.getProperty("Notes")!;
    expect(notes.isArray()).to.be.true;
    if (notes.isArray())
      expect(notes.maxOccurs).to.be.undefined; // round-trips through "unbounded"

    const rel = doc.getItemOfType("PumpOwnsParts", SchemaItemType.RelationshipClass)!;
    expect(rel.source.multiplicity).to.equal("(1..1)");
    expect(rel.target.polymorphic).to.be.false;

    const status = doc.getItemOfType("Status", SchemaItemType.Enumeration)!;
    expect(status.backingType).to.equal("int");
    expect(status.getEnumerator("On")!.value).to.equal(1);
  });

  it("reports malformed XML as an issue instead of throwing", async () => {
    const result = await new SchemaXmlReader().readDocument("<ECSchema schemaName='Broken'", { source: "broken.ecschema.xml" });
    expect(result.document).to.be.undefined;
    expect(result.issues.hasErrors).to.be.true;
    expect(result.issues.errors[0].location).to.match(/^broken\.ecschema\.xml:\d+:\d+$/);
  });

  it("rejects a namespace naming no known ECXML version", async () => {
    const xml = `<?xml version="1.0"?><ECSchema schemaName="Old" version="01.00" nameSpacePrefix="o" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.1.0"/>`;
    const result = await new SchemaXmlReader().readDocument(xml);
    expect(result.document).to.be.undefined;
    expect(result.issues.hasErrors).to.be.true;
  });

  it("peeks the header without reading items", async () => {
    const xml = new SchemaXmlWriter().writeDocument(composeFullDocument()).text!;
    const result = await new SchemaXmlReader().readHeader(xml);
    expect(result.issues.hasErrors).to.be.false;
    expect(result.header).to.not.be.undefined;
    expect(result.header!.name).to.equal("TestDomain");
    expect(result.header!.minorVersion).to.equal(3);
    expect(result.header!.alias).to.equal("td");
    expect(result.header!.references.map((r) => r.name)).to.deep.equal(["BisCore", "CoreCustomAttributes"]);
  });

  it("reads streamed chunks and stops pulling input once the header is complete", async () => {
    const xml = new SchemaXmlWriter().writeDocument(composeFullDocument()).text!;
    const encoder = new TextEncoder();

    // Tiny chunks, alternating string/bytes, with a multi-byte character forced across a chunk
    // boundary by the odd chunk size - exercises the streaming TextDecoder path.
    let chunksServed = 0;
    let totalChunks = 0;
    async function* chunked(): AsyncGenerator<string | Uint8Array> {
      const size = 97;
      totalChunks = Math.ceil(xml.length / size);
      for (let i = 0; i < xml.length; i += size) {
        ++chunksServed;
        const piece = xml.slice(i, i + size);
        yield (chunksServed % 2 === 0) ? piece : encoder.encode(piece);
      }
    }

    const fullRead = await new SchemaXmlReader().readDocument(chunked(), { source: "fixture" });
    expect(fullRead.issues.hasErrors, JSON.stringify(fullRead.issues)).to.be.false;
    expect(new SchemaXmlWriter().writeDocument(fullRead.document!).text).to.equal(xml);
    expect(chunksServed).to.equal(totalChunks);

    chunksServed = 0;
    const peek = await new SchemaXmlReader().readHeader(chunked());
    expect(peek.header!.name).to.equal("TestDomain");
    expect(peek.header!.references).to.have.lengthOf(2);
    expect(chunksServed).to.be.lessThan(totalChunks); // stopped early - the items were never pulled
  });
});

describe("SchemaResolver", () => {
  function makeDocument(name: string, minor: number, references: Array<{ name: string, minor?: number }> = []): Authoring.SchemaDocument {
    return new Authoring.SchemaDocument(name, name.toLowerCase(), 1, 0, minor, {
      references: references.map((r) => ({ name: r.name, readVersion: 1, writeVersion: 0, minorVersion: r.minor ?? 0, alias: r.name.toLowerCase() })),
    });
  }

  it("resolves the closure in dependency order, picking the highest compatible version", async () => {
    const source = new InMemorySchemaSource();
    source.addDocument(makeDocument("A", 0, [{ name: "B" }]));
    source.addDocument(makeDocument("B", 0));
    source.addDocument(makeDocument("B", 5)); // same read.write, higher minor - should win

    const sources = new SchemaResolver();
    sources.addSource(source);

    const root = makeDocument("Root", 0, [{ name: "A" }, { name: "B" }]);
    const resolution = await sources.resolve([root]);

    expect(resolution.isComplete, JSON.stringify(resolution.issues)).to.be.true;
    const names = resolution.schemas.map((s) => s.name);
    expect(names.indexOf("B")).to.be.lessThan(names.indexOf("A"));
    expect(names.indexOf("A")).to.be.lessThan(names.indexOf("Root"));

    const schemaSet = new Authoring.SchemaSet([root]);
    const documents = await resolution.loadDocuments(schemaSet);
    expect(documents.map((d) => d.name)).to.deep.equal(["B", "A"]); // roots are not loaded
    expect(documents[0].minorVersion).to.equal(5);
  });

  it("discovers and loads reusable in-memory schema text", async () => {
    const source = new InMemorySchemaSource();
    source.addText(
      `<ECSchema schemaName="A" alias="a" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2"/>`,
      new SchemaXmlReader(),
      "A.ecschema.xml",
    );
    const resolver = new SchemaResolver();
    resolver.addSource(source);

    const resolution = await resolver.resolveNames(["A"]);
    const set = new Authoring.SchemaSet();
    const documents = await resolution.loadDocuments(set);

    expect(resolution.isComplete, JSON.stringify(resolution.issues)).to.be.true;
    expect(documents).to.have.lengthOf(1);
    expect(set.getSchema("A")?.source).to.equal("A.ecschema.xml");
  });

  it("resolves named schemas and their transitive references", async () => {
    const source = new InMemorySchemaSource();
    source.addDocument(makeDocument("Tooling", 0, [{ name: "Support" }]));
    source.addDocument(makeDocument("Support", 0));
    const resolver = new SchemaResolver();
    resolver.addSource(source);

    const resolution = await resolver.resolveNames(["Tooling"]);

    expect(resolution.isComplete, JSON.stringify(resolution.issues)).to.be.true;
    expect(resolution.schemas.map((schema) => schema.name)).to.deep.equal(["Support", "Tooling"]);
  });

  it("reuses one discovery snapshot across resolutions", async () => {
    let discoveries = 0;
    const source = new InMemorySchemaSource();
    source.addDocument(makeDocument("A", 0));
    const countingSource = {
      discoverCandidates: async (issues: SchemaIssueList) => {
        ++discoveries;
        return source.discoverCandidates(issues);
      },
    };
    const resolver = new SchemaResolver();
    resolver.addSource(countingSource);

    await resolver.resolveNames(["A"]);
    await resolver.resolve([makeDocument("Root", 0, [{ name: "A" }])]);

    expect(discoveries).to.equal(1);
  });

  it("supports highest-version and first-source candidate selection", async () => {
    const first = new InMemorySchemaSource();
    first.addDocument(makeDocument("Dependency", 1));
    const second = new InMemorySchemaSource();
    second.addDocument(makeDocument("Dependency", 5));
    const root = makeDocument("Root", 0, [{ name: "Dependency" }]);

    const highest = new SchemaResolver();
    highest.addSource(first);
    highest.addSource(second);
    const highestResolution = await highest.resolve([root]);
    expect(highestResolution.schemas.find((schema) => schema.name === "Dependency")!.candidate!.header.minorVersion).to.equal(5);

    const firstSource = new SchemaResolver(SchemaCandidateSelectionMode.FirstSource);
    firstSource.addSource(first);
    firstSource.addSource(second);
    const firstResolution = await firstSource.resolve([root]);
    expect(firstResolution.schemas.find((schema) => schema.name === "Dependency")!.candidate!.header.minorVersion).to.equal(1);
  });

  it("skips an incompatible first source", async () => {
    const first = new InMemorySchemaSource();
    first.addDocument(makeDocument("Dependency", 1));
    const second = new InMemorySchemaSource();
    second.addDocument(makeDocument("Dependency", 5));
    const resolver = new SchemaResolver(SchemaCandidateSelectionMode.FirstSource);
    resolver.addSource(first);
    resolver.addSource(second);

    const root = makeDocument("Root", 0, [{ name: "Dependency", minor: 5 }]);
    const resolution = await resolver.resolve([root], SchemaMatchType.Exact);

    expect(resolution.isComplete, JSON.stringify(resolution.issues)).to.be.true;
    expect(resolution.schemas.find((schema) => schema.name === "Dependency")!.candidate!.header.minorVersion).to.equal(5);
  });

  it("does not reload a same-version document already in the target set", async () => {
    const source = new InMemorySchemaSource();
    source.addDocument(makeDocument("A", 0));
    const resolver = new SchemaResolver();
    resolver.addSource(source);
    const resolution = await resolver.resolveNames(["A"]);
    const target = new Authoring.SchemaSet([makeDocument("A", 0)]);

    const loaded = await resolution.loadDocuments(target);

    expect(loaded).to.be.empty;
    expect(resolution.isComplete).to.be.true;
  });

  it("reports a conflicting version already in the target set", async () => {
    const source = new InMemorySchemaSource();
    source.addDocument(makeDocument("A", 5));
    const resolver = new SchemaResolver();
    resolver.addSource(source);
    const resolution = await resolver.resolveNames(["A"]);
    const target = new Authoring.SchemaSet([makeDocument("A", 0)]);

    await resolution.loadDocuments(target);

    expect(resolution.isComplete).to.be.false;
    expect(resolution.issues.errors[0].name).to.equal("schema-name-version-conflict");
  });

  it("reports a missing reference as an error", async () => {
    const sources = new SchemaResolver();
    sources.addSource(new InMemorySchemaSource());
    const root = makeDocument("Root", 0, [{ name: "Nowhere" }]);
    const resolution = await sources.resolve([root]);
    expect(resolution.isComplete).to.be.false;
    expect(resolution.issues.errors[0].message).to.contain("Nowhere");
  });

  it("reports conflicting version requirements", async () => {
    const source = new InMemorySchemaSource();
    source.addDocument(makeDocument("A", 0, [{ name: "C" }]));
    const conflicting = new Authoring.SchemaDocument("C", "c", 2, 0, 0); // only a 2.0.0 is available
    source.addDocument(conflicting);

    const sources = new SchemaResolver();
    sources.addSource(source);

    // Root demands C 1.0.0 (via A's reference at 1.0.x the same), but only C 2.0.0 exists.
    const root = makeDocument("Root", 0, [{ name: "A" }, { name: "C" }]);
    const resolution = await sources.resolve([root]);
    expect(resolution.isComplete).to.be.false;
  });

  it("respects the requested match tolerance", async () => {
    const source = new InMemorySchemaSource();
    source.addDocument(makeDocument("A", 5));
    const sources = new SchemaResolver();
    sources.addSource(source);

    const root = makeDocument("Root", 0, [{ name: "A", minor: 0 }]);
    const lenient = await sources.resolve([root], SchemaMatchType.LatestWriteCompatible);
    expect(lenient.isComplete).to.be.true;

    const exact = await sources.resolve([root], SchemaMatchType.Exact);
    expect(exact.isComplete).to.be.false; // 1.0.5 does not match 1.0.0 exactly
  });
});
