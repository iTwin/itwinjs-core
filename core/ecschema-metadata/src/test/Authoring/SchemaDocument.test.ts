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
        references: [{ name: "BisCore", version: "1.0.0", alias: "bis" }],
      });
      expect(doc.name).to.equal("MyDomain");
      expect(doc.alias).to.equal("md");
      expect(doc.readVersion).to.equal(1);
      expect(doc.writeVersion).to.equal(2);
      expect(doc.minorVersion).to.equal(3);
      expect(doc.references).to.have.lengthOf(1);
      expect(doc.references[0].name).to.equal("BisCore");
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
  });

  describe("references", () => {
    it("setSchemaReference adds from a held document, deriving version and alias", () => {
      const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
      const other = new SchemaDocument("Other", "ot", 2, 3, 4);

      const ref = doc.setSchemaReference(other);
      expect(doc.references).to.deep.equal([{ name: "Other", version: "02.03.04", alias: "ot" }]);
      expect(ref).to.equal(doc.references[0]);
    });

    it("setSchemaReference replaces an existing reference of the same name (case-insensitive)", () => {
      const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0, {
        references: [{ name: "Other", version: "01.00.00", alias: "old" }],
      });
      const newer = new SchemaDocument("OTHER", "ot", 2, 0, 0);

      doc.setSchemaReference(newer);
      expect(doc.references).to.have.lengthOf(1); // replaced, not appended
      expect(doc.references[0]).to.deep.equal({ name: "OTHER", version: "02.00.00", alias: "ot" });
    });

    it("setSchemaReference accepts an explicit SchemaReference verbatim", () => {
      const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
      const ref: Authoring.SchemaReference = { name: "Other", version: "01.02.03", alias: null };
      expect(doc.setSchemaReference(ref)).to.equal(ref); // stored as-is, null alias preserved
    });

    it("setSchemaReference accepts any structural source (e.g. a SchemaView Schema)", () => {
      const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
      // A plain object standing in for a SchemaView `Schema` flyweight - same member shape.
      const viewSchema: Authoring.SchemaReferenceSource = { name: "Other", alias: "ot", readVersion: 3, writeVersion: 1, minorVersion: 0 };

      doc.setSchemaReference(viewSchema);
      expect(doc.references[0]).to.deep.equal({ name: "Other", version: "03.01.00", alias: "ot" });
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

    it("creates a kind of quantity: persistenceUnit mandatory, formats appended", () => {
      const koq = new SchemaDocument("S", "s", 1, 0, 0).createKindOfQuantity("Length", "Units:M", {
        relativeError: 0.001, presentationFormats: ["Formats:DefaultReal", "Formats:AmerFI"],
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

    it("createPrimitiveArray creates array properties with occurs bounds, defaulting to 0 / unbounded", () => {
      const e = new Authoring.EntityClass("E");
      const arr = e.createPrimitiveArray("Tags", PrimitiveType.String, { minOccurs: 1, maxOccurs: 5 });
      expect(arr.kind).to.equal(PropertyKind.PrimitiveArray);
      expect(arr.minOccurs).to.equal(1);
      expect(arr.maxOccurs).to.equal(5);

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
  });

  describe("Scenario A: compose a schema in code", () => {
    it("builds MyDomain:Pump with three properties (hiding via a plain CA)", () => {
      const doc = new SchemaDocument("MyDomain", "mydom", 1, 0, 0, {
        references: [{ name: "BisCore", version: "1.0.0", alias: "bis" }, { name: "AecUnits", version: "1.0.0", alias: "AECU" }],
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
