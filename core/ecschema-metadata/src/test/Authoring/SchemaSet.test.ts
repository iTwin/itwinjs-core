/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { PrimitiveType, SchemaItemType, StrengthDirection } from "../../ECObjects";
import { EntityClass, PrimitiveProperty, SchemaDocument, SchemaSet } from "../../Authoring/SchemaDocument";

/** A document plus a schema set holding it, the shape most of these tests start from. */
function makeSet(...names: string[]): { set: SchemaSet, documents: SchemaDocument[] } {
  const set = new SchemaSet();
  const documents = names.map((name, index) => set.createSchema(name, name.toLowerCase(), 1, 0, index));
  return { set, documents };
}

describe("SchemaSet lifetime", () => {
  it("gives a document created with new a private set containing only itself", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    expect(doc.schemaSet.size).to.equal(1);
    expect(doc.schemaSet.getSchema("MyDomain")).to.equal(doc);
  });

  it("holds documents created through it", () => {
    const { set, documents } = makeSet("BisCore", "MyDomain");
    expect(set.size).to.equal(2);
    expect(documents[0].schemaSet).to.equal(set);
    expect(set.getSchema("biscore")).to.equal(documents[0]);
    expect(set.hasSchema("MYDOMAIN")).to.be.true;
    expect([...set]).to.deep.equal(documents);
  });

  it("moves a document out of its previous set", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    const previous = doc.schemaSet;
    const { set } = makeSet("BisCore");

    set.moveIn(doc);

    expect(doc.schemaSet).to.equal(set);
    expect(set.size).to.equal(2);
    expect(previous.size).to.equal(0);
    expect(previous.getSchema("MyDomain")).to.be.undefined;
  });

  it("leaves a document alone when it is already in the set", () => {
    const { set, documents } = makeSet("MyDomain");
    set.moveIn(documents[0]);
    expect(set.size).to.equal(1);
  });

  it("rejects a name the set already holds rather than evicting the incumbent", () => {
    const { set, documents } = makeSet("BisCore");
    const other = new SchemaDocument("BISCORE", "bis", 1, 0, 15);

    expect(() => set.moveIn(other)).to.throw(/already holds a schema named/);
    expect(set.getSchema("BisCore")).to.equal(documents[0]);
    expect(other.schemaSet).to.not.equal(set);
    expect(other.schemaSet.size).to.equal(1);
  });

  it("hands a moved-out document a fresh private set of its own", () => {
    const { set, documents } = makeSet("BisCore", "MyDomain");

    const moved = set.moveOut("MyDomain");

    expect(moved).to.equal(documents[1]);
    expect(set.size).to.equal(1);
    expect(moved!.schemaSet).to.not.equal(set);
    expect(moved!.schemaSet.size).to.equal(1);
    expect(moved!.schemaSet.getSchema("MyDomain")).to.equal(moved);
  });

  it("moves a document out by identity, and only from the set holding it", () => {
    const { set, documents } = makeSet("MyDomain");
    const stranger = new SchemaDocument("Other", "o", 1, 0, 0);

    expect(set.moveOut(stranger)).to.be.undefined;
    expect(set.moveOut(documents[0])).to.equal(documents[0]);
    expect(set.size).to.equal(0);
  });

  it("takes documents in its constructor", () => {
    const first = new SchemaDocument("A", "a", 1, 0, 0);
    const second = new SchemaDocument("B", "b", 1, 0, 0);

    const set = new SchemaSet([first, second]);

    expect(set.size).to.equal(2);
    expect(first.schemaSet).to.equal(set);
    expect(second.schemaSet).to.equal(set);
  });
});

describe("SchemaDocument item ownership", () => {
  it("registers an item with its document as it is constructed", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    const pump = new EntityClass(doc, "Pump");

    expect(pump.document).to.equal(doc);
    expect(doc.items).to.deep.equal([pump]);
    expect(doc.getItem("PUMP")).to.equal(pump);
    expect(pump.fullName).to.equal("MyDomain:Pump");
  });

  it("registers a property with its class as it is constructed", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    const pump = doc.createEntity("Pump");
    const flow = new PrimitiveProperty(pump, "FlowRate", PrimitiveType.Double);

    expect(flow.declaringClass).to.equal(pump);
    expect(flow.document).to.equal(doc);
    expect(pump.properties).to.deep.equal([flow]);
    expect(flow.fullName).to.equal("MyDomain:Pump.FlowRate");
  });

  it("moves an item between documents, leaving the origin", () => {
    const { set, documents } = makeSet("Origin", "Target");
    const pump = documents[0].createEntity("Pump");

    documents[1].moveItemIn(pump);

    expect(pump.document).to.equal(documents[1]);
    expect(documents[0].items).to.be.empty;
    expect(documents[1].items).to.deep.equal([pump]);
    expect(set.getItem("Target:Pump")).to.equal(pump);
  });

  it("moves a property between classes", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    const pump = doc.createEntity("Pump");
    const tank = doc.createEntity("Tank");
    const serial = pump.createPrimitive("SerialNumber", PrimitiveType.String);

    tank.movePropertyIn(serial);

    expect(serial.declaringClass).to.equal(tank);
    expect(pump.properties).to.be.empty;
    expect(tank.getProperty("serialnumber")).to.equal(serial);
  });

  it("keeps the name lookup in step with every change", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    doc.createEntity("Pump");
    expect(doc.getItem("Pump")).to.not.be.undefined;

    expect(doc.removeItem("PUMP")).to.be.true;
    expect(doc.getItem("Pump")).to.be.undefined;
    expect(doc.removeItem("Pump")).to.be.false;

    const replacement = doc.createEntity("Pump");
    expect(doc.getItem("pump")).to.equal(replacement);
  });

  it("resolves a duplicate name to the first item declared, as serialization does", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    const first = doc.createEntity("Pump");
    doc.createStructClass("PUMP");

    expect(doc.items).to.have.lengthOf(2);
    expect(doc.getItem("Pump")).to.equal(first);
  });
});

describe("Reference resolution", () => {
  function twoSchemas(): { bis: SchemaDocument, domain: SchemaDocument } {
    const set = new SchemaSet();
    const bis = set.createSchema("BisCore", "bis", 1, 0, 15);
    bis.createEntity("PhysicalElement");
    const domain = set.createSchema("MyDomain", "md", 1, 0, 0, {
      references: [{ name: "BisCore", readVersion: 1, writeVersion: 0, minorVersion: 15, alias: "bis" }],
    });
    return { bis, domain };
  }

  it("resolves an unqualified reference in the document itself", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    const base = doc.createEntity("Base");
    const derived = doc.createEntity("Derived", { baseClass: "Base" });

    expect(derived.getBaseClass()).to.equal(base);
  });

  it("resolves a schema-qualified reference through the set, with either separator", () => {
    const { bis, domain } = twoSchemas();
    const pump = domain.createEntity("Pump", { baseClass: "BisCore:PhysicalElement" });
    const tank = domain.createEntity("Tank", { baseClass: "BisCore.PhysicalElement" });

    expect(pump.getBaseClass()).to.equal(bis.getItem("PhysicalElement"));
    expect(tank.getBaseClass()).to.equal(bis.getItem("PhysicalElement"));
  });

  it("resolves an alias-qualified reference through the document's reference list", () => {
    const { bis, domain } = twoSchemas();
    const pump = domain.createEntity("Pump", { baseClass: "bis:PhysicalElement" });

    expect(pump.getBaseClass()).to.equal(bis.getItem("PhysicalElement"));
    expect(domain.resolveSchemaName("bis:PhysicalElement")).to.equal("BisCore");
  });

  it("returns undefined for a reference the set cannot satisfy", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    const pump = doc.createEntity("Pump", { baseClass: "BisCore:PhysicalElement" });

    expect(pump.getBaseClass()).to.be.undefined;
    expect(doc.resolveDocument("BisCore:PhysicalElement")).to.be.undefined;
    expect(doc.resolveSchemaName("BisCore:PhysicalElement")).to.equal("BisCore");
  });

  it("returns undefined when the reference resolves to an item of the wrong kind", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    doc.createPropertyCategory("Thing");
    const pump = doc.createEntity("Pump", { baseClass: "Thing" });

    expect(pump.getBaseClass()).to.be.undefined;
    expect(doc.resolveItem("Thing")).to.not.be.undefined;
  });

  it("resolves every reference field", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    const category = doc.createPropertyCategory("Cat");
    const units = doc.createUnitSystem("SI");
    const phenomenon = doc.createPhenomenon("LENGTH", "LENGTH");
    const metre = doc.createUnit("M", "LENGTH", "SI", "M");
    const koq = doc.createKindOfQuantity("Flow", "M", 0.001);
    const values = doc.createEnumeration("Values", "int");
    const struct = doc.createStructClass("Detail");
    const target = doc.createEntity("Target");
    const mixin = doc.createMixin("IPump", "Target");
    const relationship = doc.createRelationship("PumpDrivesTank");
    relationship.source.set({ constraintClasses: ["Target"] });

    const pump = doc.createEntity("Pump", { mixins: ["IPump"] });
    const flow = pump.createPrimitive("FlowRate", PrimitiveType.Double, { kindOfQuantity: "Flow", category: "Cat" });
    const state = pump.createEnumeration("State", "Values");
    const detail = pump.createStruct("Detail", "Detail");
    const details = pump.createStructArray("Details", "Detail");
    const navigation = pump.createNavigation("Tank", "PumpDrivesTank", StrengthDirection.Forward);

    expect(flow.getKindOfQuantity()).to.equal(koq);
    expect(flow.getCategory()).to.equal(category);
    expect(state.getEnumeration()).to.equal(values);
    expect(detail.getStructClass()).to.equal(struct);
    expect(details.getStructClass()).to.equal(struct);
    expect(navigation.getRelationshipClass()).to.equal(relationship);
    expect(pump.getMixins()).to.deep.equal([mixin]);
    expect(mixin.getAppliesTo()).to.equal(target);
    expect(koq.getPersistenceUnit()).to.equal(metre);
    expect(metre.getPhenomenon()).to.equal(phenomenon);
    expect(metre.getUnitSystem()).to.equal(units);
    expect(relationship.source.getConstraintClasses()).to.deep.equal([target]);
  });

  it("resolves a name case-insensitively across item kinds, first declaration winning", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    const phenomenon = doc.createPhenomenon("LENGTH", "LENGTH");
    doc.createKindOfQuantity("Length", "M", 0.001);

    // EC compares item names case-insensitively across kinds, so these two collide. The document
    // keeps both and resolves the first, which is what serialization writes.
    expect(doc.resolveItem("Length")).to.equal(phenomenon);
    expect(doc.resolveItemOfType("Length", SchemaItemType.KindOfQuantity)).to.be.undefined;
  });

  it("keeps an unresolvable entry in place in a resolved list", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    const known = doc.createMixin("IKnown", "Pump");
    const pump = doc.createEntity("Pump", { mixins: ["IMissing", "IKnown"] });

    expect(pump.getMixins()).to.deep.equal([undefined, known]);
  });
});

describe("Setting references from items", () => {
  it("stores a bare name for an item of the same document", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    const base = doc.createEntity("Base");
    const derived = doc.createEntity("Derived");

    derived.setBaseClass(base);

    expect(derived.baseClass).to.equal("Base");
    expect(doc.references).to.be.empty;
  });

  it("stores a qualified name and adds the missing schema reference", () => {
    const set = new SchemaSet();
    const bis = set.createSchema("BisCore", "bis", 1, 0, 15);
    const element = bis.createEntity("PhysicalElement");
    const domain = set.createSchema("MyDomain", "md", 1, 0, 0);
    const pump = domain.createEntity("Pump");

    pump.setBaseClass(element);

    expect(pump.baseClass).to.equal("BisCore:PhysicalElement");
    expect(domain.references).to.deep.equal([{ name: "BisCore", readVersion: 1, writeVersion: 0, minorVersion: 15, alias: "bis" }]);
    expect(pump.getBaseClass()).to.equal(element);
  });

  it("leaves an existing schema reference untouched, version disagreement included", () => {
    const set = new SchemaSet();
    const bis = set.createSchema("BisCore", "bis", 1, 0, 15);
    const element = bis.createEntity("PhysicalElement");
    const domain = set.createSchema("MyDomain", "md", 1, 0, 0, {
      references: [{ name: "BisCore", readVersion: 1, writeVersion: 0, minorVersion: 0, alias: "bisCore" }],
    });

    domain.createEntity("Pump").setBaseClass(element);

    expect(domain.references).to.have.lengthOf(1);
    expect(domain.references[0].minorVersion).to.equal(0);
    expect(domain.references[0].alias).to.equal("bisCore");
  });

  it("accepts an item from another schema set", () => {
    const foreign = new SchemaDocument("BisCore", "bis", 1, 0, 15);
    const element = foreign.createEntity("PhysicalElement");
    const domain = new SchemaDocument("MyDomain", "md", 1, 0, 0);

    domain.createEntity("Pump").setBaseClass(element);

    // The reference string is all that is stored, so the source set does not matter. It does not
    // resolve here, which is a validation finding rather than a setter's business.
    expect(domain.getEntity("Pump")!.baseClass).to.equal("BisCore:PhysicalElement");
    expect(domain.getEntity("Pump")!.getBaseClass()).to.be.undefined;
  });
});

describe("SchemaSet lookups", () => {
  it("finds an item by schema-qualified full name", () => {
    const { set, documents } = makeSet("BisCore");
    const element = documents[0].createEntity("Element");

    expect(set.getItem("BisCore:Element")).to.equal(element);
    expect(set.getItem("biscore.element")).to.equal(element);
    expect(set.getItem("Element")).to.be.undefined;
    expect(set.getItem("Missing:Element")).to.be.undefined;
  });

  it("narrows a resolved item by kind", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    const pump = doc.createEntity("Pump");

    expect(doc.resolveItemOfType("Pump", SchemaItemType.EntityClass)).to.equal(pump);
    expect(doc.resolveItemOfType("Pump", SchemaItemType.StructClass)).to.be.undefined;
  });
});
