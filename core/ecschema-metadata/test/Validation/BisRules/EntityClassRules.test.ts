/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import sinon = require("sinon");
import { BisTestHelper } from "../../TestUtils/BisTestHelper";

import { SchemaContext } from "../../../src/Context";
import { DelayedPromiseWithProps } from "../../../src/DelayedPromise";
import { PrimitiveType } from "../../../src/ECObjects";
import { ECObjectsError, ECObjectsStatus } from "../../../src/Exception";
import { ECClass, MutableClass } from "../../../src/Metadata/Class";
import { EntityClass, MutableEntityClass } from "../../../src/Metadata/EntityClass";
import { Mixin } from "../../../src/Metadata/Mixin";
import { Schema } from "../../../src/Metadata/Schema";
import * as Rules from "../../../src/Validation/BisRules";
import { DiagnosticCategory, DiagnosticType } from "../../../src/Validation/Diagnostic";

describe("EntityClass Rule Tests", () => {
  let testSchema: Schema;
  let bisCoreSchema: Schema;

  async function getTestSchema(items: any, name: string = "TestSchema", context?: SchemaContext, withBisReference: boolean = true): Promise<Schema> {
    if (!context) {
      context = withBisReference ? await BisTestHelper.getNewContext() : new SchemaContext();

    }
    return Schema.fromJson(createSchemaJson(name, items, withBisReference), context);
  }

  function createSchemaJson(name: string, items: any, withBisReference: boolean) {
    const refJson = !withBisReference ? {} : {
      references: [
        {
          name: "BisCore",
          version: "1.0.0",
        },
      ],
    };
    return createSchemaJsonWithItems(name, items, refJson);
  }

  function createSchemaJsonWithItems(name: string, itemsJson: any, referenceJson?: any): any {
    return {
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name,
      version: "1.2.3",
      items: {
        ...itemsJson,
      },
      ...referenceJson,
    };
  }

  beforeEach(async () => {
    const context = new SchemaContext();
    testSchema = new Schema(context, "TestSchema", 1, 0, 0);
    bisCoreSchema = new Schema(context, "BisCore", 1, 0, 0);
  });

  afterEach(() => {
    sinon.restore();

  });

  describe("EntityClassMustDeriveFromBisHierarchy tests", () => {
    it("EntityClass does not derived from BIS hierarchy, rule violated.", async () => {
      const baseEntity = new EntityClass(testSchema, "BaseEntity");
      const childEntity = new EntityClass(testSchema, "TestEntity");
      childEntity.baseClass = new DelayedPromiseWithProps(baseEntity.key, async () => baseEntity);

      const result = await Rules.entityClassMustDeriveFromBisHierarchy(childEntity);

      let resultHasEntries = false;
      for await (const diagnostic of result!) {
        resultHasEntries = true;
        expect(diagnostic).to.not.be.undefined;
        expect(diagnostic!.ecDefinition).to.equal(childEntity);
        expect(diagnostic!.messageArgs).to.eql([childEntity.fullName]);
        expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic!.code).to.equal(Rules.DiagnosticCodes.EntityClassMustDeriveFromBisHierarchy);
        expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.SchemaItem);
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });

    it("EntityClass does derive from BIS base class, rule passes.", async () => {
      const baseEntity = new EntityClass(bisCoreSchema, "BaseEntity");
      const childEntity = new EntityClass(testSchema, "ChildEntity");
      childEntity.baseClass = new DelayedPromiseWithProps(baseEntity.key, async () => baseEntity);

      const result = await Rules.entityClassMustDeriveFromBisHierarchy(childEntity);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });

    it("EntityClass does derive from BIS hierarchy, rule passes.", async () => {
      const baseEntity = new EntityClass(bisCoreSchema, "BaseEntity");
      const childEntity = new EntityClass(testSchema, "ChildEntity");
      childEntity.baseClass = new DelayedPromiseWithProps(baseEntity.key, async () => baseEntity);
      const grandChildEntity = new EntityClass(testSchema, "GrandChildEntity");
      grandChildEntity.baseClass = new DelayedPromiseWithProps(childEntity.key, async () => childEntity);

      const result = await Rules.entityClassMustDeriveFromBisHierarchy(grandChildEntity);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });
  });

  describe("EntityClassMayNotInheritSameProperty tests", () => {
    it("Same property in base Entity and Mixin, rule violated.", async () => {
      const baseEntity = new EntityClass(testSchema, "BaseEntity") as ECClass;
      await (baseEntity as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.Integer);

      const mixin = new Mixin(testSchema, "TestMixin");
      await (mixin as unknown as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.Integer);

      const childEntity = new EntityClass(testSchema, "TestEntity");
      await (childEntity as unknown as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.Integer);
      childEntity.baseClass = new DelayedPromiseWithProps(baseEntity.key, async () => baseEntity);
      await (childEntity as MutableEntityClass).addMixin(mixin);

      const result = await Rules.entityClassMayNotInheritSameProperty(childEntity);

      let resultHasEntries = false;
      for await (const diagnostic of result!) {
        resultHasEntries = true;
        expect(diagnostic).to.not.be.undefined;
        expect(diagnostic!.ecDefinition).to.equal(childEntity);
        expect(diagnostic!.messageArgs).to.eql([childEntity.fullName, "TestProperty", baseEntity.fullName, mixin.fullName]);
        expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic!.code).to.equal(Rules.DiagnosticCodes.EntityClassMayNotInheritSameProperty);
        expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.SchemaItem);
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });

    it("Same property in Mixins, rule violated.", async () => {
      const mixin1 = new Mixin(testSchema, "TestMixin");
      await (mixin1 as unknown as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.Integer);

      const mixin2 = new Mixin(testSchema, "TestMixin2");
      await (mixin2 as unknown as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.Integer);

      const childEntity = new EntityClass(testSchema, "TestEntity");
      await (childEntity as unknown as MutableClass).createPrimitiveProperty("TestProperty", PrimitiveType.Integer);
      await (childEntity as MutableEntityClass).addMixin(mixin1);
      await (childEntity as MutableEntityClass).addMixin(mixin2);

      const result = await Rules.entityClassMayNotInheritSameProperty(childEntity);

      let resultHasEntries = false;
      for await (const diagnostic of result!) {
        resultHasEntries = true;
        expect(diagnostic).to.not.be.undefined;
        expect(diagnostic!.ecDefinition).to.equal(childEntity);
        expect(diagnostic!.messageArgs).to.eql([childEntity.fullName, "TestProperty", mixin1.fullName, mixin2.fullName]);
        expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic!.code).to.equal(Rules.DiagnosticCodes.EntityClassMayNotInheritSameProperty);
        expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.SchemaItem);
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });

    it("Property overridden but not duplicated in base classes, rule passes.", async () => {
      const baseEntity = new EntityClass(testSchema, "BaseEntity") as ECClass;
      await (baseEntity as MutableClass).createPrimitiveProperty("TestPropertyA", PrimitiveType.Integer);

      const mixin = new Mixin(testSchema, "TestMixin");
      await (mixin as unknown as MutableClass).createPrimitiveProperty("TestPropertyB", PrimitiveType.Integer);

      const childEntity = new EntityClass(testSchema, "TestEntity");
      await (childEntity as unknown as MutableClass).createPrimitiveProperty("TestPropertyA", PrimitiveType.Integer);
      childEntity.baseClass = new DelayedPromiseWithProps(baseEntity.key, async () => baseEntity);
      await (childEntity as MutableEntityClass).addMixin(mixin);

      const result = await Rules.entityClassMayNotInheritSameProperty(childEntity);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });

    it("No mixins, getProperties not called.", async () => {
      const baseEntity = new EntityClass(testSchema, "BaseEntity") as ECClass;
      await (baseEntity as MutableClass).createPrimitiveProperty("TestPropertyA", PrimitiveType.Integer);
      const childEntity = new EntityClass(testSchema, "TestEntity");
      childEntity.baseClass = new DelayedPromiseWithProps(baseEntity.key, async () => baseEntity);
      const spy = sinon.spy(EntityClass.prototype, "getProperties");

      const result = await Rules.entityClassMayNotInheritSameProperty(childEntity);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }

      expect(spy.notCalled).to.be.true;
    });

    it("One mixin and no base class, getProperties not called.", async () => {
      const childEntity = new EntityClass(testSchema, "TestEntity");
      const mixin = new Mixin(testSchema, "TestMixin");
      await (childEntity as MutableEntityClass).addMixin(mixin);
      const spy = sinon.spy(EntityClass.prototype, "getProperties");

      const result = await Rules.entityClassMayNotInheritSameProperty(childEntity);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }

      expect(spy.notCalled).to.be.true;
    });
  });

  describe("ElementMultiAspectMustHaveCorrespondingRelationship tests", () => {
    it("ElementMultiAspect EntityClass does not have a corresponding relationship, rule violated.", async () => {
      const schemaJson = {
        TestRelationship: {
          schemaItemType: "RelationshipClass",
          strength: "embedding",
          strengthDirection: "forward",
          source: {
            multiplicity: "(1..1)",
            polymorphic: true,
            roleLabel: "owns",
            constraintClasses: [
            ],
          },
          target: {
            multiplicity: "(0..*)",
            polymorphic: true,
            roleLabel: "is owned by",
            constraintClasses: [
              "TestSchema.TestEntity",
            ],
          },
        },
        TestEntity: {
          baseClass: "BisCore.ElementMultiAspect",
          schemaItemType: "EntityClass",
        },
      };
      const schema = await getTestSchema(schemaJson);
      const entity = (await schema.getItem("TestEntity")) as EntityClass;

      const result = await Rules.elementMultiAspectMustHaveCorrespondingRelationship(entity);

      let resultHasEntries = false;
      for await (const diagnostic of result!) {
        resultHasEntries = true;
        expect(diagnostic).to.not.be.undefined;
        expect(diagnostic!.ecDefinition).to.equal(entity);
        expect(diagnostic!.messageArgs).to.eql([entity.fullName]);
        expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic!.code).to.equal(Rules.DiagnosticCodes.ElementMultiAspectMustHaveCorrespondingRelationship);
        expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.SchemaItem);
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });

    it("Base ElementMultiAspect in different schema, does not have a corresponding relationship, rule violated.", async () => {
      const baseSchemaJson = {
        BaseEntity: {
          baseClass: "BisCore.ElementMultiAspect",
          schemaItemType: "EntityClass",
        },
      };
      const context = await BisTestHelper.getNewContext();
      await getTestSchema(baseSchemaJson, "BaseSchema", context);

      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        references: [
          {
            name: "BaseSchema",
            version: "1.2.3",
          },
        ],
        items: {
          TestRelationship: {
            schemaItemType: "RelationshipClass",
            strength: "embedding",
            strengthDirection: "forward",
            source: {
              multiplicity: "(1..1)",
              polymorphic: true,
              roleLabel: "owns",
              constraintClasses: [
              ],
            },
            target: {
              multiplicity: "(0..*)",
              polymorphic: true,
              roleLabel: "is owned by",
              constraintClasses: [
                "TestSchema.TestEntity",
              ],
            },
          },
          TestEntity: {
            baseClass: "BaseSchema.BaseEntity",
            schemaItemType: "EntityClass",
          },
        },
      };
      const schema = await Schema.fromJson(schemaJson, context);
      const entity = (await schema.getItem("TestEntity")) as EntityClass;

      const result = await Rules.elementMultiAspectMustHaveCorrespondingRelationship(entity);

      let resultHasEntries = false;
      for await (const diagnostic of result!) {
        resultHasEntries = true;
        expect(diagnostic).to.not.be.undefined;
        expect(diagnostic!.ecDefinition).to.equal(entity);
        expect(diagnostic!.messageArgs).to.eql([entity.fullName]);
        expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic!.code).to.equal(Rules.DiagnosticCodes.ElementMultiAspectMustHaveCorrespondingRelationship);
        expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.SchemaItem);
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });

    it("Schema has no relationship, rule violated.", async () => {
      const schemaJson = {
        TestEntity: {
          baseClass: "BisCore.ElementMultiAspect",
          schemaItemType: "EntityClass",
        },
      };
      const schema = await getTestSchema(schemaJson);
      const entity = (await schema.getItem("TestEntity")) as EntityClass;

      const result = await Rules.elementMultiAspectMustHaveCorrespondingRelationship(entity);

      let resultHasEntries = false;
      for await (const diagnostic of result!) {
        resultHasEntries = true;
        expect(diagnostic).to.not.be.undefined;
        expect(diagnostic!.ecDefinition).to.equal(entity);
        expect(diagnostic!.messageArgs).to.eql([entity.fullName]);
        expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic!.code).to.equal(Rules.DiagnosticCodes.ElementMultiAspectMustHaveCorrespondingRelationship);
        expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.SchemaItem);
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });

    it("EntityClass is not a ElementMultiAspect, rule passes.", async () => {
      const schemaJson = {
        TestRelationship: {
          schemaItemType: "RelationshipClass",
          baseClass: "BisCore.ElementOwnsMultiAspects",
          strength: "embedding",
          strengthDirection: "forward",
          source: {
            multiplicity: "(1..1)",
            polymorphic: true,
            roleLabel: "owns",
            constraintClasses: [
            ],
          },
          target: {
            multiplicity: "(0..*)",
            polymorphic: true,
            roleLabel: "is owned by",
            constraintClasses: [
              "TestSchema.TestEntity",
            ],
          },
        },
        TestEntity: {
          schemaItemType: "EntityClass",
        },
      };
      const schema = await getTestSchema(schemaJson);
      const entity = (await schema.getItem("TestEntity")) as EntityClass;

      const result = await Rules.elementMultiAspectMustHaveCorrespondingRelationship(entity);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });

    it("ElementMultiAspect EntityClass does have a corresponding relationship, rule passes.", async () => {
      const schemaJson = {
        TestRelationship: {
          schemaItemType: "RelationshipClass",
          baseClass: "BisCore.ElementOwnsMultiAspects",
          strength: "embedding",
          strengthDirection: "forward",
          source: {
            multiplicity: "(1..1)",
            polymorphic: true,
            roleLabel: "owns",
            constraintClasses: [
            ],
          },
          target: {
            multiplicity: "(0..*)",
            polymorphic: true,
            roleLabel: "is owned by",
            constraintClasses: [
              "TestSchema.TestEntity",
            ],
          },
        },
        TestEntity: {
          baseClass: "BisCore.ElementMultiAspect",
          schemaItemType: "EntityClass",
        },
      };
      const schema = await getTestSchema(schemaJson);
      const entity = (await schema.getItem("TestEntity")) as EntityClass;

      const result = await Rules.elementMultiAspectMustHaveCorrespondingRelationship(entity);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });

    it("BisCore schema not referenced, rule passes.", async () => {
      const testEntity = new EntityClass(testSchema, "TestEntity");

      const result = await Rules.elementMultiAspectMustHaveCorrespondingRelationship(testEntity);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });
  });

  describe("ElementUniqueAspectMustHaveCorrespondingRelationship tests", () => {
    it("ElementUniqueAspect EntityClass does not have a corresponding relationship, rule violated.", async () => {
      const schemaJson = {
        TestRelationship: {
          schemaItemType: "RelationshipClass",
          strength: "embedding",
          strengthDirection: "forward",
          source: {
            multiplicity: "(1..1)",
            polymorphic: true,
            roleLabel: "owns",
            constraintClasses: [
            ],
          },
          target: {
            multiplicity: "(0..*)",
            polymorphic: true,
            roleLabel: "is owned by",
            constraintClasses: [
              "TestSchema.TestEntity",
            ],
          },
        },
        TestEntity: {
          baseClass: "BisCore.ElementUniqueAspect",
          schemaItemType: "EntityClass",
        },
      };
      const schema = await getTestSchema(schemaJson);
      const entity = (await schema.getItem("TestEntity")) as EntityClass;

      const result = await Rules.elementUniqueAspectMustHaveCorrespondingRelationship(entity);

      let resultHasEntries = false;
      for await (const diagnostic of result!) {
        resultHasEntries = true;
        expect(diagnostic).to.not.be.undefined;
        expect(diagnostic!.ecDefinition).to.equal(entity);
        expect(diagnostic!.messageArgs).to.eql([entity.fullName]);
        expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic!.code).to.equal(Rules.DiagnosticCodes.ElementUniqueAspectMustHaveCorrespondingRelationship);
        expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.SchemaItem);
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });

    it("Schema has no relationship, rule violated.", async () => {
      const schemaJson = {
        TestEntity: {
          baseClass: "BisCore.ElementUniqueAspect",
          schemaItemType: "EntityClass",
        },
      };
      const schema = await getTestSchema(schemaJson);
      const entity = (await schema.getItem("TestEntity")) as EntityClass;

      const result = await Rules.elementUniqueAspectMustHaveCorrespondingRelationship(entity);

      let resultHasEntries = false;
      for await (const diagnostic of result!) {
        resultHasEntries = true;
        expect(diagnostic).to.not.be.undefined;
        expect(diagnostic!.ecDefinition).to.equal(entity);
        expect(diagnostic!.messageArgs).to.eql([entity.fullName]);
        expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic!.code).to.equal(Rules.DiagnosticCodes.ElementUniqueAspectMustHaveCorrespondingRelationship);
        expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.SchemaItem);
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });

    it("EntityClass is not a ElementUniqueAspect, rule passes.", async () => {
      const schemaJson = {
        TestRelationship: {
          schemaItemType: "RelationshipClass",
          baseClass: "BisCore.ElementOwnsUniqueAspect",
          strength: "embedding",
          strengthDirection: "forward",
          source: {
            multiplicity: "(1..1)",
            polymorphic: true,
            roleLabel: "owns",
            constraintClasses: [
            ],
          },
          target: {
            multiplicity: "(0..*)",
            polymorphic: true,
            roleLabel: "is owned by",
            constraintClasses: [
              "TestSchema.TestEntity",
            ],
          },
        },
        TestEntity: {
          schemaItemType: "EntityClass",
        },
      };
      const schema = await getTestSchema(schemaJson);
      const entity = (await schema.getItem("TestEntity")) as EntityClass;

      const result = await Rules.elementUniqueAspectMustHaveCorrespondingRelationship(entity);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });

    it("ElementUniqueAspect EntityClass does have a corresponding relationship, rule passes.", async () => {
      const schemaJson = {
        TestRelationship: {
          schemaItemType: "RelationshipClass",
          baseClass: "BisCore.ElementOwnsUniqueAspect",
          strength: "embedding",
          strengthDirection: "forward",
          source: {
            multiplicity: "(1..1)",
            polymorphic: true,
            roleLabel: "owns",
            constraintClasses: [
            ],
          },
          target: {
            multiplicity: "(0..*)",
            polymorphic: true,
            roleLabel: "is owned by",
            constraintClasses: [
              "TestSchema.TestEntity",
            ],
          },
        },
        TestEntity: {
          baseClass: "BisCore.ElementUniqueAspect",
          schemaItemType: "EntityClass",
        },
      };
      const schema = await getTestSchema(schemaJson);
      const entity = (await schema.getItem("TestEntity")) as EntityClass;

      const result = await Rules.elementUniqueAspectMustHaveCorrespondingRelationship(entity);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });

    it("BisCore schema not referenced, rule passes.", async () => {
      const testEntity = new EntityClass(testSchema, "TestEntity");

      const result = await Rules.elementUniqueAspectMustHaveCorrespondingRelationship(testEntity);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });
  });

  describe("EntityClassesCannotDeriveFromIParentElementAndISubModeledElement tests", () => {
    it("EntityClass implement both mixins, rule violated.", async () => {
      const schemaJson = {
        TestEntity: {
          schemaItemType: "EntityClass",
          mixins: ["BisCore.IParentElement", "BisCore.ISubModeledElement"],
        },
      };
      const schema = await getTestSchema(schemaJson);
      const testEntity = (await schema.getItem("TestEntity")) as EntityClass;

      const result = await Rules.entityClassesCannotDeriveFromIParentElementAndISubModeledElement(testEntity);

      let resultHasEntries = false;
      for await (const diagnostic of result!) {
        resultHasEntries = true;
        expect(diagnostic).to.not.be.undefined;
        expect(diagnostic!.ecDefinition).to.equal(testEntity);
        expect(diagnostic!.messageArgs).to.eql([testEntity.fullName]);
        expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic!.code).to.equal(Rules.DiagnosticCodes.EntityClassesCannotDeriveFromIParentElementAndISubModeledElement);
        expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.SchemaItem);
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });

    it("EntityClass does not derive from both mixins, rule passes.", async () => {
      const schemaJson = {
        TestEntity: {
          schemaItemType: "EntityClass",
          mixins: ["BisCore.IParentElement"],
        },
      };
      const schema = await getTestSchema(schemaJson);
      const testEntity = (await schema.getItem("TestEntity")) as EntityClass;

      const result = await Rules.entityClassesCannotDeriveFromIParentElementAndISubModeledElement(testEntity);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });

    it("Schema does not reference BIS, rule passes.", async () => {
      const schemaJson = {
        TestEntity: {
          schemaItemType: "EntityClass",
        },
      };
      const schema = await getTestSchema(schemaJson, "TestSchema", new SchemaContext(), false);
      const testEntity = (await schema.getItem("TestEntity")) as EntityClass;

      const result = await Rules.entityClassesCannotDeriveFromIParentElementAndISubModeledElement(testEntity);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });
  });

  describe("EntityClassesCannotDeriveFromModelClasses tests", () => {
    it("EntityClass derives from bis:PhysicalModel, rule violated.", async () => {
      const schemaJson = {
        TestEntity: {
          schemaItemType: "EntityClass",
          baseClass: "BisCore.PhysicalModel",
        },
      };
      const schema = await getTestSchema(schemaJson);
      const testEntity = (await schema.getItem("TestEntity")) as EntityClass;

      const result = await Rules.entityClassesCannotDeriveFromModelClasses(testEntity);

      let resultHasEntries = false;
      for await (const diagnostic of result!) {
        resultHasEntries = true;
        expect(diagnostic).to.not.be.undefined;
        expect(diagnostic!.ecDefinition).to.equal(testEntity);
        expect(diagnostic!.messageArgs).to.eql([testEntity.fullName, "BisCore.PhysicalModel"]);
        expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic!.code).to.equal(Rules.DiagnosticCodes.EntityClassesCannotDeriveFromModelClasses);
        expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.SchemaItem);
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });

    it("EntityClass derives from bis:SpatialLocationModel, rule violated.", async () => {
      const schemaJson = {
        TestEntity: {
          schemaItemType: "EntityClass",
          baseClass: "BisCore.SpatialLocationModel",
        },
      };
      const schema = await getTestSchema(schemaJson);
      const testEntity = (await schema.getItem("TestEntity")) as EntityClass;

      const result = await Rules.entityClassesCannotDeriveFromModelClasses(testEntity);

      let resultHasEntries = false;
      for await (const diagnostic of result!) {
        resultHasEntries = true;
        expect(diagnostic).to.not.be.undefined;
        expect(diagnostic!.ecDefinition).to.equal(testEntity);
        expect(diagnostic!.messageArgs).to.eql([testEntity.fullName, "BisCore.SpatialLocationModel"]);
        expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic!.code).to.equal(Rules.DiagnosticCodes.EntityClassesCannotDeriveFromModelClasses);
        expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.SchemaItem);
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });

    it("EntityClass derives from bis:InformationRecordModel, rule violated.", async () => {
      const schemaJson = {
        TestEntity: {
          schemaItemType: "EntityClass",
          baseClass: "BisCore.InformationRecordModel",
        },
      };
      const schema = await getTestSchema(schemaJson);
      const testEntity = (await schema.getItem("TestEntity")) as EntityClass;

      const result = await Rules.entityClassesCannotDeriveFromModelClasses(testEntity);

      let resultHasEntries = false;
      for await (const diagnostic of result!) {
        resultHasEntries = true;
        expect(diagnostic).to.not.be.undefined;
        expect(diagnostic!.ecDefinition).to.equal(testEntity);
        expect(diagnostic!.messageArgs).to.eql([testEntity.fullName, "BisCore.InformationRecordModel"]);
        expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic!.code).to.equal(Rules.DiagnosticCodes.EntityClassesCannotDeriveFromModelClasses);
        expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.SchemaItem);
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });

    it("EntityClass derives from bis:DefinitionModel, rule violated.", async () => {
      const schemaJson = {
        TestEntity: {
          schemaItemType: "EntityClass",
          baseClass: "BisCore.DefinitionModel",
        },
      };
      const schema = await getTestSchema(schemaJson);
      const testEntity = (await schema.getItem("TestEntity")) as EntityClass;

      const result = await Rules.entityClassesCannotDeriveFromModelClasses(testEntity);

      let resultHasEntries = false;
      for await (const diagnostic of result!) {
        resultHasEntries = true;
        expect(diagnostic).to.not.be.undefined;
        expect(diagnostic!.ecDefinition).to.equal(testEntity);
        expect(diagnostic!.messageArgs).to.eql([testEntity.fullName, "BisCore.DefinitionModel"]);
        expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic!.code).to.equal(Rules.DiagnosticCodes.EntityClassesCannotDeriveFromModelClasses);
        expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.SchemaItem);
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });

    it("EntityClass derives from bis:DocumentListModel, rule violated.", async () => {
      const schemaJson = {
        TestEntity: {
          schemaItemType: "EntityClass",
          baseClass: "BisCore.DocumentListModel",
        },
      };
      const schema = await getTestSchema(schemaJson);
      const testEntity = (await schema.getItem("TestEntity")) as EntityClass;

      const result = await Rules.entityClassesCannotDeriveFromModelClasses(testEntity);

      let resultHasEntries = false;
      for await (const diagnostic of result!) {
        resultHasEntries = true;
        expect(diagnostic).to.not.be.undefined;
        expect(diagnostic!.ecDefinition).to.equal(testEntity);
        expect(diagnostic!.messageArgs).to.eql([testEntity.fullName, "BisCore.DocumentListModel"]);
        expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic!.code).to.equal(Rules.DiagnosticCodes.EntityClassesCannotDeriveFromModelClasses);
        expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.SchemaItem);
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });

    it("EntityClass derives from bis:LinkModel, rule violated.", async () => {
      const schemaJson = {
        TestEntity: {
          schemaItemType: "EntityClass",
          baseClass: "BisCore.LinkModel",
        },
      };
      const schema = await getTestSchema(schemaJson);
      const testEntity = (await schema.getItem("TestEntity")) as EntityClass;

      const result = await Rules.entityClassesCannotDeriveFromModelClasses(testEntity);

      let resultHasEntries = false;
      for await (const diagnostic of result!) {
        resultHasEntries = true;
        expect(diagnostic).to.not.be.undefined;
        expect(diagnostic!.ecDefinition).to.equal(testEntity);
        expect(diagnostic!.messageArgs).to.eql([testEntity.fullName, "BisCore.LinkModel"]);
        expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic!.code).to.equal(Rules.DiagnosticCodes.EntityClassesCannotDeriveFromModelClasses);
        expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.SchemaItem);
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });

    it("Schema does not reference BIS, rule passes.", async () => {
      const schemaJson = {
        TestEntity: {
          schemaItemType: "EntityClass",
        },
      };
      const schema = await getTestSchema(schemaJson, "TestSchema", new SchemaContext(), false);
      const testEntity = (await schema.getItem("TestEntity")) as EntityClass;

      const result = await Rules.entityClassesCannotDeriveFromModelClasses(testEntity);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });

    it("Model class not found in BIS schema, throws.", async () => {
      let error: any;
      const schemaJson = {
        TestEntity: {
          schemaItemType: "EntityClass",
          baseClass: "BisCore.SpatialLocationModel",
        },
      };
      const schema = await getTestSchema(schemaJson);
      const testEntity = (await schema.getItem("TestEntity")) as EntityClass;
      const stub = sinon.stub(Schema.prototype, "getItem");
      stub.withArgs("PhysicalModel").resolves(undefined);
      stub.callThrough();

      try {
        const result = await Rules.entityClassesCannotDeriveFromModelClasses(testEntity);
        for await (const _r of result!) { }
      } catch (e) {
        error = e;
      }

      expect(error).to.be.instanceOf(ECObjectsError);
      expect(error.errorNumber).to.be.equal(ECObjectsStatus.ClassNotFound);
      expect(error.message.includes("PhysicalModel")).to.be.true;
    });

    it("EntityClass does not derive from unsupported model classes, rule passes.", async () => {
      const schemaJson = {
        BaseEntity: {
          schemaItemType: "EntityClass",
        },
        TestEntity: {
          schemaItemType: "EntityClass",
          baseClass: "TestSchema.BaseEntity",
        },
      };
      const schema = await getTestSchema(schemaJson);
      const testEntity = (await schema.getItem("TestEntity")) as EntityClass;

      const result = await Rules.entityClassesCannotDeriveFromModelClasses(testEntity);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });
  });

  describe("BisModelSubClassesCannotDefineProperties tests", () => {
    it("EntityClass derives from bis:Model and has local properties, rule violated.", async () => {
      const schemaJson = {
        TestEntity: {
          schemaItemType: "EntityClass",
          baseClass: "BisCore.Model",
          properties: [
            {
              type: "PrimitiveProperty",
              typeName: "string",
              name: "TestProperty",
            },
          ],
        },
      };
      const schema = await getTestSchema(schemaJson);
      const testEntity = (await schema.getItem("TestEntity")) as EntityClass;

      const result = await Rules.bisModelSubClassesCannotDefineProperties(testEntity);

      let resultHasEntries = false;
      for await (const diagnostic of result!) {
        resultHasEntries = true;
        expect(diagnostic).to.not.be.undefined;
        expect(diagnostic!.ecDefinition).to.equal(testEntity);
        expect(diagnostic!.messageArgs).to.eql([testEntity.fullName]);
        expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic!.code).to.equal(Rules.DiagnosticCodes.BisModelSubClassesCannotDefineProperties);
        expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.SchemaItem);
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });

    it("EntityClass derives from bis:Model and has no local properties, rule passes.", async () => {
      const schemaJson = {
        TestEntity: {
          baseClass: "BisCore.Model",
          schemaItemType: "EntityClass",
        },
      };
      const schema = await getTestSchema(schemaJson);
      const testEntity = (await schema.getItem("TestEntity")) as EntityClass;

      const result = await Rules.bisModelSubClassesCannotDefineProperties(testEntity);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });

    it("EntityClass does not derive from bis:Model and has local properties, rule passes.", async () => {
      const schemaJson = {
        TestEntity: {
          schemaItemType: "EntityClass",
          properties: [
            {
              type: "PrimitiveProperty",
              typeName: "string",
              name: "TestProperty",
            },
          ],
        },
      };
      const schema = await getTestSchema(schemaJson);
      const testEntity = (await schema.getItem("TestEntity")) as EntityClass;

      const result = await Rules.bisModelSubClassesCannotDefineProperties(testEntity);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });

    it("Model class not found in BIS schema, throws.", async () => {
      let error: any;
      const schemaJson = {
        TestEntity: {
          schemaItemType: "EntityClass",
          baseClass: "BisCore.Model",
        },
      };
      const schema = await getTestSchema(schemaJson);
      const testEntity = (await schema.getItem("TestEntity")) as EntityClass;
      const stub = sinon.stub(Schema.prototype, "getItem");
      stub.withArgs("Model").resolves(undefined);
      stub.callThrough();

      try {
        const result = await Rules.bisModelSubClassesCannotDefineProperties(testEntity);
        for await (const _r of result!) { }
      } catch (e) {
        error = e;
      }

      expect(error).to.be.instanceOf(ECObjectsError);
      expect(error.errorNumber).to.be.equal(ECObjectsStatus.ClassNotFound);
      expect(error.message.includes("Model")).to.be.true;
    });
  });

  describe("EntityClassesMayNotSubclassDeprecatedClasses tests", () => {
    it("EntityClass derives from deprecated class, rule violated.", async () => {
      const schemaJson = {
        BaseEntity: {
          schemaItemType: "EntityClass",
          customAttributes: [
            {
              className: "CoreCustomAttributes.Deprecated",
            },
          ],
        },
        TestEntity: {
          schemaItemType: "EntityClass",
          baseClass: "TestSchema.BaseEntity",
        },
      };
      const schema = await getTestSchema(schemaJson);
      const testEntity = (await schema.getItem("TestEntity")) as EntityClass;

      const result = await Rules.entityClassesMayNotSubclassDeprecatedClasses(testEntity);

      let resultHasEntries = false;
      for await (const diagnostic of result!) {
        resultHasEntries = true;
        expect(diagnostic).to.not.be.undefined;
        expect(diagnostic!.ecDefinition).to.equal(testEntity);
        expect(diagnostic!.messageArgs).to.eql([testEntity.fullName, testEntity.baseClass!.fullName]);
        expect(diagnostic!.category).to.equal(DiagnosticCategory.Error);
        expect(diagnostic!.code).to.equal(Rules.DiagnosticCodes.EntityClassesMayNotSubclassDeprecatedClasses);
        expect(diagnostic!.diagnosticType).to.equal(DiagnosticType.SchemaItem);
      }
      expect(resultHasEntries, "expected rule to return an AsyncIterable with entries.").to.be.true;
    });

    it("EntityClass does not derive from deprecated class, rule violated.", async () => {
      const schemaJson = {
        BaseEntity: {
          schemaItemType: "EntityClass",
          customAttributes: [
          ],
        },
        TestEntity: {
          schemaItemType: "EntityClass",
          baseClass: "TestSchema.BaseEntity",
        },
      };
      const schema = await getTestSchema(schemaJson);
      const testEntity = (await schema.getItem("TestEntity")) as EntityClass;

      const result = await Rules.entityClassesMayNotSubclassDeprecatedClasses(testEntity);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });

    it("EntityClass has no base class, rule passes.", async () => {
      const schemaJson = {
        TestEntity: {
          schemaItemType: "EntityClass",
        },
      };
      const schema = await getTestSchema(schemaJson);
      const testEntity = (await schema.getItem("TestEntity")) as EntityClass;

      const result = await Rules.entityClassesMayNotSubclassDeprecatedClasses(testEntity);

      for await (const _diagnostic of result!) {
        expect(false, "Rule should have passed").to.be.true;
      }
    });
  });
});
