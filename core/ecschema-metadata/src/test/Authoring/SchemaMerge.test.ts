/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { ECClassModifier, PrimitiveType, SchemaItemType, StrengthDirection, StrengthType } from "../../ECObjects";
import { mergeFieldClassOf } from "../../Authoring/MergeFields";
import { AnyClass, EntityClass, SchemaDocument, SchemaSet } from "../../Authoring/SchemaDocument";
import { SchemaJsonWriter } from "../../Authoring/SchemaJsonWriter";
import { mergeSchemaInto, SchemaMergeOptions } from "../../Authoring/SchemaMerge";
import { composeFullDocument } from "./FullDocumentFixture";

/** Builds a standalone document. Merging deliberately takes one schema at a time, so most cases
 * here need nothing but two documents and a set to merge into. */
function document(name = "MyDomain", minorVersion = 0): SchemaDocument {
  return new SchemaDocument(name, name.substring(0, 2).toLowerCase(), 1, 0, minorVersion);
}

function setWith(...documents: SchemaDocument[]): SchemaSet {
  const set = new SchemaSet();
  set.moveIn(...documents);
  return set;
}

function merge(target: SchemaSet, incoming: SchemaDocument, options?: SchemaMergeOptions) {
  const result = mergeSchemaInto(target, incoming, options);
  return { ...result, names: [...result.issues].map((issue) => issue.name) };
}

function propertyNames(item: AnyClass): string[] {
  return item.properties.map((property) => property.name);
}

function entity(doc: SchemaDocument, name: string): EntityClass {
  return doc.getItemOfType(name, SchemaItemType.EntityClass)!;
}

describe("mergeSchemaInto - accumulating into a target set", () => {
  it("copies the schema in when the set does not hold it", () => {
    const target = new SchemaSet();
    const incoming = document();
    incoming.createEntity("Pump", { label: "Pump" }).createPrimitive("SerialNumber", PrimitiveType.String);

    const { document: merged, issues } = merge(target, incoming);
    expect(issues.hasErrors).to.be.false;
    expect(target.getSchema("MyDomain")).to.equal(merged);
    expect(merged).to.not.equal(incoming);
    expect(propertyNames(entity(merged!, "Pump"))).to.deep.equal(["SerialNumber"]);
  });

  it("leaves the incoming document untouched", () => {
    const existing = document();
    existing.createEntity("Pump").createPrimitive("Serial", PrimitiveType.String);
    const incoming = document();
    incoming.createEntity("Pump").createPrimitive("Model", PrimitiveType.String);

    merge(setWith(existing), incoming);
    expect(propertyNames(entity(incoming, "Pump"))).to.deep.equal(["Model"]);
    expect(incoming.getItem("Pump")!.document).to.equal(incoming);
  });

  it("accumulates several schemas into one set", () => {
    const target = new SchemaSet();
    for (const name of ["Alpha", "Beta"]) {
      const source = document(name);
      source.createEntity(`${name}Class`);
      merge(target, source);
    }
    expect(target.size).to.equal(2);
    expect(target.getSchema("Alpha")!.getItem("AlphaClass")).to.not.be.undefined;
  });

  it("is a no-op the second time the same schema is merged", () => {
    const target = new SchemaSet();
    const incoming = composeFullDocument();
    merge(target, incoming);
    const afterFirst = new SchemaJsonWriter().writeDocumentTree(target.getSchema("TestDomain")!).tree;

    const second = merge(target, incoming);
    const afterSecond = new SchemaJsonWriter().writeDocumentTree(target.getSchema("TestDomain")!).tree;
    expect(second.renames).to.be.empty;
    expect(second.issues.errors).to.be.empty;
    expect(afterSecond).to.deep.equal(afterFirst);
  });
});

describe("mergeSchemaInto - union semantics", () => {
  it("adds items and properties and never removes any", () => {
    const existing = document();
    const pump = existing.createEntity("Pump");
    pump.createPrimitive("Serial", PrimitiveType.String);
    existing.createEntity("OnlyInTarget");

    const incoming = document();
    incoming.createEntity("Pump").createPrimitive("Model", PrimitiveType.String);
    incoming.createEntity("OnlyInIncoming");

    const { document: merged } = merge(setWith(existing), incoming);
    expect(merged!.items.map((item) => item.name).sort()).to.deep.equal(["OnlyInIncoming", "OnlyInTarget", "Pump"]);
    expect(propertyNames(entity(merged!, "Pump"))).to.deep.equal(["Serial", "Model"]);
  });

  it("does not touch an item the incoming schema says nothing about", () => {
    const existing = document();
    const untouched = existing.createEntity("OnlyInTarget");
    const incoming = document();
    incoming.createEntity("Other");

    const { document: merged } = merge(setWith(existing), incoming);
    expect(merged!.getItem("OnlyInTarget")).to.equal(untouched);
  });

  it("unions enumerators, mixins and constraint classes", () => {
    const existing = document();
    const status = existing.createEnumeration("Status", "int");
    status.createEnumerator("On", 1);
    existing.createEntity("Element");
    existing.createMixin("Named", "Element");
    existing.createMixin("Tagged", "Element");
    existing.createEntity("Pump", { mixins: ["Named"] });

    const incoming = document();
    const incomingStatus = incoming.createEnumeration("Status", "int");
    incomingStatus.createEnumerator("On", 1);
    incomingStatus.createEnumerator("Off", 2);
    incoming.createEntity("Element");
    incoming.createMixin("Named", "Element");
    incoming.createMixin("Tagged", "Element");
    incoming.createEntity("Pump", { mixins: ["Tagged"] });

    const { document: merged } = merge(setWith(existing), incoming);
    const mergedStatus = merged!.getItemOfType("Status", SchemaItemType.Enumeration)!;
    expect(mergedStatus.enumerators.map((enumerator) => enumerator.name)).to.deep.equal(["On", "Off"]);
    expect(entity(merged!, "Pump").mixins).to.have.lengthOf(2);
  });

  it("takes the higher version and keeps the target's schema reference version", () => {
    const existing = document("MyDomain", 5);
    existing.setSchemaReference({ name: "BisCore", readVersion: 1, writeVersion: 0, minorVersion: 0, alias: "bis" });
    const incoming = document("MyDomain", 9);
    incoming.setSchemaReference({ name: "BisCore", readVersion: 1, writeVersion: 0, minorVersion: 15, alias: "bis" });
    incoming.setSchemaReference({ name: "Functional", readVersion: 1, writeVersion: 0, minorVersion: 0, alias: "func" });

    const { document: merged, names } = merge(setWith(existing), incoming);
    expect(merged!.minorVersion).to.equal(9);
    expect(merged!.getSchemaReference("BisCore")!.minorVersion).to.equal(0);
    expect(merged!.getSchemaReference("Functional")).to.not.be.undefined;
    expect(names).to.include("schema-reference-version-differs");
  });
});

describe("mergeSchemaInto - the field classification table", () => {
  it("reports an identity disagreement as an error and keeps the target's value", () => {
    const existing = document();
    existing.createKindOfQuantity("Length", "Units:M", 0.001);
    const incoming = document();
    incoming.createKindOfQuantity("Length", "Units:FT", 0.001);

    const { document: merged, issues, names } = merge(setWith(existing), incoming);
    expect(names).to.include("field-conflict");
    expect(issues.errors[0].location).to.equal("MyDomain:Length");
    expect(merged!.getItemOfType("Length", SchemaItemType.KindOfQuantity)!.getPersistenceUnit()).to.be.undefined;
    expect(merged!.getItemOfType("Length", SchemaItemType.KindOfQuantity)!.persistenceUnit).to.match(/^Units[.:]M$/);
  });

  it("reports a constrained disagreement as a warning and keeps the target's value", () => {
    const existing = document();
    existing.createEntity("Pump", { modifier: ECClassModifier.Sealed });
    const incoming = document();
    incoming.createEntity("Pump", { modifier: ECClassModifier.Abstract });

    const { document: merged, issues } = merge(setWith(existing), incoming);
    expect(issues.warnings.map((issue) => issue.name)).to.include("field-differs");
    expect(issues.errors).to.be.empty;
    expect(entity(merged!, "Pump").modifier).to.equal(ECClassModifier.Sealed);
  });

  it("keeps the target's descriptive values quietly and takes a value the target lacks", () => {
    const existing = document();
    existing.createEntity("Pump", { label: "Target label" });
    const incoming = document();
    incoming.createEntity("Pump", { label: "Incoming label", description: "Incoming description" });

    const { document: merged, issues } = merge(setWith(existing), incoming);
    expect(issues.errors).to.be.empty;
    expect(issues.warnings).to.be.empty;
    const pump = entity(merged!, "Pump");
    expect(pump.label).to.equal("Target label");
    expect(pump.description).to.equal("Incoming description");
  });

  it("classifies every field a fully populated document emits", () => {
    const tree = new SchemaJsonWriter().writeDocumentTree(composeFullDocument(), { omitDefaults: true }).tree!;
    const unclassified = new Set<string>();
    // A field classified `identity` is compared as a whole value, so the walk stops there rather
    // than descending into it - a Format's composite spec is one object, not four fields. Custom
    // attribute values are author-defined names and merge as whole instances, so they stop it too.
    const walk = (value: unknown): void => {
      if (Array.isArray(value))
        return value.forEach(walk);
      if (typeof value !== "object" || value === null)
        return;
      for (const [field, member] of Object.entries(value)) {
        if (field === "customAttributes")
          continue;
        const fieldClass = mergeFieldClassOf(field);
        if (fieldClass === undefined)
          unclassified.add(field);
        if (fieldClass !== "identity")
          walk(member);
      }
    };
    for (const [name, item] of Object.entries(tree.items as Record<string, unknown>)) {
      expect(name).to.be.a("string");
      walk(item);
    }
    for (const [field, value] of Object.entries(tree)) {
      if (field !== "items" && field !== "customAttributes") {
        if (mergeFieldClassOf(field) === undefined)
          unclassified.add(field);
        walk(value);
      }
    }
    expect([...unclassified], "fields missing a row in mergeFieldClasses").to.be.empty;
  });
});

describe("mergeSchemaInto - properties", () => {
  it("renames a property the two sides type incompatibly", () => {
    const existing = document();
    existing.createEntity("Pump").createPrimitive("Serial", PrimitiveType.String);
    const incoming = document();
    incoming.createEntity("Pump").createPrimitive("Serial", PrimitiveType.Integer);

    const { document: merged, renames, names } = merge(setWith(existing), incoming);
    expect(names).to.include("property-renamed");
    expect(renames).to.deep.equal([{ kind: "property", location: "MyDomain:Pump", from: "Serial", to: "Serial_1" }]);
    const pump = entity(merged!, "Pump");
    expect(propertyNames(pump)).to.deep.equal(["Serial", "Serial_1"]);
    const kept = pump.getProperty("Serial")!;
    expect(kept.isPrimitive() && kept.typeName).to.equal("string");
  });

  it("reuses the renamed property rather than renaming again on a second merge", () => {
    const existing = document();
    existing.createEntity("Pump").createPrimitive("Serial", PrimitiveType.String);
    const incoming = document();
    incoming.createEntity("Pump").createPrimitive("Serial", PrimitiveType.Integer);

    const target = setWith(existing);
    const first = merge(target, incoming);
    const second = merge(target, incoming);
    expect(first.renames[0].to).to.equal("Serial_1");
    expect(second.renames[0].to).to.equal("Serial_1");
    expect(propertyNames(entity(target.getSchema("MyDomain")!, "Pump"))).to.deep.equal(["Serial", "Serial_1"]);
  });

  it("reuses a rename for a third schema that agrees, and adds one for a third that does not", () => {
    const existing = document();
    existing.createEntity("Pump").createPrimitive("Serial", PrimitiveType.String);
    const target = setWith(existing);

    const agreeing = [PrimitiveType.Integer, PrimitiveType.Integer, PrimitiveType.Double];
    const landed = agreeing.map((type) => {
      const source = document();
      source.createEntity("Pump").createPrimitive("Serial", type);
      return merge(target, source).renames[0].to;
    });

    expect(landed).to.deep.equal(["Serial_1", "Serial_1", "Serial_2"]);
    expect(propertyNames(entity(target.getSchema("MyDomain")!, "Pump"))).to.deep.equal(["Serial", "Serial_1", "Serial_2"]);
  });

  it("keeps the target's property when renaming is off", () => {
    const existing = document();
    existing.createEntity("Pump").createPrimitive("Serial", PrimitiveType.String);
    const incoming = document();
    incoming.createEntity("Pump").createPrimitive("Serial", PrimitiveType.Integer);

    const { document: merged, names } = merge(setWith(existing), incoming, { renamePropertyOnConflict: false });
    expect(names).to.include("property-conflict");
    expect(propertyNames(entity(merged!, "Pump"))).to.deep.equal(["Serial"]);
  });

  it("renames against an inherited property when the base schema is loaded", () => {
    const existing = document();
    const element = existing.createEntity("Element");
    element.createPrimitive("Name", PrimitiveType.String);
    existing.createEntity("Pump", { baseClass: "Element" });

    const incoming = document();
    incoming.createEntity("Element").createPrimitive("Name", PrimitiveType.String);
    incoming.createEntity("Pump", { baseClass: "Element" }).createPrimitive("Name", PrimitiveType.Integer);

    const { document: merged, names } = merge(setWith(existing), incoming);
    expect(names).to.include("property-renamed");
    expect(propertyNames(entity(merged!, "Pump"))).to.deep.equal(["Name_1"]);
  });

  it("keeps the target's property order and appends what only the incoming schema has", () => {
    const existing = document();
    const pump = existing.createEntity("Pump");
    pump.createPrimitive("A", PrimitiveType.String);
    pump.createPrimitive("B", PrimitiveType.String);

    const incoming = document();
    const incomingPump = incoming.createEntity("Pump");
    incomingPump.createPrimitive("B", PrimitiveType.String);
    incomingPump.createPrimitive("A", PrimitiveType.String);
    incomingPump.createPrimitive("C", PrimitiveType.String);

    const { document: merged, names } = merge(setWith(existing), incoming);
    expect(propertyNames(entity(merged!, "Pump"))).to.deep.equal(["A", "B", "C"]);
    expect(names).to.include("property-order-differs");
  });
});

describe("mergeSchemaInto - base classes", () => {
  it("narrows to the incoming base class when it derives from the target's", () => {
    const existing = document();
    existing.createEntity("Element");
    existing.createEntity("PhysicalElement", { baseClass: "Element" });
    existing.createEntity("Pump", { baseClass: "Element" });

    const incoming = document();
    incoming.createEntity("Element");
    incoming.createEntity("PhysicalElement", { baseClass: "Element" });
    incoming.createEntity("Pump", { baseClass: "PhysicalElement" });

    const { document: merged, issues, names } = merge(setWith(existing), incoming);
    expect(issues.errors).to.be.empty;
    expect(names).to.include("base-class-narrowed");
    expect(entity(merged!, "Pump").getBaseClass()!.name).to.equal("PhysicalElement");
  });

  it("keeps the target's base class when the incoming one is a subtype of it", () => {
    const existing = document();
    existing.createEntity("Element");
    existing.createEntity("PhysicalElement", { baseClass: "Element" });
    existing.createEntity("Pump", { baseClass: "PhysicalElement" });

    const incoming = document();
    incoming.createEntity("Element");
    incoming.createEntity("PhysicalElement", { baseClass: "Element" });
    incoming.createEntity("Pump", { baseClass: "Element" });

    const { document: merged, issues } = merge(setWith(existing), incoming);
    expect(issues.errors).to.be.empty;
    expect(entity(merged!, "Pump").getBaseClass()!.name).to.equal("PhysicalElement");
  });

  it("overflows a disjoint base class into mixins and reports it", () => {
    const existing = document();
    existing.createEntity("Element");
    existing.createEntity("Asset");
    existing.createEntity("Pump", { baseClass: "Element" });

    const incoming = document();
    incoming.createEntity("Element");
    incoming.createEntity("Asset");
    incoming.createEntity("Pump", { baseClass: "Asset" });

    const { document: merged, names } = merge(setWith(existing), incoming);
    expect(names).to.include("base-class-conflict");
    const pump = entity(merged!, "Pump");
    expect(pump.getBaseClass()!.name).to.equal("Element");
    expect(pump.getMixins().map((mixin) => mixin?.name)).to.deep.equal([undefined]);
    expect(pump.mixins).to.have.lengthOf(1);
    expect(merged!.resolveItem(pump.mixins[0])!.name).to.equal("Asset");
  });

  it("reports once when the base schemas are not in the set", () => {
    const existing = document();
    existing.createEntity("Pump", { baseClass: "BisCore:PhysicalElement" });
    const incoming = document();
    incoming.createEntity("Pump", { baseClass: "BisCore:GraphicalElement3d" });

    const { names } = merge(setWith(existing), incoming);
    expect(names.filter((name) => name === "base-class-not-loaded")).to.have.lengthOf(1);
    expect(names).to.include("base-class-conflict");
  });
});

describe("mergeSchemaInto - schema items of different kinds", () => {
  it("keeps the target's item and reports by default", () => {
    const existing = document();
    existing.createEntity("Pump");
    const incoming = document();
    incoming.createStructClass("Pump");

    const { document: merged, names } = merge(setWith(existing), incoming);
    expect(names).to.include("item-kind-conflict");
    expect(merged!.getItem("Pump")!.schemaItemType).to.equal(SchemaItemType.EntityClass);
  });

  it("renames the incoming item and repoints references to it from its own schema", () => {
    const existing = document();
    existing.createEntity("Pump");

    const incoming = document();
    incoming.createStructClass("Pump");
    incoming.createEntity("Station").createStruct("Detail", "Pump");

    const { document: merged, renames, names } = merge(setWith(existing), incoming, { renameItemOnConflict: true });
    expect(names).to.include("item-renamed");
    expect(renames).to.deep.equal([{ kind: "item", location: "MyDomain", from: "Pump", to: "Pump_1" }]);
    expect(merged!.getItem("Pump")!.schemaItemType).to.equal(SchemaItemType.EntityClass);
    expect(merged!.getItem("Pump_1")!.schemaItemType).to.equal(SchemaItemType.StructClass);

    const detail = entity(merged!, "Station").getProperty("Detail")!;
    expect(detail.isStruct() && merged!.resolveItem(detail.typeName)!.name).to.equal("Pump_1");
  });
});

// EC property names are PascalCase, which is what a custom attribute value map is keyed by.
/* eslint-disable @typescript-eslint/naming-convention */
describe("mergeSchemaInto - custom attributes", () => {
  const dynamic = "CoreCustomAttributes.DynamicSchema";

  it("lets the incoming instance win and keeps a one-sided instance", () => {
    const existing = document();
    existing.createEntity("Pump").customAttributes.add({ className: "CoreCustomAttributes.HiddenClass", values: { Show: false } });
    existing.customAttributes.add({ className: dynamic });

    const incoming = document();
    incoming.createEntity("Pump").customAttributes.add({ className: "CoreCustomAttributes.HiddenClass", values: { Show: true } });

    const { document: merged } = merge(setWith(existing), incoming);
    expect(entity(merged!, "Pump").customAttributes.get("CoreCustomAttributes.HiddenClass")!.values.Show).to.equal(true);
    expect(merged!.customAttributes.get(dynamic)).to.not.be.undefined;
  });

  it("fires the hook for both sides, for one-sided instances, and for new content", () => {
    const existing = document();
    existing.createEntity("Pump").customAttributes.add({ className: "CoreCustomAttributes.HiddenClass", values: { Show: false } });

    const incoming = document();
    incoming.createEntity("Pump").customAttributes.add({ className: "CoreCustomAttributes.HiddenClass", values: { Show: true } });
    const brandNew = incoming.createEntity("Valve");
    brandNew.customAttributes.add({ className: dynamic });
    brandNew.createPrimitive("Size", PrimitiveType.Integer).customAttributes.add({ className: "CoreCustomAttributes.HiddenProperty" });

    const seen: string[] = [];
    merge(setWith(existing), incoming, {
      onCustomAttribute: (site) => {
        seen.push(`${site.location}|${site.className}|${site.target === undefined ? "-" : "t"}${site.incoming === undefined ? "-" : "i"}`);
        return undefined;
      },
    });

    expect(seen).to.include("MyDomain:Pump|CoreCustomAttributes.HiddenClass|ti");
    expect(seen).to.include("MyDomain:Valve|CoreCustomAttributes.DynamicSchema|-i");
    expect(seen).to.include("MyDomain:Valve.Size|CoreCustomAttributes.HiddenProperty|-i");
  });

  it("drops an attribute the hook rejects, including one the target already had", () => {
    const existing = document();
    existing.createEntity("Pump").customAttributes.add({ className: dynamic });
    const incoming = document();
    incoming.createEntity("Pump");

    const { document: merged } = merge(setWith(existing), incoming, {
      onCustomAttribute: (site) => site.className === dynamic ? "drop" : undefined,
    });
    expect(entity(merged!, "Pump").customAttributes.size).to.equal(0);
  });

  it("takes a replacement the hook supplies", () => {
    const existing = document();
    existing.createEntity("Pump").customAttributes.add({ className: "CoreCustomAttributes.HiddenClass", values: { Show: false } });
    const incoming = document();
    incoming.createEntity("Pump");

    const { document: merged } = merge(setWith(existing), incoming, {
      onCustomAttribute: () => ({ className: "CoreCustomAttributes.HiddenClass", values: { Show: true } }),
    });
    expect(entity(merged!, "Pump").customAttributes.get("CoreCustomAttributes.HiddenClass")!.values.Show).to.equal(true);
  });
});

/* eslint-enable @typescript-eslint/naming-convention */

describe("mergeSchemaInto - the onConflict callback", () => {
  it("takes the incoming value when asked to", () => {
    const existing = document();
    existing.createKindOfQuantity("Length", "Units:M", 0.001);
    const incoming = document();
    incoming.createKindOfQuantity("Length", "Units:FT", 0.001);

    const { document: merged, issues } = merge(setWith(existing), incoming, { onConflict: () => "takeIncoming" });
    expect(issues.errors).to.be.empty;
    expect(merged!.getItemOfType("Length", SchemaItemType.KindOfQuantity)!.persistenceUnit).to.match(/^Units[.:]FT$/);
  });

  it("sees the field, its class, both values and the default", () => {
    const existing = document();
    existing.createEntity("Pump").createPrimitive("Serial", PrimitiveType.String);
    const incoming = document();
    incoming.createEntity("Pump").createPrimitive("Serial", PrimitiveType.Integer);

    const conflicts: string[] = [];
    merge(setWith(existing), incoming, {
      onConflict: (conflict) => {
        conflicts.push(`${conflict.location}|${conflict.field}|${conflict.fieldClass}|${String(conflict.target)}->${String(conflict.incoming)}|${conflict.defaultResolution}`);
        return undefined;
      },
    });
    expect(conflicts).to.include("MyDomain:Pump.Serial|typeName|identity|string->int|rename");
  });

  it("drops the incoming construct on skip", () => {
    const existing = document();
    existing.createEntity("Pump").createPrimitive("Serial", PrimitiveType.String);
    const incoming = document();
    incoming.createEntity("Pump").createPrimitive("Serial", PrimitiveType.Integer);

    const { document: merged, issues } = merge(setWith(existing), incoming, { onConflict: () => "skip" });
    expect(issues.errors).to.be.empty;
    expect(propertyNames(entity(merged!, "Pump"))).to.deep.equal(["Serial"]);
  });

  it("reports rename asked for where nothing can be renamed", () => {
    const existing = document();
    existing.createEntity("Pump", { label: "Target" });
    const incoming = document();
    incoming.createEntity("Pump", { label: "Incoming" });

    const { names } = merge(setWith(existing), incoming, { onConflict: () => "rename" });
    expect(names).to.include("resolution-not-applicable");
  });
});

describe("mergeSchemaInto - relationships", () => {
  it("merges constraints and unions their constraint classes", () => {
    const build = (target: string): SchemaDocument => {
      const doc = document();
      doc.createEntity("Element");
      doc.createEntity("Pump", { baseClass: "Element" });
      doc.createEntity("Valve", { baseClass: "Element" });
      doc.createRelationship("ElementOwnsChild", {
        strength: StrengthType.Referencing,
        strengthDirection: StrengthDirection.Forward,
        source: { multiplicity: "(0..1)", roleLabel: "owns", constraintClasses: ["Element"] },
        target: { multiplicity: "(0..*)", roleLabel: "is owned by", constraintClasses: [target] },
      });
      return doc;
    };

    const { document: merged, issues } = merge(setWith(build("Pump")), build("Valve"));
    expect(issues.errors).to.be.empty;
    const relationship = merged!.getItemOfType("ElementOwnsChild", SchemaItemType.RelationshipClass)!;
    expect(relationship.target.constraintClasses).to.have.lengthOf(2);
  });

  it("reports a strength disagreement as an identity conflict", () => {
    const existing = document();
    existing.createRelationship("Owns", { strength: StrengthType.Embedding });
    const incoming = document();
    incoming.createRelationship("Owns", { strength: StrengthType.Holding });

    const { names } = merge(setWith(existing), incoming);
    expect(names).to.include("field-conflict");
  });

  it("treats a value written as its spec default the same as an omitted one", () => {
    const existing = document();
    existing.createRelationship("Owns", {});
    const incoming = document();
    incoming.createRelationship("Owns", { strength: StrengthType.Referencing });

    const { issues } = merge(setWith(existing), incoming);
    expect(issues.errors).to.be.empty;
  });
});

describe("mergeSchemaInto - the merged result is a document like any other", () => {
  it("survives a full-fixture merge into an empty set and round-trips", () => {
    const target = new SchemaSet();
    const { issues } = merge(target, composeFullDocument());
    expect(issues.errors, issues.errors.map((issue) => `${issue.name}@${issue.location}`).join(", ")).to.be.empty;

    const merged = target.getSchema("TestDomain")!;
    const original = new SchemaJsonWriter().writeDocumentTree(composeFullDocument(), { omitDefaults: true }).tree;
    const copy = new SchemaJsonWriter().writeDocumentTree(merged, { omitDefaults: true }).tree;
    expect(copy).to.deep.equal(original);
  });
});
