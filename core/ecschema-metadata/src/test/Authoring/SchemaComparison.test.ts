/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { CustomAttributeContainerType, StrengthType } from "../../ECObjects";
import { compareSchemaDocuments, formatSchemaComparison } from "../../Authoring/SchemaComparison";
import * as Authoring from "../../Authoring/SchemaDocument";
import { SchemaJsonReader } from "../../Authoring/SchemaJsonReader";
import { SchemaJsonWriter } from "../../Authoring/SchemaJsonWriter";
import { SchemaXmlReader } from "../../Authoring/SchemaXmlReader";
import { SchemaXmlWriter } from "../../Authoring/SchemaXmlWriter";
import { composeFullDocument } from "./FullDocumentFixture";

describe("compareSchemaDocuments", () => {
  it("finds two builds of the same document equal", () => {
    const comparison = compareSchemaDocuments(composeFullDocument(), composeFullDocument());
    expect(comparison.areEqual, formatSchemaComparison(comparison)).to.be.true;
    expect(formatSchemaComparison(comparison)).to.equal("No differences.");
  });

  it("finds the same schema loaded from XML and from JSON equal", async () => {
    const original = composeFullDocument();
    const xml = new SchemaXmlWriter().writeDocument(original).text!;
    const json = new SchemaJsonWriter().writeDocument(original).text!;
    const fromXml = (await new SchemaXmlReader().readDocument(xml)).document!;
    const fromJson = (await new SchemaJsonReader().readDocument(json)).document!;

    // The XML-read document carries reference aliases, the JSON-read one cannot (ECJSON has
    // none) - the comparison ignores them by design.
    expect(fromXml.references[0].alias).to.equal("bis");
    expect(fromJson.references[0].alias).to.be.null;

    const comparison = compareSchemaDocuments(fromXml, fromJson);
    expect(comparison.areEqual, formatSchemaComparison(comparison)).to.be.true;
  });

  it("compares item references resolved, not verbatim", () => {
    function compose(baseClass: string): Authoring.SchemaDocument {
      const doc = new Authoring.SchemaDocument("RefTest", "rt", 1, 0, 0, {
        references: [{ name: "BisCore", readVersion: 1, writeVersion: 0, minorVersion: 0, alias: "bis" }],
      });
      doc.createEntity("Pump", { baseClass });
      return doc;
    }
    const comparison = compareSchemaDocuments(compose("bis:PhysicalElement"), compose("BisCore.PhysicalElement"));
    expect(comparison.areEqual, formatSchemaComparison(comparison)).to.be.true;
  });

  it("compares custom attribute values across the XML/JSON typing boundary", async () => {
    const original = new Authoring.SchemaDocument("CaTest", "ct", 1, 0, 0);
    original.createCustomAttributeClass("Marked", CustomAttributeContainerType.Schema);
    original.customAttributes.add({ className: "Marked", json: { Count: 5, Active: true } }); // eslint-disable-line @typescript-eslint/naming-convention

    // The XML writer renders the scalars as canonical text ("5", "True"); the round-tripped document
    // holds them as a raw XML body. The comparison converts that body back to JSON (the guarded
    // promotion reads "5"/"True" as the same types), so the typing gap is closed for canonical values.
    const xml = new SchemaXmlWriter().writeDocument(original).text!;
    const fromXml = (await new SchemaXmlReader().readDocument(xml)).document!;
    expect(fromXml.customAttributes.get("Marked")!.format).to.equal(Authoring.CustomAttributeFormat.Xml);

    const comparison = compareSchemaDocuments(original, fromXml);
    expect(comparison.areEqual, formatSchemaComparison(comparison)).to.be.true;
  });

  it("treats constraint classes as a set", () => {
    function compose(constraintClasses: string[]): Authoring.SchemaDocument {
      const doc = new Authoring.SchemaDocument("RelTest", "rl", 1, 0, 0);
      doc.createEntity("A");
      doc.createEntity("B");
      const rel = doc.createRelationship("Rel", { strength: StrengthType.Referencing });
      rel.source.multiplicity = "(0..*)";
      rel.source.roleLabel = "refers to";
      rel.source.constraintClasses.push(...constraintClasses);
      rel.target.multiplicity = "(0..*)";
      rel.target.roleLabel = "is referred by";
      rel.target.constraintClasses.push("A");
      return doc;
    }
    const comparison = compareSchemaDocuments(compose(["A", "B"]), compose(["B", "A"]));
    expect(comparison.areEqual, formatSchemaComparison(comparison)).to.be.true;
  });

  it("reports modified fields with their paths", () => {
    const left = composeFullDocument();
    const right = composeFullDocument();
    right.getEntity("Pump")!.label = "Pumpe";
    right.getEntity("Pump")!.getProperty("SerialNumber")!.priority = 60;

    const comparison = compareSchemaDocuments(left, right);
    expect(comparison.areEqual).to.be.false;
    expect(comparison.schemaDifferences).to.be.empty;
    expect(comparison.itemDifferences).to.have.lengthOf(1);

    const pump = comparison.itemDifferences[0];
    expect(pump.name).to.equal("Pump");
    expect(pump.change).to.equal("modified");
    expect(pump.differences).to.deep.include({ path: "label", left: `"Pump"`, right: `"Pumpe"` });
    expect(pump.differences).to.deep.include({ path: "properties.SerialNumber.priority", left: "50", right: "60" });
  });

  it("reports added and removed items", () => {
    const smaller = composeFullDocument();
    const larger = composeFullDocument();
    larger.createUnitSystem("IMPERIAL");

    const added = compareSchemaDocuments(smaller, larger);
    expect(added.itemDifferences).to.deep.equal([{ name: "IMPERIAL", change: "added", differences: [] }]);

    const removed = compareSchemaDocuments(larger, smaller);
    expect(removed.itemDifferences).to.deep.equal([{ name: "IMPERIAL", change: "removed", differences: [] }]);
  });

  it("reports schema-level differences", () => {
    const left = new Authoring.SchemaDocument("Versioned", "v", 1, 0, 0);
    const right = new Authoring.SchemaDocument("Versioned", "v", 1, 0, 1, { label: "Versioned" });

    const comparison = compareSchemaDocuments(left, right);
    expect(comparison.itemDifferences).to.be.empty;
    expect(comparison.schemaDifferences).to.deep.include({ path: "version", left: `"01.00.00"`, right: `"01.00.01"` });
    expect(comparison.schemaDifferences).to.deep.include({ path: "label", left: undefined, right: `"Versioned"` });
  });

  it("formats a readable difference listing", () => {
    const left = composeFullDocument();
    const right = composeFullDocument();
    right.getEntity("Pump")!.label = "Pumpe";
    right.createUnitSystem("IMPERIAL");

    const listing = formatSchemaComparison(compareSchemaDocuments(left, right));
    expect(listing).to.contain("~ Pump");
    expect(listing).to.contain(`label: "Pump" -> "Pumpe"`);
    expect(listing).to.contain("+ IMPERIAL");
  });
});
