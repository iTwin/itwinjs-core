/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { SchemaItemType } from "../../ECObjects";
import { SchemaJsonReader } from "../../Authoring/SchemaJsonReader";
import { SchemaJsonWriter } from "../../Authoring/SchemaJsonWriter";
import { SchemaXmlReader } from "../../Authoring/SchemaXmlReader";
import { SchemaXmlWriter } from "../../Authoring/SchemaXmlWriter";
import { composeFullDocument } from "./FullDocumentFixture";

describe("SchemaJsonWriter / SchemaJsonReader", () => {
  it("round-trips a document with every item kind to stable JSON", async () => {
    const original = composeFullDocument();
    const writer = new SchemaJsonWriter();

    const firstWrite = writer.writeDocument(original);
    expect(firstWrite.issues.hasErrors, JSON.stringify(firstWrite.issues)).to.be.false;
    expect(firstWrite.text).to.be.a("string");

    const readBack = await new SchemaJsonReader().readDocument(firstWrite.text!, { source: "fixture" });
    expect(readBack.issues.hasErrors, JSON.stringify(readBack.issues)).to.be.false;
    expect(readBack.document).to.not.be.undefined;

    // Write -> read -> write is the stability check: the second output must equal the first.
    const secondWrite = writer.writeDocument(readBack.document!);
    expect(secondWrite.issues.hasErrors, JSON.stringify(secondWrite.issues)).to.be.false;
    expect(secondWrite.text).to.equal(firstWrite.text);
  });

  it("streams the same bytes writeDocument materializes", async () => {
    const document = composeFullDocument();
    const writer = new SchemaJsonWriter();

    const materialized = writer.writeDocument(document);
    expect(materialized.issues.hasErrors, JSON.stringify(materialized.issues)).to.be.false;

    const chunks: string[] = [];
    const streamed = await writer.writeDocumentTo(document, (chunk) => { chunks.push(chunk); });
    expect(streamed.issues.hasErrors, JSON.stringify(streamed.issues)).to.be.false;
    // The JSON writer materializes internally (documented), so it emits the whole text as one chunk;
    // either way, concatenating the chunks must reproduce the materialized text exactly.
    expect(chunks.join("")).to.equal(materialized.text);
  });

  it("reads an already-parsed object without a stringify round trip", () => {
    const original = composeFullDocument();
    const writer = new SchemaJsonWriter();
    const reader = new SchemaJsonReader();

    // The object path mirrors the iModel getSchemaProps flow: a live object in, no text in between.
    const tree = writer.writeDocumentTree(original);
    expect(tree.issues.hasErrors, JSON.stringify(tree.issues)).to.be.false;
    expect(tree.tree).to.not.be.undefined;

    const readObject = reader.readObject(tree.tree!, { source: "props" });
    expect(readObject.issues.hasErrors, JSON.stringify(readObject.issues)).to.be.false;
    expect(readObject.document).to.not.be.undefined;

    // Reading the object must yield the same document as reading the equivalent text.
    const viaText = writer.writeDocument(readObject.document!);
    expect(viaText.text).to.equal(writer.writeDocument(original).text);
  });

  it("reads the header from an already-parsed object", () => {
    const original = composeFullDocument();
    const tree = new SchemaJsonWriter().writeDocumentTree(original);

    const header = new SchemaJsonReader().readHeaderObject(tree.tree!, { source: "props" });
    expect(header.issues.hasErrors, JSON.stringify(header.issues)).to.be.false;
    expect(header.header!.name).to.equal(original.name);
    expect(header.header!.minorVersion).to.equal(original.minorVersion);
    expect(header.header!.references.length).to.equal(original.references.length);
  });

  it("emits the ECJSON 3.2 shape", () => {
    const json = JSON.parse(new SchemaJsonWriter().writeDocument(composeFullDocument()).text!);

    expect(json.$schema).to.equal("https://dev.bentley.com/json_schemas/ec/32/ecschema");
    expect(json.name).to.equal("TestDomain");
    expect(json.version).to.equal("01.02.03");
    expect(json.alias).to.equal("td");

    // References carry name and version only - ECJSON has no reference aliases.
    expect(json.references).to.deep.equal([
      { name: "BisCore", version: "01.00.00" },
      { name: "CoreCustomAttributes", version: "01.00.03" },
    ]);

    // Custom attributes are flattened: className beside the property values.
    const tagged = json.customAttributes.find((ca: any) => ca.className === "TestDomain.Tagged");
    expect(tagged.Note).to.equal("hello & <welcome>");
    expect(tagged.Tags).to.deep.equal(["a", "b"]);

    // Mixins are first class, with appliesTo - no IsMixin custom attribute.
    const mixin = json.items.IMonitored;
    expect(mixin.schemaItemType).to.equal("Mixin");
    expect(mixin.appliesTo).to.equal("TestDomain.Pump");
    expect(mixin.customAttributes).to.be.undefined;

    // Item references use the dot-form full name, including into the schema itself.
    const pump = json.items.Pump;
    expect(pump.baseClass).to.equal("BisCore.PhysicalElement");
    expect(pump.mixins).to.deep.equal(["TestDomain.IMonitored"]);

    // An enum-backed property still says PrimitiveProperty; the enumeration is the typeName.
    const state = pump.properties.find((p: any) => p.name === "State");
    expect(state.type).to.equal("PrimitiveProperty");
    expect(state.typeName).to.equal("TestDomain.Status");

    // An unbounded array omits maxOccurs.
    const notes = pump.properties.find((p: any) => p.name === "Notes");
    expect(notes.type).to.equal("PrimitiveArrayProperty");
    expect(notes.minOccurs).to.equal(0);
    expect(notes.maxOccurs).to.be.undefined;

    const status = json.items.Status;
    expect(status.type).to.equal("int");
    expect(status.isStrict).to.be.false;
    expect(status.enumerators[0]).to.deep.equal({ name: "On", value: 1, label: "On" });

    const format = json.items.DefaultReal;
    expect(format.type).to.equal("Decimal");
    expect(format.formatTraits).to.deep.equal(["KeepSingleZero", "ShowUnitLabel"]);
    expect(format.composite.units).to.deep.equal([{ name: "TestDomain.M", label: "m" }]);
  });

  it("hydrates the document shape from JSON", async () => {
    const json = new SchemaJsonWriter().writeDocument(composeFullDocument()).text!;
    const doc = (await new SchemaJsonReader().readDocument(json, { source: "fixture" })).document!;

    expect(doc.name).to.equal("TestDomain");
    expect(doc.alias).to.equal("td");
    expect(doc.minorVersion).to.equal(3);
    expect(doc.originalECXmlVersionMajor).to.equal(3);
    expect(doc.originalECXmlVersionMinor).to.equal(2);
    expect(doc.source).to.equal("fixture");

    // ECJSON references carry no alias; null records that as an explicit absence.
    expect(doc.references.map((r) => r.alias)).to.deep.equal([null, null]);

    const tagged = doc.customAttributes.get("Tagged");
    expect(tagged).to.not.be.undefined;
    expect(tagged!.json!.Tags).to.deep.equal(["a", "b"]);

    // Dot-form references normalize the same way the XML reader normalizes alias-form ones.
    const pump = doc.getEntity("Pump")!;
    expect(pump.baseClass).to.equal("BisCore:PhysicalElement");
    expect(pump.mixins).to.deep.equal(["IMonitored"]);
    expect(pump.getProperty("State")!.isEnumeration()).to.be.true;

    const mixin = doc.getItemOfType("IMonitored", SchemaItemType.Mixin)!;
    expect(mixin.appliesTo).to.equal("Pump");

    const rel = doc.getItemOfType("PumpOwnsParts", SchemaItemType.RelationshipClass)!;
    expect(rel.source.multiplicity).to.equal("(1..1)");
    expect(rel.target.polymorphic).to.be.false;
  });

  it("reads the same document from XML and JSON text", async () => {
    // The two formats hydrate identical documents, so writing either reader's result
    // produces the same JSON.
    const original = composeFullDocument();
    const xml = new SchemaXmlWriter().writeDocument(original).text!;
    const fromXml = (await new SchemaXmlReader().readDocument(xml)).document!;

    const jsonWriter = new SchemaJsonWriter();
    const jsonFromXmlRead = jsonWriter.writeDocument(fromXml);
    expect(jsonFromXmlRead.issues.hasErrors, JSON.stringify(jsonFromXmlRead.issues)).to.be.false;
    expect(jsonFromXmlRead.text).to.equal(jsonWriter.writeDocument(original).text);

    // And back across: a JSON-read document writes the original XML, except that ECJSON does
    // not carry reference aliases - restore those before comparing.
    const fromJson = (await new SchemaJsonReader().readDocument(jsonFromXmlRead.text!)).document!;
    for (const reference of original.references)
      fromJson.setSchemaReference(reference);
    expect(new SchemaXmlWriter().writeDocument(fromJson).text).to.equal(xml);
  });

  it("reports malformed JSON as an issue instead of throwing", async () => {
    const result = await new SchemaJsonReader().readDocument(`{"name": "Broken",`, { source: "broken.ecschema.json" });
    expect(result.document).to.be.undefined;
    expect(result.issues.hasErrors).to.be.true;
    expect(result.issues.errors[0].code).to.equal("SchemaJson-0010");
    expect(result.issues.errors[0].source).to.equal("broken.ecschema.json");
  });

  it("rejects a missing or foreign $schema", async () => {
    const noUrl = await new SchemaJsonReader().readDocument(`{"name": "Plain", "version": "01.00.00"}`);
    expect(noUrl.document).to.be.undefined;
    expect(noUrl.issues.errors[0].code).to.equal("SchemaJson-0014");

    const foreign = await new SchemaJsonReader().readDocument(
      `{"$schema": "https://example.com/other", "name": "Foreign", "version": "01.00.00"}`);
    expect(foreign.document).to.be.undefined;
    expect(foreign.issues.errors[0].code).to.equal("SchemaJson-0014");
  });

  it("peeks the header", async () => {
    const json = new SchemaJsonWriter().writeDocument(composeFullDocument()).text!;
    const result = await new SchemaJsonReader().readHeader(json);
    expect(result.issues.hasErrors).to.be.false;
    expect(result.header!.name).to.equal("TestDomain");
    expect(result.header!.minorVersion).to.equal(3);
    expect(result.header!.alias).to.equal("td");
    expect(result.header!.references.map((r) => r.name)).to.deep.equal(["BisCore", "CoreCustomAttributes"]);
    expect(result.header!.references.map((r) => r.alias)).to.deep.equal([null, null]);
  });

  it("reads streamed chunks", async () => {
    const json = new SchemaJsonWriter().writeDocument(composeFullDocument()).text!;
    const encoder = new TextEncoder();
    async function* chunked(): AsyncGenerator<string | Uint8Array> {
      const size = 97;
      for (let i = 0; i < json.length; i += size) {
        const piece = json.slice(i, i + size);
        yield (i % 2 === 0) ? encoder.encode(piece) : piece;
      }
    }
    const result = await new SchemaJsonReader().readDocument(chunked());
    expect(result.issues.hasErrors, JSON.stringify(result.issues)).to.be.false;
    expect(new SchemaJsonWriter().writeDocument(result.document!).text).to.equal(json);
  });
});
