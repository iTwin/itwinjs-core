/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// CA property names mirror real ECSchema identifiers (PascalCase), so the EC naming is intentional.
/* eslint-disable @typescript-eslint/naming-convention */

import { describe, expect, it } from "vitest";
import { customAttributeJsonToXml, customAttributeXmlToJson, CustomAttributeConversionContext } from "../../Authoring/CustomAttributeConverter"; // eslint-disable-line sort-imports
import { SchemaIssueList } from "../../Authoring/SchemaIssues";
import { SchemaView } from "../../SchemaView/SchemaView";

// The converter only touches a narrow slice of SchemaView: findClass -> getProperty ->
// isStruct()/isArray() -> structClass.name/getProperty. A structural mock exercises exactly that
// slice without building a binary schema-view blob. Cast to SchemaView at the boundary; the runtime
// shape is all the converter uses.

interface FakeProperty {
  isStruct(): boolean;
  isArray(): boolean;
  structClass?: FakeClass;
}
interface FakeClass {
  name: string;
  getProperty(name: string): FakeProperty | undefined;
}

/** A scalar/primitive-array property: neither struct nor (for our purposes) a struct array. */
const scalarProperty: FakeProperty = { isStruct: () => false, isArray: () => false };

function structArrayProperty(structClass: FakeClass): FakeProperty {
  return { isStruct: () => true, isArray: () => true, structClass };
}

/** Builds a fake SchemaView whose `findClass` returns the given class for any name. */
function fakeView(rootClass: FakeClass): SchemaView {
  return { findClass: () => rootClass } as unknown as SchemaView;
}

function context(schemaView?: SchemaView): CustomAttributeConversionContext & { issues: SchemaIssueList } {
  return { schemaView, ownerSchemaName: "TestDomain", issues: new SchemaIssueList(), location: "TestDomain:Item" };
}

describe("CustomAttributeConverter", () => {
  describe("XML -> JSON", () => {
    it("promotes scalar booleans and numbers with a reversibility guard, keeps everything else a string", () => {
      const ctx = context();
      const json = customAttributeXmlToJson(
        "<IsUnique>True</IsUnique>\n<IsNullable>False</IsNullable>\n<Count>5</Count>\n<Padded>007</Padded>\n<Collation>NoCase</Collation>",
        "ECDbMap:PropertyMap", ctx);
      expect(ctx.issues.hasErrors).to.be.false;
      // Exact EC-canonical True/False -> boolean; "5" -> 5 (String(Number("5")) === "5"); "007" stays
      // a string (would not re-serialize byte-identically); a plain word stays a string.
      expect(json).to.deep.equal({ IsUnique: true, IsNullable: false, Count: 5, Padded: "007", Collation: "NoCase" });
    });

    it("reads repeated primitive-keyword children as a string array (entries stay strings)", () => {
      const ctx = context();
      const json = customAttributeXmlToJson("<Restrictions>\n    <string>Clone</string>\n    <string>Copy</string>\n</Restrictions>", "BisCore:ClassHasHandler", ctx);
      expect(json).to.deep.equal({ Restrictions: ["Clone", "Copy"] });
    });

    it("reads a nested element as a struct object", () => {
      const ctx = context();
      const json = customAttributeXmlToJson("<Ref>\n    <SchemaName>BisCore</SchemaName>\n    <MajorVersion>1</MajorVersion>\n</Ref>", "CoreCA:SupplementalSchema", ctx);
      expect(json).to.deep.equal({ Ref: { SchemaName: "BisCore", MajorVersion: 1 } });
    });

    it("reads a multi-entry struct array as a canonical array, dropping the entry element name (no class needed)", () => {
      const ctx = context();
      const body =
        "<Indexes>\n    <DbIndex>\n        <Name>ix_a</Name>\n        <IsUnique>True</IsUnique>\n    </DbIndex>\n    <DbIndex>\n        <Name>ix_b</Name>\n        <IsUnique>False</IsUnique>\n    </DbIndex>\n</Indexes>";
      const json = customAttributeXmlToJson(body, "ECDbMap:DbIndexList", ctx);
      expect(json).to.deep.equal({ Indexes: [{ Name: "ix_a", IsUnique: true }, { Name: "ix_b", IsUnique: false }] });
    });

    it("class-blind, reads a SINGLE-entry struct array as a struct (the documented residual gap)", () => {
      const ctx = context();
      const body = "<Indexes>\n    <DbIndex>\n        <Name>ix_a</Name>\n    </DbIndex>\n</Indexes>";
      const json = customAttributeXmlToJson(body, "ECDbMap:DbIndexList", ctx);
      // Lexically identical to a struct property whose single member is named DbIndex.
      expect(json).to.deep.equal({ Indexes: { DbIndex: { Name: "ix_a" } } });
    });

    it("with a SchemaView, resolves a single-entry struct array to a one-element array", () => {
      const dbIndex: FakeClass = { name: "DbIndex", getProperty: () => scalarProperty };
      const caClass: FakeClass = { name: "DbIndexList", getProperty: (n) => (n === "Indexes" ? structArrayProperty(dbIndex) : undefined) };
      const ctx = context(fakeView(caClass));
      const body = "<Indexes>\n    <DbIndex>\n        <Name>ix_a</Name>\n    </DbIndex>\n</Indexes>";
      const json = customAttributeXmlToJson(body, "ECDbMap:DbIndexList", ctx);
      expect(json).to.deep.equal({ Indexes: [{ Name: "ix_a" }] });
      expect(ctx.issues.hasErrors).to.be.false;
    });

    it("reports an error and yields undefined for an unparseable body", () => {
      const ctx = context();
      const json = customAttributeXmlToJson("<Unclosed>", "X:Y", ctx);
      expect(json).to.be.undefined;
      expect(ctx.issues.errors.map((i) => i.code)).to.include("SchemaCA-0003");
    });
  });

  describe("JSON -> XML", () => {
    it("serializes scalars to EC-canonical text (booleans capitalized)", () => {
      const ctx = context();
      const xml = customAttributeJsonToXml({ IsUnique: true, IsNullable: false, Count: 5, Collation: "NoCase" }, "ECDbMap:PropertyMap", ctx);
      expect(xml).to.equal("<IsUnique>True</IsUnique>\n<IsNullable>False</IsNullable>\n<Count>5</Count>\n<Collation>NoCase</Collation>");
    });

    it("serializes a primitive array as repeated typed entry elements", () => {
      const ctx = context();
      const xml = customAttributeJsonToXml({ Restrictions: ["Clone", "Copy"] }, "BisCore:ClassHasHandler", ctx);
      expect(xml).to.equal("<Restrictions>\n    <string>Clone</string>\n    <string>Copy</string>\n</Restrictions>");
    });

    it("serializes a struct object as a nested element", () => {
      const ctx = context();
      const xml = customAttributeJsonToXml({ Ref: { SchemaName: "BisCore", MajorVersion: 1 } }, "CoreCA:SupplementalSchema", ctx);
      expect(xml).to.equal("<Ref>\n    <SchemaName>BisCore</SchemaName>\n    <MajorVersion>1</MajorVersion>\n</Ref>");
    });

    it("drops a CA with a struct-array value and reports an error when no SchemaView names the entry element", () => {
      const ctx = context();
      const xml = customAttributeJsonToXml({ Indexes: [{ Name: "ix_a" }] }, "ECDbMap:DbIndexList", ctx);
      expect(xml).to.be.undefined;
      expect(ctx.issues.errors.map((i) => i.code)).to.include("SchemaCA-0001");
    });

    it("with a SchemaView, names struct-array entry elements from the struct class", () => {
      const dbIndex: FakeClass = { name: "DbIndex", getProperty: () => scalarProperty };
      const caClass: FakeClass = { name: "DbIndexList", getProperty: (n) => (n === "Indexes" ? structArrayProperty(dbIndex) : undefined) };
      const ctx = context(fakeView(caClass));
      const xml = customAttributeJsonToXml({ Indexes: [{ Name: "ix_a" }, { Name: "ix_b" }] }, "ECDbMap:DbIndexList", ctx);
      expect(xml).to.equal(
        "<Indexes>\n    <DbIndex>\n        <Name>ix_a</Name>\n    </DbIndex>\n    <DbIndex>\n        <Name>ix_b</Name>\n    </DbIndex>\n</Indexes>");
      expect(ctx.issues.hasErrors).to.be.false;
    });

    it("escapes element text", () => {
      const ctx = context();
      const xml = customAttributeJsonToXml({ Note: "a & b < c" }, "X:Y", ctx);
      expect(xml).to.equal("<Note>a &amp; b &lt; c</Note>");
    });
  });

  describe("round trips", () => {
    it("XML -> JSON -> XML is byte-identical for scalars, primitive arrays, and structs", () => {
      const body = "<IsUnique>True</IsUnique>\n<Restrictions>\n    <string>Clone</string>\n</Restrictions>\n<Ref>\n    <SchemaName>BisCore</SchemaName>\n</Ref>";
      const toJson = context();
      const json = customAttributeXmlToJson(body, "X:Y", toJson)!;
      const toXml = context();
      expect(customAttributeJsonToXml(json, "X:Y", toXml)).to.equal(body);
    });

    it("with a SchemaView, a struct array survives XML -> JSON -> XML", () => {
      const dbIndex: FakeClass = { name: "DbIndex", getProperty: () => scalarProperty };
      const caClass: FakeClass = { name: "DbIndexList", getProperty: (n) => (n === "Indexes" ? structArrayProperty(dbIndex) : undefined) };
      const body = "<Indexes>\n    <DbIndex>\n        <Name>ix_a</Name>\n    </DbIndex>\n    <DbIndex>\n        <Name>ix_b</Name>\n    </DbIndex>\n</Indexes>";
      const json = customAttributeXmlToJson(body, "ECDbMap:DbIndexList", context(fakeView(caClass)))!;
      expect(json).to.deep.equal({ Indexes: [{ Name: "ix_a" }, { Name: "ix_b" }] });
      expect(customAttributeJsonToXml(json, "ECDbMap:DbIndexList", context(fakeView(caClass)))).to.equal(body);
    });
  });
});
