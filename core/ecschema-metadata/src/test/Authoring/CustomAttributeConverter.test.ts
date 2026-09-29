/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// Custom attribute property names mirror real ECSchema identifiers (PascalCase), so the EC naming
// is intentional.
/* eslint-disable @typescript-eslint/naming-convention */

import { describe, expect, it } from "vitest";
import { CustomAttributeContainerType, PrimitiveType } from "../../ECObjects";
import { CustomAttribute, SchemaDocument, SchemaSet } from "../../Authoring/SchemaDocument";
import { SchemaXmlWriter } from "../../Authoring/SchemaXmlWriter";
import { SchemaJsonWriter } from "../../Authoring/SchemaJsonWriter";

/** A document declaring its own custom attribute class, so conversion has a class to work from
 * without leaning on the built-in standard schemas. */
function documentWithCustomAttributeClass(): SchemaDocument {
  const doc = new SchemaDocument("TestDomain", "td", 1, 0, 0);
  const dbIndex = doc.createStructClass("DbIndex");
  dbIndex.createPrimitive("Name", PrimitiveType.String);
  dbIndex.createPrimitive("IsUnique", PrimitiveType.Boolean);
  dbIndex.createPrimitiveArray("Properties", PrimitiveType.String);

  const ca = doc.createCustomAttributeClass("Mapping", CustomAttributeContainerType.AnyClass);
  ca.createPrimitive("Count", PrimitiveType.Integer);
  ca.createPrimitive("Ratio", PrimitiveType.Double);
  ca.createPrimitive("IsUnique", PrimitiveType.Boolean);
  ca.createPrimitive("Collation", PrimitiveType.String);
  ca.createPrimitiveArray("Restrictions", PrimitiveType.String);
  ca.createStruct("Primary", "DbIndex");
  ca.createStructArray("Indexes", "DbIndex");
  return doc;
}

/** Applies an unmaterialized custom attribute carrying `body` to a fresh class in `doc`. */
function applyXmlBody(doc: SchemaDocument, className: string, body: string): CustomAttribute {
  const target = doc.createEntity(`Target${doc.items.length}`);
  return CustomAttribute.fromXmlBody(target, className, body);
}

describe("Custom attribute materialization", () => {
  it("starts unmaterialized when read from ECXML and converts on first read", () => {
    const doc = documentWithCustomAttributeClass();
    const ca = applyXmlBody(doc, "Mapping", "<Count>5</Count>");

    expect(ca.isMaterialized).to.be.false;
    expect(ca.values).to.deep.equal({ Count: 5 });
    expect(ca.isMaterialized).to.be.true;
  });

  it("types every value from the custom attribute class, not from how the text looks", () => {
    const doc = documentWithCustomAttributeClass();
    const ca = applyXmlBody(doc, "Mapping",
      "<Count>007</Count>\n<Ratio>1.0</Ratio>\n<IsUnique>True</IsUnique>\n<Collation>5</Collation>");

    // "007" and "1.0" are numbers because the class says so - the old class-blind reader had to
    // leave them as strings to keep the round trip reversible. "5" stays a string for the same
    // reason in reverse: the class declares it a string.
    expect(ca.values).to.deep.equal({ Count: 7, Ratio: 1, IsUnique: true, Collation: "5" });
  });

  it("distinguishes a single-entry struct array from a struct, which is what needs the class", () => {
    const doc = documentWithCustomAttributeClass();
    const single = applyXmlBody(doc, "Mapping",
      "<Indexes>\n    <DbIndex>\n        <Name>ix_a</Name>\n    </DbIndex>\n</Indexes>");
    const struct = applyXmlBody(doc, "Mapping",
      "<Primary>\n    <Name>ix_a</Name>\n</Primary>");

    expect(single.values).to.deep.equal({ Indexes: [{ Name: "ix_a" }] });
    expect(struct.values).to.deep.equal({ Primary: { Name: "ix_a" } });
  });

  it("reads a primitive array through the class, whatever its entry elements are named", () => {
    const doc = documentWithCustomAttributeClass();
    const ca = applyXmlBody(doc, "Mapping",
      "<Restrictions>\n    <string>Clone</string>\n    <string>Copy</string>\n</Restrictions>");

    expect(ca.values).to.deep.equal({ Restrictions: ["Clone", "Copy"] });
  });

  it("throws on read when the custom attribute class is not in the schema set", () => {
    const doc = new SchemaDocument("TestDomain", "td", 1, 0, 0);
    const ca = applyXmlBody(doc, "SomeOtherDomain:Mapping", "<Count>5</Count>");

    expect(() => ca.values).to.throw(/not in the schema set/);
    expect(ca.tryGetValues()).to.be.undefined;
    expect(ca.isMaterialized).to.be.false;
  });

  it("resolves the class once the schema holding it joins the set", () => {
    const set = new SchemaSet();
    const doc = set.createSchema("TestDomain", "td", 1, 0, 0);
    const ca = applyXmlBody(doc, "Mapping:Flag", "<Enabled>True</Enabled>");
    expect(ca.tryGetValues()).to.be.undefined;

    const mapping = set.createSchema("Mapping", "map", 1, 0, 0);
    mapping.createCustomAttributeClass("Flag", CustomAttributeContainerType.AnyClass)
      .createPrimitive("Enabled", PrimitiveType.Boolean);

    expect(ca.values).to.deep.equal({ Enabled: true });
  });

  it("keeps a value the class does not declare rather than losing it", () => {
    const doc = documentWithCustomAttributeClass();
    const ca = applyXmlBody(doc, "Mapping", "<Count>5</Count>\n<Removed>whatever</Removed>");

    expect(ca.values).to.deep.equal({ Count: 5, Removed: "whatever" });
  });

  it("is materialized from the start when authored in code", () => {
    const doc = documentWithCustomAttributeClass();
    const target = doc.createEntity("Pump");
    const ca = target.customAttributes.add({ className: "Mapping", values: { Count: 5 } });

    expect(ca.isMaterialized).to.be.true;
    expect(ca.getValue("Count")).to.equal(5);
    ca.setValue("Count", 6);
    expect(ca.values.Count).to.equal(6);
  });
});

describe("Custom attributes through the built-in standard schemas", () => {
  it("materializes an ECDbMap attribute with nothing loaded", () => {
    const doc = new SchemaDocument("TestDomain", "td", 1, 0, 0);
    const ca = applyXmlBody(doc, "ECDbMap:DbIndexList",
      "<Indexes>\n    <DbIndex>\n        <Name>ix_a</Name>\n        <IsUnique>True</IsUnique>\n        <Properties>\n            <string>Code</string>\n        </Properties>\n    </DbIndex>\n</Indexes>");

    expect(ca.values).to.deep.equal({ Indexes: [{ Name: "ix_a", IsUnique: true, Properties: ["Code"] }] });
  });

  it("materializes a CoreCustomAttributes attribute with nothing loaded", () => {
    const doc = new SchemaDocument("TestDomain", "td", 1, 0, 0);
    const hidden = applyXmlBody(doc, "CoreCustomAttributes:HiddenClass", "<Show>False</Show>");
    const mixin = applyXmlBody(doc, "CoreCustomAttributes:IsMixin", "<AppliesToEntityClass>BisCore:Element</AppliesToEntityClass>");

    expect(hidden.values).to.deep.equal({ Show: false });
    expect(mixin.values).to.deep.equal({ AppliesToEntityClass: "BisCore:Element" });
  });

  it("lets a schema in the set redefine a standard class, which then wins", () => {
    const set = new SchemaSet();
    const doc = set.createSchema("TestDomain", "td", 1, 0, 0);
    const ecdbMap = set.createSchema("ECDbMap", "ecdbmap", 3, 0, 0);
    ecdbMap.createCustomAttributeClass("QueryView", CustomAttributeContainerType.EntityClass)
      .createPrimitiveArray("Query", PrimitiveType.String);

    const ca = applyXmlBody(doc, "ECDbMap:QueryView", "<Query>\n    <string>SELECT 1</string>\n</Query>");

    // Against the built-in definition Query is a single string; the set's version says array.
    expect(ca.values).to.deep.equal({ Query: ["SELECT 1"] });
  });
});

describe("Custom attributes through the writers", () => {
  function xmlOf(doc: SchemaDocument): { text: string, errors: string[], warnings: string[] } {
    const result = new SchemaXmlWriter().writeDocument(doc);
    return { text: result.text ?? "", errors: result.issues.errors.map((i) => i.name), warnings: result.issues.warnings.map((i) => i.name) };
  }

  it("writes an in-memory struct array to ECXML using the class to name the entry elements", () => {
    const doc = documentWithCustomAttributeClass();
    doc.createEntity("Pump").customAttributes.add({
      className: "Mapping",
      values: { Indexes: [{ Name: "ix_a", IsUnique: true }] },
    });

    const { text, errors } = xmlOf(doc);
    expect(errors).to.be.empty;
    expect(text).to.contain("<Indexes>");
    expect(text).to.contain("<DbIndex>");
    expect(text).to.contain("<Name>ix_a</Name>");
    expect(text).to.contain("<IsUnique>True</IsUnique>");
  });

  it("drops a struct array it cannot name the entry elements of, and reports an error", () => {
    const doc = new SchemaDocument("TestDomain", "td", 1, 0, 0);
    doc.createEntity("Pump").customAttributes.add({
      className: "Unknown:Mapping",
      values: { Indexes: [{ Name: "ix_a" }] },
    });

    const { text, errors } = xmlOf(doc);
    expect(errors).to.include("custom-attribute-struct-array-entry-class-unresolved");
    expect(text).to.not.contain("ix_a");
  });

  it("copies an unresolvable attribute through verbatim when writing back to ECXML, with a warning", () => {
    const doc = new SchemaDocument("TestDomain", "td", 1, 0, 0);
    applyXmlBody(doc, "Unknown:Mapping", "<Count>5</Count>");

    const { text, errors, warnings } = xmlOf(doc);
    expect(errors).to.be.empty;
    expect(warnings).to.include("custom-attribute-body-passed-through");
    expect(text).to.contain("<Count>5</Count>");
  });

  it("drops an unresolvable attribute when writing to ECJSON, which cannot pass it through", () => {
    const doc = new SchemaDocument("TestDomain", "td", 1, 0, 0);
    applyXmlBody(doc, "Unknown:Mapping", "<Count>5</Count>");

    const result = new SchemaJsonWriter().writeDocument(doc);
    expect(result.issues.errors.map((i) => i.name)).to.include("custom-attribute-class-unresolved");
    expect(result.text).to.not.contain("Count");
  });

  it("round-trips an ECXML body through materialization unchanged", () => {
    const doc = documentWithCustomAttributeClass();
    const body = "<Count>5</Count>\n<Restrictions>\n    <string>Clone</string>\n</Restrictions>\n<Indexes>\n    <DbIndex>\n        <Name>ix_a</Name>\n    </DbIndex>\n</Indexes>";
    const ca = applyXmlBody(doc, "Mapping", body);
    expect(ca.isMaterialized).to.be.false;
    expect(ca.values).to.not.be.undefined; // materializes

    const { text, errors } = xmlOf(doc);
    expect(errors).to.be.empty;
    for (const line of body.split("\n"))
      expect(text).to.contain(line.trim());
  });

  it("escapes element text", () => {
    const doc = documentWithCustomAttributeClass();
    doc.createEntity("Pump").customAttributes.add({ className: "Mapping", values: { Collation: "a & b < c" } });

    expect(xmlOf(doc).text).to.contain("<Collation>a &amp; b &lt; c</Collation>");
  });
});
