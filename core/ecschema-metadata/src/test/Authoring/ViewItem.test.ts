/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/* eslint-disable @typescript-eslint/naming-convention -- EC property names are PascalCase */
import { describe, expect, it } from "vitest";
import { AbstractSchemaItemType, ECClassModifier, PrimitiveType } from "../../ECObjects";
import { AuthoringSchemaItemType, SchemaDocument, View } from "../../Authoring/SchemaDocument";
import { SchemaJsonReader } from "../../Authoring/SchemaJsonReader";
import { SchemaJsonWriter } from "../../Authoring/SchemaJsonWriter";
import { SchemaIssueList } from "../../Authoring/SchemaIssues";
import { SchemaXmlReader } from "../../Authoring/SchemaXmlReader";
import { SchemaXmlWriter } from "../../Authoring/SchemaXmlWriter";
import { validateSchemaDocument } from "../../Authoring/Validation/SchemaValidator";

const query = "SELECT [p].[ECInstanceId], [p].[Length]\n  FROM [ts].[Pipe] [p]\n  WHERE [p].[Length] > 0";

function names(issues: SchemaIssueList): string[] {
  return [...issues].map((issue) => issue.name);
}

/** A document holding one view, plus the ECDbMap reference its serialized form needs. */
function makeDocument(): { doc: SchemaDocument, view: View } {
  const doc = new SchemaDocument("TestSchema", "ts", 1, 0, 0, {
    references: [{ name: "ECDbMap", readVersion: 2, writeVersion: 0, minorVersion: 4, alias: "ecdbmap" }],
  });
  const view = doc.createView("PipeView", query, { modifier: ECClassModifier.Abstract, label: "Pipe View" });
  view.createPrimitive("Length", PrimitiveType.Double);
  return { doc, view };
}

describe("View as an item kind", () => {
  it("is a class, so it answers to the class grouping and the class accessors", () => {
    const { doc, view } = makeDocument();
    expect(view.schemaItemType).toBe(AuthoringSchemaItemType.View);
    expect(view.isView()).toBe(true);
    expect(view.isClass()).toBe(true);
    expect(view.isEntity()).toBe(false);
    expect([...doc.getItemsOfType(AbstractSchemaItemType.Class)]).toContain(view);
    expect(doc.getItemOfType("PipeView", AuthoringSchemaItemType.View)).toBe(view);
    expect(doc.getEntity("PipeView")).toBeUndefined();
  });

  it("participates in the property walk like any other class", () => {
    const { doc, view } = makeDocument();
    const base = doc.createEntity("Base", { modifier: ECClassModifier.Abstract });
    base.createPrimitive("Shared", PrimitiveType.String);
    view.setBaseClass(base);
    expect([...view.getExpandedProperties()].map((p) => p.name)).toEqual(["Shared", "Length"]);
  });
});

describe("View round trip", () => {
  it("writes ECXML as an entity class carrying QueryView, and reads it back as a view", async () => {
    const { doc } = makeDocument();
    const text = new SchemaXmlWriter().writeDocument(doc).text!;
    expect(text).toContain(`<ECEntityClass typeName="PipeView"`);
    expect(text).toContain(`<QueryView xmlns="ECDbMap.02.00.04">`);
    expect(text).not.toContain("<View");

    const reread = (await new SchemaXmlReader().readDocument(text)).document!;
    const view = reread.getItemOfType("PipeView", AuthoringSchemaItemType.View)!;
    expect(view).toBeDefined();
    expect(view.query).toBe(query);
    expect(view.modifier).toBe(ECClassModifier.Abstract);
    expect(view.label).toBe("Pipe View");
    // The attribute was consumed by the promotion, not left applied as well.
    expect(view.customAttributes.has("ECDbMap:QueryView")).toBe(false);
    expect(view.properties.map((p) => p.name)).toEqual(["Length"]);
  });

  it("writes ECJSON as an entity class carrying QueryView - ECJSON has no view either", () => {
    const { doc } = makeDocument();
    const tree = new SchemaJsonWriter().writeDocumentTree(doc).tree as any;
    expect(tree.items.PipeView.schemaItemType).toBe("EntityClass");
    expect(tree.items.PipeView.customAttributes).toEqual([{ className: "ECDbMap.QueryView", Query: query }]);

    const reread = new SchemaJsonReader().readObject(tree).document!;
    const view = reread.getItemOfType("PipeView", AuthoringSchemaItemType.View)!;
    expect(view.query).toBe(query);
    expect(view.customAttributes.has("ECDbMap:QueryView")).toBe(false);
  });

  it("keeps the view's own custom attributes alongside the promoted one", async () => {
    const { doc, view } = makeDocument();
    doc.setSchemaReference({ name: "CoreCustomAttributes", readVersion: 1, writeVersion: 0, minorVersion: 3, alias: "CoreCA" });
    view.customAttributes.add({ className: "CoreCustomAttributes:HiddenClass", values: { Show: false } });

    const text = new SchemaXmlWriter().writeDocument(doc).text!;
    const reread = (await new SchemaXmlReader().readDocument(text)).document!;
    const rereadView = reread.getItemOfType("PipeView", AuthoringSchemaItemType.View)!;
    expect(rereadView.query).toBe(query);
    expect(rereadView.customAttributes.has("CoreCustomAttributes:HiddenClass")).toBe(true);
    expect(rereadView.customAttributes.size).toBe(1);
  });

  it("warns rather than fails when ECDbMap is not referenced", () => {
    const doc = new SchemaDocument("TestSchema", "ts", 1, 0, 0);
    doc.createView("PipeView", query, { modifier: ECClassModifier.Abstract });
    const result = new SchemaXmlWriter().writeDocument(doc);
    expect(names(result.issues)).toContain("view-custom-attribute-reference-missing");
    expect(result.text).toContain(`<QueryView xmlns="ECDbMap.02.00.04">`);
  });
});

describe("View validation", () => {
  it("accepts a well-formed view", () => {
    const { doc } = makeDocument();
    expect(names(validateSchemaDocument(doc))).toEqual([]);
  });

  it("reports the ECDb import constraints a view has to satisfy", () => {
    const doc = new SchemaDocument("TestSchema", "ts", 1, 0, 0, {
      references: [{ name: "ECDbMap", readVersion: 2, writeVersion: 0, minorVersion: 4, alias: "ecdbmap" }],
    });
    const base = doc.createEntity("Base", { modifier: ECClassModifier.Abstract });
    const view = doc.createView("PipeView", "  ", { modifier: ECClassModifier.None });
    view.setBaseClass(base);

    const reported = names(validateSchemaDocument(doc));
    expect(reported).toContain("view-not-abstract");
    expect(reported).toContain("view-base-not-allowed");
    expect(reported).toContain("view-query-empty");
    expect(reported).toContain("view-no-properties");
  });

  it("counts the ECDbMap reference as used even though nothing in the model names it", () => {
    const { doc } = makeDocument();
    expect(names(validateSchemaDocument(doc))).not.toContain("schema-reference-unused");
  });
});
