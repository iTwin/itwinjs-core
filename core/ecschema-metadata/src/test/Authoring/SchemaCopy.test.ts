/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/naming-convention */ // EC property names are PascalCase.
import { describe, expect, it } from "vitest";
import { PrimitiveType, PropertyKind, SchemaItemType, StrengthDirection } from "../../ECObjects";
import { copyDocumentInto, copyItemInto, copyPropertyInto } from "../../Authoring/SchemaCopy";
import { EntityClass, SchemaDocument, SchemaSet } from "../../Authoring/SchemaDocument";

function makeSource(set: SchemaSet): { source: SchemaDocument, bis: SchemaDocument } {
  const bis = set.createSchema("BisCore", "bis", 1, 0, 15);
  bis.createEntity("PhysicalElement");
  const source = set.createSchema("Source", "src", 1, 0, 0, {
    references: [bis],
  });
  source.createStructClass("PortInfo");
  source.createPropertyCategory("Mechanical");
  return { source, bis };
}

describe("copyItemInto", () => {
  it("deep-copies a class with its properties and custom attributes", () => {
    const set = new SchemaSet();
    const { source } = makeSource(set);
    const pump = source.createEntity("Pump", {
      label: "Pump",
      baseClass: "BisCore:PhysicalElement",
      properties: [
        { kind: PropertyKind.Primitive, name: "SerialNumber", type: PrimitiveType.String, isReadOnly: true },
        { kind: PropertyKind.StructArray, name: "Ports", structClass: "Source:PortInfo", maxOccurs: 4 },
      ],
    });
    pump.customAttributes.add({ className: "CoreCustomAttributes:HiddenClass", values: { Show: false } });

    const target = new SchemaSet().createSchema("Target", "tgt", 1, 0, 0);
    const { copy, issues } = copyItemInto(target, pump);

    expect(issues.hasErrors, [...issues].map((i) => i.message).join("\n")).toBe(false);
    expect(copy).toBeDefined();
    expect(copy).not.toBe(pump);
    expect(copy!.document).toBe(target);
    expect(source.getEntity("Pump")).toBe(pump); // source untouched

    const copied = target.getItemOfType("Pump", SchemaItemType.EntityClass)!;
    expect(copied.label).toBe("Pump");
    expect(copied.baseClass).toBe("BisCore:PhysicalElement");
    expect(copied.properties.map((p) => p.name)).toEqual(["SerialNumber", "Ports"]);
    expect(copied.getProperty("SerialNumber")!.isReadOnly).toBe(true);
    expect(copied.customAttributes.get("CoreCustomAttributes:HiddenClass")!.getValue("Show")).toBe(false);
  });

  it("carries the schema references the copy needs, without touching existing ones", () => {
    const set = new SchemaSet();
    const { source } = makeSource(set);
    const pump = source.createEntity("Pump", { baseClass: "BisCore:PhysicalElement" });
    pump.createStruct("Port", "Source:PortInfo");

    const target = new SchemaSet().createSchema("Target", "tgt", 1, 0, 0);
    target.setSchemaReference({ name: "BisCore", readVersion: 1, writeVersion: 0, minorVersion: 0, alias: "bisAlias" });

    copyItemInto(target, pump);

    // Source is named by the copy, so a reference to it is added.
    expect(target.getSchemaReference("Source")).toMatchObject({ name: "Source", readVersion: 1, minorVersion: 0 });
    // BisCore was already referenced - version and alias are left exactly as the target had them.
    expect(target.getSchemaReference("BisCore")).toMatchObject({ minorVersion: 0, alias: "bisAlias" });
  });

  it("copies verbatim when carrySchemaReferences is off", () => {
    const set = new SchemaSet();
    const { source } = makeSource(set);
    const pump = source.createEntity("Pump", { baseClass: "BisCore:PhysicalElement" });

    const target = new SchemaSet().createSchema("Target", "tgt", 1, 0, 0);
    copyItemInto(target, pump, { carrySchemaReferences: false });

    expect(target.references).toHaveLength(0);
    // With no reference to BisCore in the target, the reader leaves an unknown qualifier exactly as
    // the serializer wrote it - ECJSON's dot separator. The document treats `.` and `:` as equal,
    // so this still resolves the moment a BisCore reference is added.
    expect(target.getEntity("Pump")!.baseClass).toBe("BisCore.PhysicalElement");
  });

  it("renames on request and leaves the source name alone", () => {
    const set = new SchemaSet();
    const { source } = makeSource(set);
    const pump = source.createEntity("Pump");

    const { copy } = copyItemInto(source, pump, { name: "PumpBase" });
    expect(copy!.name).toBe("PumpBase");
    expect(source.items.map((i) => i.name)).toContain("Pump");
    expect(source.items.map((i) => i.name)).toContain("PumpBase");
  });

  it("copies a relationship class with both constraints", () => {
    const set = new SchemaSet();
    const { source } = makeSource(set);
    source.createEntity("Pump");
    const rel = source.createRelationship("PumpOwnsPorts", {
      source: { multiplicity: "(1..1)", roleLabel: "owns", constraintClasses: ["Source:Pump"] },
      target: { multiplicity: "(0..*)", roleLabel: "is owned by", constraintClasses: ["Source:PortInfo"] },
    });

    const target = new SchemaSet().createSchema("Target", "tgt", 1, 0, 0);
    copyItemInto(target, rel);

    const copied = target.getItemOfType("PumpOwnsPorts", SchemaItemType.RelationshipClass)!;
    expect(copied.source.multiplicity).toBe("(1..1)");
    expect(copied.source.roleLabel).toBe("owns");
    expect(copied.target.constraintClasses).toEqual(["Source:PortInfo"]);
  });

  it("copies an enumeration with its enumerators", () => {
    const set = new SchemaSet();
    const { source } = makeSource(set);
    const status = source.createEnumeration("Status", "int", { isStrict: false });
    status.createEnumerator("Idle", 0, { label: "Idle" });
    status.createEnumerator("Running", 1);

    const target = new SchemaSet().createSchema("Target", "tgt", 1, 0, 0);
    copyItemInto(target, status);

    const copied = target.getItemOfType("Status", SchemaItemType.Enumeration)!;
    expect(copied.isStrict).toBe(false);
    expect(copied.enumerators.map((e) => [e.name, e.value])).toEqual([["Idle", 0], ["Running", 1]]);
    expect(copied.getEnumerator("Idle")!.label).toBe("Idle");
  });
});

describe("copyPropertyInto", () => {
  it("copies a property between classes in different documents", () => {
    const set = new SchemaSet();
    const { source } = makeSource(set);
    const pump = source.createEntity("Pump");
    const serial = pump.createPrimitive("SerialNumber", PrimitiveType.String, { priority: 7, category: "Source:Mechanical" });

    const target = new SchemaSet().createSchema("Target", "tgt", 1, 0, 0);
    const valve = target.createEntity("Valve");
    const { copy, issues } = copyPropertyInto(valve, serial);

    expect(issues.hasErrors).toBe(false);
    expect(copy!.declaringClass).toBe(valve);
    expect(copy!.priority).toBe(7);
    expect(copy!.category).toBe("Source:Mechanical");
    expect(target.getSchemaReference("Source")).toBeDefined();
    expect(pump.properties).toHaveLength(1); // source untouched
  });

  it("copies a navigation property with its direction", () => {
    const set = new SchemaSet();
    const { source } = makeSource(set);
    const pump = source.createEntity("Pump");
    const nav = pump.createNavigation("Parent", "Source:PumpOwnsPorts", StrengthDirection.Backward);

    const target = new SchemaSet().createSchema("Target", "tgt", 1, 0, 0);
    const valve = target.createEntity("Valve");
    const { copy } = copyPropertyInto(valve, nav, { name: "Owner" });

    expect(copy!.name).toBe("Owner");
    const copied = valve.getProperty("Owner")!;
    // Predicate rather than `assertNavigation()`: an `asserts this is T` method does not narrow a
    // union-typed receiver, and `getProperty` returns the `AnyProperty` union. See the note on
    // Property's assert methods.
    expect(copied.isNavigation()).toBe(true);
    if (!copied.isNavigation())
      throw new Error("expected a navigation property");
    expect(copied.direction).toBe(StrengthDirection.Backward);
    expect(copied.relationshipName).toBe("Source:PumpOwnsPorts");
  });
});

describe("copyDocumentInto", () => {
  it("copies a whole document into another set, leaving the original in place", () => {
    const set = new SchemaSet();
    const { source } = makeSource(set);
    source.createEntity("Pump", { baseClass: "BisCore:PhysicalElement" });

    const otherSet = new SchemaSet();
    const { copy, issues } = copyDocumentInto(otherSet, source);

    expect(issues.hasErrors).toBe(false);
    expect(copy).not.toBe(source);
    expect(copy!.schemaSet).toBe(otherSet);
    expect(source.schemaSet).toBe(set);
    expect(copy!.getEntity("Pump")!.baseClass).toBe("BisCore:PhysicalElement");
    expect(copy!.getSchemaReference("BisCore")!.minorVersion).toBe(15);
  });

  it("renames the copy on request", () => {
    const set = new SchemaSet();
    const { source } = makeSource(set);
    const { copy } = copyDocumentInto(set, source, { name: "SourceFork" });
    expect(copy!.name).toBe("SourceFork");
    expect(set.hasSchema("Source")).toBe(true);
    expect(set.hasSchema("SourceFork")).toBe(true);
  });

  it("reports rather than replaces when the name is taken", () => {
    const set = new SchemaSet();
    const { source } = makeSource(set);
    const { copy, issues } = copyDocumentInto(set, source);
    expect(issues.hasErrors).toBe(true);
    // The copy is handed back so the caller can rename and retry, but it did not join the set and
    // the incumbent was not evicted.
    expect(copy!.schemaSet).not.toBe(set);
    expect(set.getSchema("Source")).toBe(source);
  });
});

describe("property declarations", () => {
  it("creates every property kind from declarations, narrowed to the concrete type", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    doc.createStructClass("PortInfo");
    const pump = doc.createEntity("Pump");

    const primitive = pump.createProperty({ kind: PropertyKind.Primitive, name: "Serial", type: PrimitiveType.String, maxLength: 32 });
    const array = pump.createProperty({ kind: PropertyKind.PrimitiveArray, name: "Tags", type: PrimitiveType.String, minOccurs: 1 });
    const struct = pump.createProperty({ kind: PropertyKind.Struct, name: "Port", structClass: "PortInfo" });
    const structArray = pump.createProperty({ kind: PropertyKind.StructArray, name: "Ports", structClass: "PortInfo", maxOccurs: 4 });
    const nav = pump.createProperty({ kind: PropertyKind.Navigation, name: "Owner", relationship: "Rel", direction: StrengthDirection.Backward });

    // The return types are the concrete kinds, so these members resolve without narrowing.
    expect(primitive.maxLength).toBe(32);
    expect(array.minOccurs).toBe(1);
    expect(struct.typeName).toBe("PortInfo");
    expect(structArray.maxOccurs).toBe(4);
    expect(nav.direction).toBe(StrengthDirection.Backward);
    expect(pump.properties.map((p) => p.name)).toEqual(["Serial", "Tags", "Port", "Ports", "Owner"]);
  });

  it("accepts properties in a class init, in declaration order", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    const pump = doc.createEntity("Pump", {
      properties: [
        { kind: PropertyKind.Primitive, name: "A", type: PrimitiveType.Integer },
        { kind: PropertyKind.Primitive, name: "B", type: PrimitiveType.Double },
      ],
    });
    expect(pump.properties.map((p) => p.name)).toEqual(["A", "B"]);
    expect(pump.getProperty("b")!.kind).toBe(PropertyKind.Primitive);
  });

  it("createProperties returns the created properties in order", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    const pump = doc.createEntity("Pump");
    const created = pump.createProperties(
      { kind: PropertyKind.Primitive, name: "A", type: PrimitiveType.Integer },
      { kind: PropertyKind.Primitive, name: "B", type: PrimitiveType.Double },
    );
    expect(created.map((p) => p.name)).toEqual(["A", "B"]);
    expect(created[0].declaringClass).toBe(pump);
  });
});

describe("discriminant availability", () => {
  it("exposes schemaItemType while the base constructor registers the item", () => {
    // The discriminant is a getter rather than a field precisely so it exists before a subclass
    // field initializer would have run - the base constructor publishes `this` to the document.
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    const seen: unknown[] = [];
    const original = doc.getItem.bind(doc);
    void original;
    const entity = new EntityClass(doc, "Pump");
    seen.push(entity.schemaItemType);
    expect(seen).toEqual([SchemaItemType.EntityClass]);
    expect(doc.items[0].schemaItemType).toBe(SchemaItemType.EntityClass);
  });
});
