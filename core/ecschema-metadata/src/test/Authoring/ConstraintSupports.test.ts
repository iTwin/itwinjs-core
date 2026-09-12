/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*---------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { CustomAttributeContainerType, ECClassModifier, StrengthDirection } from "../../ECObjects";
import {
  RelationshipConstraint, RelationshipConstraintInit, SchemaDocument, SchemaSet,
} from "../../Authoring/SchemaDocument";
import { validateSchemaDocument } from "../../Authoring/Validation/SchemaValidator";
import { constraintSupports, satisfiesConstraintClass } from "../../Authoring/Validation/StructureRules";

function makeConstraint(document: SchemaDocument, init: RelationshipConstraintInit): RelationshipConstraint {
  const relationship = document.createRelationship(`ConstraintRelationship${document.items.length}`);
  relationship.source.set(init);
  return relationship.source;
}

function makeFixture() {
  const set = new SchemaSet();
  const document = set.createSchema("Test", "t", 1, 0, 0);
  const element = document.createEntity("Element", { modifier: ECClassModifier.Abstract });
  const pump = document.createEntity("Pump", { baseClass: element.name });
  const pumpChild = document.createEntity("PumpChild", { baseClass: pump.name });
  const otherElement = document.createEntity("OtherElement", { baseClass: element.name });
  const outside = document.createEntity("Outside");
  const outsideChild = document.createEntity("OutsideChild", { baseClass: outside.name });
  const mixin = document.createMixin("IMarker", element.name);
  const appliedMixin = document.createEntity("AppliedMixin", { baseClass: element.name, mixins: [mixin.name] });
  const rootRelationship = document.createRelationship("RootRelationship");
  const derivedRelationship = document.createRelationship("DerivedRelationship", { baseClass: rootRelationship.name });
  const struct = document.createStructClass("Location");
  const customAttribute = document.createCustomAttributeClass("Tag", CustomAttributeContainerType.EntityClass);
  const view = document.createView("ElementView", "SELECT 1");
  const anyClass = document.createEntity("AnyClass");

  return {
    set, document, element, pump, pumpChild, otherElement, outside, outsideChild, mixin, appliedMixin,
    rootRelationship, derivedRelationship, struct, customAttribute, view, anyClass,
  };
}

describe("constraintSupports", () => {
  it("requires exact matches when an abstract and explicit class are nonpolymorphic", () => {
    const { document, element, pump, pumpChild, otherElement } = makeFixture();
    const constraint = makeConstraint(document, {
      polymorphic: false,
      abstractConstraint: element.name,
      constraintClasses: [pump.name],
    });

    expect(constraintSupports(constraint, element)).toBe(true);
    expect(constraintSupports(constraint, pump)).toBe(true);
    expect(constraintSupports(constraint, pumpChild)).toBe(false);
    expect(constraintSupports(constraint, otherElement)).toBe(false);
    expect(satisfiesConstraintClass(pump, element)).toBe(true);
  });

  it("uses polymorphism for abstract and explicit classes, including mixins", () => {
    const { document, element, pumpChild, otherElement, mixin, appliedMixin } = makeFixture();
    const constraint = makeConstraint(document, {
      abstractConstraint: element.name,
      constraintClasses: ["Pump"],
    });

    expect(constraintSupports(constraint, otherElement)).toBe(true);
    expect(constraintSupports(constraint, pumpChild)).toBe(true);

    const mixinConstraint = makeConstraint(document, { abstractConstraint: element.name });
    expect(satisfiesConstraintClass(mixin, element)).toBe(true);
    expect(constraintSupports(mixinConstraint, mixin)).toBe(true);
    expect(satisfiesConstraintClass(appliedMixin, mixin)).toBe(true);
    expect(constraintSupports(mixinConstraint, appliedMixin)).toBe(true);

    const appliedConstraint = makeConstraint(document, { constraintClasses: [mixin.name] });
    const derivedMixin = document.createMixin("IDerivedMarker", element.name, { baseClass: mixin.name });
    expect(constraintSupports(appliedConstraint, appliedMixin)).toBe(true);
    expect(constraintSupports(appliedConstraint, derivedMixin)).toBe(true);
    appliedConstraint.polymorphic = false;
    expect(constraintSupports(appliedConstraint, appliedMixin)).toBe(false);
    expect(constraintSupports(appliedConstraint, derivedMixin)).toBe(false);
  });

  it("keeps explicit lists polymorphic without an abstract constraint", () => {
    const { document, pump, pumpChild, otherElement } = makeFixture();
    const polymorphic = makeConstraint(document, { constraintClasses: [pump.name] });
    const nonpolymorphic = makeConstraint(document, { polymorphic: false, constraintClasses: [pump.name] });

    expect(constraintSupports(polymorphic, pump)).toBe(true);
    expect(constraintSupports(polymorphic, pumpChild)).toBe(true);
    expect(constraintSupports(polymorphic, otherElement)).toBe(false);
    expect(constraintSupports(nonpolymorphic, pump)).toBe(true);
    expect(constraintSupports(nonpolymorphic, pumpChild)).toBe(false);
    expect(satisfiesConstraintClass(pumpChild, pump)).toBe(true);
  });

  it("checks explicit classes outside the abstract constraint and relationship inheritance", () => {
    const { document, element, outside, outsideChild, rootRelationship, derivedRelationship } = makeFixture();
    const outsideConstraint = makeConstraint(document, {
      polymorphic: false,
      abstractConstraint: element.name,
      constraintClasses: [outside.name],
    });
    const relationshipConstraint = makeConstraint(document, { constraintClasses: [rootRelationship.name] });

    expect(constraintSupports(outsideConstraint, outside)).toBe(true);
    expect(constraintSupports(outsideConstraint, outsideChild)).toBe(false);
    expect(constraintSupports(relationshipConstraint, derivedRelationship)).toBe(true);
    relationshipConstraint.polymorphic = false;
    expect(constraintSupports(relationshipConstraint, derivedRelationship)).toBe(false);
  });

  it("accepts every endpoint kind named by AnyClass, while rejecting structs and custom attributes", () => {
    const { document, anyClass, element, mixin, rootRelationship, view, struct, customAttribute } = makeFixture();
    const constraint = makeConstraint(document, { constraintClasses: [anyClass.name] });

    expect(constraintSupports(constraint, element)).toBe(true);
    expect(constraintSupports(constraint, mixin)).toBe(true);
    expect(constraintSupports(constraint, rootRelationship)).toBe(true);
    expect(constraintSupports(constraint, view)).toBe(true);
    expect(constraintSupports(constraint, struct)).toBe(false);
    expect(constraintSupports(constraint, customAttribute)).toBe(false);
  });

  it("rejects an empty constraint without an abstract class", () => {
    const { document, element } = makeFixture();
    expect(constraintSupports(makeConstraint(document, {}), element)).toBe(false);
  });
});

describe("constraintSupports validation integration", () => {
  it("rejects an OtherElement end when a nonpolymorphic base allows abstract Element and Pump", () => {
    const set = new SchemaSet();
    const document = set.createSchema("Test", "t", 1, 0, 0);
    document.createEntity("Element", { modifier: ECClassModifier.Abstract });
    document.createEntity("Pump", { baseClass: "Element" });
    document.createEntity("OtherElement", { baseClass: "Element" });
    document.createEntity("Port");
    document.createRelationship("BaseRelationship", {
      modifier: ECClassModifier.Abstract,
      source: {
        polymorphic: false, multiplicity: "(0..1)", roleLabel: "has", abstractConstraint: "Element", constraintClasses: ["Pump"],
      },
      target: { multiplicity: "(0..1)", roleLabel: "is in", constraintClasses: ["Port"] },
    });
    document.createRelationship("DerivedRelationship", {
      modifier: ECClassModifier.Sealed,
      baseClass: "BaseRelationship",
      source: { polymorphic: false, multiplicity: "(0..1)", roleLabel: "has", constraintClasses: ["OtherElement"] },
      target: { multiplicity: "(0..1)", roleLabel: "is in", constraintClasses: ["Port"] },
    });

    expect([...validateSchemaDocument(document)].map((issue) => issue.name)).to.include("relationship-constraint-class-widens-base");
  });

  it("checks abstract and multiplicity narrowing even when the base has no listed classes", () => {
    const document = new SchemaDocument("Test", "t", 1, 0, 0);
    document.createEntity("Element");
    document.createEntity("OtherElement", { baseClass: "Element" });
    const base = document.createRelationship("Base", {
      source: { polymorphic: false, multiplicity: "(0..1)", abstractConstraint: "Element", roleLabel: "has" },
      target: { roleLabel: "is in", constraintClasses: ["Element"] },
    });
    document.createRelationship("Derived", {
      baseClass: base.name,
      source: { polymorphic: false, multiplicity: "(0..*)", abstractConstraint: "OtherElement", constraintClasses: ["OtherElement"] },
      target: { constraintClasses: ["Element"] },
    });

    const issueNames = [...validateSchemaDocument(document)].map((issue) => issue.name);
    expect(issueNames).to.include("relationship-constraint-abstract-widens-base");
    expect(issueNames).to.include("relationship-constraint-multiplicity-widens-base");
    expect(issueNames).not.to.include("relationship-constraint-class-widens-base");
  });

  it("rejects an OtherElement navigation owner while accepting Pump", () => {
    const set = new SchemaSet();
    const document = set.createSchema("Test", "t", 1, 0, 0);
    const element = document.createEntity("Element", { modifier: ECClassModifier.Abstract });
    const pump = document.createEntity("Pump", { baseClass: element.name });
    const otherElement = document.createEntity("OtherElement", { baseClass: element.name });
    document.createEntity("Port");
    const relationship = document.createRelationship("Relates", {
      source: {
        polymorphic: false, multiplicity: "(0..1)", roleLabel: "has", abstractConstraint: element.name, constraintClasses: [pump.name],
      },
      target: { multiplicity: "(0..1)", roleLabel: "is in", constraintClasses: ["Port"] },
    });
    pump.createNavigation("Port", relationship.name, StrengthDirection.Forward);
    otherElement.createNavigation("Port", relationship.name, StrengthDirection.Forward);

    const navigationIssues = [...validateSchemaDocument(document)].filter((issue) => issue.name === "property-navigation-class-not-constrained");
    expect(navigationIssues).toHaveLength(1);
    expect(navigationIssues[0].location).toBe("Test:OtherElement.Port");
  });
});
