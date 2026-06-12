/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { DecimalPrecision, FormatTraits, FormatType } from "@itwin/core-quantity";
import { CustomAttributeContainerType, PrimitiveType, SchemaItemType, SchemaMatchType, StrengthDirection, StrengthType } from "../../ECObjects";
import { SchemaDocument } from "../../Authoring/SchemaDocument";
import { SchemaXmlReader } from "../../Authoring/SchemaXmlReader";
import { SchemaXmlWriter } from "../../Authoring/SchemaXmlWriter";
import { InMemorySchemaSource, SchemaSourceSet } from "../../Authoring/SchemaSources";

/** Composes a document exercising every schema item kind, property kind, and CA placement. */
function composeFullDocument(): SchemaDocument {
  const doc = new SchemaDocument("TestDomain", "td", 1, 2, 3, {
    label: "Test Domain",
    description: "Round-trip fixture",
    references: [
      { name: "BisCore", readVersion: 1, writeVersion: 0, minorVersion: 0, alias: "bis" },
      { name: "CoreCustomAttributes", readVersion: 1, writeVersion: 0, minorVersion: 3, alias: "CoreCA" },
    ],
  });
  doc.customAttributes.add({ className: "CoreCustomAttributes.DynamicSchema" });
  // eslint-disable-next-line @typescript-eslint/naming-convention
  doc.customAttributes.add({ className: "TestDomain:Tagged", properties: { Note: "hello & <welcome>", Tags: ["a", "b"] } });

  // Units / formats family.
  doc.createUnitSystem("METRIC", { label: "Metric" });
  doc.createPhenomenon("LENGTH", "LENGTH");
  doc.createUnit("M", "LENGTH", "METRIC", "M", { label: "m" });
  doc.createUnit("MM", "LENGTH", "METRIC", "MILLI*M", { numerator: 1, denominator: 1000 });
  doc.createInvertedUnit("INV_M", "M", "METRIC");
  doc.createConstant("PI", "LENGTH", "ONE", { numerator: 3.14159 });
  doc.createFormat("DefaultReal", FormatType.Decimal, {
    precision: DecimalPrecision.Four,
    formatTraits: FormatTraits.KeepSingleZero | FormatTraits.ShowUnitLabel,
    uomSeparator: "",
    composite: { includeZero: true, spacer: "", units: [{ name: "M", label: "m" }] },
  });
  doc.createKindOfQuantity("LENGTH_KOQ", "M", 0.001, {
    label: "Length",
    presentationFormats: ["f:DefaultReal(4)[u:M]"],
  });

  doc.createPropertyCategory("Main", { priority: 100 });

  const status = doc.createEnumeration("Status", "int", { isStrict: false });
  status.createEnumerator("On", 1, { label: "On" });
  status.createEnumerator("Off", 2);
  const codes = doc.createEnumeration("Codes", "string");
  codes.createEnumerator("A", "a-value", { description: "the a" });

  doc.createCustomAttributeClass("Tagged", CustomAttributeContainerType.Schema | CustomAttributeContainerType.AnyClass);

  const partInfo = doc.createStructClass("PartInfo");
  partInfo.createPrimitive("PartNumber", PrimitiveType.String);

  const pump = doc.createEntity("Pump", { label: "Pump", baseClass: "BisCore:PhysicalElement", mixins: ["IMonitored"] });
  const serial = pump.createPrimitive("SerialNumber", PrimitiveType.String, { priority: 50, category: "Main" });
  serial.customAttributes.add({ className: "CoreCustomAttributes.HiddenProperty" });
  pump.createPrimitive("Length", PrimitiveType.Double, { kindOfQuantity: "LENGTH_KOQ" });
  pump.createEnumeration("State", "Status");
  pump.createPrimitiveArray("Readings", PrimitiveType.Double, { minOccurs: 0, maxOccurs: 10 });
  pump.createPrimitiveArray("Notes", PrimitiveType.String); // unbounded
  pump.createStruct("MainPart", "PartInfo");
  pump.createStructArray("Parts", "PartInfo", { minOccurs: 1 });
  pump.createNavigation("PartsRel", "PumpOwnsParts", StrengthDirection.Forward, { description: "nav" });

  doc.createMixin("IMonitored", "Pump", { description: "monitoring mixin" });

  const rel = doc.createRelationship("PumpOwnsParts", { strength: StrengthType.Embedding });
  rel.source.multiplicity = "(1..1)";
  rel.source.roleLabel = "owns";
  rel.source.constraintClasses.push("Pump");
  rel.target.multiplicity = "(0..*)";
  rel.target.roleLabel = "is owned by";
  rel.target.polymorphic = false;
  rel.target.constraintClasses.push("PartInfo");

  return doc;
}

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

    // The schema CA bag survives, values kept untyped.
    expect(doc.customAttributes.has("CoreCustomAttributes:DynamicSchema")).to.be.true;
    const tagged = doc.customAttributes.get("TestDomain.Tagged") ?? doc.customAttributes.get("Tagged");
    expect(tagged).to.not.be.undefined;
    expect(tagged!.properties!.Note).to.equal("hello & <welcome>");
    expect(tagged!.properties!.Tags).to.deep.equal(["a", "b"]);

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
    notes.assertArray();
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
    expect(result.issues.errors[0].source).to.equal("broken.ecschema.xml");
  });

  it("rejects a non-3.x namespace", async () => {
    const xml = `<?xml version="1.0"?><ECSchema schemaName="Old" version="01.00" nameSpacePrefix="o" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.2.0"/>`;
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

describe("SchemaSourceSet", () => {
  function makeDocument(name: string, minor: number, references: Array<{ name: string, minor?: number }> = []): SchemaDocument {
    return new SchemaDocument(name, name.toLowerCase(), 1, 0, minor, {
      references: references.map((r) => ({ name: r.name, readVersion: 1, writeVersion: 0, minorVersion: r.minor ?? 0, alias: r.name.toLowerCase() })),
    });
  }

  it("resolves the closure in dependency order, picking the highest compatible version", async () => {
    const source = new InMemorySchemaSource();
    source.addDocument(makeDocument("A", 0, [{ name: "B" }]));
    source.addDocument(makeDocument("B", 0));
    source.addDocument(makeDocument("B", 5)); // same read.write, higher minor - should win

    const sources = new SchemaSourceSet();
    sources.addSource(source);

    const root = makeDocument("Root", 0, [{ name: "A" }, { name: "B" }]);
    const resolution = await sources.resolve([root]);

    expect(resolution.isComplete, JSON.stringify(resolution.issues)).to.be.true;
    const names = resolution.schemas.map((s) => s.name);
    expect(names.indexOf("B")).to.be.lessThan(names.indexOf("A"));
    expect(names.indexOf("A")).to.be.lessThan(names.indexOf("Root"));

    const documents = await resolution.loadDocuments();
    expect(documents.map((d) => d.name)).to.deep.equal(["B", "A"]); // roots are not loaded
    expect(documents[0].minorVersion).to.equal(5);
  });

  it("reports a missing reference as an error", async () => {
    const sources = new SchemaSourceSet();
    sources.addSource(new InMemorySchemaSource());
    const root = makeDocument("Root", 0, [{ name: "Nowhere" }]);
    const resolution = await sources.resolve([root]);
    expect(resolution.isComplete).to.be.false;
    expect(resolution.issues.errors[0].message).to.contain("Nowhere");
  });

  it("reports conflicting version requirements", async () => {
    const source = new InMemorySchemaSource();
    source.addDocument(makeDocument("A", 0, [{ name: "C" }]));
    const conflicting = new SchemaDocument("C", "c", 2, 0, 0); // only a 2.0.0 is available
    source.addDocument(conflicting);

    const sources = new SchemaSourceSet();
    sources.addSource(source);

    // Root demands C 1.0.0 (via A's reference at 1.0.x the same), but only C 2.0.0 exists.
    const root = makeDocument("Root", 0, [{ name: "A" }, { name: "C" }]);
    const resolution = await sources.resolve([root]);
    expect(resolution.isComplete).to.be.false;
  });

  it("respects the requested match tolerance", async () => {
    const source = new InMemorySchemaSource();
    source.addDocument(makeDocument("A", 5));
    const sources = new SchemaSourceSet();
    sources.addSource(source);

    const root = makeDocument("Root", 0, [{ name: "A", minor: 0 }]);
    const lenient = await sources.resolve([root], SchemaMatchType.LatestWriteCompatible);
    expect(lenient.isComplete).to.be.true;

    const exact = await sources.resolve([root], SchemaMatchType.Exact);
    expect(exact.isComplete).to.be.false; // 1.0.5 does not match 1.0.0 exactly
  });
});
