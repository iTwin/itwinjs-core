/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { AnyProperty, DelayedPromiseWithProps, ECClass, EntityClass, KindOfQuantity, PrimitiveProperty, PrimitiveType,
  PropertyProps, RelationshipClass, Schema, SchemaContext, StructClass } from "@itwin/ecschema-metadata";
import { MutableClass } from "../../../Editing/Mutable/MutableClass";
import { MutableSchema } from "../../../Editing/Mutable/MutableSchema";
import { DiagnosticCategory, DiagnosticType } from "../../../Validation/Diagnostic";
import * as Rules from "../../../Validation/ECRules";
import { createSchemaJsonWithItems } from "../../TestUtils/DeserializationHelpers";

/* eslint-disable @typescript-eslint/naming-convention */

describe("PropertyRule tests", () => {
  let schema: Schema;
  let context: SchemaContext;
  let testClass: EntityClass;
  let testBaseClass: EntityClass;
  let testKindOfQuantity: KindOfQuantity;
  let testBaseKindOfQuantity: KindOfQuantity;

  beforeEach(async () => {
    context = new SchemaContext();
    schema = new Schema(context, "TestSchema", "ts", 1, 0, 0);
    const mutable = schema as MutableSchema;
    testClass = await mutable.createEntityClass("TestClass");
    testBaseClass = await mutable.createEntityClass("TestBaseClass");
    testKindOfQuantity = await mutable.createKindOfQuantity("TestKoQ");
    testBaseKindOfQuantity = await mutable.createKindOfQuantity("TestBaseKoQ");
    await (testClass as ECClass as MutableClass).setBaseClass(new DelayedPromiseWithProps(testBaseClass.key, async () => testBaseClass));
  });

  describe("IncompatibleValueTypePropertyOverride Tests", () => {
    it("IncompatibleValueTypePropertyOverride, rule violated.", async () => {
      await (testBaseClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);
      await (testClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.Integer);

      const properties = Array.from(testClass.getPropertiesSync(true));
      const results = Rules.incompatibleValueTypePropertyOverride(properties[0] as PrimitiveProperty);

      let resultHasEntries = false;
      for await (const diagnostic of results) {
        resultHasEntries = true;
        expect(diagnostic.ecDefinition).eq(properties[0]);
        expect(diagnostic.messageArgs).deep.eq([testClass.fullName, "TestProperty", testBaseClass.fullName, "string", "int"]);
        expect(diagnostic.messageText)
          .eq("The ECProperty 'TestSchema.TestClass.TestProperty' has a base property 'TestSchema.TestBaseClass.TestProperty' with a value type of string which is incompatible with the value type of int.");
        expect(diagnostic.category).eq(DiagnosticCategory.Error);
        expect(diagnostic.code).eq(Rules.DiagnosticCodes.IncompatibleValueTypePropertyOverride);
        expect(diagnostic.diagnosticType).eq(DiagnosticType.Property);
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").true;
    });

    it("IncompatibleValueTypePropertyOverride, multiple base classes, rule violated.", async () => {
      const rootBaseClass = new EntityClass(schema, "RootBaseClass");
      await (rootBaseClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);
      await (testClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.Integer);
      await (testClass as ECClass as MutableClass).setBaseClass(new DelayedPromiseWithProps(rootBaseClass.key, async () => rootBaseClass));

      const properties = Array.from(testClass.getPropertiesSync(true));
      const results = Rules.incompatibleValueTypePropertyOverride(properties[0] as PrimitiveProperty);

      let resultHasEntries = false;
      for await (const diagnostic of results) {
        resultHasEntries = true;
        expect(diagnostic.ecDefinition).eq(properties[0]);
        expect(diagnostic.messageArgs).deep.eq([testClass.fullName, "TestProperty", rootBaseClass.fullName, "string", "int"]);
        expect(diagnostic.messageText)
          .eq("The ECProperty 'TestSchema.TestClass.TestProperty' has a base property 'TestSchema.RootBaseClass.TestProperty' with a value type of string which is incompatible with the value type of int.");
        expect(diagnostic.category).eq(DiagnosticCategory.Error);
        expect(diagnostic.code).eq(Rules.DiagnosticCodes.IncompatibleValueTypePropertyOverride);
        expect(diagnostic.diagnosticType).eq(DiagnosticType.Property);
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").true;
    });

    it("IncompatibleValueTypePropertyOverride, different property types, rule passes.", async () => {
      await (testBaseClass as ECClass as MutableClass).createPrimitiveArrayProperty("TestProperty", PrimitiveType.String);
      await (testClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.Integer);

      const properties = Array.from(testClass.getPropertiesSync(true));
      const results = Rules.incompatibleValueTypePropertyOverride(properties[0] as PrimitiveProperty);
      for await (const _diagnostic of results)
        expect(false, "Rule should have passed").true;
    });

    it("IncompatibleValueTypePropertyOverride, same value types, rule passes.", async () => {
      await (testBaseClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);
      await (testClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);

      const properties = Array.from(testClass.getPropertiesSync(true));
      const results = Rules.incompatibleValueTypePropertyOverride(properties[0] as PrimitiveProperty);
      for await (const _diagnostic of results)
        expect(false, "Rule should have passed").true;
    });

    it("IncompatibleValueTypePropertyOverride, same array value types, rule passes.", async () => {
      await (testBaseClass as ECClass as MutableClass).createPrimitiveArrayProperty("TestProperty", PrimitiveType.String);
      await (testClass as ECClass as MutableClass).createPrimitiveArrayProperty("TestProperty", PrimitiveType.String);

      const properties = Array.from(testClass.getPropertiesSync(true));
      const results = Rules.incompatibleValueTypePropertyOverride(properties[0] as PrimitiveProperty);
      for await (const _diagnostic of results)
        expect(false, "Rule should have passed").true;
    });

    it("IncompatibleValueTypePropertyOverride, non-primitive type, rule passes.", async () => {
      await (testBaseClass as ECClass as MutableClass).createStructProperty("TestProperty", new StructClass(schema, "TestStruct"));
      await (testClass as ECClass as MutableClass).createStructProperty("TestProperty", new StructClass(schema, "TestStruct"));

      const properties = Array.from(testClass.getPropertiesSync(true));
      const results = Rules.incompatibleValueTypePropertyOverride(properties[0] as PrimitiveProperty);
      for await (const _diagnostic of results)
        expect(false, "Rule should have passed").true;
    });

    it("IncompatibleValueTypePropertyOverride, no base class, rule passes.", async () => {
      const entityClass = new EntityClass(new Schema(new SchemaContext(), "TestSchema", "ts", 1, 2, 3), "TestEntity");
      await (entityClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.Integer);

      const properties = Array.from(entityClass.getPropertiesSync(true));
      const results = Rules.incompatibleValueTypePropertyOverride(properties[0] as PrimitiveProperty);
      for await (const _diagnostic of results)
        expect(false, "Rule should have passed").true;
    });
  });

  describe("IncompatibleTypePropertyOverride Tests", () => {
    it("IncompatibleTypePropertyOverride, rule violated.", async () => {
      await (testBaseClass as ECClass as MutableClass).createPrimitiveArrayProperty("TestProperty", PrimitiveType.String);
      await (testClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.Integer);

      const properties = Array.from(testClass.getPropertiesSync(true));
      const results = Rules.incompatibleTypePropertyOverride(properties[0] as PrimitiveProperty);

      let resultHasEntries = false;
      for await (const diagnostic of results) {
        resultHasEntries = true;
        expect(diagnostic.ecDefinition).eq(properties[0]);
        expect(diagnostic.messageArgs).deep.eq([testClass.fullName, "TestProperty", testBaseClass.fullName, "PrimitiveArrayProperty", "PrimitiveProperty"]);
        expect(diagnostic.messageText)
          .eq(`The ECProperty '${testClass.fullName}.TestProperty' has a base property '${testBaseClass.fullName}.TestProperty' with a type of PrimitiveArrayProperty which is incompatible with the type of PrimitiveProperty.`);
        expect(diagnostic.category).eq(DiagnosticCategory.Error);
        expect(diagnostic.code).eq(Rules.DiagnosticCodes.IncompatibleTypePropertyOverride);
        expect(diagnostic.diagnosticType).eq(DiagnosticType.Property);
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").true;
    });

    it("IncompatibleTypePropertyOverride, multiple base classes, rule violated.", async () => {
      const rootBaseClass = new EntityClass(schema, "RootBaseClass");
      await (rootBaseClass as ECClass as MutableClass).createPrimitiveArrayProperty("TestProperty", PrimitiveType.String);
      await (testClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);
      await (testBaseClass as ECClass as MutableClass).setBaseClass(new DelayedPromiseWithProps(rootBaseClass.key, async () => rootBaseClass));

      const properties = Array.from(testClass.getPropertiesSync(true));
      const results = Rules.incompatibleTypePropertyOverride(properties[0] as PrimitiveProperty);

      let resultHasEntries = false;
      for await (const diagnostic of results) {
        resultHasEntries = true;
        expect(diagnostic.ecDefinition).eq(properties[0]);
        expect(diagnostic.messageArgs).deep.eq([testClass.fullName, "TestProperty", rootBaseClass.fullName, "PrimitiveArrayProperty", "PrimitiveProperty"]);
        expect(diagnostic.messageText)
          .eq(`The ECProperty '${testClass.fullName}.TestProperty' has a base property '${rootBaseClass.fullName}.TestProperty' with a type of PrimitiveArrayProperty which is incompatible with the type of PrimitiveProperty.`);
        expect(diagnostic.category).eq(DiagnosticCategory.Error);
        expect(diagnostic.code).eq(Rules.DiagnosticCodes.IncompatibleTypePropertyOverride);
        expect(diagnostic.diagnosticType).eq(DiagnosticType.Property);
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").true;
    });

    it("IncompatibleTypePropertyOverride, types compatible, rule passes.", async () => {
      await (testBaseClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);
      // different value type, but THIS rule should still pass
      await (testClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.Integer);

      const properties = Array.from(testClass.getPropertiesSync(true));
      const results = Rules.incompatibleTypePropertyOverride(properties[0] as PrimitiveProperty);
      for await (const _diagnostic of results)
        expect(false, "Rule should have passed").true;
    });

    it("IncompatibleTypePropertyOverride, no base class, rule passes.", async () => {
      const entityClass = new EntityClass(new Schema(new SchemaContext(), "TestSchema", "ts", 1, 2, 3), "TestEntity");
      await (entityClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.Integer);

      const properties = Array.from(entityClass.getPropertiesSync(true));
      const results = Rules.incompatibleTypePropertyOverride(properties[0] as PrimitiveProperty);
      for await (const _diagnostic of results)
        expect(false, "Rule should have passed").true;
    });
  });

  describe("IncompatibleUnitPropertyOverride Tests", () => {
    it("IncompatibleUnitPropertyOverride, rule violated.", async () => {
      await (testBaseClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);
      await (testClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.Integer);

      const basePropJson: PropertyProps = {
        name: "TestProperty",
        type: "PrimitiveProperty",
        kindOfQuantity: "TestSchema.TestBaseKoQ",
      };

      const childPropJson: PropertyProps = {
        name: "TestProperty",
        type: "PrimitiveProperty",
        kindOfQuantity: "TestSchema.TestKoQ",
      };

      const baseProperties = Array.from(testBaseClass.getPropertiesSync(true));
      const childProperties = Array.from(testClass.getPropertiesSync(true));

      const baseProperty = baseProperties[0];
      await baseProperty.fromJSON(basePropJson);

      const childProperty = childProperties[0];
      await childProperty.fromJSON(childPropJson);

      const baseUnit = await (schema as MutableSchema).createUnit("BaseTestUnit");
      await testBaseKindOfQuantity.fromJSON({
        persistenceUnit: "TestSchema.BaseTestUnit",
        relativeError: 5,
      });

      const childUnit = await (schema as MutableSchema).createUnit("TestUnit");
      await testKindOfQuantity.fromJSON({
        persistenceUnit: "TestSchema.TestUnit",
        relativeError: 4,
      });

      const results = Rules.incompatibleUnitPropertyOverride(childProperties[0] as PrimitiveProperty);

      let resultHasEntries = false;
      for await (const diagnostic of results) {
        resultHasEntries = true;
        expect(diagnostic.ecDefinition).eq(childProperties[0]);
        expect(diagnostic.messageArgs).deep.eq([
          testClass.fullName, "TestProperty", testBaseClass.fullName,
          testBaseKindOfQuantity.fullName, baseUnit.fullName, childUnit.fullName, testKindOfQuantity.fullName,
        ]);
        expect(diagnostic.messageText)
          .eq(`The ECProperty '${testClass.fullName}.TestProperty' has a base property '${testBaseClass.fullName}.TestProperty' with KindOfQuantity '${testBaseKindOfQuantity.fullName}' with persistence unit '${baseUnit.fullName}' which is not the same as the persistence unit '${childUnit.fullName}' of the provided KindOfQuantity '${testKindOfQuantity.fullName}'.`);
        expect(diagnostic.category).eq(DiagnosticCategory.Error);
        expect(diagnostic.code).eq(Rules.DiagnosticCodes.IncompatibleUnitPropertyOverride);
        expect(diagnostic.diagnosticType).eq(DiagnosticType.Property);
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").true;
    });

    it("IncompatibleUnitPropertyOverride, multiple base classes, rule violated.", async () => {
      const rootBaseClass = new EntityClass(schema, "RootBaseClass");
      await (rootBaseClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);
      await (testClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.Integer);
      await (testBaseClass as ECClass as MutableClass).setBaseClass(new DelayedPromiseWithProps(rootBaseClass.key, async () => rootBaseClass));

      const basePropJson = {
        name: "TestProperty",
        type: "PrimitiveProperty",
        kindOfQuantity: "TestSchema.TestBaseKoQ",
      };

      const childPropJson = {
        name: "TestProperty",
        type: "PrimitiveProperty",
        kindOfQuantity: "TestSchema.TestKoQ",
      };

      const baseProperties = Array.from(rootBaseClass.getPropertiesSync(true));
      const childProperties = Array.from(testClass.getPropertiesSync(true));

      const baseProperty = baseProperties[0];
      await baseProperty.fromJSON(basePropJson);

      const childProperty = childProperties[0];
      await childProperty.fromJSON(childPropJson);

      const baseUnit = await (schema as MutableSchema).createUnit("BaseTestUnit");
      await testBaseKindOfQuantity.fromJSON({
        persistenceUnit: "TestSchema.BaseTestUnit",
        relativeError: 5,
      });

      const childUnit = await (schema as MutableSchema).createUnit("TestUnit");
      await testKindOfQuantity.fromJSON({
        persistenceUnit: "TestSchema.TestUnit",
        relativeError: 4,
      });

      const results = Rules.incompatibleUnitPropertyOverride(childProperty as PrimitiveProperty);

      let resultHasEntries = false;
      for await (const diagnostic of results) {
        resultHasEntries = true;
        expect(diagnostic.ecDefinition).eq(childProperty);
        expect(diagnostic.messageArgs).deep.eq([
          testClass.fullName, "TestProperty", rootBaseClass.fullName,
          testBaseKindOfQuantity.fullName, baseUnit.fullName, childUnit.fullName, testKindOfQuantity.fullName,
        ]);
        expect(diagnostic.messageText).eq(`The ECProperty '${testClass.fullName}.TestProperty' has a base property '${rootBaseClass.fullName}.TestProperty' with KindOfQuantity '${testBaseKindOfQuantity.fullName}' with persistence unit '${baseUnit.fullName}' which is not the same as the persistence unit '${childUnit.fullName}' of the provided KindOfQuantity '${testKindOfQuantity.fullName}'.`);
        expect(diagnostic.category).eq(DiagnosticCategory.Error);
        expect(diagnostic.code).eq(Rules.DiagnosticCodes.IncompatibleUnitPropertyOverride);
        expect(diagnostic.diagnosticType).eq(DiagnosticType.Property);
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").true;
    });

    it("IncompatibleUnitPropertyOverride, same persistence units, rule passes", async () => {
      await (testBaseClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);
      await (testClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.Integer);

      const basePropJson = {
        name: "TestProperty",
        type: "PrimitiveProperty",
        kindOfQuantity: "TestSchema.TestBaseKoQ",
      };

      const childPropJson = {
        name: "TestProperty",
        type: "PrimitiveProperty",
        kindOfQuantity: "TestSchema.TestKoQ",
      };

      const baseProperties = Array.from(testBaseClass.getPropertiesSync(true));
      const childProperties = Array.from(testClass.getPropertiesSync(true));

      const baseProperty = baseProperties[0];
      await baseProperty.fromJSON(basePropJson);

      const childProperty = childProperties[0];
      await childProperty.fromJSON(childPropJson);

      await (schema as MutableSchema).createUnit("TestUnit");
      await testBaseKindOfQuantity.fromJSON({
        persistenceUnit: "TestSchema.TestUnit",
        relativeError: 5,
      });

      await testKindOfQuantity.fromJSON({
        persistenceUnit: "TestSchema.TestUnit",
        relativeError: 4,
      });

      const results = Rules.incompatibleUnitPropertyOverride(childProperty as PrimitiveProperty);
      for await (const _diagnostic of results)
        expect(false, `Rule should have passed, instead recieved "${_diagnostic.messageText}"`).true;
    });

    it("IncompatibleUnitPropertyOverride, no base unit, rule passes", async () => {
      await (testBaseClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);
      await (testClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);

      const basePropJson = {
        name: "TestProperty",
        type: "PrimitiveProperty",
        kindOfQuantity: "TestSchema.TestBaseKoQ",
      };

      const childPropJson = {
        name: "TestProperty",
        type: "PrimitiveProperty",
        kindOfQuantity: "TestSchema.TestKoQ",
      };

      const baseProperties = Array.from(testBaseClass.getPropertiesSync(true));
      const childProperties = Array.from(testClass.getPropertiesSync(true));

      const baseProperty = baseProperties[0];
      await baseProperty.fromJSON(basePropJson);

      const childProperty = childProperties[0];
      await childProperty.fromJSON(childPropJson);

      await (schema as MutableSchema).createUnit("TestUnit");
      await testKindOfQuantity.fromJSON({
        persistenceUnit: "TestSchema.TestUnit",
        relativeError: 4,
      });

      const results = Rules.incompatibleUnitPropertyOverride(childProperties[0] as PrimitiveProperty);
      for await (const _diagnostic of results)
        expect(false, "Rule should have passed").true;
    });

    it("IncompatibleUnitPropertyOverride, not a KOQ, rule passes.", async () => {
      await (testBaseClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);
      await (testClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);

      const basePropJson = {
        name: "TestProperty",
        type: "PrimitiveProperty",
      };

      const childPropJson = {
        name: "TestProperty",
        type: "PrimitiveProperty",
      };

      const baseProperties = Array.from(testBaseClass.getPropertiesSync(true));
      const childProperties = Array.from(testClass.getPropertiesSync(true));

      const baseProperty = baseProperties[0];
      await baseProperty.fromJSON(basePropJson);

      const childProperty = childProperties[0];
      await childProperty.fromJSON(childPropJson);

      const results = Rules.incompatibleUnitPropertyOverride(childProperties[0] as PrimitiveProperty);
      for await (const _diagnostic of results)
        expect(false, "Rule should have passed").true;
    });

    it("IncompatibleUnitPropertyOverride, incompatible property types, rule passes.", async () => {
      await (testBaseClass as ECClass as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.String);
      await (testClass as ECClass as MutableClass).createPrimitiveArrayProperty("TestProperty", PrimitiveType.Integer);

      const basePropJson = {
        name: "TestProperty",
        type: "PrimitiveProperty",
        kindOfQuantity: "TestSchema.TestBaseKoQ",
      };

      const childPropJson = {
        name: "TestProperty",
        type: "PrimitiveArrayProperty",
        kindOfQuantity: "TestSchema.TestKoQ",
      };

      const baseProperties = Array.from(testBaseClass.getPropertiesSync(true));
      const childProperties = Array.from(testClass.getPropertiesSync(true));

      const baseProperty = baseProperties[0];
      await baseProperty.fromJSON(basePropJson);

      const childProperty = childProperties[0];
      await childProperty.fromJSON(childPropJson);

      await (schema as MutableSchema).createUnit("BaseTestUnit");
      await testBaseKindOfQuantity.fromJSON({
        persistenceUnit: "TestSchema.BaseTestUnit",
        relativeError: 5,
      });

      await (schema as MutableSchema).createUnit("TestUnit");
      await testKindOfQuantity.fromJSON({
        persistenceUnit: "TestSchema.TestUnit",
        relativeError: 4,
      });

      const results = Rules.incompatibleUnitPropertyOverride(childProperties[0] as PrimitiveProperty);
      for await (const _diagnostic of results)
        expect(false, "Rule should have passed").true;
    });
  });

  describe("Validate NavigationProperty Tests", () => {
    function createSchemaJson(baseRelationship: any, sourceConst: any, targetConst: any, sourceProperties: any, targetProperties: any, inheritanceLevel: any, relationshipProperties?: any) {
      let sourcePropsInherited1: any;
      let targetPropsInherited1: any;
      let sourcePropsInherited2: any;
      let targetPropsInherited2: any;
      if (inheritanceLevel === 1) {
        sourcePropsInherited1 = sourceProperties;
        targetPropsInherited1 = targetProperties;
      } else if (inheritanceLevel === 2) {
        sourcePropsInherited2 = sourceProperties;
        targetPropsInherited2 = targetProperties;
      } else if (inheritanceLevel === 3) {
        sourcePropsInherited1 = sourceProperties;
        targetPropsInherited1 = targetProperties;
        sourcePropsInherited2 = sourceProperties;
        targetPropsInherited2 = targetProperties;
      }

      return createSchemaJsonWithItems({
        TestRelationship: {
          ...baseRelationship,
          schemaItemType: "RelationshipClass",
          strength: "referencing",
          strengthDirection: "forward",
          source: {
            ...sourceConst,
          },
          target: {
            ...targetConst,
          },
        },
        SourceBaseEntity1: {
          schemaItemType: "EntityClass",
          modifier: "abstract",
          ...sourcePropsInherited1,
        },
        SourceBaseEntity2: {
          schemaItemType: "EntityClass",
          baseClass: "TestSchema.SourceBaseEntity1",
          modifier: "abstract",
          ...sourcePropsInherited2,
        },
        TestSourceEntity: {
          schemaItemType: "EntityClass",
          baseClass: "TestSchema.SourceBaseEntity2",
          ...sourceProperties,
        },
        TargetBaseEntity1: {
          schemaItemType: "EntityClass",
          modifier: "abstract",
          ...targetPropsInherited1,
        },
        TargetBaseEntity2: {
          schemaItemType: "EntityClass",
          baseClass: "TestSchema.TargetBaseEntity1",
          modifier: "abstract",
          ...targetPropsInherited2,
        },
        TestTargetEntity: {
          schemaItemType: "EntityClass",
          baseClass: "TestSchema.TargetBaseEntity2",
          ...targetProperties,
        },
        TestRelationship2: {
          schemaItemType: "RelationshipClass",
          strength: "referencing",
          strengthDirection: "forward",
          ...relationshipProperties,
          source: {
            polymorphic: false,
            multiplicity: "(0..*)",
            roleLabel: "Test Source roleLabel",
            constraintClasses: [
              "TestSchema.TestSourceEntity",
            ],
          },
          target: {
            polymorphic: false,
            multiplicity: "(0..1)",
            roleLabel: "Test Source roleLabel",
            constraintClasses: [
              "TestSchema.TestTargetEntity",
            ],
          },
        },
      });
    }

    it("Property is not a NavigationProperty, rule not violated.", async () => {
      const mutableSchema = schema as MutableSchema;
      const testRelationship = await mutableSchema.createRelationshipClass("TestRelationshipClass");
      const testProperty = await (testRelationship as ECClass as MutableClass).createPrimitiveProperty("TestProperty") as AnyProperty;

      const results = Rules.validateNavigationProperty(testProperty);

      for await (const _diagnostic of results)
        expect(false, "Rule should have passed").true;
    });

    describe("NavigationRelationshipMustBeRoot Rule Tests", () => {
      it("NavigationProperty relationship is not a root relationship, rule violated.", async () => {
        const sourceJson = {
          polymorphic: false,
          multiplicity: "(0..*)",
          roleLabel: "Test Source roleLabel",
          constraintClasses: [
            "TestSchema.TestSourceEntity",
          ],
        };

        const targetJson = {
          polymorphic: false,
          multiplicity: "(0..1)",
          roleLabel: "Test Target roleLabel",
          constraintClasses: [
            "TestSchema.TestTargetEntity",
          ],
        };

        const propertyJson = {
          properties: [
            {
              name: "TestProperty",
              type: "NavigationProperty",
              relationshipName: "TestSchema.TestRelationship",
              direction: "Forward",
            },
          ],
        };

        const baseRelationshipJson = {
          baseClass: "TestSchema.TestRelationship2",
        };

        const testSchema = await Schema.fromJson(createSchemaJson(baseRelationshipJson, sourceJson, targetJson, propertyJson, undefined, 0), new SchemaContext());
        const testProperty = (await testSchema.getItem("TestSourceEntity", EntityClass))?.getPropertySync("TestProperty") as AnyProperty;

        const results = Rules.validateNavigationProperty(testProperty);

        let resultHasEntries = false;
        for await (const diagnostic of results) {
          resultHasEntries = true;
          expect(diagnostic.ecDefinition).eq(testProperty);
          expect(diagnostic.messageArgs).deep.eq(["TestSourceEntity.TestProperty", "TestSchema.TestRelationship"]);
          expect(diagnostic.messageText).eq(`The referenced relationship 'TestSchema.TestRelationship', used in NavigationProperty 'TestSourceEntity.TestProperty' is not the root relationship.`);
          expect(diagnostic.category).eq(DiagnosticCategory.Error);
          expect(diagnostic.code).eq(Rules.Diagnostics.NavigationRelationshipMustBeRoot.code);
          expect(diagnostic.diagnosticType).eq(DiagnosticType.Property);
        }
        expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").true;
      });

      it("NavigationProperty relationship is a root relationship, rule not violated.", async () => {
        const sourceJson = {
          polymorphic: false,
          multiplicity: "(0..*)",
          roleLabel: "Test Source roleLabel",
          constraintClasses: [
            "TestSchema.TestSourceEntity",
          ],
        };

        const targetJson = {
          polymorphic: false,
          multiplicity: "(0..1)",
          roleLabel: "Test Target roleLabel",
          constraintClasses: [
            "TestSchema.TestTargetEntity",
          ],
        };

        const propertyJson = {
          properties: [
            {
              name: "TestProperty",
              type: "NavigationProperty",
              relationshipName: "TestSchema.TestRelationship",
              direction: "Forward",
            },
          ],
        };

        const testSchema = await Schema.fromJson(createSchemaJson(undefined, sourceJson, targetJson, propertyJson, undefined, 0), new SchemaContext());
        const testProperty = (await testSchema.getItem("TestSourceEntity", EntityClass))?.getPropertySync("TestProperty") as AnyProperty;

        const results = Rules.validateNavigationProperty(testProperty);

        for await (const _diagnostic of results)
          expect(false, "Rule should have passed").true;
      });
    });

    describe("NavigationTargetMustHaveSingularMultiplicity Rule Tests", () => {
      it("Relationship target multiplicity greater than 1, forward direction, rule violated.", async () => {
        const sourceJson = {
          polymorphic: false,
          multiplicity: "(0..1)",
          roleLabel: "Test Source roleLabel",
          constraintClasses: [
            "TestSchema.TestSourceEntity",
          ],
        };

        const targetJson = {
          polymorphic: false,
          multiplicity: "(0..*)",
          roleLabel: "Test Target roleLabel",
          constraintClasses: [
            "TestSchema.TestTargetEntity",
          ],
        };

        const propertyJson = {
          properties: [
            {
              name: "TestProperty",
              type: "NavigationProperty",
              relationshipName: "TestSchema.TestRelationship",
              direction: "Forward",
            },
          ],
        };

        const testSchema = await Schema.fromJson(createSchemaJson(undefined, sourceJson, targetJson, propertyJson, undefined, 0), new SchemaContext());
        const testProperty = (await testSchema.getItem("TestSourceEntity", EntityClass))?.getPropertySync("TestProperty") as AnyProperty;

        const results = Rules.validateNavigationProperty(testProperty);

        let resultHasEntries = false;
        for await (const diagnostic of results) {
          resultHasEntries = true;
          expect(diagnostic.ecDefinition).eq(testProperty);
          expect(diagnostic.messageArgs).deep.eq(["TestSourceEntity.TestProperty", "TestSchema.TestRelationship", "Forward"]);
          expect(diagnostic.messageText).eq(`NavigationProperty 'TestSourceEntity.TestProperty' uses the relationship 'TestSchema.TestRelationship' that cannot be traversed in the 'Forward' direction due to a max multiplicity greater than 1.`);
          expect(diagnostic.category).eq(DiagnosticCategory.Error);
          expect(diagnostic.code).eq(Rules.Diagnostics.NavigationTargetMustHaveSingularMultiplicity.code);
          expect(diagnostic.diagnosticType).eq(DiagnosticType.Property);
        }
        expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").true;
      });

      it("Relationship target multiplicity (0..1), forward direction, rule passes.", async () => {
        const sourceJson = {
          polymorphic: false,
          multiplicity: "(0..*)",
          roleLabel: "Test Source roleLabel",
          constraintClasses: [
            "TestSchema.TestSourceEntity",
          ],
        };

        const targetJson = {
          polymorphic: false,
          multiplicity: "(0..1)",
          roleLabel: "Test Target roleLabel",
          constraintClasses: [
            "TestSchema.TestTargetEntity",
          ],
        };

        const propertyJson = {
          properties: [
            {
              name: "TestProperty",
              type: "NavigationProperty",
              relationshipName: "TestSchema.TestRelationship",
              direction: "Forward",
            },
          ],
        };

        const testSchema = await Schema.fromJson(createSchemaJson(undefined, sourceJson, targetJson, propertyJson, undefined, 0), new SchemaContext());
        const testProperty = (await testSchema.getItem("TestSourceEntity", EntityClass))?.getPropertySync("TestProperty") as AnyProperty;

        const results = Rules.validateNavigationProperty(testProperty);

        for await (const _diagnostic of results)
          expect(false, "Rule should have passed").true;
      });

      it("Relationship source multiplicity greater than 1, backward direction, rule violated.", async () => {
        const sourceJson = {
          polymorphic: false,
          multiplicity: "(0..*)",
          roleLabel: "Test Source roleLabel",
          constraintClasses: [
            "TestSchema.TestSourceEntity",
          ],
        };

        const targetJson = {
          polymorphic: false,
          multiplicity: "(0..1)",
          roleLabel: "Test Target roleLabel",
          constraintClasses: [
            "TestSchema.TestTargetEntity",
          ],
        };

        const propertyJson = {
          properties: [
            {
              name: "TestProperty",
              type: "NavigationProperty",
              relationshipName: "TestSchema.TestRelationship",
              direction: "Backward",
            },
          ],
        };

        const testSchema = await Schema.fromJson(createSchemaJson(undefined, sourceJson, targetJson, undefined, propertyJson, 0), new SchemaContext());
        const testProperty = (await testSchema.getItem("TestTargetEntity", EntityClass))?.getPropertySync("TestProperty") as AnyProperty;

        const results = Rules.validateNavigationProperty(testProperty);

        let resultHasEntries = false;
        for await (const diagnostic of results) {
          resultHasEntries = true;
          expect(diagnostic.ecDefinition).eq(testProperty);
          expect(diagnostic.messageArgs).deep.eq(["TestTargetEntity.TestProperty", "TestSchema.TestRelationship", "Backward"]);
          expect(diagnostic.messageText).eq(`NavigationProperty 'TestTargetEntity.TestProperty' uses the relationship 'TestSchema.TestRelationship' that cannot be traversed in the 'Backward' direction due to a max multiplicity greater than 1.`);
          expect(diagnostic.category).eq(DiagnosticCategory.Error);
          expect(diagnostic.code).eq(Rules.Diagnostics.NavigationTargetMustHaveSingularMultiplicity.code);
          expect(diagnostic.diagnosticType).eq(DiagnosticType.Property);
        }
        expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").true;
      });

      it("Relationship source multiplicity (0..1), backward direction, rule passes.", async () => {
        const sourceJson = {
          polymorphic: false,
          multiplicity: "(0..1)",
          roleLabel: "Test Source roleLabel",
          constraintClasses: [
            "TestSchema.TestSourceEntity",
          ],
        };

        const targetJson = {
          polymorphic: false,
          multiplicity: "(0..*)",
          roleLabel: "Test Target roleLabel",
          constraintClasses: [
            "TestSchema.TestTargetEntity",
          ],
        };

        const propertyJson = {
          properties: [
            {
              name: "TestProperty",
              type: "NavigationProperty",
              relationshipName: "TestSchema.TestRelationship",
              direction: "Backward",
            },
          ],
        };

        const testSchema = await Schema.fromJson(createSchemaJson(undefined, sourceJson, targetJson, undefined, propertyJson, 0), new SchemaContext());
        const testProperty = (await testSchema.getItem("TestTargetEntity", EntityClass))?.getPropertySync("TestProperty") as AnyProperty;

        const results = Rules.validateNavigationProperty(testProperty);

        for await (const _diagnostic of results)
          expect(false, "Rule should have passed").true;
      });
    });

    describe("NavigationRelationshipAbstractConstraintEntityOrMixin Rule Tests", () => {
      it("Forward direction, relationship target abstract constraint is a RelationshipClass, rule violated.", async () => {
        const sourceJson = {
          polymorphic: false,
          multiplicity: "(0..*)",
          roleLabel: "Test Source roleLabel",
          constraintClasses: [
            "TestSchema.TestSourceEntity",
          ],
        };

        const targetJson = {
          polymorphic: false,
          multiplicity: "(0..1)",
          roleLabel: "Test Target roleLabel",
          constraintClasses: [
            "TestSchema.TestRelationship2",
          ],
        };

        const propertyJson = {
          properties: [
            {
              name: "TestProperty",
              type: "NavigationProperty",
              relationshipName: "TestSchema.TestRelationship",
              direction: "Forward",
            },
          ],
        };

        const testSchema = await Schema.fromJson(createSchemaJson(undefined, sourceJson, targetJson, propertyJson, undefined, 0), new SchemaContext());
        const testProperty = (await testSchema.getItem("TestSourceEntity", EntityClass))?.getPropertySync("TestProperty") as AnyProperty;

        const results = Rules.validateNavigationProperty(testProperty);

        let resultHasEntries = false;
        for await (const diagnostic of results) {
          resultHasEntries = true;
          expect(diagnostic.ecDefinition).eq(testProperty);
          expect(diagnostic.messageArgs).deep.eq(["TestSourceEntity.TestProperty", "TestSchema.TestRelationship"]);
          expect(diagnostic.messageText).eq(`The NavigationProperty 'TestSourceEntity.TestProperty', using the relationship 'TestSchema.TestRelationship', points to a RelationshipClass, which is not allowed.  NavigationProperties must point to an EntityClass or Mixin.`);
          expect(diagnostic.category).eq(DiagnosticCategory.Error);
          expect(diagnostic.code).eq(Rules.Diagnostics.NavigationRelationshipAbstractConstraintEntityOrMixin.code);
          expect(diagnostic.diagnosticType).eq(DiagnosticType.Property);
        }
        expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").true;
      });

      it("Forward direction, relationship target abstract constraint is a EntityClass, rule passes.", async () => {
        const sourceJson = {
          polymorphic: false,
          multiplicity: "(0..*)",
          roleLabel: "Test Source roleLabel",
          constraintClasses: [
            "TestSchema.TestRelationship2",
          ],
        };

        const targetJson = {
          polymorphic: false,
          multiplicity: "(0..1)",
          roleLabel: "Test Target roleLabel",
          constraintClasses: [
            "TestSchema.TestTargetEntity",
          ],
        };

        const propertyJson = {
          properties: [
            {
              name: "TestProperty",
              type: "NavigationProperty",
              relationshipName: "TestSchema.TestRelationship",
              direction: "Forward",
            },
          ],
        };

        const testSchema = await Schema.fromJson(createSchemaJson(undefined, sourceJson, targetJson, undefined, undefined, 0, propertyJson), new SchemaContext());
        const testProperty = (await testSchema.getItem("TestRelationship2", RelationshipClass))?.getPropertySync("TestProperty") as AnyProperty;

        const results = Rules.validateNavigationProperty(testProperty);

        for await (const _diagnostic of results)
          expect(false, "Rule should have passed").true;
      });

      it("Backward direction, relationship source abstract constraint is a RelationshipClass, rule violated.", async () => {
        const sourceJson = {
          polymorphic: false,
          multiplicity: "(0..1)",
          roleLabel: "Test Source roleLabel",
          constraintClasses: [
            "TestSchema.TestRelationship2",
          ],
        };

        const targetJson = {
          polymorphic: false,
          multiplicity: "(0..*)",
          roleLabel: "Test Target roleLabel",
          constraintClasses: [
            "TestSchema.TestTargetEntity",
          ],
        };

        const propertyJson = {
          properties: [
            {
              name: "TestProperty",
              type: "NavigationProperty",
              relationshipName: "TestSchema.TestRelationship",
              direction: "Backward",
            },
          ],
        };

        const testSchema = await Schema.fromJson(createSchemaJson(undefined, sourceJson, targetJson, undefined, propertyJson, 0), new SchemaContext());
        const testProperty = (await testSchema.getItem("TestTargetEntity", EntityClass))?.getPropertySync("TestProperty") as AnyProperty;

        const results = Rules.validateNavigationProperty(testProperty);

        let resultHasEntries = false;
        for await (const diagnostic of results) {
          resultHasEntries = true;
          expect(diagnostic.ecDefinition).eq(testProperty);
          expect(diagnostic.messageArgs).deep.eq(["TestTargetEntity.TestProperty", "TestSchema.TestRelationship"]);
          expect(diagnostic.messageText).eq(`The NavigationProperty 'TestTargetEntity.TestProperty', using the relationship 'TestSchema.TestRelationship', points to a RelationshipClass, which is not allowed.  NavigationProperties must point to an EntityClass or Mixin.`);
          expect(diagnostic.category).eq(DiagnosticCategory.Error);
          expect(diagnostic.code).eq(Rules.Diagnostics.NavigationRelationshipAbstractConstraintEntityOrMixin.code);
          expect(diagnostic.diagnosticType).eq(DiagnosticType.Property);
        }
        expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").true;
      });

      it("Backward direction, relationship source abstract constraint is a EntityClass, rule passes.", async () => {
        const sourceJson = {
          polymorphic: false,
          multiplicity: "(0..1)",
          roleLabel: "Test Source roleLabel",
          constraintClasses: [
            "TestSchema.TestSourceEntity",
          ],
        };

        const targetJson = {
          polymorphic: false,
          multiplicity: "(0..*)",
          roleLabel: "Test Target roleLabel",
          constraintClasses: [
            "TestSchema.TestRelationship2",
          ],
        };

        const propertyJson = {
          properties: [
            {
              name: "TestProperty",
              type: "NavigationProperty",
              relationshipName: "TestSchema.TestRelationship",
              direction: "Backward",
            },
          ],
        };

        const testSchema = await Schema.fromJson(createSchemaJson(undefined, sourceJson, targetJson, undefined, undefined, 0, propertyJson), new SchemaContext());
        const testProperty = (await testSchema.getItem("TestRelationship2", RelationshipClass))?.getPropertySync("TestProperty") as AnyProperty;

        const results = Rules.validateNavigationProperty(testProperty);

        for await (const _diagnostic of results)
          expect(false, "Rule should have passed").true;
      });
    });

    describe("NavigationClassMustBeAConstraintClassOfRelationship Rule Tests", () => {
      it("Forward direction, relationship source constraint does not include property class, rule violated.", async () => {
        const sourceJson = {
          polymorphic: false,
          multiplicity: "(0..*)",
          roleLabel: "Test Source roleLabel",
          constraintClasses: [
            "TestSchema.TestTargetEntity",
          ],
        };

        const targetJson = {
          polymorphic: false,
          multiplicity: "(0..1)",
          roleLabel: "Test Target roleLabel",
          constraintClasses: [
            "TestSchema.TestTargetEntity",
          ],
        };

        const propertyJson = {
          properties: [
            {
              name: "TestProperty",
              type: "NavigationProperty",
              relationshipName: "TestSchema.TestRelationship",
              direction: "Forward",
            },
          ],
        };

        const testSchema = await Schema.fromJson(createSchemaJson(undefined, sourceJson, targetJson, propertyJson, undefined, 0), new SchemaContext());
        const testProperty = (await testSchema.getItem("TestSourceEntity", EntityClass))?.getPropertySync("TestProperty") as AnyProperty;

        const results = Rules.validateNavigationProperty(testProperty);

        let resultHasEntries = false;
        for await (const diagnostic of results) {
          resultHasEntries = true;
          expect(diagnostic.ecDefinition).eq(testProperty);
          expect(diagnostic.messageArgs).deep.eq(["TestSourceEntity", "TestProperty", "TestSchema.TestRelationship", "source"]);
          expect(diagnostic.messageText).eq(`The class 'TestSourceEntity' of NavigationProperty 'TestProperty' is not supported by the source constraint of the referenced relationship 'TestSchema.TestRelationship'.`);
          expect(diagnostic.category).eq(DiagnosticCategory.Error);
          expect(diagnostic.code).eq(Rules.Diagnostics.NavigationClassMustBeAConstraintClassOfRelationship.code);
          expect(diagnostic.diagnosticType).eq(DiagnosticType.Property);
        }
        expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").true;
      });

      it("Forward direction, relationship source constraint does include property class, rule passes.", async () => {
        const sourceJson = {
          polymorphic: false,
          multiplicity: "(0..*)",
          roleLabel: "Test Source roleLabel",
          constraintClasses: [
            "TestSchema.TestSourceEntity",
          ],
        };

        const targetJson = {
          polymorphic: false,
          multiplicity: "(0..1)",
          roleLabel: "Test Target roleLabel",
          constraintClasses: [
            "TestSchema.TestTargetEntity",
          ],
        };

        const propertyJson = {
          properties: [
            {
              name: "TestProperty",
              type: "NavigationProperty",
              relationshipName: "TestSchema.TestRelationship",
              direction: "Forward",
            },
          ],
        };

        const testSchema = await Schema.fromJson(createSchemaJson(undefined, sourceJson, targetJson, propertyJson, undefined, 0), new SchemaContext());
        const testProperty = (await testSchema.getItem("TestSourceEntity", EntityClass))?.getPropertySync("TestProperty") as AnyProperty;

        const results = Rules.validateNavigationProperty(testProperty);

        for await (const _diagnostic of results)
          expect(false, "Rule should have passed").true;
      });

      it("Backward direction, relationship target constraint does not include property class, rule violated.", async () => {
        const sourceJson = {
          polymorphic: false,
          multiplicity: "(0..1)",
          roleLabel: "Test Source roleLabel",
          constraintClasses: [
            "TestSchema.TestSourceEntity",
          ],
        };

        const targetJson = {
          polymorphic: false,
          multiplicity: "(0..*)",
          roleLabel: "Test Target roleLabel",
          constraintClasses: [
            "TestSchema.TestSourceEntity",
          ],
        };

        const propertyJson = {
          properties: [
            {
              name: "TestProperty",
              type: "NavigationProperty",
              relationshipName: "TestSchema.TestRelationship",
              direction: "Backward",
            },
          ],
        };

        const testSchema = await Schema.fromJson(createSchemaJson(undefined, sourceJson, targetJson, undefined, propertyJson, 0), new SchemaContext());
        const testProperty = (await testSchema.getItem("TestTargetEntity", EntityClass))?.getPropertySync("TestProperty") as AnyProperty;

        const results = Rules.validateNavigationProperty(testProperty);

        let resultHasEntries = false;
        for await (const diagnostic of results) {
          resultHasEntries = true;
          expect(diagnostic.ecDefinition).eq(testProperty);
          expect(diagnostic.messageArgs).deep.eq(["TestTargetEntity", "TestProperty", "TestSchema.TestRelationship", "target"]);
          expect(diagnostic.messageText).eq(`The class 'TestTargetEntity' of NavigationProperty 'TestProperty' is not supported by the target constraint of the referenced relationship 'TestSchema.TestRelationship'.`);
          expect(diagnostic.category).eq(DiagnosticCategory.Error);
          expect(diagnostic.code).eq(Rules.Diagnostics.NavigationClassMustBeAConstraintClassOfRelationship.code);
          expect(diagnostic.diagnosticType).eq(DiagnosticType.Property);
        }
        expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").true;
      });

      it("Backward direction, relationship target constraint does include property class, rule passes.", async () => {
        const sourceJson = {
          polymorphic: false,
          multiplicity: "(0..1)",
          roleLabel: "Test Source roleLabel",
          constraintClasses: [
            "TestSchema.TestSourceEntity",
          ],
        };

        const targetJson = {
          polymorphic: false,
          multiplicity: "(0..*)",
          roleLabel: "Test Target roleLabel",
          constraintClasses: [
            "TestSchema.TestTargetEntity",
          ],
        };

        const propertyJson = {
          properties: [
            {
              name: "TestProperty",
              type: "NavigationProperty",
              relationshipName: "TestSchema.TestRelationship",
              direction: "Backward",
            },
          ],
        };

        const testSchema = await Schema.fromJson(createSchemaJson(undefined, sourceJson, targetJson, undefined, propertyJson, 0), new SchemaContext());
        const testRelationship = await testSchema.getItem("TestTargetEntity", EntityClass);
        const testProperty = testRelationship?.getPropertySync("TestProperty") as AnyProperty;

        const results = Rules.validateNavigationProperty(testProperty);

        for await (const _diagnostic of results)
          expect(false, "Rule should have passed").true;
      });

      it("Forward direction, relationship source constraint does include inherited (grandparent) property class, rule passes.", async () => {
        const sourceJson = {
          polymorphic: false,
          multiplicity: "(0..*)",
          roleLabel: "Test Source roleLabel",
          constraintClasses: [
            "TestSchema.SourceBaseEntity1",
          ],
        };

        const targetJson = {
          polymorphic: false,
          multiplicity: "(0..1)",
          roleLabel: "Test Target roleLabel",
          constraintClasses: [
            "TestSchema.TargetBaseEntity1",
          ],
        };

        const propertyJson = {
          properties: [
            {
              name: "TestProperty",
              type: "NavigationProperty",
              relationshipName: "TestSchema.TestRelationship",
              direction: "Forward",
            },
          ],
        };

        const testSchema = await Schema.fromJson(createSchemaJson(undefined, sourceJson, targetJson, propertyJson, undefined, 1), new SchemaContext());
        const testProperty = (await testSchema.getItem("TestSourceEntity", EntityClass))?.getPropertySync("TestProperty") as AnyProperty;

        const results = Rules.validateNavigationProperty(testProperty);

        for await (const _diagnostic of results)
          expect(false, "Rule should have passed").true;
      });

      it("Forward direction, relationship source constraint does include inherited (parent) property class, rule passes.", async () => {
        const sourceJson = {
          polymorphic: false,
          multiplicity: "(0..*)",
          roleLabel: "Test Source roleLabel",
          constraintClasses: [
            "TestSchema.SourceBaseEntity2",
          ],
        };

        const targetJson = {
          polymorphic: false,
          multiplicity: "(0..1)",
          roleLabel: "Test Target roleLabel",
          constraintClasses: [
            "TestSchema.TargetBaseEntity2",
          ],
        };

        const propertyJson = {
          properties: [
            {
              name: "TestProperty",
              type: "NavigationProperty",
              relationshipName: "TestSchema.TestRelationship",
              direction: "Forward",
            },
          ],
        };

        const testSchema = await Schema.fromJson(createSchemaJson(undefined, sourceJson, targetJson, propertyJson, undefined, 2), new SchemaContext());
        const testProperty = (await testSchema.getItem("TestSourceEntity", EntityClass))?.getPropertySync("TestProperty") as AnyProperty;

        const results = Rules.validateNavigationProperty(testProperty);

        for await (const _diagnostic of results)
          expect(false, "Rule should have passed").true;
      });

      it("Forward direction, relationship source constraint does include inherited (parent and grandparent) property class, rule passes.", async () => {
        const sourceJson = {
          polymorphic: false,
          multiplicity: "(0..*)",
          roleLabel: "Test Source roleLabel",
          constraintClasses: [
            "TestSchema.SourceBaseEntity1",
          ],
        };

        const targetJson = {
          polymorphic: false,
          multiplicity: "(0..1)",
          roleLabel: "Test Target roleLabel",
          constraintClasses: [
            "TestSchema.TargetBaseEntity1",
          ],
        };

        const propertyJson = {
          properties: [
            {
              name: "TestProperty",
              type: "NavigationProperty",
              relationshipName: "TestSchema.TestRelationship",
              direction: "Forward",
            },
          ],
        };

        const testSchema = await Schema.fromJson(createSchemaJson(undefined, sourceJson, targetJson, propertyJson, undefined, 3), new SchemaContext());
        const testProperty = (await testSchema.getItem("TestSourceEntity", EntityClass))?.getPropertySync("TestProperty") as AnyProperty;

        const results = Rules.validateNavigationProperty(testProperty);

        for await (const _diagnostic of results)
          expect(false, "Rule should have passed").true;
      });

      it("Backward direction, relationship target constraint does include inherited (grandparent) property class, rule passes.", async () => {
        const sourceJson = {
          polymorphic: false,
          multiplicity: "(0..1)",
          roleLabel: "Test Source roleLabel",
          constraintClasses: [
            "TestSchema.SourceBaseEntity1",
          ],
        };

        const targetJson = {
          polymorphic: false,
          multiplicity: "(0..*)",
          roleLabel: "Test Target roleLabel",
          constraintClasses: [
            "TestSchema.TargetBaseEntity1",
          ],
        };

        const propertyJson = {
          properties: [
            {
              name: "TestProperty",
              type: "NavigationProperty",
              relationshipName: "TestSchema.TestRelationship",
              direction: "Backward",
            },
          ],
        };

        const testSchema = await Schema.fromJson(createSchemaJson(undefined, sourceJson, targetJson, undefined, propertyJson, 1), new SchemaContext());
        const testProperty = (await testSchema.getItem("TestTargetEntity", EntityClass))?.getPropertySync("TestProperty") as AnyProperty;

        const results = Rules.validateNavigationProperty(testProperty);

        for await (const _diagnostic of results)
          expect(false, "Rule should have passed").true;
      });

      it("Backward direction, relationship target constraint does include inherited (parent) property class, rule passes.", async () => {
        const sourceJson = {
          polymorphic: false,
          multiplicity: "(0..1)",
          roleLabel: "Test Source roleLabel",
          constraintClasses: [
            "TestSchema.SourceBaseEntity2",
          ],
        };

        const targetJson = {
          polymorphic: false,
          multiplicity: "(0..*)",
          roleLabel: "Test Target roleLabel",
          constraintClasses: [
            "TestSchema.TargetBaseEntity2",
          ],
        };

        const propertyJson = {
          properties: [
            {
              name: "TestProperty",
              type: "NavigationProperty",
              relationshipName: "TestSchema.TestRelationship",
              direction: "Backward",
            },
          ],
        };

        const testSchema = await Schema.fromJson(createSchemaJson(undefined, sourceJson, targetJson, undefined, propertyJson, 2), new SchemaContext());
        const testProperty = (await testSchema.getItem("TestTargetEntity", EntityClass))?.getPropertySync("TestProperty") as AnyProperty;

        const results = Rules.validateNavigationProperty(testProperty);

        for await (const _diagnostic of results)
          expect(false, "Rule should have passed").true;
      });

      it("Backward direction, relationship target constraint does include inherited (parent and grandparent) property class, rule passes.", async () => {
        const sourceJson = {
          polymorphic: false,
          multiplicity: "(0..1)",
          roleLabel: "Test Source roleLabel",
          constraintClasses: [
            "TestSchema.SourceBaseEntity1",
          ],
        };

        const targetJson = {
          polymorphic: false,
          multiplicity: "(0..*)",
          roleLabel: "Test Target roleLabel",
          constraintClasses: [
            "TestSchema.TargetBaseEntity1",
          ],
        };

        const propertyJson = {
          properties: [
            {
              name: "TestProperty",
              type: "NavigationProperty",
              relationshipName: "TestSchema.TestRelationship",
              direction: "Backward",
            },
          ],
        };

        const testSchema = await Schema.fromJson(createSchemaJson(undefined, sourceJson, targetJson, undefined, propertyJson, 3), new SchemaContext());
        const testProperty = (await testSchema.getItem("TestTargetEntity", EntityClass))?.getPropertySync("TestProperty") as AnyProperty;

        const results = Rules.validateNavigationProperty(testProperty);

        for await (const _diagnostic of results)
          expect(false, "Rule should have passed").true;
      });
    });
  });
});
