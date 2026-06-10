/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import {
  AbstractSchemaItemType, CustomAttributeContainerType, ECClassModifier, PrimitiveType, PropertyKind,
  RelationshipEnd, SchemaItemType, SchemaMatchType, StrengthDirection, StrengthType,
} from "../../ECObjects";
import { Authoring, SchemaDocument } from "../../Authoring/SchemaDocument";

describe("SchemaDocument", () => {
  describe("construction / version", () => {
    it("captures the envelope and the numeric version", () => {
      const doc = new SchemaDocument("MyDomain", "md", 1, 2, 3, {
        label: "My Domain", description: "desc",
        references: [{ name: "BisCore", readVersion: 1, writeVersion: 0, minorVersion: 0, alias: "bis" }],
      });
      expect(doc.name).to.equal("MyDomain");
      expect(doc.alias).to.equal("md");
      expect(doc.readVersion).to.equal(1);
      expect(doc.writeVersion).to.equal(2);
      expect(doc.minorVersion).to.equal(3);
      expect(doc.label).to.equal("My Domain");
      expect(doc.description).to.equal("desc");
      expect(doc.references).to.have.lengthOf(1);
      expect(doc.references[0].name).to.equal("BisCore");
    });

    it("records the deserialization source as plain data", () => {
      expect(new SchemaDocument("S", "s", 1, 0, 0, { source: "/tmp/S.ecschema.xml" }).source).to.equal("/tmp/S.ecschema.xml");
      expect(new SchemaDocument("S", "s", 1, 0, 0).source).to.be.undefined;
    });

    it("treats the original EC XML version as an optional origin hint", () => {
      expect(new SchemaDocument("S", "s", 1, 0, 0).originalECXmlVersionMajor).to.be.undefined; // in memory -> latest
      const fromXml = new SchemaDocument("S", "s", 1, 0, 0, { originalECXmlVersionMajor: 3, originalECXmlVersionMinor: 2 });
      expect(fromXml.originalECXmlVersionMajor).to.equal(3);
      expect(fromXml.originalECXmlVersionMinor).to.equal(2);
    });

    it("derives a SchemaKey for matching / comparing", () => {
      const doc = new SchemaDocument("MyDomain", "md", 1, 2, 3);
      expect(doc.key.name).to.equal("MyDomain");
      expect(doc.key.toString()).to.equal("MyDomain.01.02.03");
      doc.minorVersion++; // digits stay the source of truth; the key reflects the edit
      expect(doc.key.minorVersion).to.equal(4);
      expect(doc.key.matches(doc.key, SchemaMatchType.Exact)).to.be.true;
    });

    it("the key getter is the one throwing spot: out-of-range version digits are held, but not representable as a key", () => {
      const doc = new SchemaDocument("S", "s", 1, 0, 0);
      doc.readVersion = 1000; // beyond ECVersion's range; the validity-free document holds it anyway
      expect(doc.readVersion).to.equal(1000);
      expect(() => doc.key).to.throw();

      doc.readVersion = 1;
      doc.minorVersion = -1;
      expect(() => doc.key).to.throw();
    });
  });

  describe("references", () => {
    it("setSchemaReference adds from a held document, copying identity and alias", () => {
      const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
      const other = new SchemaDocument("Other", "ot", 2, 3, 4);

      const ref = doc.setSchemaReference(other);
      expect(doc.references).to.deep.equal([{ name: "Other", readVersion: 2, writeVersion: 3, minorVersion: 4, alias: "ot" }]);
      expect(ref).to.equal(doc.references[0]);
      expect(doc.references[0]).to.not.equal(other); // copied, never the document itself
    });

    it("setSchemaReference replaces an existing reference of the same name (case-insensitive)", () => {
      const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0, {
        references: [{ name: "Other", readVersion: 1, writeVersion: 0, minorVersion: 0, alias: "old" }],
      });
      const newer = new SchemaDocument("OTHER", "ot", 2, 0, 0);

      doc.setSchemaReference(newer);
      expect(doc.references).to.have.lengthOf(1); // replaced, not appended
      expect(doc.references[0]).to.deep.equal({ name: "OTHER", readVersion: 2, writeVersion: 0, minorVersion: 0, alias: "ot" });
    });

    it("setSchemaReference copies an explicit SchemaReference, preserving a null alias", () => {
      const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
      const ref: Authoring.SchemaReference = { name: "Other", readVersion: 1, writeVersion: 2, minorVersion: 3, alias: null };
      const stored = doc.setSchemaReference(ref);
      expect(stored).to.deep.equal(ref);
      expect(stored).to.not.equal(ref); // a copy; later caller-side mutation does not leak in
    });

    it("setSchemaReference accepts any structural source (e.g. a SchemaView Schema)", () => {
      const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
      // A plain object standing in for a SchemaView `Schema` flyweight - same member shape.
      const viewSchema = { name: "Other", alias: "ot", readVersion: 3, writeVersion: 1, minorVersion: 0 };

      doc.setSchemaReference(viewSchema);
      expect(doc.references[0]).to.deep.equal({ name: "Other", readVersion: 3, writeVersion: 1, minorVersion: 0, alias: "ot" });
    });

    it("getSchemaReference reads back by name, case-insensitively", () => {
      const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0, {
        references: [{ name: "BisCore", readVersion: 1, writeVersion: 0, minorVersion: 0, alias: "bis" }],
      });
      expect(doc.getSchemaReference("biscore")).to.equal(doc.references[0]);
      expect(doc.getSchemaReference("Missing")).to.be.undefined;
    });

    it("replacing a reference keeps its position in declaration order", () => {
      const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0, {
        references: [
          { name: "BisCore", readVersion: 1, writeVersion: 0, minorVersion: 0, alias: "bis" },
          { name: "AecUnits", readVersion: 1, writeVersion: 0, minorVersion: 0, alias: "AECU" },
        ],
      });
      doc.setSchemaReference({ name: "BisCore", readVersion: 1, writeVersion: 0, minorVersion: 5, alias: "bis" });
      expect(doc.references.map((r) => r.name)).to.deep.equal(["BisCore", "AecUnits"]);
      expect(doc.references[0].minorVersion).to.equal(5);
    });

    it("duplicate names in init.references collapse to one entry, last wins", () => {
      const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0, {
        references: [
          { name: "BisCore", readVersion: 1, writeVersion: 0, minorVersion: 0, alias: "bis" },
          { name: "BISCORE", readVersion: 1, writeVersion: 0, minorVersion: 9, alias: "bis" },
        ],
      });
      expect(doc.references).to.have.lengthOf(1);
      expect(doc.references[0].minorVersion).to.equal(9);
    });
  });

  describe("items / typed accessors", () => {
    it("createEntity constructs, appends, and returns the handle", () => {
      const doc = new SchemaDocument("S", "s", 1, 0, 0);
      const widget = doc.createEntity("Widget", { label: "Widget", description: "d", modifier: ECClassModifier.Abstract });

      expect(widget.schemaItemType).to.equal(SchemaItemType.EntityClass);
      expect(widget.modifier).to.equal(ECClassModifier.Abstract);
      expect(doc.getEntity("widget")).to.equal(widget); // case-insensitive
      expect(doc.getItem("Widget")).to.equal(widget);
      expect([...doc.getEntities()]).to.deep.equal([widget]);
      expect(doc.items).to.have.lengthOf(1);
    });

    it("also supports direct construction + push (the power path)", () => {
      const doc = new SchemaDocument("S", "s", 1, 0, 0);
      const widget = new Authoring.EntityClass("Widget");
      doc.items.push(widget);
      expect(doc.getEntity("Widget")).to.equal(widget);
    });

    it("getItemOfType narrows by kind and returns undefined for a mismatched kind", () => {
      const doc = new SchemaDocument("S", "s", 1, 0, 0);
      const cat = doc.createPropertyCategory("Cat");
      doc.createEntity("Widget");
      expect(doc.getItemOfType("Cat", SchemaItemType.PropertyCategory)).to.equal(cat);
      expect(doc.getItemOfType("Cat", SchemaItemType.EntityClass)).to.be.undefined; // wrong kind
      expect(doc.getItemOfType("Missing", SchemaItemType.EntityClass)).to.be.undefined; // no such name
    });

    it("getItemsOfType iterates one kind in declaration order", () => {
      const doc = new SchemaDocument("S", "s", 1, 0, 0);
      doc.createEntity("A");
      doc.createStructClass("S1");
      doc.createEntity("B");
      expect([...doc.getItemsOfType(SchemaItemType.EntityClass)].map((e) => e.name)).to.deep.equal(["A", "B"]);
      expect([...doc.getItemsOfType(SchemaItemType.StructClass)].map((s) => s.name)).to.deep.equal(["S1"]);
    });

    it("the Class grouping matches any class kind, but not a non-class item", () => {
      const doc = new SchemaDocument("S", "s", 1, 0, 0);
      const widget = doc.createEntity("Widget");
      doc.createPropertyCategory("Cat");

      expect(doc.getItemOfType("Widget", AbstractSchemaItemType.Class)).to.equal(widget);
      expect(doc.getItemOfType("Cat", AbstractSchemaItemType.Class)).to.be.undefined; // PropertyCategory is not a class
    });

    it("getItemsOfType over the Class grouping yields every class kind in declaration order", () => {
      const doc = new SchemaDocument("S", "s", 1, 0, 0);
      doc.createEntity("E");
      doc.createPropertyCategory("Cat"); // not a class - excluded
      doc.createStructClass("S1");
      doc.createMixin("M", "S:E");

      expect([...doc.getItemsOfType(AbstractSchemaItemType.Class)].map((c) => c.name)).to.deep.equal(["E", "S1", "M"]);
      expect([...doc.getItemsOfType(AbstractSchemaItemType.SchemaItem)].map((i) => i.name)).to.deep.equal(["E", "Cat", "S1", "M"]);
    });

    it("splits base class and mixins, set inline or after", () => {
      const e = new Authoring.EntityClass("E", { baseClass: "BisCore:PhysicalElement", mixins: ["MyDomain:IMixin"] });
      e.mixins.push("Other:Thing");
      expect(e.baseClass).to.equal("BisCore:PhysicalElement");
      expect(e.mixins).to.deep.equal(["MyDomain:IMixin", "Other:Thing"]);
    });

    it("defaults entity modifier to None and leaves baseClass / mixins empty", () => {
      const e = new Authoring.EntityClass("E");
      expect(e.modifier).to.equal(ECClassModifier.None);
      expect(e.baseClass).to.be.undefined;
      expect(e.mixins).to.deep.equal([]);
    });

    it("removeItem removes by name (case-insensitive) and returns the item", () => {
      const doc = new SchemaDocument("S", "s", 1, 0, 0);
      const widget = doc.createEntity("Widget");
      doc.createEntity("Other");

      expect(doc.removeItem("WIDGET")).to.equal(widget);
      expect(doc.items.map((i) => i.name)).to.deep.equal(["Other"]);
      expect(doc.removeItem("Missing")).to.be.undefined;
    });

    it("duplicate item names are tolerated; every name lookup is first-occurrence", () => {
      // The validity-free stance: duplicates are a compile diagnostic, never an edit-time rejection.
      const doc = new SchemaDocument("S", "s", 1, 0, 0);
      const first = doc.createEntity("Foo");
      const second = doc.createEnumeration("FOO", "int"); // same folded name, different kind - accepted
      expect(doc.items).to.have.lengthOf(2);

      expect(doc.getItem("foo")).to.equal(first);
      // getItemOfType resolves the name first (first occurrence), then checks the kind - it does NOT
      // scan on for a later same-named item of the requested kind. Keeps behavior consistent with a
      // future name -> firstIndex lookup map.
      expect(doc.getItemOfType("Foo", SchemaItemType.Enumeration)).to.be.undefined;
      expect(doc.getItemOfType("Foo", SchemaItemType.EntityClass)).to.equal(first);
      // Kind-filtered iteration still reaches the shadowed duplicate.
      expect([...doc.getItemsOfType(SchemaItemType.Enumeration)]).to.deep.equal([second]);

      // removeItem peels the first occurrence only.
      expect(doc.removeItem("foo")).to.equal(first);
      expect(doc.getItem("foo")).to.equal(second);
    });

    it("init arrays are copied, not aliased", () => {
      const mixins = ["MyDomain:IMixin"];
      const e = new Authoring.EntityClass("E", { mixins });
      mixins.push("Other:Thing"); // caller-side mutation after construction
      expect(e.mixins).to.deep.equal(["MyDomain:IMixin"]);

      const presentationFormats = ["Formats:DefaultReal"];
      const koq = new Authoring.KindOfQuantity("Len", "Units:M", 0.001, { presentationFormats });
      presentationFormats.push("Formats:AmerFI");
      expect(koq.presentationFormats).to.deep.equal(["Formats:DefaultReal"]);
    });
  });

  describe("class kinds", () => {
    it("creates a mixin: appliesTo mandatory, abstract by default, overridable", () => {
      const doc = new SchemaDocument("S", "s", 1, 0, 0);
      const mixin = doc.createMixin("IMixin", "BisCore:Element");
      expect(mixin.schemaItemType).to.equal(SchemaItemType.Mixin);
      expect(mixin.appliesTo).to.equal("BisCore:Element");
      expect(mixin.modifier).to.equal(ECClassModifier.Abstract); // default for a mixin
      expect(doc.createMixin("Other", "BisCore:Element", { modifier: ECClassModifier.None }).modifier).to.equal(ECClassModifier.None);
    });

    it("creates a struct class (no extra fields, inherits ECClass)", () => {
      const s = new SchemaDocument("S", "s", 1, 0, 0).createStructClass("Point", { description: "a point" });
      expect(s.schemaItemType).to.equal(SchemaItemType.StructClass);
      expect(s.description).to.equal("a point");
    });

    it("creates a custom attribute class with a container-type bitmask", () => {
      const ca = new SchemaDocument("S", "s", 1, 0, 0).createCustomAttributeClass(
        "MyCa", CustomAttributeContainerType.AnyClass | CustomAttributeContainerType.Schema,
      );
      expect(ca.schemaItemType).to.equal(SchemaItemType.CustomAttributeClass);
      expect(ca.appliesTo & CustomAttributeContainerType.Schema).to.not.equal(0);
      expect(ca.appliesTo & CustomAttributeContainerType.EntityClass).to.not.equal(0);
      expect(ca.appliesTo & CustomAttributeContainerType.PrimitiveProperty).to.equal(0);
    });

    it("creates a relationship: strength / direction defaults and two empty constraints", () => {
      const rel = new SchemaDocument("S", "s", 1, 0, 0).createRelationship("ElementOwnsChildren");
      expect(rel.schemaItemType).to.equal(SchemaItemType.RelationshipClass);
      expect(rel.strength).to.equal(StrengthType.Referencing);
      expect(rel.strengthDirection).to.equal(StrengthDirection.Forward);
      expect(rel.source.relationshipEnd).to.equal(RelationshipEnd.Source);
      expect(rel.target.relationshipEnd).to.equal(RelationshipEnd.Target);
      expect(rel.source.multiplicity).to.equal("(0..*)");
      expect(rel.source.polymorphic).to.be.true;

      rel.source.constraintClasses.push("BisCore:Element");
      rel.target.multiplicity = "(0..1)";
      rel.target.roleLabel = "is owned by";
      rel.target.constraintClasses.push("BisCore:Element");
      expect(rel.source.constraintClasses).to.deep.equal(["BisCore:Element"]);
      expect(rel.target.multiplicity).to.equal("(0..1)");
    });

    it("relationship init overrides strength and direction", () => {
      const rel = new Authoring.RelationshipClass("R", {
        strength: StrengthType.Embedding, strengthDirection: StrengthDirection.Backward,
      });
      expect(rel.strength).to.equal(StrengthType.Embedding);
      expect(rel.strengthDirection).to.equal(StrengthDirection.Backward);
    });
  });

  describe("referenced item kinds", () => {
    it("creates an enumeration with enumerators", () => {
      const doc = new SchemaDocument("S", "s", 1, 0, 0);
      const color = doc.createEnumeration("Color", "int", { isStrict: false });
      expect(color.schemaItemType).to.equal(SchemaItemType.Enumeration);
      expect(color.backingType).to.equal("int");
      expect(color.isStrict).to.be.false;

      const red = color.createEnumerator("Red", 1, { label: "Red" });
      color.createEnumerator("Green", 2);
      expect(color.enumerators).to.have.lengthOf(2);
      expect(red.label).to.equal("Red");
      expect(color.enumerators.map((e) => e.value)).to.deep.equal([1, 2]);
    });

    it("defaults an enumeration to strict", () => {
      expect(new Authoring.Enumeration("E", "string").isStrict).to.be.true;
    });

    it("getEnumerator reads back by name, case-insensitively", () => {
      const color = new Authoring.Enumeration("Color", "int");
      const red = color.createEnumerator("Red", 1);
      expect(color.getEnumerator("RED")).to.equal(red);
      expect(color.getEnumerator("Blue")).to.be.undefined;
    });

    it("an enumerator value mismatching the backing type is tolerated (a compile diagnostic, not an edit error)", () => {
      const color = new Authoring.Enumeration("Color", "int");
      const odd = color.createEnumerator("Odd", "not-an-int");
      expect(odd.value).to.equal("not-an-int");
    });

    it("creates a kind of quantity: persistenceUnit and relativeError mandatory, formats appended", () => {
      const koq = new SchemaDocument("S", "s", 1, 0, 0).createKindOfQuantity("Length", "Units:M", 0.001, {
        presentationFormats: ["Formats:DefaultReal", "Formats:AmerFI"],
      });
      expect(koq.schemaItemType).to.equal(SchemaItemType.KindOfQuantity);
      expect(koq.persistenceUnit).to.equal("Units:M");
      expect(koq.relativeError).to.equal(0.001);
      expect(koq.presentationFormats).to.deep.equal(["Formats:DefaultReal", "Formats:AmerFI"]);
    });

    it("creates a property category", () => {
      const cat = new SchemaDocument("S", "s", 1, 0, 0).createPropertyCategory("Core", { priority: 10 });
      expect(cat.schemaItemType).to.equal(SchemaItemType.PropertyCategory);
      expect(cat.priority).to.equal(10);
    });
  });

  describe("properties", () => {
    it("createPrimitive stores typeName from a PrimitiveType and keeps the handle", () => {
      const e = new Authoring.EntityClass("E");
      const name = e.createPrimitive("Name", PrimitiveType.String);
      const count = e.createPrimitive("Count", PrimitiveType.Integer, { priority: 50 });

      expect(name.kind).to.equal(PropertyKind.Primitive);
      expect(name.typeName).to.equal("string");
      expect(count.typeName).to.equal("int");
      expect(count.priority).to.equal(50);
      expect(e.properties).to.deep.equal([name, count]);
      expect(e.getProperty("count")).to.equal(count); // case-insensitive
    });

    it("createEnumeration stores the reference as typeName (same PrimitiveProperty storage)", () => {
      const color = new Authoring.EntityClass("E").createEnumeration("Color", "MyDomain:ColorEnum");
      expect(color.kind).to.equal(PropertyKind.Primitive);
      expect(color.typeName).to.equal("MyDomain:ColorEnum");
    });

    it("init passes every shared and primitive-specific field through", () => {
      const p = new Authoring.EntityClass("E").createPrimitive("Length", PrimitiveType.Double, {
        label: "Len", description: "d", isReadOnly: true, priority: 7,
        category: "MyDomain:Cat", kindOfQuantity: "AecUnits:LENGTH",
        extendedTypeName: "BeGuid", minValue: 0, maxValue: 100, minLength: 1, maxLength: 8,
      });
      expect(p.label).to.equal("Len");
      expect(p.description).to.equal("d");
      expect(p.isReadOnly).to.be.true;
      expect(p.priority).to.equal(7);
      expect(p.category).to.equal("MyDomain:Cat");
      expect(p.kindOfQuantity).to.equal("AecUnits:LENGTH");
      expect(p.extendedTypeName).to.equal("BeGuid");
      expect(p.minValue).to.equal(0);
      expect(p.maxValue).to.equal(100);
      expect(p.minLength).to.equal(1);
      expect(p.maxLength).to.equal(8);
    });

    it("everything is unset by default - no field invents a value", () => {
      const p = new Authoring.EntityClass("E").createPrimitive("P", PrimitiveType.String);
      expect(p.label).to.be.undefined;
      expect(p.description).to.be.undefined;
      expect(p.isReadOnly).to.be.undefined;
      expect(p.priority).to.be.undefined;
      expect(p.category).to.be.undefined;
      expect(p.kindOfQuantity).to.be.undefined;
      expect(p.extendedTypeName).to.be.undefined;
      expect(p.minValue).to.be.undefined;
      expect(p.customAttributes.size).to.equal(0);
    });

    it("createPrimitiveArray creates array properties with occurs bounds, defaulting to 0 / unbounded", () => {
      const e = new Authoring.EntityClass("E");
      const arr = e.createPrimitiveArray("Tags", PrimitiveType.String, { minOccurs: 1, maxOccurs: 5, minLength: 1, maxLength: 64 });
      expect(arr.kind).to.equal(PropertyKind.PrimitiveArray);
      expect(arr.minOccurs).to.equal(1);
      expect(arr.maxOccurs).to.equal(5);
      expect(arr.minLength).to.equal(1);
      expect(arr.maxLength).to.equal(64);

      const def = e.createPrimitiveArray("More", PrimitiveType.String);
      expect(def.minOccurs).to.equal(0);
      expect(def.maxOccurs).to.be.undefined;
    });

    it("createStruct / createStructArray reference a struct class via typeName", () => {
      const e = new Authoring.EntityClass("E");
      const at = e.createStruct("At", "MyDomain:Point");
      const many = e.createStructArray("Forces", "MyDomain:Force", { minOccurs: 1 });
      expect(at.kind).to.equal(PropertyKind.Struct);
      expect(at.typeName).to.equal("MyDomain:Point");
      expect(many.kind).to.equal(PropertyKind.StructArray);
      expect(many.typeName).to.equal("MyDomain:Force");
      expect(many.minOccurs).to.equal(1);
      expect(many.maxOccurs).to.be.undefined;
    });

    it("createNavigation captures the relationship reference and direction", () => {
      const nav = new Authoring.EntityClass("E").createNavigation("Parent", "BisCore:ElementOwnsChildElements", StrengthDirection.Backward);
      expect(nav.kind).to.equal(PropertyKind.Navigation);
      expect(nav.relationshipName).to.equal("BisCore:ElementOwnsChildElements");
      expect(nav.direction).to.equal(StrengthDirection.Backward);
    });

    it("property factories live on the shared ECClass base, so every class kind has them", () => {
      const rel = new SchemaDocument("S", "s", 1, 0, 0).createRelationship("R");
      const p = rel.createPrimitive("Note", PrimitiveType.String);
      expect(rel.getProperty("Note")).to.equal(p);
    });

    it("removeProperty removes by name (case-insensitive) and returns the property", () => {
      const e = new Authoring.EntityClass("E");
      const name = e.createPrimitive("Name", PrimitiveType.String);
      e.createPrimitive("Count", PrimitiveType.Integer);

      expect(e.removeProperty("NAME")).to.equal(name);
      expect(e.properties.map((p) => p.name)).to.deep.equal(["Count"]);
      expect(e.removeProperty("Missing")).to.be.undefined;
    });

    it("duplicate property names are tolerated; getProperty and removeProperty are first-occurrence", () => {
      const e = new Authoring.EntityClass("E");
      const first = e.createPrimitive("Twin", PrimitiveType.String);
      const second = e.createPrimitive("TWIN", PrimitiveType.Integer); // accepted; a compile diagnostic later
      expect(e.properties).to.have.lengthOf(2);
      expect(e.getProperty("twin")).to.equal(first);
      expect(e.removeProperty("twin")).to.equal(first);
      expect(e.getProperty("twin")).to.equal(second);
    });
  });

  describe("narrowing predicates and asserts", () => {
    it("item predicates narrow by kind; isClass spans every class kind", () => {
      const doc = new SchemaDocument("S", "s", 1, 0, 0);
      const entity = doc.createEntity("E");
      const mixin = doc.createMixin("M", "S:E");
      const struct = doc.createStructClass("St");
      const caClass = doc.createCustomAttributeClass("Ca", CustomAttributeContainerType.AnyClass);
      const rel = doc.createRelationship("R");
      const enumeration = doc.createEnumeration("En", "int");

      expect(entity.isEntity()).to.be.true;
      expect(entity.isMixin()).to.be.false;
      expect(mixin.isMixin()).to.be.true;
      expect(struct.isStruct()).to.be.true;
      expect(caClass.isCustomAttribute()).to.be.true;
      expect(rel.isRelationship()).to.be.true;

      expect([entity, mixin, struct, caClass, rel].every((c) => c.isClass())).to.be.true;
      expect(enumeration.isClass()).to.be.false;
      expect(enumeration.isEntity()).to.be.false;
    });

    it("item asserts pass on a match and throw with kind and name on a mismatch", () => {
      const doc = new SchemaDocument("S", "s", 1, 0, 0);
      const entity = doc.createEntity("E");
      const enumeration = doc.createEnumeration("En", "int");

      expect(() => entity.assertEntity()).to.not.throw();
      expect(() => entity.assertClass()).to.not.throw();
      expect(() => enumeration.assertEntity()).to.throw("Expected an entity class, got Enumeration for \"En\"");
      expect(() => enumeration.assertClass()).to.throw("Expected a class, got Enumeration for \"En\"");
      expect(() => entity.assertRelationship()).to.throw("Expected a relationship class, got EntityClass for \"E\"");
    });

    it("property predicates narrow by kind; isPrimitive includes primitive arrays, matching SchemaView", () => {
      const e = new Authoring.EntityClass("E");
      const prim = e.createPrimitive("P", PrimitiveType.String);
      const primArr = e.createPrimitiveArray("Pa", PrimitiveType.Integer);
      const struct = e.createStruct("S", "MyDomain:Point");
      const structArr = e.createStructArray("Sa", "MyDomain:Force");
      const nav = e.createNavigation("N", "S:R", StrengthDirection.Forward);

      expect(prim.isPrimitive()).to.be.true;
      expect(primArr.isPrimitive()).to.be.true; // arrays included
      expect(struct.isPrimitive()).to.be.false;

      expect(struct.isStruct()).to.be.true;
      expect(structArr.isStruct()).to.be.true;

      expect(primArr.isArray()).to.be.true;
      expect(structArr.isArray()).to.be.true;
      expect(prim.isArray()).to.be.false;

      expect(nav.isNavigation()).to.be.true;
      expect(nav.isPrimitive()).to.be.false;
    });

    it("isEnumeration is a lexical check: any non-keyword typeName on a primitive kind counts as an enum reference", () => {
      const e = new Authoring.EntityClass("E");
      expect(e.createPrimitive("P", PrimitiveType.String).isEnumeration()).to.be.false;
      expect(new Authoring.PrimitiveProperty("Kw", "String").isEnumeration()).to.be.false; // keyword match is case-insensitive
      expect(e.createEnumeration("En", "MyDomain:ColorEnum").isEnumeration()).to.be.true;
      expect(e.createEnumerationArray("EnArr", "ColorEnum").isEnumeration()).to.be.true; // local reference
      expect(e.createStruct("S", "MyDomain:Point").isEnumeration()).to.be.false; // not a primitive kind
    });

    it("property asserts pass on a match and throw with kind and name on a mismatch", () => {
      const e = new Authoring.EntityClass("E");
      const prim = e.createPrimitive("P", PrimitiveType.String);
      const nav = e.createNavigation("N", "S:R", StrengthDirection.Forward);

      expect(() => prim.assertPrimitive()).to.not.throw();
      expect(() => nav.assertNavigation()).to.not.throw();
      expect(() => prim.assertNavigation()).to.throw("Expected a navigation property, got Primitive for \"P\"");
      expect(() => nav.assertPrimitive()).to.throw("Expected a primitive property, got Navigation for \"N\"");
      expect(() => prim.assertArray()).to.throw("Expected an array property, got Primitive for \"P\"");
      expect(() => prim.assertStruct()).to.throw("Expected a struct property, got Primitive for \"P\"");
    });
  });

  describe("custom attributes", () => {
    it("adds and looks up CAs by full name (separator- and case-insensitive) on schema, class, property, constraint", () => {
      const doc = new SchemaDocument("S", "s", 1, 0, 0);
      doc.customAttributes.add({ className: "CoreCustomAttributes.DynamicSchema" });
      expect(doc.customAttributes.has("CoreCustomAttributes:DynamicSchema")).to.be.true; // `.` vs `:`
      expect(doc.customAttributes.has("corecustomattributes.dynamicschema")).to.be.true; // case

      const e = doc.createEntity("E");
      e.customAttributes.add({ className: "BisCore:ClassHasHandler", properties: { restricted: "yes" } });
      expect(e.customAttributes.get("BisCore:ClassHasHandler")!.properties!.restricted).to.equal("yes");

      const prop = e.createPrimitive("Serial", PrimitiveType.String);
      prop.customAttributes.add({ className: "CoreCustomAttributes:HiddenProperty" });
      expect(prop.customAttributes.size).to.equal(1);
      expect(prop.customAttributes.remove("CoreCustomAttributes.HiddenProperty")).to.not.be.undefined;
      expect(prop.customAttributes.size).to.equal(0);

      const rel = doc.createRelationship("R");
      rel.source.customAttributes.add({ className: "MyDomain:ConstraintCa" });
      expect(rel.source.customAttributes.has("MyDomain:ConstraintCa")).to.be.true;
    });

    it("add returns the stored instance for follow-up configuration", () => {
      const e = new Authoring.EntityClass("E");
      const ca = e.customAttributes.add({ className: "BisCore:ClassHasHandler" });
      ca.properties = { restricted: "yes" };
      expect(e.customAttributes.get("BisCore:ClassHasHandler")!.properties).to.deep.equal({ restricted: "yes" });
    });

    it("a second instance of the same CA class is tolerated; get and remove are first-occurrence", () => {
      // The spec allows one instance per class; the validity-free document does not enforce that.
      const e = new Authoring.EntityClass("E");
      const first = e.customAttributes.add({ className: "MyDomain:Ca", properties: { n: 1 } });
      const second = e.customAttributes.add({ className: "mydomain.ca", properties: { n: 2 } });
      expect(e.customAttributes.size).to.equal(2);
      expect([...e.customAttributes]).to.deep.equal([first, second]); // insertion order
      expect(e.customAttributes.get("MyDomain:Ca")).to.equal(first);

      expect(e.customAttributes.remove("MyDomain:Ca")).to.equal(first);
      expect(e.customAttributes.get("MyDomain:Ca")).to.equal(second);
    });

    it("matching compares spellings, not resolved identity: alias-qualified does not match schema-name form", () => {
      const e = new Authoring.EntityClass("E");
      e.customAttributes.add({ className: "bis:ClassHasHandler" }); // alias-qualified (tolerated on input)
      expect(e.customAttributes.has("bis.ClassHasHandler")).to.be.true; // separator still folds
      expect(e.customAttributes.has("BisCore:ClassHasHandler")).to.be.false; // same class, different qualifier - no match
    });

    it("the set serializes transparently through JSON.stringify", () => {
      const e = new Authoring.EntityClass("E");
      e.customAttributes.add({ className: "BisCore:ClassHasHandler" });
      expect(JSON.parse(JSON.stringify(e.customAttributes))).to.deep.equal([{ className: "BisCore:ClassHasHandler" }]);
    });
  });

  describe("Scenario A: compose a schema in code", () => {
    it("builds MyDomain:Pump with three properties (hiding via a plain CA)", () => {
      const doc = new SchemaDocument("MyDomain", "mydom", 1, 0, 0, {
        references: [
          { name: "BisCore", readVersion: 1, writeVersion: 0, minorVersion: 0, alias: "bis" },
          { name: "AecUnits", readVersion: 1, writeVersion: 0, minorVersion: 0, alias: "AECU" },
        ],
      });
      doc.customAttributes.add({ className: "CoreCustomAttributes.DynamicSchema" });

      const pump = doc.createEntity("Pump", {
        label: "Pump", description: "Pump physical element", baseClass: "BisCore:PhysicalElement",
      });

      const serial = pump.createPrimitive("SerialNumber", PrimitiveType.String, { priority: 50 });
      serial.customAttributes.add({ className: "CoreCustomAttributes.HiddenProperty" }); // hidden is a plain CA now
      pump.createPrimitive("RatingKw", PrimitiveType.Integer, { priority: 50 });
      pump.createPrimitive("FlowRate", PrimitiveType.Double, {
        priority: 100, kindOfQuantity: "AecUnits:VOLUMETRIC_FLOW", description: "Design point volumetric flow rate",
      });

      expect([...pump.properties].map((p) => p.name)).to.deep.equal(["SerialNumber", "RatingKw", "FlowRate"]);
      expect(pump.baseClass).to.equal("BisCore:PhysicalElement");
      expect(pump.getProperty("FlowRate")!.kindOfQuantity).to.equal("AecUnits:VOLUMETRIC_FLOW");
      expect(pump.getProperty("SerialNumber")!.customAttributes.has("CoreCustomAttributes:HiddenProperty")).to.be.true;
      expect(doc.customAttributes.has("CoreCustomAttributes:DynamicSchema")).to.be.true;
    });
  });
});
