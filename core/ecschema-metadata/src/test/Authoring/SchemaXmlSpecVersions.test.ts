/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/naming-convention */ // EC property names are PascalCase.
import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";
import { SchemaItemType } from "../../ECObjects";
import { compareSchemaDocuments, formatSchemaComparison } from "../../Authoring/SchemaComparison";
import { SchemaDocument, SchemaSet } from "../../Authoring/SchemaDocument";
import { ECSpec } from "../../Authoring/SchemaDocumentIO";
import { SchemaXmlReader } from "../../Authoring/SchemaXmlReader";
import { SchemaXmlWriter } from "../../Authoring/SchemaXmlWriter";

/** The 3.1 half of the deliberate same-schema pair kept for the ecschema2ts converter tests. */
const assets = path.resolve(__dirname, "../../../../../tools/ecschema2ts/src/test/assets");
const comprehensive31 = path.join(assets, "ComprehensiveSchema.01.00.ecschema.xml");

async function read(file: string, set?: SchemaSet) {
  const text = fs.readFileSync(file, "utf8");
  return new SchemaXmlReader().readDocument(text, { schemaSet: set, source: file });
}

function messages(issues: Iterable<{ severity: string, code: string, message: string }>): string {
  return [...issues].map((i) => `${i.severity} ${i.code}: ${i.message}`).join("\n");
}

describe("ECXml 3.1 reading", () => {
  it("reads a real 3.1 schema without errors", async () => {
    const set = new SchemaSet();
    const { document, issues } = await read(comprehensive31, set);
    expect(document, messages(issues)).toBeDefined();
    // One custom attribute class in this fixture genuinely omits appliesTo - a defect in the file,
    // not a spec difference, so the reader is right to report it.
    const unexpected = [...issues].filter((i) => i.severity === "error" && i.code !== "SchemaXml-0022");
    expect(unexpected.map((i) => i.message)).toEqual([]);
    expect(document!.items.length).toBeGreaterThan(40);
  });

  it("records the source spec version as 3.1", async () => {
    const { document } = await read(comprehensive31);
    expect(document!.originalECXmlVersionMajor).toBe(3);
    expect(document!.originalECXmlVersionMinor).toBe(1);
  });

  it("reads the two-component schema version as read/0/minor", async () => {
    const { document } = await read(comprehensive31);
    // The file says version="01.00".
    expect([document!.readVersion, document!.writeVersion, document!.minorVersion]).toEqual([1, 0, 0]);
  });

  it("synthesizes enumerator names the way native does", async () => {
    const { document } = await read(comprehensive31);
    const intEnum = document!.getItemOfType("IntEnumeration", SchemaItemType.Enumeration)!;
    // An integer enumerator takes the enumeration name followed by the value.
    expect(intEnum.enumerators.map((e) => e.name)).toEqual(["IntEnumeration1", "IntEnumeration2", "IntEnumeration3"]);
    expect(intEnum.enumerators.map((e) => e.value)).toEqual([1, 2, 3]);

    const stringEnum = document!.getItemOfType("StringEnumeration", SchemaItemType.Enumeration)!;
    // A string enumerator takes its own value as its name.
    expect(stringEnum.enumerators.map((e) => e.name)).toEqual(["spring", "summer", "fall", "winter"]);
  });

  it("reads the 3.1 `strict` attribute, which 3.2 spells `isStrict`", async () => {
    const { document } = await read(comprehensive31);
    // The 3.1 file says strict="false" on StringEnumeration and strict="true" on IntEnumeration.
    expect(document!.getItemOfType("StringEnumeration", SchemaItemType.Enumeration)!.isStrict).toBe(false);
    expect(document!.getItemOfType("IntEnumeration", SchemaItemType.Enumeration)!.isStrict).toBe(true);
  });
});

describe("ECXml spec round trips", () => {
  /** Reading a document, writing it to `spec`, and reading it back must produce the same model,
   * for every field that spec can carry. */
  async function roundTrip(spec: ECSpec, source: string): Promise<void> {
    const original = (await read(source)).document!;
    const written = new SchemaXmlWriter().writeDocument(original, { spec });
    expect(written.text, messages(written.issues)).toBeDefined();
    expect(written.text).toContain(`Bentley.ECXML.${spec as string}`);

    const reread = (await new SchemaXmlReader().readDocument(written.text!)).document!;
    const comparison = compareSchemaDocuments(original, reread);
    expect(comparison.areEqual, formatSchemaComparison(comparison)).toBe(true);
  }

  it("round-trips a real 3.1 schema through 3.1", async () => {
    await roundTrip(ECSpec.V3_1, comprehensive31);
  });

  it("round-trips a real 3.1 schema through 3.2", async () => {
    await roundTrip(ECSpec.V3_2, comprehensive31);
  });
});

describe("ECXml spec downgrade", () => {
  function buildDocument(): SchemaDocument {
    const doc = new SchemaDocument("SpecDelta", "sd", 1, 0, 0);
    doc.createEntity("Widget");
    doc.createEntity("Part");
    const status = doc.createEnumeration("Status", "int", { isStrict: true });
    status.createEnumerator("Status1", 1);
    status.createEnumerator("Status2", 2);
    doc.createRelationship("WidgetHasParts", {
      source: { multiplicity: "(1..1)", roleLabel: "has", constraintClasses: ["Widget"] },
      target: { multiplicity: "(0..*)", roleLabel: "is part of", constraintClasses: ["Part"] },
    });
    return doc;
  }

  it("writes a two-component version before 3.2 and three from 3.2", () => {
    const doc = buildDocument();
    expect(new SchemaXmlWriter().writeDocument(doc, { spec: ECSpec.V3_2 }).text).toContain(`version="01.00.00"`);
    expect(new SchemaXmlWriter().writeDocument(doc, { spec: ECSpec.V3_1 }).text).toContain(`version="01.00"`);
  });

  it("warns rather than silently dropping a write component a two-component version cannot carry", () => {
    const doc = new SchemaDocument("SpecDelta", "sd", 1, 7, 0);
    const result = new SchemaXmlWriter().writeDocument(doc, { spec: ECSpec.V3_1 });
    expect(result.text).toContain(`version="01.00"`);
    expect([...result.issues].some((i) => i.code === "SchemaXml-0060")).toBe(true);
  });

  it("writes `alias` from 3.1 and `nameSpacePrefix` at 3.0", () => {
    const doc = buildDocument();
    expect(new SchemaXmlWriter().writeDocument(doc, { spec: ECSpec.V3_1 }).text).toContain(`alias="sd"`);
    const at30 = new SchemaXmlWriter().writeDocument(doc, { spec: ECSpec.V3_0 }).text!;
    expect(at30).toContain(`nameSpacePrefix="sd"`);
    expect(at30).not.toContain(`alias="sd"`);
  });

  it("writes `multiplicity` from 3.1 and `cardinality` at 3.0", () => {
    const doc = buildDocument();
    expect(new SchemaXmlWriter().writeDocument(doc, { spec: ECSpec.V3_1 }).text).toContain(`multiplicity="(0..*)"`);
    const at30 = new SchemaXmlWriter().writeDocument(doc, { spec: ECSpec.V3_0 }).text!;
    // 3.0 spells unbounded `N` and separates with a comma.
    expect(at30).toContain(`cardinality="(0,N)"`);
    expect(at30).toContain(`cardinality="(1,1)"`);
  });

  it("writes enumerator names only from 3.2", () => {
    const doc = buildDocument();
    expect(new SchemaXmlWriter().writeDocument(doc, { spec: ECSpec.V3_2 }).text).toContain(`name="Status1"`);
    const at31 = new SchemaXmlWriter().writeDocument(doc, { spec: ECSpec.V3_1 }).text!;
    expect(at31).not.toContain(`name="Status1"`);
    expect(at31).toContain(`<ECEnumerator value="1"`);
  });

  it("warns when an enumerator name cannot be recovered from its value", () => {
    const doc = new SchemaDocument("SpecDelta", "sd", 1, 0, 0);
    const status = doc.createEnumeration("Status", "int");
    status.createEnumerator("Handwritten", 1); // synthesis would produce "Status1"
    const result = new SchemaXmlWriter().writeDocument(doc, { spec: ECSpec.V3_1 });
    expect([...result.issues].some((i) => i.code === "SchemaXml-0061")).toBe(true);
    // At 3.2 the name is carried, so there is nothing to warn about.
    expect([...new SchemaXmlWriter().writeDocument(doc, { spec: ECSpec.V3_2 }).issues]).toHaveLength(0);
  });

  it("writes the enumeration strictness attribute under its per-version name", () => {
    const doc = buildDocument();
    expect(new SchemaXmlWriter().writeDocument(doc, { spec: ECSpec.V3_2 }).text).toContain(`isStrict="true"`);
    expect(new SchemaXmlWriter().writeDocument(doc, { spec: ECSpec.V3_1 }).text).toContain(`strict="true"`);
  });

  it("writes 2.0 with the legacy class flags in place of a modifier", () => {
    const at20 = new SchemaXmlWriter().writeDocument(buildDocument(), { spec: ECSpec.V2_0 }).text!;
    expect(at20).toContain(`<ECClass typeName="Widget" isStruct="false" isCustomAttributeClass="false" isDomainClass="true"`);
    expect(at20).not.toContain("ECEntityClass");
    expect(at20).not.toContain("modifier=");
  });

  it("reports each item kind 2.0 has no element for instead of dropping it silently", () => {
    const result = new SchemaXmlWriter().writeDocument(buildDocument(), { spec: ECSpec.V2_0 });
    expect(result.text).not.toContain("ECEnumeration");
    expect([...result.issues].filter((i) => i.code === "SchemaXml-0064").map((i) => i.message))
      .toEqual([`ECXML 2.0 has no enumerations, so "Status" was dropped.`]);
  });
});

describe("multi-line custom attribute values", () => {
  it("keeps newlines inside a value out of the writer's indentation", async () => {
    // ECDbMap:QueryView carries an ECSQL string that spans lines. The writer indents markup, and a
    // value's own newlines must not be mistaken for markup - re-indenting rewrote the ECSQL a
    // little further on every write. Found by cross-checking against native's serializer.
    const query = "SELECT a\n  FROM b\n  WHERE c = 1";
    const doc = new SchemaDocument("D", "d", 1, 0, 0);
    doc.createEntity("C").customAttributes.add({ className: "ECDbMap:QueryView", values: { Query: query } });

    let text = new SchemaXmlWriter().writeDocument(doc).text!;
    for (let pass = 0; pass < 3; ++pass) {
      const reread = (await new SchemaXmlReader().readDocument(text)).document!;
      expect(reread.getEntity("C")!.customAttributes.get("ECDbMap:QueryView")!.getValue("Query")).toBe(query);
      text = new SchemaXmlWriter().writeDocument(reread).text!;
    }
  });
});
