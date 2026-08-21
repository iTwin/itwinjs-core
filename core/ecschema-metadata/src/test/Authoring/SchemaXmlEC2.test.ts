/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { CustomAttributeContainerType, ECClassModifier, PrimitiveType, SchemaItemType, StrengthDirection } from "../../ECObjects";
import { SchemaDocument, SchemaSet } from "../../Authoring/SchemaDocument";
import { ECSpec } from "../../Authoring/SchemaDocumentIO";
import { SchemaXmlReader } from "../../Authoring/SchemaXmlReader";
import { SchemaXmlWriter } from "../../Authoring/SchemaXmlWriter";

async function read(xml: string, set?: SchemaSet) {
  return new SchemaXmlReader().readDocument(xml, { schemaSet: set });
}

function messages(issues: Iterable<{ severity: string, code: string, message: string }>): string {
  return [...issues].map((i) => `${i.severity} ${i.code}: ${i.message}`).join("\n");
}

/** A 2.0 schema exercising the whole legacy vocabulary: flagged classes, a struct array flag, the
 * PascalCase range attributes, and a relationship with legacy cardinality. */
const legacySchema = `<?xml version="1.0" encoding="UTF-8"?>
<ECSchema schemaName="Legacy" nameSpacePrefix="lg" version="01.02" description="A legacy schema"
          xmlns="http://www.bentley.com/schemas/Bentley.ECXML.2.0">
    <ECSchemaReference name="Bentley_Standard_CustomAttributes" version="01.14" prefix="bsca"/>
    <ECClass typeName="Item" isStruct="True" isDomainClass="True" description="An item">
        <ECProperty propertyName="Label" typeName="string" MinimumValue="0" MaximumValue="10"/>
        <ECProperty propertyName="Count" typeName="int" MinimumValue="1" MaximumValue="99"/>
    </ECClass>
    <ECClass typeName="Marker" isCustomAttributeClass="True" isDomainClass="False">
        <ECProperty propertyName="Note" typeName="string"/>
    </ECClass>
    <ECClass typeName="AbstractThing"
             isStruct="False" isCustomAttributeClass="False" isDomainClass="False"/>
    <ECClass typeName="SealedThing" isDomainClass="True" isFinal="True">
        <BaseClass>AbstractThing</BaseClass>
    </ECClass>
    <ECClass typeName="Container" isDomainClass="True">
        <ECArrayProperty propertyName="Items" typeName="Item" isStruct="True" minOccurs="1" maxOccurs="unbounded"/>
        <ECArrayProperty propertyName="Tags" typeName="string" isStruct="True" minOccurs="0" maxOccurs="unbounded"/>
        <ECStructProperty propertyName="Primary" typeName="Item"/>
    </ECClass>
    <ECRelationshipClass typeName="ContainerHasThings" isDomainClass="True" strength="embedding">
        <Source cardinality="(1,1)" roleLabel="contains" polymorphic="True">
            <Class class="Container"/>
        </Source>
        <Target cardinality="(0,N)" roleLabel="is contained by" polymorphic="False">
            <Class class="SealedThing">
                <Key>
                    <Property name="Id"/>
                </Key>
            </Class>
        </Target>
    </ECRelationshipClass>
</ECSchema>`;

describe("ECXml 2.0 reading", () => {
  it("reads a legacy schema without errors", async () => {
    const { document, issues } = await read(legacySchema);
    expect(document, messages(issues)).toBeDefined();
    expect(issues.errors.map((i) => i.message)).toEqual([]);
    expect(document!.originalECXmlVersionMajor).toBe(2);
    expect(document!.originalECXmlVersionMinor).toBe(0);
  });

  it("takes the schema alias from nameSpacePrefix and the version as read/0/minor", async () => {
    const { document } = await read(legacySchema);
    expect(document!.alias).toBe("lg");
    expect([document!.readVersion, document!.writeVersion, document!.minorVersion]).toEqual([1, 0, 2]);
    expect(document!.getSchemaReference("Bentley_Standard_CustomAttributes")!.alias).toBe("bsca");
  });

  it("falls back to the schema name when nameSpacePrefix is absent", async () => {
    const xml = `<?xml version="1.0"?><ECSchema schemaName="NoPrefix" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.2.0"/>`;
    const { document, issues } = await read(xml);
    expect(document!.alias).toBe("NoPrefix");
    expect(issues.errors.map((i) => i.code)).toEqual([]);
  });

  it("picks the class kind from the flags, struct winning over custom attribute", async () => {
    const { document } = await read(legacySchema);
    expect(document!.getItem("Item")!.schemaItemType).toBe(SchemaItemType.StructClass);
    expect(document!.getItem("Marker")!.schemaItemType).toBe(SchemaItemType.CustomAttributeClass);
    expect(document!.getItem("Container")!.schemaItemType).toBe(SchemaItemType.EntityClass);
    expect(document!.getItem("ContainerHasThings")!.schemaItemType).toBe(SchemaItemType.RelationshipClass);
  });

  it("reads a custom attribute class with no appliesTo as applying to anything", async () => {
    const { document, issues } = await read(legacySchema);
    expect(document!.getItemOfType("Marker", SchemaItemType.CustomAttributeClass)!.appliesTo).toBeGreaterThan(0);
    expect(issues.errors.map((i) => i.code)).not.toContain("SchemaXml-0022");
  });

  it("derives the class modifier from the flags: no kind is abstract, isFinal is sealed", async () => {
    const { document } = await read(legacySchema);
    expect(document!.getEntity("AbstractThing")!.modifier).toBe(ECClassModifier.Abstract);
    expect(document!.getEntity("SealedThing")!.modifier).toBe(ECClassModifier.Sealed);
    expect(document!.getEntity("Container")!.modifier).toBeUndefined();
  });

  it("classifies an array from whether typeName names a struct class, not from isStruct", async () => {
    const { document } = await read(legacySchema);
    const container = document!.getEntity("Container")!;
    // `Items` is flagged isStruct and names a struct - a struct array.
    expect(container.getProperty("Items")!.isStruct()).toBe(true);
    // `Tags` is flagged isStruct too, but names a primitive. Native ignores the flag; so do we.
    expect(container.getProperty("Tags")!.isStruct()).toBe(false);
    expect(container.getProperty("Primary")!.isStruct()).toBe(true);
  });

  it("reads the PascalCase range attributes", async () => {
    const { document } = await read(legacySchema);
    const count = document!.getItemOfType("Item", SchemaItemType.StructClass)!.getProperty("Count")!;
    expect(count.isPrimitive() && [count.minValue, count.maxValue]).toEqual([1, 99]);
  });

  it("normalizes legacy cardinality to multiplicity and drops constraint keys", async () => {
    const { document } = await read(legacySchema);
    const relationship = document!.getItemOfType("ContainerHasThings", SchemaItemType.RelationshipClass)!;
    expect(relationship.source.multiplicity).toBe("(1..1)");
    expect(relationship.target.multiplicity).toBe("(0..*)");
    expect(relationship.target.polymorphic).toBe(false);
    expect(relationship.target.constraintClasses).toEqual(["SealedThing"]);
  });

  it("reads the forgiving cardinality spellings published legacy schemas carry", async () => {
    const build = (source: string, target: string) => `<?xml version="1.0"?>
      <ECSchema schemaName="C" nameSpacePrefix="c" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.2.0">
        <ECClass typeName="A" isDomainClass="True"/>
        <ECRelationshipClass typeName="R" isDomainClass="True">
          <Source cardinality="${source}"><Class class="A"/></Source>
          <Target cardinality="${target}"><Class class="A"/></Target>
        </ECRelationshipClass>
      </ECSchema>`;

    const cases: Array<[string, string]> = [["(0,N)", "(0..*)"], ["(3,12)", "(3..12)"], ["(5)", "(5..*)"], ["1", "(1..1)"], ["unbounded", "(0..*)"], ["(7..N)", "(7..*)"]];
    for (const [written, expected] of cases) {
      const { document } = await read(build(written, "(0,N)"));
      expect(document!.getItemOfType("R", SchemaItemType.RelationshipClass)!.source.multiplicity, written).toBe(expected);
    }
  });

  it("keeps an unparseable cardinality verbatim and warns", async () => {
    const xml = `<?xml version="1.0"?>
      <ECSchema schemaName="C" nameSpacePrefix="c" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.2.0">
        <ECClass typeName="A" isDomainClass="True"/>
        <ECRelationshipClass typeName="R" isDomainClass="True">
          <Source cardinality="banana"><Class class="A"/></Source>
          <Target cardinality="(0,N)"><Class class="A"/></Target>
        </ECRelationshipClass>
      </ECSchema>`;
    const { document, issues } = await read(xml);
    expect(document!.getItemOfType("R", SchemaItemType.RelationshipClass)!.source.multiplicity).toBe("banana");
    expect([...issues].some((i) => i.code === "SchemaXml-0063")).toBe(true);
  });
});

describe("ECXml 2.0 writing", () => {
  function buildDocument(): SchemaDocument {
    const doc = new SchemaDocument("Down", "dn", 1, 0, 5);
    doc.setSchemaReference({ name: "Units", readVersion: 1, writeVersion: 0, minorVersion: 0, alias: "u" });
    const item = doc.createStructClass("Item");
    item.createPrimitive("Label", PrimitiveType.String);
    const container = doc.createEntity("Container", { modifier: ECClassModifier.Sealed });
    container.createStructArray("Items", "Item");
    doc.createEntity("AbstractThing", { modifier: ECClassModifier.Abstract });
    doc.createRelationship("R", {
      source: { multiplicity: "(1..1)", roleLabel: "has", constraintClasses: ["Container"], abstractConstraint: "Container" },
      target: { multiplicity: "(0..*)", roleLabel: "is of", constraintClasses: ["AbstractThing"] },
    });
    container.createNavigation("Owner", "R", StrengthDirection.Forward);
    return doc;
  }

  function write(doc: SchemaDocument) {
    return new SchemaXmlWriter().writeDocument(doc, { spec: ECSpec.V2_0 });
  }

  it("writes the legacy class flags and never a modifier", () => {
    const text = write(buildDocument()).text!;
    expect(text).toContain(`<ECClass typeName="Item" isStruct="true" isCustomAttributeClass="false" isDomainClass="false"`);
    expect(text).toContain(`<ECClass typeName="AbstractThing" isStruct="false" isCustomAttributeClass="false" isDomainClass="false"`);
    expect(text).not.toContain("modifier=");
  });

  it("reports that a sealed class cannot survive the downgrade", () => {
    const result = write(buildDocument());
    expect([...result.issues].filter((i) => i.code === "SchemaXml-0065")).toHaveLength(1);
  });

  it("writes a struct array as an ECArrayProperty flagged isStruct", () => {
    const text = write(buildDocument()).text!;
    expect(text).toContain(`<ECArrayProperty propertyName="Items" typeName="Item"`);
    expect(text).toContain(`isStruct="true"`);
    expect(text).not.toContain("ECStructArrayProperty");
  });

  it("writes a navigation property as a long and says so", () => {
    const result = write(buildDocument());
    expect(result.text).toContain(`<ECProperty propertyName="Owner" typeName="long"`);
    expect(result.text).not.toContain("ECNavigationProperty");
    expect([...result.issues].filter((i) => i.code === "SchemaXml-0067")).toHaveLength(1);
  });

  it("writes cardinality and leaves out abstractConstraint", () => {
    const text = write(buildDocument()).text!;
    expect(text).toContain(`cardinality="(1,1)"`);
    expect(text).toContain(`cardinality="(0,N)"`);
    expect(text).not.toContain("abstractConstraint");
    expect(text).not.toContain("multiplicity");
  });

  it("leaves out the Units and Formats references, which 2.0 has nothing to point at", () => {
    expect(write(buildDocument()).text).not.toContain("ECSchemaReference");
  });

  it("writes a property's enumeration as its backing type and says the values were lost", () => {
    const doc = new SchemaDocument("E", "e", 1, 0, 0);
    const status = doc.createEnumeration("Status", "int", { isStrict: true });
    status.createEnumerator("Status1", 1);
    doc.createEntity("C").createEnumeration("State", "Status");
    const result = write(doc);
    expect(result.text).toContain(`<ECProperty propertyName="State" typeName="int"`);
    expect([...result.issues].filter((i) => i.code === "SchemaXml-0066")).toHaveLength(1);
  });

  it("writes a custom attribute namespace in the two-component legacy form", () => {
    const doc = new SchemaDocument("N", "n", 2, 3, 4);
    doc.createEntity("C").customAttributes.add({ className: "N:Marker", values: {} });
    doc.createCustomAttributeClass("Marker", CustomAttributeContainerType.Any);
    expect(write(doc).text).toContain(`<Marker xmlns="N.02.04"/>`);
  });
});

describe("ECXml 2.0 round trips", () => {
  it("round-trips every field 2.0 can carry", async () => {
    const original = (await read(legacySchema)).document!;
    const written = new SchemaXmlWriter().writeDocument(original, { spec: ECSpec.V2_0 });
    expect(written.text, messages(written.issues)).toBeDefined();

    const reread = (await read(written.text!)).document!;
    expect(reread.alias).toBe("lg");
    expect(reread.items.map((i) => `${i.name}:${i.schemaItemType}`)).toEqual(original.items.map((i) => `${i.name}:${i.schemaItemType}`));
    expect(reread.getEntity("AbstractThing")!.modifier).toBe(ECClassModifier.Abstract);
    expect(reread.getEntity("Container")!.getProperty("Items")!.isStruct()).toBe(true);
    expect(reread.getItemOfType("ContainerHasThings", SchemaItemType.RelationshipClass)!.target.multiplicity).toBe("(0..*)");
  });

  it("cannot carry a sealed modifier, which is the documented loss", async () => {
    const original = (await read(legacySchema)).document!;
    const text = new SchemaXmlWriter().writeDocument(original, { spec: ECSpec.V2_0 }).text!;
    const reread = (await read(text)).document!;
    expect(original.getEntity("SealedThing")!.modifier).toBe(ECClassModifier.Sealed);
    expect(reread.getEntity("SealedThing")!.modifier).toBeUndefined();
  });
});
