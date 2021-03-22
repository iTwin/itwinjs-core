/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import {
  AnyEnumerator, Constant, CustomAttributeClass, EntityClass, Enumeration, Format, InvertedUnit, KindOfQuantity, Mixin, Phenomenon, PrimitiveProperty,
  PropertyCategory, RelationshipClass, RelationshipConstraint, RelationshipEnd, Schema, SchemaCompareDiagnostics, SchemaContext, SchemaItemType, Unit,
} from "../../ecschema-metadata";
import { ChangeType, SchemaChanges } from "../../Validation/SchemaChanges";

describe("SchemaChanges tests", () => {
  let schema: Schema;
  beforeEach(async () => {
    schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
  });

  describe("SchemaChanges", () => {
    it("SchemaDelta, correct change created", async () => {
      const diag = new SchemaCompareDiagnostics.SchemaDelta(schema, ["label", "LabelA", "LabelB"]);
      const changes = new SchemaChanges(schema);

      changes.addDiagnostic(diag);

      expect(changes.propertyValueChanges.length).to.equal(1, "Expected 1 differences.");
      expect(changes.propertyValueChanges[0].topLevelSchemaItem).to.equal(schema);
      expect(changes.propertyValueChanges[0].diagnostic).to.equal(diag);
      expect(changes.propertyValueChanges[0].changeType).to.equal(ChangeType.Delta);
      const text = changes.propertyValueChanges[0].toString();
      expect(text).to.equal("Label: LabelA -> LabelB");
    });

    it("SchemaReferenceMissing, correct change created", async () => {
      const refSchema = new Schema(new SchemaContext(), "ReferenceSchema", "ref", 1, 0, 0);
      const diag = new SchemaCompareDiagnostics.SchemaReferenceMissing(schema, [refSchema]);
      const changes = new SchemaChanges(schema);

      changes.addDiagnostic(diag);

      expect(changes.missingSchemaReferences.length).to.equal(1, "Expected 1 differences.");
      expect(changes.missingSchemaReferences[0].topLevelSchemaItem).to.equal(schema);
      expect(changes.missingSchemaReferences[0].diagnostic).to.equal(diag);
      expect(changes.missingSchemaReferences[0].changeType).to.equal(ChangeType.Missing);
      const text = changes.missingSchemaReferences[0].toString();
      expect(text).to.equal(`Schema(${refSchema.name})`);
    });

    it("SchemaReferenceDelta, correct change created", async () => {
      const refSchema = new Schema(new SchemaContext(), "ReferenceSchema", "ref", 2, 0, 0);
      const diag = new SchemaCompareDiagnostics.SchemaReferenceDelta(schema, [refSchema, "01.00.00", "02.00.00"]);
      const changes = new SchemaChanges(schema);

      changes.addDiagnostic(diag);

      expect(changes.schemaReferenceDeltas.length).to.equal(1, "Expected 1 differences.");
      expect(changes.schemaReferenceDeltas[0].topLevelSchemaItem).to.equal(schema);
      expect(changes.schemaReferenceDeltas[0].diagnostic).to.equal(diag);
      expect(changes.schemaReferenceDeltas[0].changeType).to.equal(ChangeType.Delta);
      const text = changes.schemaReferenceDeltas[0].toString();
      expect(text).to.equal(`Schema(${refSchema.name}): 01.00.00 -> 02.00.00`);
    });
  });

  describe("ClassChanges", () => {
    it("ClassDelta, correct change created", async () => {
      const testClass = new EntityClass(schema, "TestClass");
      const diag = new SchemaCompareDiagnostics.ClassDelta(testClass, ["modifier", "Abstract", "Sealed"]);
      const changes = new SchemaChanges(schema);

      changes.addDiagnostic(diag);

      expect(changes.classChanges.has(testClass.name)).to.be.true;
      const classChange = changes.classChanges.get(testClass.name);
      expect(classChange!.schemaItemType).to.equal(SchemaItemType.EntityClass);
      const propChanges = classChange!.propertyValueChanges;
      expect(propChanges.length).to.equal(1);

      expect(propChanges[0].topLevelSchemaItem).to.equal(testClass);
      expect(propChanges[0].diagnostic).to.equal(diag);
      expect(propChanges[0].changeType).to.equal(ChangeType.Delta);
      const text = propChanges[0].toString();
      expect(text).to.equal("Modifier: Abstract -> Sealed");
    });

    it("BaseClassDelta, correct change created", async () => {
      const baseA = new EntityClass(schema, "BaseClassA");
      const baseB = new EntityClass(schema, "BaseClassA");
      const testClass = new EntityClass(schema, "TestClass");
      const diag = new SchemaCompareDiagnostics.BaseClassDelta(testClass, [baseA, baseB]);
      const changes = new SchemaChanges(schema);

      changes.addDiagnostic(diag);

      expect(changes.classChanges.has(testClass.name)).to.be.true;
      const change = changes.classChanges.get(testClass.name);
      expect(change!.ecTypeName).to.equal(testClass.name);
      expect(change!.baseClassDelta!.topLevelSchemaItem).to.equal(testClass);
      expect(change!.baseClassDelta!.diagnostic).to.equal(diag);
      expect(change!.baseClassDelta!.changeType).to.equal(ChangeType.Delta);
      const text = change!.baseClassDelta!.toString();
      expect(text).to.equal(`BaseClass: ${baseA.fullName} -> ${baseB.fullName}`);
    });

    it("BaseClassDelta, class A undefined, correct change created", async () => {
      const baseB = new EntityClass(schema, "BaseClassA");
      const testClass = new EntityClass(schema, "TestClass");
      const diag = new SchemaCompareDiagnostics.BaseClassDelta(testClass, [undefined, baseB]);
      const changes = new SchemaChanges(schema);

      changes.addDiagnostic(diag);

      expect(changes.classChanges.has(testClass.name)).to.be.true;
      const change = changes.classChanges.get(testClass.name);
      expect(change!.ecTypeName).to.equal(testClass.name);
      expect(change!.baseClassDelta!.topLevelSchemaItem).to.equal(testClass);
      expect(change!.baseClassDelta!.diagnostic).to.equal(diag);
      expect(change!.baseClassDelta!.changeType).to.equal(ChangeType.Delta);
      const text = change!.baseClassDelta!.toString();
      expect(text).to.equal(`BaseClass: undefined -> ${baseB.fullName}`);
    });

    it("BaseClassDelta, class A undefined, correct change created", async () => {
      const baseA = new EntityClass(schema, "BaseClassA");
      const testClass = new EntityClass(schema, "TestClass");
      const diag = new SchemaCompareDiagnostics.BaseClassDelta(testClass, [baseA, undefined]);
      const changes = new SchemaChanges(schema);

      changes.addDiagnostic(diag);

      expect(changes.classChanges.has(testClass.name)).to.be.true;
      const change = changes.classChanges.get(testClass.name);
      expect(change!.ecTypeName).to.equal(testClass.name);
      expect(change!.baseClassDelta!.topLevelSchemaItem).to.equal(testClass);
      expect(change!.baseClassDelta!.diagnostic).to.equal(diag);
      expect(change!.baseClassDelta!.changeType).to.equal(ChangeType.Delta);
      const text = change!.baseClassDelta!.toString();
      expect(text).to.equal(`BaseClass: ${baseA.fullName} -> undefined`);
    });

    it("RelationshipClassDelta, correct change created", async () => {
      const testClass = new RelationshipClass(schema, "TestClass");
      const diag = new SchemaCompareDiagnostics.RelationshipDelta(testClass, ["strength", "Embedding", "Holding"]);
      const changes = new SchemaChanges(schema);

      changes.addDiagnostic(diag);

      expect(changes.classChanges.has(testClass.name)).to.be.true;
      const classChange = changes.classChanges.get(testClass.name);
      expect(classChange!.schemaItemType).to.equal(SchemaItemType.RelationshipClass);
      const propChanges = classChange!.propertyValueChanges;
      expect(propChanges.length).to.equal(1);
      expect(propChanges[0].topLevelSchemaItem).to.equal(testClass);
      expect(propChanges[0].diagnostic).to.equal(diag);
      expect(propChanges[0].changeType).to.equal(ChangeType.Delta);
      const text = propChanges[0].toString();
      expect(text).to.equal("Strength: Embedding -> Holding");
    });

    it("MixinDelta, correct change created", async () => {
      const testClass = new Mixin(schema, "TestClass");
      const diag = new SchemaCompareDiagnostics.MixinDelta(testClass, ["appliesTo", "TestSchema.ClassA", "TestSchema.ClassB"]);
      const changes = new SchemaChanges(schema);

      changes.addDiagnostic(diag);

      expect(changes.classChanges.has(testClass.name)).to.be.true;
      const classChange = changes.classChanges.get(testClass.name);
      expect(classChange!.schemaItemType).to.equal(SchemaItemType.Mixin);
      const propChanges = classChange!.propertyValueChanges;
      expect(propChanges.length).to.equal(1);

      expect(propChanges[0].topLevelSchemaItem).to.equal(testClass);
      expect(propChanges[0].diagnostic).to.equal(diag);
      expect(propChanges[0].changeType).to.equal(ChangeType.Delta);
      const text = propChanges[0].toString();
      expect(text).to.equal("AppliesTo: TestSchema.ClassA -> TestSchema.ClassB");
    });

    it("Source RelationshipConstraintDelta, correct change created", async () => {
      const testClass = new RelationshipClass(schema, "TestClass");
      const constraint = new RelationshipConstraint(testClass, RelationshipEnd.Source);
      const diag = new SchemaCompareDiagnostics.RelationshipConstraintDelta(constraint, ["polymorphic", true, false]);
      const changes = new SchemaChanges(schema);

      changes.addDiagnostic(diag);

      expect(changes.classChanges.has(testClass.name)).to.be.true;
      const constraintChanges = changes.classChanges.get(testClass.name)!.sourceConstraintChanges.get(constraint.fullName);
      expect(constraintChanges).to.not.be.undefined;
      const propChanges = constraintChanges!.propertyValueChanges;
      expect(propChanges.length).to.equal(1);
      expect(propChanges[0].topLevelSchemaItem).to.equal(testClass);
      expect(propChanges[0].diagnostic).to.equal(diag);
      expect(propChanges[0].changeType).to.equal(ChangeType.Delta);
      const text = propChanges[0].toString();
      expect(text).to.equal("Polymorphic: true -> false");
    });

    it("Target RelationshipConstraintDelta, correct change created", async () => {
      const testClass = new RelationshipClass(schema, "TestClass");
      const constraint = new RelationshipConstraint(testClass, RelationshipEnd.Target);
      const diag = new SchemaCompareDiagnostics.RelationshipConstraintDelta(constraint, ["polymorphic", true, false]);
      const changes = new SchemaChanges(schema);

      changes.addDiagnostic(diag);

      expect(changes.classChanges.has(testClass.name)).to.be.true;
      const constraintChanges = changes.classChanges.get(testClass.name)!.targetConstraintChanges.get(constraint.fullName);
      expect(constraintChanges).to.not.be.undefined;
      const propChanges = constraintChanges!.propertyValueChanges;
      expect(propChanges.length).to.equal(1);
      expect(propChanges[0].topLevelSchemaItem).to.equal(testClass);
      expect(propChanges[0].diagnostic).to.equal(diag);
      expect(propChanges[0].changeType).to.equal(ChangeType.Delta);
      const text = propChanges[0].toString();
      expect(text).to.equal("Polymorphic: true -> false");
    });

    it("Source RelationshipConstraintClassMissing, correct change created", async () => {
      const testClass = new RelationshipClass(schema, "TestRelationship");
      const constraintClass = new EntityClass(schema, "TestClass");
      const constraint = new RelationshipConstraint(testClass, RelationshipEnd.Source);
      const diag = new SchemaCompareDiagnostics.RelationshipConstraintClassMissing(constraint, [constraintClass]);
      const changes = new SchemaChanges(schema);

      changes.addDiagnostic(diag);

      expect(changes.classChanges.has(testClass.name)).to.be.true;
      const constraintChanges = changes.classChanges.get(testClass.name)!.sourceConstraintChanges.get(constraint.fullName);
      expect(constraintChanges).to.not.be.undefined;
      expect(constraintChanges!.constraintClassChanges.length).to.equal(1);
      expect(constraintChanges!.constraintClassChanges[0].topLevelSchemaItem).to.equal(testClass);
      expect(constraintChanges!.constraintClassChanges[0].diagnostic).to.equal(diag);
      expect(constraintChanges!.constraintClassChanges[0].changeType).to.equal(ChangeType.Missing);
      const text = constraintChanges!.constraintClassChanges[0].toString();
      expect(text).to.equal("ConstraintClass: TestSchema.TestClass");
    });

    it("Target RelationshipConstraintClassMissing, correct change created", async () => {
      const testClass = new RelationshipClass(schema, "TestRelationship");
      const constraintClass = new EntityClass(schema, "TestClass");
      const constraint = new RelationshipConstraint(testClass, RelationshipEnd.Target);
      const diag = new SchemaCompareDiagnostics.RelationshipConstraintClassMissing(constraint, [constraintClass]);
      const changes = new SchemaChanges(schema);

      changes.addDiagnostic(diag);

      expect(changes.classChanges.has(testClass.name)).to.be.true;
      const constraintChanges = changes.classChanges.get(testClass.name)!.targetConstraintChanges.get(constraint.fullName);
      expect(constraintChanges).to.not.be.undefined;
      expect(constraintChanges).to.not.be.undefined;
      expect(constraintChanges!.constraintClassChanges.length).to.equal(1);
      expect(constraintChanges!.constraintClassChanges[0].topLevelSchemaItem).to.equal(testClass);
      expect(constraintChanges!.constraintClassChanges[0].diagnostic).to.equal(diag);
      expect(constraintChanges!.constraintClassChanges[0].changeType).to.equal(ChangeType.Missing);
      const text = constraintChanges!.constraintClassChanges[0].toString();
      expect(text).to.equal("ConstraintClass: TestSchema.TestClass");
    });

    it("CustomAttributeClassDelta, correct change created", async () => {
      const testClass = new CustomAttributeClass(schema, "TestClass");
      const diag = new SchemaCompareDiagnostics.RelationshipDelta(testClass, ["containerType", "Schema", "AnyClass"]);
      const changes = new SchemaChanges(schema);

      changes.addDiagnostic(diag);

      expect(changes.classChanges.has(testClass.name)).to.be.true;
      const classChange = changes.classChanges.get(testClass.name);
      expect(classChange!.schemaItemType).to.equal(SchemaItemType.CustomAttributeClass);
      const propChanges = classChange!.propertyValueChanges;
      expect(propChanges.length).to.equal(1);

      expect(propChanges[0].topLevelSchemaItem).to.equal(testClass);
      expect(propChanges[0].diagnostic).to.equal(diag);
      expect(propChanges[0].changeType).to.equal(ChangeType.Delta);
      const text = propChanges[0].toString();
      expect(text).to.equal("ContainerType: Schema -> AnyClass");
    });

    it("EntityMixinMissing, correct change created", async () => {
      const testMixin = new Mixin(schema, "TestMixin");
      const testClass = new EntityClass(schema, "TestClass");
      const diag = new SchemaCompareDiagnostics.EntityMixinMissing(testClass, [testMixin]);
      const changes = new SchemaChanges(schema);

      changes.addDiagnostic(diag);

      expect(changes.classChanges.has(testClass.name)).to.be.true;
      const mixinChanges = changes.classChanges.get(testClass.name)!.entityMixinChanges.get(testMixin.fullName);
      expect(mixinChanges!.ecTypeName).to.equal(testMixin.fullName);
      expect(mixinChanges!.entityMixinChange[0].changeKey).to.equal(testMixin.fullName);
      expect(mixinChanges!.entityMixinChange[0].topLevelSchemaItem).to.equal(testClass);
      expect(mixinChanges!.entityMixinChange[0].diagnostic).to.equal(diag);
      expect(mixinChanges!.entityMixinChange[0].changeType).to.equal(ChangeType.Missing);
      const text = mixinChanges!.entityMixinChange[0].toString();
      expect(text).to.equal("Mixin: TestSchema.TestMixin");
    });

    describe("PropertyChanges", () => {
      it("PropertyDelta, correct change created", async () => {
        const testClass = new EntityClass(schema, "TestClass");
        const testProperty = new PrimitiveProperty(testClass, "BaseClassA");
        const diag = new SchemaCompareDiagnostics.PropertyDelta(testProperty, ["label", "LabelA", "LabelB"]);
        const changes = new SchemaChanges(schema);

        changes.addDiagnostic(diag);

        expect(changes.classChanges.has(testClass.name)).to.be.true;
        const propChanges = changes.classChanges.get(testClass.name)!.propertyChanges.get(testProperty.name);
        expect(propChanges!.ecTypeName).to.equal(testProperty.name);
        expect(propChanges!.propertyValueChanges.length).to.equal(1);
        expect(propChanges!.propertyValueChanges[0].topLevelSchemaItem).to.equal(testClass);
        expect(propChanges!.propertyValueChanges[0].diagnostic).to.equal(diag);
        expect(propChanges!.propertyValueChanges[0].changeType).to.equal(ChangeType.Delta);
        const text = propChanges!.propertyValueChanges[0].toString();
        expect(text).to.equal("Label: LabelA -> LabelB");
      });

      it("PropertyMissing, correct change created", async () => {
        const testClass = new EntityClass(schema, "TestClass");
        const testProperty = new PrimitiveProperty(testClass, "TestProperty");
        const diag = new SchemaCompareDiagnostics.PropertyMissing(testProperty, []);
        const changes = new SchemaChanges(schema);

        changes.addDiagnostic(diag);

        expect(changes.classChanges.has(testClass.name)).to.be.true;
        const propChanges = changes.classChanges.get(testClass.name)!.propertyChanges.get(testProperty.name);
        expect(propChanges!.ecTypeName).to.equal(testProperty.name);
        expect(propChanges!.propertyMissing).to.not.be.undefined;

        expect(propChanges!.propertyMissing!.topLevelSchemaItem).to.equal(testClass);
        expect(propChanges!.propertyMissing!.diagnostic).to.equal(diag);
        expect(propChanges!.propertyMissing!.changeType).to.equal(ChangeType.Missing);
        const text = propChanges!.propertyMissing!.toString();
        expect(text).to.equal("Property(TestProperty)");
      });
    });
  });

  describe("EnumerationChanges", () => {
    it("EnumerationDelta, correct change created", async () => {
      const testClass = new Enumeration(schema, "TestEnumeration");
      const diag = new SchemaCompareDiagnostics.EnumerationDelta(testClass, ["label", "LabelA", "LabelB"]);
      const changes = new SchemaChanges(schema);

      changes.addDiagnostic(diag);

      expect(changes.enumerationChanges.has(testClass.name)).to.be.true;
      const schemaItemChange = changes.enumerationChanges.get(testClass.name);
      expect(schemaItemChange!.schemaItemType).to.equal(SchemaItemType.Enumeration);
      const propChanges = schemaItemChange!.propertyValueChanges;
      expect(propChanges.length).to.equal(1);

      expect(propChanges[0].topLevelSchemaItem).to.equal(testClass);
      expect(propChanges[0].diagnostic).to.equal(diag);
      expect(propChanges[0].changeType).to.equal(ChangeType.Delta);
      const text = propChanges[0].toString();
      expect(text).to.equal("Label: LabelA -> LabelB");
    });

    it("EnumeratorDelta, correct change created", async () => {
      const enumerator: AnyEnumerator = {
        name: "A",
        value: 1,
        label: "LabelA",
      };
      const testClass = new Enumeration(schema, "TestEnumeration");
      const diag = new SchemaCompareDiagnostics.EnumeratorDelta(testClass, [enumerator, "label", "LabelA", "LabelB"]);
      const changes = new SchemaChanges(schema);

      changes.addDiagnostic(diag);

      expect(changes.enumerationChanges.has(testClass.name)).to.be.true;
      const change = changes.enumerationChanges.get(testClass.name)!.enumeratorChanges.get(enumerator.name);
      expect(change!.ecTypeName).to.equal(enumerator.name);
      expect(change!.enumeratorDeltas.length).to.equal(1);
      expect(change!.enumeratorDeltas[0].changeKey).to.equal(enumerator.name);
      expect(change!.enumeratorDeltas[0].topLevelSchemaItem).to.equal(testClass);
      expect(change!.enumeratorDeltas[0].diagnostic).to.equal(diag);
      expect(change!.enumeratorDeltas[0].changeType).to.equal(ChangeType.Delta);
      const text = change!.enumeratorDeltas[0].toString();
      expect(text).to.equal("Label: LabelA -> LabelB");
    });

    it("EnumeratorMissing, correct change created", async () => {
      const enumerator: AnyEnumerator = {
        name: "A",
        value: 1,
        label: "LabelA",
      };
      const testClass = new Enumeration(schema, "TestEnumeration");
      const diag = new SchemaCompareDiagnostics.EnumeratorMissing(testClass, [enumerator]);
      const changes = new SchemaChanges(schema);

      changes.addDiagnostic(diag);

      expect(changes.enumerationChanges.has(testClass.name)).to.be.true;
      const change = changes.enumerationChanges.get(testClass.name)!.enumeratorChanges.get(enumerator.name);
      expect(change!.ecTypeName).to.equal(enumerator.name);
      expect(change!.enumeratorMissing).to.not.be.undefined;
      expect(change!.enumeratorMissing!.changeKey).to.equal(enumerator.name);
      expect(change!.enumeratorMissing!.topLevelSchemaItem).to.equal(testClass);
      expect(change!.enumeratorMissing!.diagnostic).to.equal(diag);
      expect(change!.enumeratorMissing!.changeType).to.equal(ChangeType.Missing);
      const text = change!.enumeratorMissing!.toString();
      expect(text).to.equal("Enumerator(A)");
    });
  });

  describe("CustomAttributeContainerChanges", () => {
    it("CustomAttributeInstanceClassMissing, Schema container, correct change created", async () => {
      const ca = { className: "TestSchema.TestCustomAttribute" };
      const diag = new SchemaCompareDiagnostics.CustomAttributeInstanceClassMissing(schema, [ca]);
      const changes = new SchemaChanges(schema);

      changes.addDiagnostic(diag);

      const caChanges = changes.customAttributeChanges.get(ca.className);
      expect(caChanges).to.not.be.undefined;
      expect(caChanges!.customAttributeChanges.length).to.equal(1);
      expect(caChanges!.customAttributeChanges[0].changeKey).to.equal(ca.className);
      expect(caChanges!.customAttributeChanges[0].topLevelSchemaItem).to.equal(schema);
      expect(caChanges!.customAttributeChanges[0].diagnostic).to.equal(diag);
      expect(caChanges!.customAttributeChanges[0].changeType).to.equal(ChangeType.Missing);
      const text = caChanges!.customAttributeChanges[0].toString();
      expect(text).to.equal("CustomAttribute: TestSchema.TestCustomAttribute");
    });

    it("CustomAttributeInstanceClassMissing, SchemaItem container, correct change created", async () => {
      const ca = { className: "TestSchema.TestCustomAttribute" };
      const testClass = new EntityClass(schema, "TestClass");
      const diag = new SchemaCompareDiagnostics.CustomAttributeInstanceClassMissing(testClass, [ca]);
      const changes = new SchemaChanges(schema);

      changes.addDiagnostic(diag);

      expect(changes.classChanges.has(testClass.name)).to.be.true;
      const caChanges = changes.classChanges.get(testClass.name)!.customAttributeChanges.get(ca.className);
      expect(caChanges).to.not.be.undefined;
      expect(caChanges!.customAttributeChanges.length).to.equal(1);
      expect(caChanges!.customAttributeChanges[0].changeKey).to.equal(ca.className);
      expect(caChanges!.customAttributeChanges[0].topLevelSchemaItem).to.equal(testClass);
      expect(caChanges!.customAttributeChanges[0].diagnostic).to.equal(diag);
      expect(caChanges!.customAttributeChanges[0].changeType).to.equal(ChangeType.Missing);
      const text = caChanges!.customAttributeChanges[0].toString();
      expect(text).to.equal("CustomAttribute: TestSchema.TestCustomAttribute");
    });

    it("CustomAttributeInstanceClassMissing, Property container, correct change created", async () => {
      const ca = { className: "TestSchema.TestCustomAttribute" };
      const testClass = new EntityClass(schema, "TestClass");
      const testProperty = new PrimitiveProperty(testClass, "TestProperty");
      const diag = new SchemaCompareDiagnostics.CustomAttributeInstanceClassMissing(testProperty, [ca]);
      const changes = new SchemaChanges(schema);

      changes.addDiagnostic(diag);

      expect(changes.classChanges.has(testClass.name)).to.be.true;
      const propChanges = changes.classChanges.get(testClass.name)!.propertyChanges.get(testProperty.name);
      expect(propChanges).to.not.be.undefined;
      const caChanges = propChanges!.customAttributeChanges.get(ca.className);
      expect(caChanges).to.not.be.undefined;
      expect(caChanges!.customAttributeChanges.length).to.equal(1);
      expect(caChanges!.customAttributeChanges[0].changeKey).to.equal(ca.className);
      expect(caChanges!.customAttributeChanges[0].topLevelSchemaItem).to.equal(testClass);
      expect(caChanges!.customAttributeChanges[0].diagnostic).to.equal(diag);
      expect(caChanges!.customAttributeChanges[0].changeType).to.equal(ChangeType.Missing);
      const text = caChanges!.customAttributeChanges[0].toString();
      expect(text).to.equal("CustomAttribute: TestSchema.TestCustomAttribute");
    });

    it("CustomAttributeInstanceClassMissing, Source RelationshipConstraint container, correct change created", async () => {
      const ca = { className: "TestSchema.TestCustomAttribute" };
      const relationshipClass = new RelationshipClass(schema, "TestClass");
      const constraint = new RelationshipConstraint(relationshipClass, RelationshipEnd.Source);
      const diag = new SchemaCompareDiagnostics.CustomAttributeInstanceClassMissing(constraint, [ca]);
      const changes = new SchemaChanges(schema);

      changes.addDiagnostic(diag);

      expect(changes.classChanges.has(relationshipClass.name)).to.be.true;
      const constraintChanges = changes.classChanges.get(relationshipClass.name)!.sourceConstraintChanges.get(constraint.fullName);
      expect(constraintChanges).to.not.be.undefined;
      const caChanges = constraintChanges!.customAttributeChanges.get(ca.className);
      expect(caChanges).to.not.be.undefined;
      expect(caChanges!.customAttributeChanges.length).to.equal(1);
      expect(caChanges!.customAttributeChanges[0].changeKey).to.equal(ca.className);
      expect(caChanges!.customAttributeChanges[0].topLevelSchemaItem).to.equal(relationshipClass);
      expect(caChanges!.customAttributeChanges[0].diagnostic).to.equal(diag);
      expect(caChanges!.customAttributeChanges[0].changeType).to.equal(ChangeType.Missing);
      const text = caChanges!.customAttributeChanges[0].toString();
      expect(text).to.equal("CustomAttribute: TestSchema.TestCustomAttribute");
    });

    it("CustomAttributeInstanceClassMissing, Target RelationshipConstraint container, correct change created", async () => {
      const ca = { className: "TestSchema.TestCustomAttribute" };
      const relationshipClass = new RelationshipClass(schema, "TestClass");
      const constraint = new RelationshipConstraint(relationshipClass, RelationshipEnd.Target);
      const diag = new SchemaCompareDiagnostics.CustomAttributeInstanceClassMissing(constraint, [ca]);
      const changes = new SchemaChanges(schema);

      changes.addDiagnostic(diag);

      expect(changes.classChanges.has(relationshipClass.name)).to.be.true;
      const constraintChanges = changes.classChanges.get(relationshipClass.name)!.targetConstraintChanges.get(constraint.fullName);
      expect(constraintChanges).to.not.be.undefined;
      const caChanges = constraintChanges!.customAttributeChanges.get(ca.className);
      expect(caChanges).to.not.be.undefined;
      expect(caChanges!.customAttributeChanges.length).to.equal(1);
      expect(caChanges!.customAttributeChanges[0].changeKey).to.equal(ca.className);
      expect(caChanges!.customAttributeChanges[0].topLevelSchemaItem).to.equal(relationshipClass);
      expect(caChanges!.customAttributeChanges[0].diagnostic).to.equal(diag);
      expect(caChanges!.customAttributeChanges[0].changeType).to.equal(ChangeType.Missing);
      const text = caChanges!.customAttributeChanges[0].toString();
      expect(text).to.equal("CustomAttribute: TestSchema.TestCustomAttribute");
    });
  });

  describe("KindOfQuantityChanges", () => {
    it("KoqDelta, correct change created", async () => {
      const testClass = new KindOfQuantity(schema, "TestClass");
      const diag = new SchemaCompareDiagnostics.KoqDelta(testClass, ["relativeError", 1, 2]);
      const changes = new SchemaChanges(schema);

      changes.addDiagnostic(diag);

      expect(changes.kindOfQuantityChanges.has(testClass.name)).to.be.true;
      const schemaItemChange = changes.kindOfQuantityChanges.get(testClass.name);
      expect(schemaItemChange!.schemaItemType).to.equal(SchemaItemType.KindOfQuantity);
      const propChanges = schemaItemChange!.propertyValueChanges;
      expect(propChanges.length).to.equal(1);

      expect(propChanges[0].topLevelSchemaItem).to.equal(testClass);
      expect(propChanges[0].diagnostic).to.equal(diag);
      expect(propChanges[0].changeType).to.equal(ChangeType.Delta);
      const text = propChanges[0].toString();
      expect(text).to.equal("RelativeError: 1 -> 2");
    });

    it("PresentationUnitMissing, correct change created", async () => {
      const testClass = new KindOfQuantity(schema, "TestClass");
      const format = new Format(schema, "TestClass");
      const diag = new SchemaCompareDiagnostics.PresentationUnitMissing(testClass, [format]);
      const changes = new SchemaChanges(schema);

      changes.addDiagnostic(diag);

      expect(changes.kindOfQuantityChanges.has(testClass.name)).to.be.true;
      const change = changes.kindOfQuantityChanges.get(testClass.name)!.presentationUnitChanges.get(format.fullName);
      expect(change!.ecTypeName).to.equal(format.fullName);
      expect(change!.presentationUnitChange.length).to.equal(1);
      expect(change!.presentationUnitChange[0].changeKey).to.equal(format.fullName);
      expect(change!.presentationUnitChange[0].topLevelSchemaItem).to.equal(testClass);
      expect(change!.presentationUnitChange[0].diagnostic).to.equal(diag);
      expect(change!.presentationUnitChange[0].changeType).to.equal(ChangeType.Missing);
      const text = change!.presentationUnitChange[0].toString();
      expect(text).to.equal("Unit: TestSchema.TestClass");
    });
  });

  describe("FormatChanges", () => {
    it("FormatDelta, correct change created", async () => {
      const testClass = new Format(schema, "TestClass");
      const diag = new SchemaCompareDiagnostics.FormatDelta(testClass, ["spacer", ",", ":"]);
      const changes = new SchemaChanges(schema);

      changes.addDiagnostic(diag);

      expect(changes.formatChanges.has(testClass.name)).to.be.true;
      const schemaItemChange = changes.formatChanges.get(testClass.name);
      expect(schemaItemChange!.schemaItemType).to.equal(SchemaItemType.Format);
      const propChanges = schemaItemChange!.propertyValueChanges;
      expect(propChanges.length).to.equal(1);

      expect(propChanges[0].topLevelSchemaItem).to.equal(testClass);
      expect(propChanges[0].diagnostic).to.equal(diag);
      expect(propChanges[0].changeType).to.equal(ChangeType.Delta);
      const text = propChanges[0].toString();
      expect(text).to.equal("Spacer: , -> :");
    });

    it("PresentationUnitMissing, correct change created", async () => {
      const testClass = new Format(schema, "TestClass");
      const unit = new Unit(schema, "TestUnit");
      const diag = new SchemaCompareDiagnostics.FormatUnitMissing(testClass, [unit]);
      const changes = new SchemaChanges(schema);

      changes.addDiagnostic(diag);

      expect(changes.formatChanges.has(testClass.name)).to.be.true;
      const change = changes.formatChanges.get(testClass.name)!.formatUnitChanges.get(unit.fullName);
      expect(change!.ecTypeName).to.equal(unit.fullName);
      expect(change!.formatUnitChanges.length).to.equal(1);
      expect(change!.formatUnitChanges[0].changeKey).to.equal(unit.fullName);
      expect(change!.formatUnitChanges[0].topLevelSchemaItem).to.equal(testClass);
      expect(change!.formatUnitChanges[0].diagnostic).to.equal(diag);
      expect(change!.formatUnitChanges[0].changeType).to.equal(ChangeType.Missing);
      const text = change!.formatUnitChanges[0].toString();
      expect(text).to.equal("Unit: TestSchema.TestUnit");
    });

    it("UnitLabelOverrideDelta, correct change created", async () => {
      const testClass = new Format(schema, "TestClass");
      const unit = new Unit(schema, "TestUnit");
      const diag = new SchemaCompareDiagnostics.UnitLabelOverrideDelta(testClass, [unit, "LabelA", "LabelB"]);
      const changes = new SchemaChanges(schema);

      changes.addDiagnostic(diag);

      expect(changes.formatChanges.has(testClass.name)).to.be.true;
      const change = changes.formatChanges.get(testClass.name)!.formatUnitChanges.get(unit.fullName);
      expect(change!.ecTypeName).to.equal(unit.fullName);
      expect(change!.unitLabelOverrideDeltas.length).to.equal(1);
      expect(change!.unitLabelOverrideDeltas[0].changeKey).to.equal(unit.fullName);
      expect(change!.unitLabelOverrideDeltas[0].topLevelSchemaItem).to.equal(testClass);
      expect(change!.unitLabelOverrideDeltas[0].diagnostic).to.equal(diag);
      expect(change!.unitLabelOverrideDeltas[0].changeType).to.equal(ChangeType.Delta);
      const text = change!.unitLabelOverrideDeltas[0].toString();
      expect(text).to.equal("Label: LabelA -> LabelB");
    });
  });

  describe("Other SchemaItems", () => {
    it("PropertyCategoryDelta, correct change created", async () => {
      const testClass = new PropertyCategory(schema, "TestClass");
      const diag = new SchemaCompareDiagnostics.PropertyCategoryDelta(testClass, ["priority", 1, 2]);
      const changes = new SchemaChanges(schema);

      changes.addDiagnostic(diag);

      expect(changes.schemaItemChanges.has(testClass.name)).to.be.true;
      const schemaItemChange = changes.schemaItemChanges.get(testClass.name);
      expect(schemaItemChange!.schemaItemType).to.equal(SchemaItemType.PropertyCategory);
      const propChanges = schemaItemChange!.propertyValueChanges;
      expect(propChanges.length).to.equal(1);

      expect(propChanges[0].topLevelSchemaItem).to.equal(testClass);
      expect(propChanges[0].diagnostic).to.equal(diag);
      expect(propChanges[0].changeType).to.equal(ChangeType.Delta);
      const text = propChanges[0].toString();
      expect(text).to.equal("Priority: 1 -> 2");
    });

    it("UnitDelta, correct change created", async () => {
      const testClass = new Unit(schema, "TestClass");
      const diag = new SchemaCompareDiagnostics.UnitDelta(testClass, ["unitSystem", "TestSchema.UnitSystemA", "TestSchema.UnitSystemB"]);
      const changes = new SchemaChanges(schema);

      changes.addDiagnostic(diag);

      expect(changes.schemaItemChanges.has(testClass.name)).to.be.true;
      const schemaItemChange = changes.schemaItemChanges.get(testClass.name);
      expect(schemaItemChange!.schemaItemType).to.equal(SchemaItemType.Unit);
      const propChanges = schemaItemChange!.propertyValueChanges;
      expect(propChanges.length).to.equal(1);

      expect(propChanges[0].topLevelSchemaItem).to.equal(testClass);
      expect(propChanges[0].diagnostic).to.equal(diag);
      expect(propChanges[0].changeType).to.equal(ChangeType.Delta);
      const text = propChanges[0].toString();
      expect(text).to.equal("UnitSystem: TestSchema.UnitSystemA -> TestSchema.UnitSystemB");
    });

    it("InvertedUnitDelta, correct change created", async () => {
      const testClass = new InvertedUnit(schema, "TestClass");
      const diag = new SchemaCompareDiagnostics.InvertedUnitDelta(testClass, ["unitSystem", "TestSchema.UnitSystemA", "TestSchema.UnitSystemB"]);
      const changes = new SchemaChanges(schema);

      changes.addDiagnostic(diag);

      expect(changes.schemaItemChanges.has(testClass.name)).to.be.true;
      const schemaItemChange = changes.schemaItemChanges.get(testClass.name);
      expect(schemaItemChange!.schemaItemType).to.equal(SchemaItemType.InvertedUnit);
      const propChanges = schemaItemChange!.propertyValueChanges;
      expect(propChanges.length).to.equal(1);

      expect(propChanges[0].topLevelSchemaItem).to.equal(testClass);
      expect(propChanges[0].diagnostic).to.equal(diag);
      expect(propChanges[0].changeType).to.equal(ChangeType.Delta);
      const text = propChanges[0].toString();
      expect(text).to.equal("UnitSystem: TestSchema.UnitSystemA -> TestSchema.UnitSystemB");
    });

    it("PhenomenonDelta, correct change created", async () => {
      const testClass = new Phenomenon(schema, "TestClass");
      const diag = new SchemaCompareDiagnostics.PhenomenonDelta(testClass, ["definition", "DefinitionA", "DefinitionB"]);
      const changes = new SchemaChanges(schema);

      changes.addDiagnostic(diag);

      expect(changes.schemaItemChanges.has(testClass.name)).to.be.true;
      const schemaItemChange = changes.schemaItemChanges.get(testClass.name);
      expect(schemaItemChange!.schemaItemType).to.equal(SchemaItemType.Phenomenon);
      const propChanges = schemaItemChange!.propertyValueChanges;
      expect(propChanges.length).to.equal(1);

      expect(propChanges[0].topLevelSchemaItem).to.equal(testClass);
      expect(propChanges[0].diagnostic).to.equal(diag);
      expect(propChanges[0].changeType).to.equal(ChangeType.Delta);
      const text = propChanges[0].toString();
      expect(text).to.equal("Definition: DefinitionA -> DefinitionB");
    });

    it("ConstantDelta, correct change created", async () => {
      const testClass = new Constant(schema, "TestClass");
      const diag = new SchemaCompareDiagnostics.ConstantDelta(testClass, ["phenomenon", "TestSchema.PhenomenonA", "TestSchema.PhenomenonB"]);
      const changes = new SchemaChanges(schema);

      changes.addDiagnostic(diag);

      expect(changes.schemaItemChanges.has(testClass.name)).to.be.true;
      const schemaItemChange = changes.schemaItemChanges.get(testClass.name);
      expect(schemaItemChange!.schemaItemType).to.equal(SchemaItemType.Constant);
      const propChanges = schemaItemChange!.propertyValueChanges;
      expect(propChanges.length).to.equal(1);

      expect(propChanges[0].topLevelSchemaItem).to.equal(testClass);
      expect(propChanges[0].diagnostic).to.equal(diag);
      expect(propChanges[0].changeType).to.equal(ChangeType.Delta);
      const text = propChanges[0].toString();
      expect(text).to.equal("Phenomenon: TestSchema.PhenomenonA -> TestSchema.PhenomenonB");
    });
  });
});
