/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { CustomAttributeContainerType, PrimitiveType } from "../../ECObjects";
import { AnyProperty, ECClass, SchemaDocument, SchemaSet } from "../../Authoring/SchemaDocument";

function names(properties: ReadonlyArray<AnyProperty>): string[] {
  return properties.map((p) => p.name);
}

/** The declaring class of each expanded property, which is what says where it came from. */
function origins(properties: ReadonlyArray<AnyProperty>): string[] {
  return properties.map((p) => `${p.declaringClass.name}.${p.name}`);
}

function addStrings(cls: ECClass, ...propertyNames: string[]): void {
  for (const name of propertyNames)
    cls.createPrimitive(name, PrimitiveType.String);
}

describe("Property expansion - ordering", () => {
  it("walks base classes first, then mixins in declaration order, then own properties", () => {
    const set = new SchemaSet();
    const bis = set.createSchema("BisCore", "bis", 1, 0, 15);
    const element = bis.createEntity("Element");
    addStrings(element, "CodeValue");
    const physical = bis.createEntity("PhysicalElement", { baseClass: "Element" });
    addStrings(physical, "Category");

    const domain = set.createSchema("MyDomain", "md", 1, 0, 0, {
      references: [{ name: "BisCore", readVersion: 1, writeVersion: 0, minorVersion: 15, alias: "bis" }],
    });
    const serviceable = domain.createMixin("IServiceable", "bis:PhysicalElement");
    addStrings(serviceable, "LastServiced");
    const tagged = domain.createMixin("ITagged", "bis:PhysicalElement");
    addStrings(tagged, "Tag");
    const pump = domain.createEntity("Pump", { baseClass: "bis:PhysicalElement", mixins: ["IServiceable", "ITagged"] });
    addStrings(pump, "FlowRate");

    expect(names(pump.getExpandedProperties())).to.deep.equal([
      "CodeValue", "Category", "LastServiced", "Tag", "FlowRate",
    ]);
    expect(pump.getExpandedProperty("codevalue")!.declaringClass).to.equal(element);
    expect(pump.getProperty("CodeValue")).to.be.undefined;
  });

  it("moves an override to the overriding class's own position", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    const base = doc.createEntity("Base");
    addStrings(base, "Name", "Tail");
    const derived = doc.createEntity("Derived", { baseClass: "Base" });
    const override = derived.createPrimitive("Name", PrimitiveType.String, { label: "Overridden" });

    const expanded = derived.getExpandedProperties();
    expect(names(expanded)).to.deep.equal(["Tail", "Name"]);
    expect(expanded[1]).to.equal(override);
  });

  it("takes the derived class's order when it declares the same properties reordered", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    const base = doc.createEntity("Base");
    addStrings(base, "A", "B", "C");
    const derived = doc.createEntity("Derived", { baseClass: "Base" });
    addStrings(derived, "C", "B", "A");

    expect(names(derived.getExpandedProperties())).to.deep.equal(["C", "B", "A"]);
    expect(origins(derived.getExpandedProperties())).to.deep.equal(["Derived.C", "Derived.B", "Derived.A"]);
  });

  it("orders a four-level hierarchy root first", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    const root = doc.createEntity("Root");
    addStrings(root, "R1", "R2");
    const middle = doc.createEntity("Middle", { baseClass: "Root" });
    addStrings(middle, "M1");
    const lower = doc.createEntity("Lower", { baseClass: "Middle" });
    addStrings(lower, "L1", "L2");
    const leaf = doc.createEntity("Leaf", { baseClass: "Lower" });
    addStrings(leaf, "F1");

    expect(names(leaf.getExpandedProperties())).to.deep.equal(["R1", "R2", "M1", "L1", "L2", "F1"]);
  });

  it("expands a struct class hierarchy", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    const base = doc.createStructClass("BaseStruct");
    addStrings(base, "A");
    const derived = doc.createStructClass("DerivedStruct", { baseClass: "BaseStruct" });
    addStrings(derived, "B");

    expect(names(derived.getExpandedProperties())).to.deep.equal(["A", "B"]);
  });

  it("expands a relationship class hierarchy", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    const base = doc.createRelationship("BaseRel");
    addStrings(base, "A");
    const derived = doc.createRelationship("DerivedRel", { baseClass: "BaseRel" });
    addStrings(derived, "B");

    expect(names(derived.getExpandedProperties())).to.deep.equal(["A", "B"]);
  });

  it("expands a custom attribute class hierarchy", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    const base = doc.createCustomAttributeClass("BaseCA", CustomAttributeContainerType.Any);
    addStrings(base, "A");
    const derived = doc.createCustomAttributeClass("DerivedCA", CustomAttributeContainerType.Any, { baseClass: "BaseCA" });
    addStrings(derived, "B");

    expect(names(derived.getExpandedProperties())).to.deep.equal(["A", "B"]);
  });
});

describe("Property expansion - the native multi-branch fixture", () => {
  /** Adapted from imodel-native's ECClassTests property-ordering test, which is the closest thing to
   * a specification of multi-branch expansion that exists. Native's `mn` has two direct base
   * classes; EC 3 allows one entity base plus mixins, so one branch is the base chain and the other
   * is a mixin chain. The override case asserts native's own answer: the six overridden names move
   * to the end, in `mn`'s declaration order. */
  function buildFixture(): { mn: ECClass, addOverrides: () => void } {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    const ab = doc.createMixin("ab", "ef");
    addStrings(ab, "a", "b");
    const cd = doc.createMixin("cd", "ef");
    addStrings(cd, "c", "d");
    const ef = doc.createEntity("ef", { mixins: ["ab", "cd"] });
    addStrings(ef, "e", "f");
    const gh = doc.createMixin("gh", "mn");
    addStrings(gh, "g", "h");
    const ij = doc.createMixin("ij", "mn", { baseClass: "gh" });
    addStrings(ij, "i", "j");
    const mn = doc.createEntity("mn", { baseClass: "ef", mixins: ["ij"] });
    addStrings(mn, "m", "n");

    return { mn, addOverrides: () => addStrings(mn, "b", "d", "f", "h", "j") };
  }

  it("orders a two-branch hierarchy a through n", () => {
    const { mn } = buildFixture();
    expect(names(mn.getExpandedProperties())).to.deep.equal(
      ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "m", "n"],
    );
  });

  it("moves the leaf's five overrides to the end, in the leaf's declaration order", () => {
    const { mn, addOverrides } = buildFixture();
    addOverrides();

    const expanded = mn.getExpandedProperties();
    expect(names(expanded)).to.deep.equal(
      ["a", "c", "e", "g", "i", "m", "n", "b", "d", "f", "h", "j"],
    );
    for (const overridden of ["b", "d", "f", "h", "j"])
      expect(mn.getExpandedProperty(overridden)!.declaringClass, overridden).to.equal(mn);
  });
});

describe("Property expansion - collisions between branches", () => {
  it("lets the base class win over a mixin declaring the same name", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    const base = doc.createEntity("Base");
    addStrings(base, "Shared");
    const mixin = doc.createMixin("IShared", "Base");
    addStrings(mixin, "Shared");
    const derived = doc.createEntity("Derived", { baseClass: "Base", mixins: ["IShared"] });

    const expanded = derived.getExpandedProperties();
    expect(origins(expanded)).to.deep.equal(["Base.Shared"]);
    expect(derived.getExpandedProperty("Shared")!.declaringClass).to.equal(base);
  });

  it("lets the first mixin win over a later one declaring the same name", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    doc.createEntity("Host");
    const first = doc.createMixin("IFirst", "Host");
    addStrings(first, "Shared");
    const second = doc.createMixin("ISecond", "Host");
    addStrings(second, "Shared");
    const derived = doc.createEntity("Derived", { baseClass: "Host", mixins: ["IFirst", "ISecond"] });

    expect(origins(derived.getExpandedProperties())).to.deep.equal(["IFirst.Shared"]);
    expect(derived.getExpandedProperty("Shared")!.declaringClass).to.equal(first);
    expect(second.getProperty("Shared")).to.not.be.undefined;
  });

  it("lets a mixin override a property it inherits from its own base mixin", () => {
    // SchemaView gets this one wrong: it inserts a mixin's own properties only when the name is not
    // already present, which lets the base mixin's declaration beat the derived mixin's override.
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    doc.createEntity("Host");
    const baseMixin = doc.createMixin("IBase", "Host");
    addStrings(baseMixin, "Shared");
    const derivedMixin = doc.createMixin("IDerived", "Host", { baseClass: "IBase" });
    addStrings(derivedMixin, "Shared");
    const entity = doc.createEntity("Entity", { baseClass: "Host", mixins: ["IDerived"] });

    expect(origins(entity.getExpandedProperties())).to.deep.equal(["IDerived.Shared"]);
    expect(entity.getExpandedProperty("Shared")!.declaringClass).to.equal(derivedMixin);
  });

  it("yields a mixin reached through two paths once", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    doc.createEntity("Host");
    const shared = doc.createMixin("IShared", "Host");
    addStrings(shared, "SharedProp");
    const base = doc.createEntity("Base", { baseClass: "Host", mixins: ["IShared"] });
    addStrings(base, "BaseProp");
    const derived = doc.createEntity("Derived", { baseClass: "Base", mixins: ["IShared"] });

    expect(names(derived.getExpandedProperties())).to.deep.equal(["SharedProp", "BaseProp"]);
  });

  it("treats a case-only name difference as the same property", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    const base = doc.createEntity("Base");
    addStrings(base, "Name");
    const derived = doc.createEntity("Derived", { baseClass: "Base" });
    const override = derived.createPrimitive("NAME", PrimitiveType.String);

    const expanded = derived.getExpandedProperties();
    expect(expanded).to.have.lengthOf(1);
    expect(expanded[0]).to.equal(override);
    expect(derived.getExpandedProperty("nAmE")).to.equal(override);
  });
});

describe("Property expansion - raw and unvalidated", () => {
  it("returns a primitive property overriding a struct property without complaint", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    doc.createStructClass("Point");
    const base = doc.createEntity("Base");
    base.createStruct("Location", "Point");
    const derived = doc.createEntity("Derived", { baseClass: "Base" });
    const override = derived.createPrimitive("Location", PrimitiveType.String);

    const expanded = derived.getExpandedProperties();
    expect(expanded).to.deep.equal([override]);
    expect(expanded[0].isPrimitive()).to.be.true;
    expect(override.getBaseProperty()!.isStruct()).to.be.true;
  });

  it("returns a property overriding one of a different primitive type without complaint", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    const base = doc.createEntity("Base");
    base.createPrimitive("Count", PrimitiveType.Integer);
    const derived = doc.createEntity("Derived", { baseClass: "Base" });
    const override = derived.createPrimitive("Count", PrimitiveType.String);

    expect(derived.getExpandedProperties()).to.deep.equal([override]);
  });
});

describe("Property expansion - resilience", () => {
  it("skips a base class the schema set cannot resolve", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    const pump = doc.createEntity("Pump", { baseClass: "BisCore:PhysicalElement" });
    addStrings(pump, "FlowRate");

    expect(names(pump.getExpandedProperties())).to.deep.equal(["FlowRate"]);
    expect(pump.getExpandedProperty("FlowRate")).to.not.be.undefined;
    expect(pump.getExpandedProperty("CodeValue")).to.be.undefined;
  });

  it("skips a mixin the schema set cannot resolve and keeps the ones it can", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    doc.createEntity("Host");
    const known = doc.createMixin("IKnown", "Host");
    addStrings(known, "Known");
    const pump = doc.createEntity("Pump", { baseClass: "Host", mixins: ["Missing:IGone", "IKnown"] });
    addStrings(pump, "FlowRate");

    expect(names(pump.getExpandedProperties())).to.deep.equal(["Known", "FlowRate"]);
  });

  it("terminates on a base class cycle", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    const first = doc.createEntity("First", { baseClass: "Second" });
    addStrings(first, "A");
    const second = doc.createEntity("Second", { baseClass: "First" });
    addStrings(second, "B");

    expect(names(first.getExpandedProperties())).to.deep.equal(["B", "A"]);
    expect(first.getExpandedProperty("A")!.declaringClass).to.equal(first);
    expect(first.getExpandedProperty("B")!.declaringClass).to.equal(second);
    expect(first.getExpandedProperty("Absent")).to.be.undefined;
  });

  it("terminates on a mixin cycle", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    doc.createEntity("Host");
    const first = doc.createMixin("IFirst", "Host", { baseClass: "ISecond" });
    addStrings(first, "A");
    doc.createMixin("ISecond", "Host", { baseClass: "IFirst" });
    const entity = doc.createEntity("Entity", { baseClass: "Host", mixins: ["IFirst"] });

    expect(names(entity.getExpandedProperties())).to.deep.equal(["A"]);
    expect(first.getExpandedProperty("A")).to.not.be.undefined;
  });
});

describe("Property expansion - lookup agrees with the list", () => {
  it("finds the same property the list yields, for every name in a mixed hierarchy", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    const root = doc.createEntity("Root");
    addStrings(root, "R", "Shared");
    const mixin = doc.createMixin("IMixin", "Root");
    addStrings(mixin, "M", "Shared");
    const middle = doc.createEntity("Middle", { baseClass: "Root", mixins: ["IMixin"] });
    addStrings(middle, "Mid", "R");
    const leaf = doc.createEntity("Leaf", { baseClass: "Middle" });
    addStrings(leaf, "Leaf", "Shared");

    for (const property of leaf.getExpandedProperties())
      expect(leaf.getExpandedProperty(property.name), property.name).to.equal(property);
  });

  it("prefers this class's own property over anything inherited", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    const base = doc.createEntity("Base");
    addStrings(base, "Name");
    const derived = doc.createEntity("Derived", { baseClass: "Base" });
    const own = derived.createPrimitive("Name", PrimitiveType.String);

    expect(derived.getExpandedProperty("Name")).to.equal(own);
    expect(derived.getProperty("Name")).to.equal(own);
  });
});

describe("Property.getBaseProperty", () => {
  it("returns undefined for a property no ancestor declares", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    const base = doc.createEntity("Base");
    addStrings(base, "Name");
    const derived = doc.createEntity("Derived", { baseClass: "Base" });
    const own = derived.createPrimitive("Fresh", PrimitiveType.String);

    expect(own.getBaseProperty()).to.be.undefined;
    expect(base.getProperty("Name")!.getBaseProperty()).to.be.undefined;
  });

  it("chains through three levels to the declaration that introduced the name", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    const root = doc.createEntity("Root");
    const rootProperty = root.createPrimitive("Name", PrimitiveType.String, { label: "Root" });
    const middle = doc.createEntity("Middle", { baseClass: "Root" });
    const middleProperty = middle.createPrimitive("Name", PrimitiveType.String, { label: "Middle" });
    const leaf = doc.createEntity("Leaf", { baseClass: "Middle" });
    const leafProperty = leaf.createPrimitive("Name", PrimitiveType.String, { label: "Leaf" });

    expect(leafProperty.getBaseProperty()).to.equal(middleProperty);
    expect(leafProperty.getBaseProperty()!.getBaseProperty()).to.equal(rootProperty);
    expect(leafProperty.getBaseProperty()!.getBaseProperty()!.getBaseProperty()).to.be.undefined;
  });

  it("skips a level that does not redeclare the name", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    const root = doc.createEntity("Root");
    const rootProperty = root.createPrimitive("Name", PrimitiveType.String);
    doc.createEntity("Middle", { baseClass: "Root" });
    const leaf = doc.createEntity("Leaf", { baseClass: "Middle" });
    const leafProperty = leaf.createPrimitive("Name", PrimitiveType.String);

    expect(leafProperty.getBaseProperty()).to.equal(rootProperty);
  });

  it("finds a base property declared on a mixin", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    doc.createEntity("Host");
    const mixin = doc.createMixin("IMixin", "Host");
    const mixinProperty = mixin.createPrimitive("Name", PrimitiveType.String);
    const entity = doc.createEntity("Entity", { baseClass: "Host", mixins: ["IMixin"] });
    const own = entity.createPrimitive("Name", PrimitiveType.String);

    expect(own.getBaseProperty()).to.equal(mixinProperty);
  });

  it("prefers the base class over a mixin declaring the same name", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    const base = doc.createEntity("Base");
    const baseProperty = base.createPrimitive("Name", PrimitiveType.String);
    const mixin = doc.createMixin("IMixin", "Base");
    mixin.createPrimitive("Name", PrimitiveType.String);
    const derived = doc.createEntity("Derived", { baseClass: "Base", mixins: ["IMixin"] });
    const own = derived.createPrimitive("Name", PrimitiveType.String);

    expect(own.getBaseProperty()).to.equal(baseProperty);
  });

  it("returns undefined when the base class does not resolve", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    const pump = doc.createEntity("Pump", { baseClass: "BisCore:PhysicalElement" });
    const own = pump.createPrimitive("CodeValue", PrimitiveType.String);

    expect(own.getBaseProperty()).to.be.undefined;
  });

  it("follows the class the property was moved into, since nothing is stored on the property", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    const base = doc.createEntity("Base");
    const baseProperty = base.createPrimitive("Name", PrimitiveType.String);
    const unrelated = doc.createEntity("Unrelated");
    const property = unrelated.createPrimitive("Name", PrimitiveType.String);
    expect(property.getBaseProperty()).to.be.undefined;

    const derived = doc.createEntity("Derived", { baseClass: "Base" });
    derived.movePropertyIn(property);

    expect(property.getBaseProperty()).to.equal(baseProperty);
  });

  it("follows a base class changed after the property was created", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    const first = doc.createEntity("First");
    const firstProperty = first.createPrimitive("Name", PrimitiveType.String);
    const second = doc.createEntity("Second");
    const secondProperty = second.createPrimitive("Name", PrimitiveType.String);
    const derived = doc.createEntity("Derived", { baseClass: "First" });
    const own = derived.createPrimitive("Name", PrimitiveType.String);
    expect(own.getBaseProperty()).to.equal(firstProperty);

    derived.setBaseClass(second);

    expect(own.getBaseProperty()).to.equal(secondProperty);
  });
});
