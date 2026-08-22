/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { FormatType } from "@itwin/core-quantity";
import { CustomAttributeContainerType, ECClassModifier, PrimitiveType, StrengthDirection } from "../../ECObjects";
import {
  Constant, CustomAttributeClass, ECClass, EntityClass, Enumeration, Format, InvertedUnit, KindOfQuantity, Mixin, NavigationProperty, Phenomenon,
  PrimitiveArrayProperty,
  PrimitiveProperty, Property, PropertyCategory, RelationshipClass, RelationshipConstraint, SchemaDocument, SchemaSet, StructArrayProperty, StructClass,
  StructProperty, Unit, UnitSystem,
} from "../../Authoring/SchemaDocument";
import { collectReferenceSites } from "../../Authoring/Validation/ReferenceRules";
import { ECSpec } from "../../Authoring/SchemaDocumentIO";
import { SchemaIssue, SchemaIssueList } from "../../Authoring/SchemaIssues";
import { SchemaXmlReader } from "../../Authoring/SchemaXmlReader";
import { validateSchemaDocument, validateSchemaSet } from "../../Authoring/Validation/SchemaValidator";
import { CoreCustomAttributes, ECDbMap } from "../../Authoring/StandardSchemas";

/** The issue names, which are the contract; the messages deliberately are not. */
function names(issues: SchemaIssueList): string[] {
  return [...issues].map((issue) => issue.name);
}

function find(issues: SchemaIssueList, name: string): SchemaIssue | undefined {
  return [...issues].find((issue) => issue.name === name);
}

/** BisCore-shaped fixture: a set with a stand-in BisCore plus a domain schema referencing it. */
function makeSet(): { set: SchemaSet, bis: SchemaDocument, domain: SchemaDocument } {
  const set = new SchemaSet();
  const bis = set.createSchema("BisCore", "bis", 1, 0, 15);
  const element = bis.createEntity("Element", { modifier: ECClassModifier.Abstract });
  element.createPrimitive("CodeValue", PrimitiveType.String);
  bis.createEntity("PhysicalElement", { baseClass: "Element", modifier: ECClassModifier.Abstract });
  const domain = set.createSchema("MyDomain", "md", 1, 0, 0, {
    references: [{ name: "BisCore", readVersion: 1, writeVersion: 0, minorVersion: 15, alias: "bis" }],
  });
  return { set, bis, domain };
}

describe("Schema validation - a valid schema", () => {
  it("reports nothing for a well-formed domain schema", () => {
    const { domain } = makeSet();
    const pump = domain.createEntity("Pump", { baseClass: "bis:PhysicalElement" });
    pump.createPrimitive("SerialNumber", PrimitiveType.String);
    const port = domain.createEntity("Port", { baseClass: "bis:PhysicalElement" });
    const relationship = domain.createRelationship("PumpHasPorts", {
      modifier: ECClassModifier.Sealed,
      source: { multiplicity: "(0..1)", roleLabel: "has", constraintClasses: ["Pump"] },
      target: { multiplicity: "(0..*)", roleLabel: "is owned by", constraintClasses: ["Port"] },
    });
    port.createNavigation("Pump", relationship.name, StrengthDirection.Backward);

    expect(names(validateSchemaDocument(domain))).to.deep.equal([]);
  });

  it("reports nothing for a schema using only the built-in standard custom attributes", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0, {
      references: [
        { name: "CoreCustomAttributes", readVersion: 1, writeVersion: 0, minorVersion: 4, alias: "CoreCA" },
        { name: "ECDbMap", readVersion: 2, writeVersion: 0, minorVersion: 1, alias: "ecdbmap" },
      ],
      customAttributes: [CoreCustomAttributes.dynamicSchema()],
    });
    const pump = doc.createEntity("Pump");
    pump.customAttributes.add(ECDbMap.dbIndexList({ indexes: [{ name: "ix_pump", properties: ["SerialNumber"] }] }));
    pump.createPrimitive("SerialNumber", PrimitiveType.String);

    expect(names(validateSchemaDocument(doc))).to.deep.equal([]);
  });
});

describe("Schema validation - references", () => {
  it("reports an absent schema once and skips every reference into it", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0, {
      references: [{ name: "BisCore", readVersion: 1, writeVersion: 0, minorVersion: 15, alias: "bis" }],
    });
    doc.createEntity("Pump", { baseClass: "bis:PhysicalElement" });
    doc.createEntity("Port", { baseClass: "bis:PhysicalElement" });

    const issues = validateSchemaDocument(doc);
    expect(names(issues).filter((name) => name === "schema-reference-not-loaded")).to.have.length(1);
    expect(names(issues)).to.not.include("reference-item-not-found");
  });

  it("reports a qualifier no schema reference declares", () => {
    const { domain } = makeSet();
    domain.createEntity("Pump", { baseClass: "nosuch:PhysicalElement" });

    expect(find(validateSchemaDocument(domain), "reference-qualifier-undeclared")?.location).to.equal("MyDomain:Pump");
  });

  it("reports an item the referenced schema does not declare", () => {
    const { domain } = makeSet();
    domain.createEntity("Pump", { baseClass: "bis:NoSuchElement" });

    const issue = find(validateSchemaDocument(domain), "reference-item-not-found");
    expect(issue?.severity).to.equal("error");
    expect(issue?.message).to.include("baseClass");
  });

  it("reports an item of the wrong kind", () => {
    const { domain } = makeSet();
    domain.createPropertyCategory("Details");
    const pump = domain.createEntity("Pump", { baseClass: "bis:PhysicalElement" });
    pump.createStruct("Location", "Details");

    expect(find(validateSchemaDocument(domain), "reference-item-wrong-kind")?.message).to.include("PropertyCategory");
  });

  it("keeps an unresolved unit or format reference a warning", () => {
    const { domain } = makeSet();
    domain.createKindOfQuantity("Flow", "Units:CUB_M_PER_SEC", 0.001, { presentationFormats: ["Formats:DefaultRealU(4)[Units:M]"] });
    domain.setSchemaReference({ name: "Units", readVersion: 1, writeVersion: 0, minorVersion: 11, alias: "u" });
    domain.setSchemaReference({ name: "Formats", readVersion: 1, writeVersion: 0, minorVersion: 0, alias: "f" });
    const units = domain.schemaSet.createSchema("Units", "u", 1, 0, 11);
    units.createUnitSystem("SI");
    domain.schemaSet.createSchema("Formats", "f", 1, 0, 0);

    const issues = validateSchemaDocument(domain);
    expect([...issues].filter((issue) => issue.name === "reference-item-not-found").every((issue) => issue.severity === "warning")).to.be.true;
    expect(issues.hasErrors).to.be.false;
  });

  it("warns about a reference to a deprecated item", () => {
    const { bis, domain } = makeSet();
    bis.setSchemaReference({ name: "CoreCustomAttributes", readVersion: 1, writeVersion: 0, minorVersion: 4, alias: "CoreCA" });
    bis.getEntity("PhysicalElement")!.customAttributes.add(CoreCustomAttributes.deprecated());
    domain.createEntity("Pump", { baseClass: "bis:PhysicalElement" });

    expect(names(validateSchemaDocument(domain))).to.include("reference-item-deprecated");
  });
});

describe("Schema validation - the schema reference list", () => {
  it("reports duplicate, shadowed, and self references", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0, {
      references: [
        { name: "BisCore", readVersion: 1, writeVersion: 0, minorVersion: 15, alias: "bis" },
        { name: "Units", readVersion: 1, writeVersion: 0, minorVersion: 11, alias: "bis" },
        { name: "Formats", readVersion: 1, writeVersion: 0, minorVersion: 0, alias: "md" },
        { name: "MyDomain", readVersion: 1, writeVersion: 0, minorVersion: 0, alias: "self" },
      ],
    });

    const reported = names(validateSchemaDocument(doc));
    expect(reported).to.include("schema-reference-alias-duplicate");
    expect(reported).to.include("schema-reference-alias-shadowed");
    expect(reported).to.include("schema-reference-self");
  });

  it("compares the declared reference version against the one the set holds", () => {
    const { domain } = makeSet();
    domain.setSchemaReference({ name: "BisCore", readVersion: 1, writeVersion: 0, minorVersion: 20, alias: "bis" });
    expect(names(validateSchemaSet(domain.schemaSet))).to.include("schema-reference-version-older");

    domain.setSchemaReference({ name: "BisCore", readVersion: 2, writeVersion: 0, minorVersion: 0, alias: "bis" });
    expect(names(validateSchemaSet(domain.schemaSet))).to.include("schema-reference-version-incompatible");
  });

  it("reports a reference cycle through the set", () => {
    const { bis, domain } = makeSet();
    bis.setSchemaReference(domain);

    expect(names(validateSchemaDocument(domain))).to.include("schema-reference-cycle");
  });

  it("warns about a reference nothing names, and does not for a mixin", () => {
    const { domain } = makeSet();
    expect(names(validateSchemaDocument(domain))).to.include("schema-reference-unused");

    domain.createMixin("IServiceable", "bis:PhysicalElement");
    domain.setSchemaReference({ name: "CoreCustomAttributes", readVersion: 1, writeVersion: 0, minorVersion: 4, alias: "CoreCA" });
    domain.schemaSet.createSchema("CoreCustomAttributes", "CoreCA", 1, 0, 4);
    // The mixin names BisCore through appliesTo, and serializes as a CoreCustomAttributes:IsMixin.
    expect(names(validateSchemaDocument(domain))).to.not.include("schema-reference-unused");
  });
});

describe("Schema validation - shape", () => {
  it("reports invalid names and version components", () => {
    const doc = new SchemaDocument("My Domain", "1md", 1, 0, -1);
    doc.createEntity("2Pump").createPrimitive("Serial Number", PrimitiveType.String);

    const reported = names(validateSchemaDocument(doc));
    expect(reported).to.include("schema-name-invalid");
    expect(reported).to.include("schema-alias-invalid");
    expect(reported).to.include("schema-version-invalid");
    expect(reported).to.include("item-name-invalid");
    expect(reported).to.include("property-name-invalid");
  });

  it("reports duplicate item names across kinds and duplicate property names", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    doc.createPhenomenon("LENGTH", "LENGTH");
    doc.createKindOfQuantity("Length", "M", 0.001);
    const pump = doc.createEntity("Pump");
    pump.createPrimitive("Serial", PrimitiveType.String);
    pump.createPrimitive("SERIAL", PrimitiveType.Integer);

    const reported = names(validateSchemaDocument(doc));
    expect(reported).to.include("schema-item-name-duplicate");
    expect(reported).to.include("class-property-name-duplicate");
  });

  it("reports enumerator problems", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    const status = doc.createEnumeration("Status", "int", {
      enumerators: [
        { name: "Open", value: 1 },
        { name: "open", value: 2 },
        { name: "Closed", value: 1 },
        { name: "Broken", value: "two" },
      ],
    });
    expect(status.enumerators).to.have.length(4);

    const reported = names(validateSchemaDocument(doc));
    expect(reported).to.include("enumeration-enumerator-name-duplicate");
    expect(reported).to.include("enumeration-enumerator-value-duplicate");
    expect(reported).to.include("enumeration-enumerator-value-type-mismatch");
  });

  it("reports inverted bounds and bounds that do not apply", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    const pump = doc.createEntity("Pump");
    pump.createPrimitive("Flow", PrimitiveType.Double, { minValue: 10, maxValue: 1 });
    pump.createPrimitive("Name", PrimitiveType.String, { minValue: 1, maxValue: 10 });
    pump.createPrimitiveArray("Tags", PrimitiveType.String, { minOccurs: 5, maxOccurs: 2 });

    const reported = names(validateSchemaDocument(doc));
    expect(reported).to.include("property-value-range-inverted");
    expect(reported).to.include("property-value-range-not-applicable");
    expect(reported).to.include("property-occurs-inverted");
  });

  it("reports format and kind of quantity shape", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    doc.createFormat("Sci", FormatType.Scientific);
    doc.createKindOfQuantity("Flow", "M", -1, { presentationFormats: ["Sci", "sci"] });

    const reported = names(validateSchemaDocument(doc));
    expect(reported).to.include("format-scientific-type-missing");
    expect(reported).to.include("koq-relative-error-invalid");
    expect(reported).to.include("koq-presentation-format-duplicate");
  });
});

describe("Schema validation - inheritance", () => {
  it("reports a sealed base, a base of another kind, and a cycle", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    doc.createEntity("Sealed", { modifier: ECClassModifier.Sealed });
    doc.createEntity("Derived", { baseClass: "Sealed" });
    doc.createStructClass("Location");
    doc.createEntity("Wrong", { baseClass: "Location" });
    doc.createEntity("Loop", { baseClass: "Loop" });

    const reported = names(validateSchemaDocument(doc));
    expect(reported).to.include("class-base-sealed");
    expect(reported).to.include("class-base-kind-mismatch");
    expect(reported).to.include("class-base-cycle");
  });

  it("reports a struct or custom attribute class with a base class", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    doc.createStructClass("Base");
    doc.createStructClass("Derived", { baseClass: "Base" });
    doc.createCustomAttributeClass("Marker", CustomAttributeContainerType.AnyClass);
    doc.createCustomAttributeClass("SubMarker", CustomAttributeContainerType.AnyClass, { baseClass: "Marker" });

    const reported = names(validateSchemaDocument(doc));
    expect(reported).to.include("struct-base-not-allowed");
    expect(reported).to.include("custom-attribute-class-base-not-allowed");
  });

  it("reports a mixin applied to a class outside its appliesTo, and a mixin overriding a property", () => {
    const { domain } = makeSet();
    domain.createEntity("Standalone");
    const serviceable = domain.createMixin("IServiceable", "bis:PhysicalElement");
    serviceable.createPrimitive("LastServiced", PrimitiveType.DateTime);
    domain.createEntity("Loose", { mixins: ["IServiceable"] });

    const baseMixin = domain.createMixin("IBase", "bis:PhysicalElement");
    baseMixin.createPrimitive("Tag", PrimitiveType.String);
    const derivedMixin = domain.createMixin("IDerived", "bis:PhysicalElement", { baseClass: "IBase" });
    derivedMixin.createPrimitive("Tag", PrimitiveType.String);

    const reported = names(validateSchemaDocument(domain));
    expect(reported).to.include("entity-mixin-not-applicable");
    expect(reported).to.include("mixin-property-overrides-base");
  });

  it("reports a property inherited from both a base class and a mixin", () => {
    const { domain } = makeSet();
    const mixin = domain.createMixin("ITagged", "bis:PhysicalElement");
    mixin.createPrimitive("CodeValue", PrimitiveType.String);
    domain.createEntity("Pump", { baseClass: "bis:PhysicalElement", mixins: ["ITagged"] });

    expect(names(validateSchemaDocument(domain))).to.include("entity-property-inherited-twice");
  });

  it("reports an override that changes kind, type, or persistence unit", () => {
    const { domain } = makeSet();
    domain.setSchemaReference({ name: "Units", readVersion: 1, writeVersion: 0, minorVersion: 11, alias: "u" });
    const units = domain.schemaSet.createSchema("Units", "u", 1, 0, 11);
    const si = units.createUnitSystem("SI");
    const length = units.createPhenomenon("LENGTH", "LENGTH");
    units.createUnit("M", length.name, si.name, "M");
    units.createUnit("MM", length.name, si.name, "MILLI*M");
    domain.createKindOfQuantity("InMetres", "u:M", 0.001);
    domain.createKindOfQuantity("InMillimetres", "u:MM", 0.001);

    const base = domain.createEntity("Base");
    base.createPrimitive("Name", PrimitiveType.String);
    base.createPrimitive("Count", PrimitiveType.Integer);
    base.createPrimitive("Length", PrimitiveType.Double, { kindOfQuantity: "InMetres" });

    const derived = domain.createEntity("Derived", { baseClass: "Base" });
    derived.createPrimitiveArray("Name", PrimitiveType.String);
    derived.createPrimitive("Count", PrimitiveType.Long);
    derived.createPrimitive("Length", PrimitiveType.Double, { kindOfQuantity: "InMillimetres" });

    const reported = names(validateSchemaDocument(domain));
    expect(reported).to.include("property-override-kind-mismatch");
    expect(reported).to.include("property-override-type-mismatch");
    expect(reported).to.include("property-override-persistence-unit-mismatch");
  });
});

describe("Schema validation - relationships", () => {
  it("reports a constraint with no class, a missing role label, and a redundant abstract constraint", () => {
    const { domain } = makeSet();
    domain.createEntity("Pump", { baseClass: "bis:PhysicalElement" });
    domain.createRelationship("Broken", {
      source: { multiplicity: "(0..1)", constraintClasses: ["Pump"], abstractConstraint: "Pump" },
      target: { multiplicity: "(0..*)", roleLabel: "is owned by" },
    });

    const reported = names(validateSchemaDocument(domain));
    expect(reported).to.include("relationship-constraint-no-class");
    expect(reported).to.include("relationship-constraint-role-label-missing");
    expect(reported).to.include("relationship-constraint-abstract-redundant");
  });

  it("requires an abstract constraint once an end names more than one class", () => {
    const { domain } = makeSet();
    domain.createEntity("Pump", { baseClass: "bis:PhysicalElement" });
    domain.createEntity("Valve", { baseClass: "bis:PhysicalElement" });
    domain.createEntity("Port", { baseClass: "bis:PhysicalElement" });
    const relationship = domain.createRelationship("Connects", {
      source: { multiplicity: "(0..1)", roleLabel: "connects", constraintClasses: ["Pump", "Valve"] },
      target: { multiplicity: "(0..*)", roleLabel: "is connected by", constraintClasses: ["Port"] },
    });

    expect(names(validateSchemaDocument(domain))).to.include("relationship-constraint-abstract-required");

    relationship.source.abstractConstraint = "bis:PhysicalElement";
    expect(names(validateSchemaDocument(domain))).to.not.include("relationship-constraint-abstract-required");
  });

  it("reports duplicate and abstract constraint classes", () => {
    const { domain } = makeSet();
    domain.createEntity("Pump", { baseClass: "bis:PhysicalElement", modifier: ECClassModifier.Abstract });
    domain.createRelationship("Loops", {
      source: { multiplicity: "(0..1)", roleLabel: "a", polymorphic: false, constraintClasses: ["Pump", "Pump"] },
      target: { multiplicity: "(0..*)", roleLabel: "b", constraintClasses: ["Pump"] },
    });

    const reported = names(validateSchemaDocument(domain));
    expect(reported).to.include("relationship-constraint-class-duplicate");
    expect(reported).to.include("relationship-constraint-class-abstract");
  });

  it("reports a derived relationship widening its base's constraints", () => {
    const { domain } = makeSet();
    domain.createEntity("Pump", { baseClass: "bis:PhysicalElement" });
    domain.createEntity("Port", { baseClass: "bis:PhysicalElement" });
    domain.createEntity("Unrelated");
    domain.createRelationship("Base", {
      modifier: ECClassModifier.Abstract,
      source: { multiplicity: "(0..1)", roleLabel: "a", constraintClasses: ["Pump"] },
      target: { multiplicity: "(0..1)", roleLabel: "b", constraintClasses: ["Port"] },
    });
    domain.createRelationship("Derived", {
      baseClass: "Base",
      source: { multiplicity: "(0..1)", roleLabel: "a", constraintClasses: ["Unrelated"] },
      target: { multiplicity: "(0..*)", roleLabel: "b", constraintClasses: ["Port"] },
    });

    const reported = names(validateSchemaDocument(domain));
    expect(reported).to.include("relationship-constraint-class-widens-base");
    expect(reported).to.include("relationship-constraint-multiplicity-widens-base");
  });

  it("reports navigation properties that cannot work", () => {
    const { domain } = makeSet();
    domain.createEntity("Pump", { baseClass: "bis:PhysicalElement" });
    const port = domain.createEntity("Port", { baseClass: "bis:PhysicalElement" });
    domain.createRelationship("Root", {
      modifier: ECClassModifier.Abstract,
      source: { multiplicity: "(0..*)", roleLabel: "a", constraintClasses: ["Pump"] },
      target: { multiplicity: "(0..*)", roleLabel: "b", constraintClasses: ["Port"] },
    });
    const derived = domain.createRelationship("Derived", {
      baseClass: "Root",
      source: { multiplicity: "(0..*)", roleLabel: "a", constraintClasses: ["Pump"] },
      target: { multiplicity: "(0..*)", roleLabel: "b", constraintClasses: ["Port"] },
    });
    // Backward means the declaring class must be a target constraint class, and it is not.
    domain.createEntity("Standalone").createNavigation("Pump", derived.name, StrengthDirection.Backward);
    port.createNavigation("Pump", "Root", StrengthDirection.Backward);

    const reported = names(validateSchemaDocument(domain));
    expect(reported).to.include("property-navigation-relationship-not-root");
    expect(reported).to.include("property-navigation-class-not-constrained");
    expect(reported).to.include("property-navigation-target-not-singular");
  });

  it("reports a malformed multiplicity", () => {
    const { domain } = makeSet();
    domain.createEntity("Pump", { baseClass: "bis:PhysicalElement" });
    domain.createRelationship("Odd", {
      source: { multiplicity: "(0,N)", roleLabel: "a", constraintClasses: ["Pump"] },
      target: { multiplicity: "(5..2)", roleLabel: "b", constraintClasses: ["Pump"] },
    });

    const reported = names(validateSchemaDocument(domain));
    expect(reported).to.include("relationship-constraint-multiplicity-invalid");
    expect(reported).to.include("relationship-constraint-multiplicity-inverted");
  });
});

describe("Schema validation - custom attributes", () => {
  it("reports an unresolvable class, a wrong container, a duplicate, and an unknown value", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0, {
      references: [{ name: "CoreCustomAttributes", readVersion: 1, writeVersion: 0, minorVersion: 4, alias: "CoreCA" }],
    });
    doc.customAttributes.add({ className: "CoreCustomAttributes:NoSuchAttribute" });
    // HiddenClass applies to classes, not to a schema.
    doc.customAttributes.add(CoreCustomAttributes.hiddenClass());
    const pump = doc.createEntity("Pump");
    pump.customAttributes.add(CoreCustomAttributes.hiddenClass(), { className: "CoreCA:HiddenClass" });
    /* eslint-disable-next-line @typescript-eslint/naming-convention -- EC property names */
    pump.customAttributes.add({ className: "CoreCustomAttributes:Deprecated", values: { Explanation: "gone", Nonsense: 1 } });

    const reported = names(validateSchemaDocument(doc));
    expect(reported).to.include("custom-attribute-class-not-found");
    expect(reported).to.include("custom-attribute-container-not-allowed");
    expect(reported).to.include("custom-attribute-duplicate");
    expect(reported).to.include("custom-attribute-value-unknown");
  });

  it("reports a custom attribute whose schema is not referenced", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    doc.createEntity("Pump").customAttributes.add(CoreCustomAttributes.hiddenClass());

    expect(names(validateSchemaDocument(doc))).to.include("custom-attribute-schema-not-referenced");
  });

  it("reports an abstract custom attribute class being applied", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    doc.createCustomAttributeClass("Marker", CustomAttributeContainerType.AnyClass, { modifier: ECClassModifier.Abstract });
    doc.createEntity("Pump").customAttributes.add({ className: "Marker" });

    expect(find(validateSchemaDocument(doc), "custom-attribute-class-abstract")?.code).to.equal("ECObjects-500");
  });
});

describe("Schema validation - ECDb import constraints", () => {
  it("reports an ECSQL system property name", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    doc.createEntity("Pump").createPrimitive("ECInstanceId", PrimitiveType.Long);
    doc.createStructClass("Location").createPrimitive("ECInstanceId", PrimitiveType.Long);

    const reported = names(validateSchemaDocument(doc));
    expect(reported.filter((name) => name === "property-name-reserved")).to.have.length(1);
  });

  it("reports a struct that contains itself", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    doc.createStructClass("Outer").createStruct("Inner", "Inner");
    doc.createStructClass("Inner").createStruct("Outer", "Outer");

    expect(find(validateSchemaDocument(doc), "property-struct-recursive")?.code).to.equal("ECDb_0299");
  });

  it("reports AnyClass as a relationship constraint", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    doc.createEntity("Pump");
    doc.createRelationship("Anything", {
      source: { multiplicity: "(0..1)", roleLabel: "a", constraintClasses: ["Bentley_Standard_Classes:AnyClass"] },
      target: { multiplicity: "(0..*)", roleLabel: "b", constraintClasses: ["Pump"] },
    });

    expect(names(validateSchemaDocument(doc))).to.include("relationship-constraint-any-class");
  });
});

describe("Schema validation - the spec version", () => {
  it("only requires a role label from EC 3.1 on", () => {
    const { domain } = makeSet();
    domain.createEntity("Pump", { baseClass: "bis:PhysicalElement" });
    domain.createRelationship("Owns", {
      source: { multiplicity: "(0..1)", constraintClasses: ["Pump"] },
      target: { multiplicity: "(0..*)", constraintClasses: ["Pump"] },
    });

    expect(names(validateSchemaDocument(domain))).to.include("relationship-constraint-role-label-missing");
    expect(names(validateSchemaDocument(domain, { spec: ECSpec.V3_0 }))).to.not.include("relationship-constraint-role-label-missing");
  });
});

describe("Schema validation - reading then validating", () => {
  const brokenXml = `<?xml version="1.0" encoding="UTF-8"?>
<ECSchema schemaName="MyDomain" alias="md" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
  <ECSchemaReference name="BisCore" version="01.00.15" alias="bis"/>
  <ECEntityClass typeName="Pump">
    <BaseClass>bis:NoSuchElement</BaseClass>
    <ECProperty propertyName="SerialNumber" typeName="string"/>
    <ECProperty propertyName="SerialNumber" typeName="int"/>
  </ECEntityClass>
  <ECRelationshipClass typeName="PumpHasPorts" strength="embedding" modifier="None">
    <Source multiplicity="(0..1)" roleLabel="has" polymorphic="true"/>
    <Target multiplicity="(0..*)" roleLabel="is owned by" polymorphic="true">
      <Class class="Pump"/>
    </Target>
  </ECRelationshipClass>
</ECSchema>`;

  it("reads a schema whose problems are semantic, then reports them", async () => {
    const set = new SchemaSet();
    set.createSchema("BisCore", "bis", 1, 0, 15);
    const result = await new SchemaXmlReader().readDocument(brokenXml, { source: "MyDomain.ecschema.xml", schemaSet: set });

    // The reader parsed everything it could; nothing here is a format problem.
    expect(result.issues.hasErrors).to.be.false;

    const reported = names(validateSchemaDocument(result.document!));
    expect(reported).to.include("reference-item-not-found");
    expect(reported).to.include("class-property-name-duplicate");
    expect(reported).to.include("relationship-constraint-no-class");
  });
});

describe("Schema validation - issue shape", () => {
  it("stamps the group, a schema element path, and the catalog code where one exists", () => {
    const doc = new SchemaDocument("MyDomain", "md", 1, 0, 0);
    doc.createStructClass("Base");
    doc.createStructClass("Derived", { baseClass: "Base" });

    const issue = find(validateSchemaDocument(doc), "struct-base-not-allowed")!;
    expect(issue.group).to.equal("validation");
    expect(issue.severity).to.equal("error");
    expect(issue.location).to.equal("MyDomain:Derived");
    expect(issue.code).to.equal("BIS-1700");
  });
});

describe("Schema validation - the reference-site table", () => {
  /** A model class, reflected over by name and prototype. */
  interface ModelType { readonly name: string, readonly prototype: object }

  /** Every accessor on the model that resolves an item reference, and the field it resolves.
   * A reference field the table in `ReferenceRules` does not cover is a reference nothing
   * validates, which is what this list exists to make impossible to add by accident. */
  const resolvingAccessors: ReadonlyArray<{ owner: ModelType, accessor: string, field: string }> = [
    { owner: ECClass, accessor: "getBaseClass", field: "baseClass" },
    { owner: EntityClass, accessor: "getMixins", field: "mixins[0]" },
    { owner: Mixin, accessor: "getAppliesTo", field: "appliesTo" },
    { owner: RelationshipConstraint, accessor: "getConstraintClasses", field: "constraintClasses[0]" },
    { owner: RelationshipConstraint, accessor: "getAbstractConstraint", field: "abstractConstraint" },
    { owner: KindOfQuantity, accessor: "getPersistenceUnit", field: "persistenceUnit" },
    { owner: Unit, accessor: "getPhenomenon", field: "phenomenon" },
    { owner: Unit, accessor: "getUnitSystem", field: "unitSystem" },
    { owner: InvertedUnit, accessor: "getInvertsUnit", field: "invertsUnit" },
    { owner: InvertedUnit, accessor: "getUnitSystem", field: "unitSystem" },
    { owner: Constant, accessor: "getPhenomenon", field: "phenomenon" },
    { owner: Format, accessor: "getCompositeUnits", field: "composite.units[0]" },
    { owner: Property, accessor: "getCategory", field: "category" },
    { owner: Property, accessor: "getKindOfQuantity", field: "kindOfQuantity" },
    { owner: PrimitiveProperty, accessor: "getEnumeration", field: "typeName" },
    { owner: PrimitiveArrayProperty, accessor: "getEnumeration", field: "typeName" },
    { owner: StructProperty, accessor: "getStructClass", field: "typeName" },
    { owner: StructArrayProperty, accessor: "getStructClass", field: "typeName" },
    { owner: NavigationProperty, accessor: "getRelationshipClass", field: "relationshipName" },
  ];

  /** Getters that read the model rather than resolve a reference into another schema item. */
  const notReferenceAccessors: ReadonlySet<string> = new Set([
    "getProperty", "getExpandedProperties", "getExpandedProperty", "getBaseProperty", "getEnumerator",
  ]);

  it("has a row for every resolving accessor the model declares", () => {
    const owners: ModelType[] = [
      ECClass, EntityClass, Mixin, StructClass, CustomAttributeClass, RelationshipClass, RelationshipConstraint,
      Enumeration, KindOfQuantity, PropertyCategory, UnitSystem, Phenomenon, Unit, InvertedUnit, Constant, Format,
      Property, PrimitiveProperty, PrimitiveArrayProperty, StructProperty, StructArrayProperty, NavigationProperty,
    ];
    const listed = new Set(resolvingAccessors.map((entry) => `${entry.owner.name}.${entry.accessor}`));

    const unlisted: string[] = [];
    for (const owner of owners) {
      for (const member of Object.getOwnPropertyNames(owner.prototype)) {
        if (!/^get[A-Z]/.test(member) || notReferenceAccessors.has(member))
          continue;
        if (!listed.has(`${owner.name}.${member}`))
          unlisted.push(`${owner.name}.${member}`);
      }
    }
    expect(unlisted, "add these to resolvingAccessors and to the table in ReferenceRules").to.deep.equal([]);
  });

  it("yields a site for every reference field of every construct", () => {
    const { set, domain } = makeSet();
    const units = set.createSchema("Units", "u", 1, 0, 11);
    const si = units.createUnitSystem("SI");
    const length = units.createPhenomenon("LENGTH", "LENGTH");
    const metre = units.createUnit("M", length.name, si.name, "M");
    units.createInvertedUnit("PER_M", metre.name, si.name);
    units.createConstant("PI", length.name, "ONE");
    units.createFormat("Real", FormatType.Decimal, { composite: { units: [{ name: "M" }] } });
    units.createKindOfQuantity("Length", "M", 0.001, { presentationFormats: ["Real(4)[M]"] });

    domain.createPropertyCategory("Details");
    domain.createEnumeration("Status", "int");
    domain.createStructClass("Location");
    const mixin = domain.createMixin("ITagged", "bis:PhysicalElement");
    const pump = domain.createEntity("Pump", { baseClass: "bis:PhysicalElement", mixins: [mixin.name] });
    const relationship = domain.createRelationship("PumpHasPorts", {
      source: { multiplicity: "(0..1)", roleLabel: "has", constraintClasses: ["Pump"], abstractConstraint: "Pump" },
      target: { multiplicity: "(0..1)", roleLabel: "is owned by", constraintClasses: ["Pump"], abstractConstraint: "Pump" },
    });
    const init = { category: "Details", kindOfQuantity: "Units:Length" };
    pump.createEnumeration("Status", "Status", init);
    pump.createEnumerationArray("Statuses", "Status", init);
    pump.createStruct("Where", "Location", init);
    pump.createStructArray("Wheres", "Location", init);
    pump.createNavigation("Port", relationship.name, StrengthDirection.Forward, init);

    const covered = new Set<string>();
    const constructs = [...domain.items, ...units.items, ...pump.properties, relationship.source, relationship.target];
    for (const construct of constructs) {
      for (const site of collectReferenceSites(construct))
        covered.add(`${construct.constructor.name}.${site.field}`);
    }

    const missing = resolvingAccessors
      .map((entry) => `${entry.owner.name}.${entry.field}`)
      .filter((expected) => ![...covered].some((actual) => matchesTableEntry(actual, expected)));
    expect(missing, "the reference-site table yields nothing for these fields").to.deep.equal([]);
  });

  /** `ECClass` and `Property` are abstract, so their fields surface on the concrete kinds. */
  function matchesTableEntry(actual: string, expected: string): boolean {
    const [owner, field] = expected.split(/\.(.*)/);
    if (owner === "ECClass" || owner === "Property")
      return actual.endsWith(`.${field}`);
    return actual === expected;
  }
});
