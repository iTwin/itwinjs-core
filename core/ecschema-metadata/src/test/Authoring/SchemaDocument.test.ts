/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { ECClassModifier, PrimitiveType, PropertyKind, SchemaItemType } from "../../ECObjects";
import { Authoring, SchemaDocument } from "../../Authoring/SchemaDocument";

describe("SchemaDocument", () => {
  describe("construction / version", () => {
    it("captures the envelope and parses the version", () => {
      const doc = new SchemaDocument("MyDomain", "md", "1.2.3", {
        label: "My Domain", description: "desc",
        references: [{ name: "BisCore", version: "1.0.0", alias: "bis" }],
      });
      expect(doc.name).to.equal("MyDomain");
      expect(doc.alias).to.equal("md");
      expect(doc.readVersion).to.equal(1);
      expect(doc.writeVersion).to.equal(2);
      expect(doc.minorVersion).to.equal(3);
      expect(doc.version).to.equal("01.02.03");
      expect(doc.references).to.have.lengthOf(1);
      expect(doc.references[0].name).to.equal("BisCore");
    });

    it("tolerates a malformed version (validity-free), defaulting components to 0", () => {
      const doc = new SchemaDocument("S", "s", "5");
      expect(doc.readVersion).to.equal(5);
      expect(doc.writeVersion).to.equal(0);
      expect(doc.minorVersion).to.equal(0);
    });

    it("treats originalSpecVersion as an optional origin hint", () => {
      expect(new SchemaDocument("S", "s", "1.0.0").originalSpecVersion).to.be.undefined; // in memory -> latest
      expect(new SchemaDocument("S", "s", "1.0.0", { originalSpecVersion: "3.2" }).originalSpecVersion).to.equal("3.2");
    });
  });

  describe("items", () => {
    it("createEntity constructs, appends, and returns the handle", () => {
      const doc = new SchemaDocument("S", "s", "1.0.0");
      const widget = doc.createEntity("Widget", { label: "Widget", description: "d", modifier: ECClassModifier.Abstract });

      expect(widget.schemaItemType).to.equal(SchemaItemType.EntityClass);
      expect(widget.modifier).to.equal(ECClassModifier.Abstract);
      expect(doc.getEntity("widget")).to.equal(widget); // case-insensitive
      expect(doc.getItem("Widget")).to.equal(widget);
      expect([...doc.getEntities()]).to.deep.equal([widget]);
      expect(doc.items).to.have.lengthOf(1);
    });

    it("also supports direct construction + push (the power path)", () => {
      const doc = new SchemaDocument("S", "s", "1.0.0");
      const widget = new Authoring.EntityClass("Widget");
      doc.items.push(widget);
      expect(doc.getEntity("Widget")).to.equal(widget);
    });

    it("splits base class and mixins, set inline or after", () => {
      const e = new Authoring.EntityClass("E", { baseClass: "BisCore:PhysicalElement", mixins: ["MyDomain:IMixin"] });
      e.mixins.push("Other:Thing");
      expect(e.baseClass).to.equal("BisCore:PhysicalElement");
      expect(e.mixins).to.deep.equal(["MyDomain:IMixin", "Other:Thing"]);
    });

    it("leaves baseClass undefined when init omits it", () => {
      expect(new Authoring.EntityClass("E").baseClass).to.be.undefined;
      expect(new Authoring.EntityClass("E").mixins).to.deep.equal([]);
    });

    it("defaults modifier to None when init omits it", () => {
      expect(new Authoring.EntityClass("E").modifier).to.equal(ECClassModifier.None);
      expect(new Authoring.EntityClass("E", { label: "x" }).modifier).to.equal(ECClassModifier.None);
    });
  });

  describe("properties", () => {
    it("createPrimitive constructs, appends, and stores typeName from a PrimitiveType", () => {
      const e = new Authoring.EntityClass("E");
      const name = e.createPrimitive("Name", PrimitiveType.String);
      const count = e.createPrimitive("Count", PrimitiveType.Integer, { priority: 50, isHidden: true });

      expect(name.kind).to.equal(PropertyKind.Primitive);
      expect(name.typeName).to.equal("string");
      expect(count.typeName).to.equal("int");
      expect(count.priority).to.equal(50);
      expect(count.isHidden).to.be.true;
      expect(e.properties).to.deep.equal([name, count]);
      expect(e.getProperty("count")).to.equal(count); // case-insensitive
    });

    it("createEnumeration stores the reference as typeName, same PrimitiveProperty storage", () => {
      const e = new Authoring.EntityClass("E");
      const color = e.createEnumeration("Color", "MyDomain:ColorEnum");
      expect(color.kind).to.equal(PropertyKind.Primitive);
      expect(color.typeName).to.equal("MyDomain:ColorEnum");
      expect(e.getProperty("Color")).to.equal(color);
    });

    it("the constructor still accepts PrimitiveType | string (the power path)", () => {
      expect(new Authoring.PrimitiveProperty("Color", "MyDomain:ColorEnum").typeName).to.equal("MyDomain:ColorEnum");
      expect(new Authoring.PrimitiveProperty("N", PrimitiveType.String).typeName).to.equal("string");
    });

    it("sets a single complementary field by name, leaving the rest unset", () => {
      const e = new Authoring.EntityClass("E");
      const flow = e.createPrimitive("FlowRate", PrimitiveType.Double, { kindOfQuantity: "AecUnits:VOLUMETRIC_FLOW" });
      expect(flow.kindOfQuantity).to.equal("AecUnits:VOLUMETRIC_FLOW");
      expect(flow.priority).to.be.undefined;
      expect(flow.category).to.be.undefined;
    });

    it("createPrimitiveArray creates array properties with occurs bounds", () => {
      const e = new Authoring.EntityClass("E");
      const arr = e.createPrimitiveArray("Tags", PrimitiveType.String, { minOccurs: 1, maxOccurs: 5 });
      expect(arr.kind).to.equal(PropertyKind.PrimitiveArray);
      expect(arr.minOccurs).to.equal(1);
      expect(arr.maxOccurs).to.equal(5);
    });

    it("defaults array minOccurs to 0 and maxOccurs to unbounded (undefined)", () => {
      const arr = new Authoring.EntityClass("E").createPrimitiveArray("Tags", PrimitiveType.String);
      expect(arr.minOccurs).to.equal(0);
      expect(arr.maxOccurs).to.be.undefined;
    });
  });

  describe("custom attributes", () => {
    it("adds and looks up CAs on schema, class, and property by full name (separator- and case-insensitive)", () => {
      const doc = new SchemaDocument("S", "s", "1.0.0");
      doc.customAttributes.add({ className: "CoreCustomAttributes.DynamicSchema" }); // not an init field
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
    });
  });

  describe("Scenario A: compose a schema in code", () => {
    it("builds MyDomain:Pump with three properties", () => {
      const doc = new SchemaDocument("MyDomain", "mydom", "1.0.0", {
        references: [{ name: "BisCore", version: "1.0.0" }, { name: "AecUnits", version: "1.0.0" }],
      });
      doc.customAttributes.add({ className: "CoreCustomAttributes.DynamicSchema" });

      const pump = doc.createEntity("Pump", {
        label: "Pump", description: "Pump physical element", baseClass: "BisCore:PhysicalElement",
      });

      pump.createPrimitive("SerialNumber", PrimitiveType.String, { priority: 50, isHidden: true });
      pump.createPrimitive("RatingKw", PrimitiveType.Integer, { priority: 50 });
      pump.createPrimitive("FlowRate", PrimitiveType.Double, {
        priority: 100, kindOfQuantity: "AecUnits:VOLUMETRIC_FLOW", description: "Design point volumetric flow rate",
      });

      expect([...pump.properties].map((p) => p.name)).to.deep.equal(["SerialNumber", "RatingKw", "FlowRate"]);
      expect(pump.baseClass).to.equal("BisCore:PhysicalElement");
      expect(pump.getProperty("FlowRate")!.kindOfQuantity).to.equal("AecUnits:VOLUMETRIC_FLOW");
      expect(doc.customAttributes.has("CoreCustomAttributes:DynamicSchema")).to.be.true;
    });
  });
});
