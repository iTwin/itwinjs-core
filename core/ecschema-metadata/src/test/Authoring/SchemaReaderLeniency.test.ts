/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/* eslint-disable @typescript-eslint/naming-convention -- JSON fixtures key items by their PascalCase EC names */

import { describe, expect, it } from "vitest";
import { SchemaItemType } from "../../ECObjects";
import { SchemaIssueList } from "../../Authoring/SchemaIssues";
import { SchemaJsonReader } from "../../Authoring/SchemaJsonReader";
import { SchemaXmlReader } from "../../Authoring/SchemaXmlReader";

// The readers are lenient: anything short of unusable input yields a best-effort document with
// the problems reported as issues. These tests pin that contract - what gets skipped, what gets
// kept, and which codes are raised - for the representative failure families of each format.

function codes(issues: SchemaIssueList): string[] {
  return [...issues].map((issue) => issue.code);
}

describe("SchemaXmlReader leniency", () => {
  function schemaXml(body: string, attributes = `schemaName="Lenient" alias="ln" version="01.00.00"`): string {
    return `<?xml version="1.0" encoding="UTF-8"?><ECSchema ${attributes} xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">${body}</ECSchema>`;
  }

  it("reports a missing alias but still produces the document", async () => {
    const result = await new SchemaXmlReader().readDocument(schemaXml("", `schemaName="NoAlias" version="01.00.00"`));
    expect(result.document).to.not.be.undefined;
    expect(result.document!.alias).to.equal("");
    expect(codes(result.issues)).to.contain("SchemaXml-0016");
  });

  it("skips an unrecognized schema child element with a warning and reads the rest", async () => {
    const result = await new SchemaXmlReader().readDocument(schemaXml(`<SomethingNew/><ECEntityClass typeName="Kept"/>`));
    expect(codes(result.issues)).to.deep.equal(["SchemaXml-0017"]);
    expect(result.issues.hasErrors).to.be.false;
    expect(result.document!.getEntity("Kept")).to.not.be.undefined;
  });

  it("ignores an unrecognized class modifier with a warning, keeping the class", async () => {
    const result = await new SchemaXmlReader().readDocument(schemaXml(`<ECEntityClass typeName="Odd" modifier="Banana"/>`));
    expect(codes(result.issues)).to.deep.equal(["SchemaXml-0019"]);
    expect(result.document!.getEntity("Odd")).to.not.be.undefined;
  });

  it("skips an item missing its typeName, keeping its siblings", async () => {
    const result = await new SchemaXmlReader().readDocument(schemaXml(`<ECEntityClass/><ECEntityClass typeName="Kept"/>`));
    expect(codes(result.issues)).to.deep.equal(["SchemaXml-0018"]);
    expect(result.document!.items.map((item) => item.name)).to.deep.equal(["Kept"]);
  });

  it("reports a relationship without constraints, keeping the class", async () => {
    const result = await new SchemaXmlReader().readDocument(schemaXml(`<ECRelationshipClass typeName="Rel" strength="referencing"/>`));
    expect(codes(result.issues)).to.deep.equal(["SchemaXml-0026", "SchemaXml-0026"]); // source and target
    expect(result.document!.getItemOfType("Rel", SchemaItemType.RelationshipClass)).to.not.be.undefined;
  });

  it("skips a non-integer enumerator on an int enumeration, keeping the valid ones", async () => {
    const result = await new SchemaXmlReader().readDocument(schemaXml(
      `<ECEnumeration typeName="Status" backingTypeName="int"><ECEnumerator name="On" value="1"/><ECEnumerator name="Bad" value="x"/></ECEnumeration>`));
    expect(codes(result.issues)).to.deep.equal(["SchemaXml-0033"]);
    const status = result.document!.getItemOfType("Status", SchemaItemType.Enumeration)!;
    expect(status.enumerators.map((e) => e.name)).to.deep.equal(["On"]);
  });

  it("ignores a non-boolean attribute value with a warning", async () => {
    const result = await new SchemaXmlReader().readDocument(schemaXml(
      `<ECEntityClass typeName="E"><ECProperty propertyName="P" typeName="string" readOnly="banana"/></ECEntityClass>`));
    expect(codes(result.issues)).to.deep.equal(["SchemaXml-0041"]);
    expect(result.document!.getEntity("E")!.getProperty("P")!.isReadOnly).to.be.undefined;
  });

  it("leaves an item reference with an unknown qualifier as written", async () => {
    const result = await new SchemaXmlReader().readDocument(schemaXml(`<ECEntityClass typeName="E"><BaseClass>nowhere:Thing</BaseClass></ECEntityClass>`));
    expect(result.document!.getEntity("E")!.baseClass).to.equal("nowhere:Thing");
  });
});

describe("SchemaJsonReader leniency", () => {
  function schemaJson(items: object = {}, extra: object = {}): string {
    return JSON.stringify({
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "Lenient", version: "01.00.00", alias: "ln",
      items, ...extra,
    });
  }

  it("rejects a JSON array root", async () => {
    const result = await new SchemaJsonReader().readDocument("[]");
    expect(result.document).to.be.undefined;
    expect(codes(result.issues)).to.deep.equal(["SchemaJson-0011"]);
  });

  it("skips an item that is not a JSON object, keeping its siblings", async () => {
    const result = await new SchemaJsonReader().readDocument(schemaJson({ Broken: 42, Kept: { schemaItemType: "EntityClass" } }));
    expect(codes(result.issues)).to.deep.equal(["SchemaJson-0017"]);
    expect(result.document!.items.map((item) => item.name)).to.deep.equal(["Kept"]);
  });

  it("skips an item with an unrecognized schemaItemType", async () => {
    const result = await new SchemaJsonReader().readDocument(schemaJson({ Odd: { schemaItemType: "HologramClass" } }));
    expect(codes(result.issues)).to.deep.equal(["SchemaJson-0018"]);
    expect(result.document!.items).to.be.empty;
  });

  it("skips a property missing its type, keeping the class and its other properties", async () => {
    const result = await new SchemaJsonReader().readDocument(schemaJson({
      E: { schemaItemType: "EntityClass", properties: [{ name: "NoType" }, { name: "Kept", type: "PrimitiveProperty", typeName: "string" }] },
    }));
    expect(codes(result.issues)).to.deep.equal(["SchemaJson-0029"]);
    expect(result.document!.getEntity("E")!.properties.map((p) => p.name)).to.deep.equal(["Kept"]);
  });

  it("skips a navigation property missing a parseable direction", async () => {
    const result = await new SchemaJsonReader().readDocument(schemaJson({
      E: { schemaItemType: "EntityClass", properties: [{ name: "Nav", type: "NavigationProperty", relationshipName: "Lenient.Rel", direction: "Sideways" }] },
    }));
    expect(codes(result.issues)).to.deep.equal(["SchemaJson-0030"]);
    expect(result.document!.getEntity("E")!.properties).to.be.empty;
  });

  it("skips an enumeration with an unsupported backing type", async () => {
    const result = await new SchemaJsonReader().readDocument(schemaJson({ Status: { schemaItemType: "Enumeration", type: "double" } }));
    expect(codes(result.issues)).to.deep.equal(["SchemaJson-0033"]);
    expect(result.document!.items).to.be.empty;
  });

  it("skips a custom attribute entry missing its className, keeping the rest", async () => {
    const result = await new SchemaJsonReader().readDocument(schemaJson({}, {
      customAttributes: [{ Note: "no class" }, { className: "Lenient.Tagged" }],
    }));
    expect(codes(result.issues)).to.deep.equal(["SchemaJson-0043"]);
    expect(result.document!.customAttributes.has("Tagged")).to.be.true;
  });

  it("accepts presentationUnits as a single delimited string", async () => {
    const result = await new SchemaJsonReader().readDocument(schemaJson({
      K: { schemaItemType: "KindOfQuantity", persistenceUnit: "Units.M", relativeError: 0.01, presentationUnits: "f:A;f:B" },
    }));
    expect(result.issues.hasErrors).to.be.false;
    expect(result.document!.getItemOfType("K", SchemaItemType.KindOfQuantity)!.presentationFormats).to.deep.equal(["f:A", "f:B"]);
  });

  it("ignores values of the wrong JSON type instead of failing", async () => {
    const result = await new SchemaJsonReader().readDocument(schemaJson({
      E: { schemaItemType: "EntityClass", label: 42 }, // label must be a string
    }));
    const entity = result.document!.getEntity("E")!;
    expect(entity.label).to.be.undefined;
  });

  it("peeks the header of a schema without references", async () => {
    const result = await new SchemaJsonReader().readHeader(schemaJson());
    expect(result.header!.name).to.equal("Lenient");
    expect(result.header!.references).to.be.empty;
  });
});
