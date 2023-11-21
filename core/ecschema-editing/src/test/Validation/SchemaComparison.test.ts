/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Schema, SchemaContext } from "@itwin/ecschema-metadata";
import { AnyDiagnostic, ISchemaChanges, ISchemaCompareReporter, SchemaChanges, SchemaCompareCodes, SchemaComparer } from "../../ecschema-editing";
import { expect } from "chai";

class TestSchemaCompareReporter implements ISchemaCompareReporter {
  public changes: SchemaChanges[] = [];
  public report(schemaChanges: ISchemaChanges): void {
    this.changes.push(schemaChanges as SchemaChanges);
  }
}

function findDiagnostic(diagnostics: AnyDiagnostic[], code: string, fullNameA: string, fullNameB: string, propertyType?: string) {
  let found = false;

  diagnostics.find((anyDiagnostic) => {
    switch (code) {
      case SchemaCompareCodes.BaseClassDelta : {
        if (anyDiagnostic.code === code &&
          anyDiagnostic.messageArgs?.at(0).fullName === fullNameA &&
          anyDiagnostic.messageArgs?.at(1).fullName === fullNameB) {
          found = true;
        }
        break;
      }
      case SchemaCompareCodes.PropertyDelta : {
        if (anyDiagnostic.code === code &&
          anyDiagnostic.messageArgs?.at(0) === propertyType &&
          anyDiagnostic.messageArgs?.at(1) === fullNameA &&
          anyDiagnostic.messageArgs?.at(2) === fullNameB) {
          found = true;
        }
        break;
      }
    }
  });
  return found;
}

describe("Schema comparison tests for comparing schemas with different names", () => {
  let reporter: TestSchemaCompareReporter;
  let contextA: SchemaContext;
  let contextB: SchemaContext;

  const dummyRefOneJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "DummyReferenceOne",
    version: "01.00.01",
    alias: "dumRefOne",
  };

  const dummyRefTwoJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "DummyReferenceTwo",
    version: "01.00.02",
    alias: "dumRefTwo",
  };

  const schemaAJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "SchemaA",
    version: "1.2.3",
    alias: "a",
    label: "labelA",
    description: "descriptionA",
  };

  const schemaBJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "SchemaB",
    version: "1.2.3",
    alias: "b",
    label: "labelB",
    description: "descriptionB",
  };

  beforeEach(async () => {
    reporter = new TestSchemaCompareReporter();
    contextA = new SchemaContext();
    contextB = new SchemaContext();
  });

  describe("Entity Class comparisons cases", () => {
    it("should not report baseClass delta when base class has same name and is defined in schemas being compared", async () => {
      const schemaA = await Schema.fromJson({
        ...schemaAJson,
        items: {
          testBaseClass: {
            schemaItemType: "EntityClass",
            description: "Test base class",
          },
          testEntityClass: {
            schemaItemType: "EntityClass",
            baseClass: "SchemaA.testBaseClass",
          },
        },
      }, contextA);

      const schemaB = await Schema.fromJson({
        ...schemaBJson,
        items: {
          testBaseClass: {
            schemaItemType: "EntityClass",
            description: "Test base class",
          },
          testEntityClass: {
            schemaItemType: "EntityClass",
            baseClass: "SchemaB.testBaseClass",
          },
        },
      }, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);
      const foundDiag = findDiagnostic(reporter.changes[0].allDiagnostics, "SC-105", "SchemaA.testBaseClass", "SchemaB.testBaseClass");
      expect(foundDiag).to.equal(false);
    });

    it("should report baseClass delta when base class has different full name", async () => {
      const schemaA = await Schema.fromJson({
        ...schemaAJson,
        items: {
          testBaseClassA: {
            schemaItemType: "EntityClass",
            description: "Test base class A",
          },
          testEntityClass: {
            schemaItemType: "EntityClass",
            description: "Test entity class",
            baseClass: "SchemaA.testBaseClassA",
          },
        },
      }, contextA);

      const schemaB = await Schema.fromJson({
        ...schemaBJson,
        items: {
          testBaseClassB: {
            schemaItemType: "EntityClass",
            description: "Test base class B",
          },
          testEntityClass: {
            schemaItemType: "EntityClass",
            description: "Test entity class",
            baseClass: "SchemaB.testBaseClassB",
          },
        },
      }, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);
      const foundDiag = findDiagnostic(reporter.changes[0].allDiagnostics, "SC-105", "SchemaA.testBaseClassA", "SchemaB.testBaseClassB");
      expect(foundDiag).to.equal(true);
    });

    it("should report baseClass delta for baseClass with same name but defined in a referenced schema", async () => {
      const _dummyRefTwo = await Schema.fromJson({
        ...dummyRefTwoJson,
        items: {
          testBaseClass: {
            schemaItemType: "EntityClass",
            description: "Test base class",
            label: "Base class",
          },
        },
      }, contextB);

      const schemaA = await Schema.fromJson({
        ...schemaAJson,
        items: {
          testBaseClass: {
            schemaItemType: "EntityClass",
            description: "Test base class",
            label: "Base class",
          },
          testEntityClass: {
            schemaItemType: "EntityClass",
            description: "Entity class for testing",
            label: "Test entity class",
            baseClass: "SchemaA.testBaseClass",
          },
        },
      }, contextA);

      const schemaB = await Schema.fromJson({
        ...schemaBJson,
        references: [
          {
            name: "DummyReferenceTwo",
            version: "01.00.02",
          },
        ],
        items: {
          testEntityClass: {
            schemaItemType: "EntityClass",
            description: "Entity class for testing",
            label: "Test entity class",
            baseClass: "DummyReferenceTwo.testBaseClass",
          },
        },
      }, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);
      const foundDiag = findDiagnostic(reporter.changes[0].allDiagnostics, "SC-105", "SchemaA.testBaseClass", "DummyReferenceTwo.testBaseClass");
      expect(foundDiag).to.equal(true);
    });

    it("should not report baseClass delta if the full names are the same, even though the schema containing the definition classA has a different name ", async () => {
      const schemaA = await Schema.fromJson({
        ...schemaAJson,
        items: {
          testBaseClass: {
            schemaItemType: "EntityClass",
            description: "Test base class",
          },
          testEntityClass: {
            schemaItemType: "EntityClass",
            baseClass: "SchemaA.testBaseClass",
          },
        },
      }, contextA);

      const schemaB = await Schema.fromJson({
        ...schemaBJson,
        references: [
          {
            name: "SchemaA",
            version: "1.2.3",
          },
        ],
        items: {
          testEntityClass: {
            schemaItemType: "EntityClass",
            baseClass: "SchemaA.testBaseClass",
          },
        },

      }, contextA);
      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);
      const foundDiag = findDiagnostic(reporter.changes[0].allDiagnostics, "SC-105", "SchemaA.testBaseClass", "SchemaA.testBaseClass");
      expect(foundDiag).to.equal(false);
    });
  });

  /**
     * Linear draft schema examples
     */
  describe("Struct Class comparisons", () => {
    it("should not report property delta for typeName of the property with same name and is defined in schemas being compared", async () => {
      const schemaA = await Schema.fromJson({
        ...schemaAJson,
        items: {
          inSpan: {
            schemaItemType: "StructClass",
            description: "Linear draft InSpan Class",
            properties: [
              {
                name: "Address",
                type: "StructProperty",
                typeName: "SchemaA.inSpanAddress",
              },
            ],
          },
          inSpanAddress: {
            schemaItemType: "StructClass",
            description: "Linear draft InSpanAddress Class",
          },
        },
      }, contextA);

      const schemaB = await Schema.fromJson({
        ...schemaBJson,
        items: {
          inSpan: {
            schemaItemType: "StructClass",
            description: "Linear draft InSpan Class",
            properties: [
              {
                name: "Address",
                type: "StructProperty",
                typeName: "SchemaB.inSpanAddress",
              },
            ],
          },
          inSpanAddress: {
            schemaItemType: "StructClass",
            description: "Linear draft InSpanAddress Class",
          },
        },
      }, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);
      const foundDiag = findDiagnostic(reporter.changes[0].allDiagnostics, "SC-106", "SchemaA.inSpanAddress", "SchemaB.inSpanAddress", "structClass");
      expect(foundDiag).to.equal(false);
    });

    it("should report property delta for typeName of the property with different name", async () => {
      const schemaA = await Schema.fromJson({
        ...schemaAJson,
        items: {
          inSpan: {
            schemaItemType: "StructClass",
            description: "Linear draft InSpan Class",
            properties: [
              {
                name: "Address",
                type: "StructProperty",
                typeName: "SchemaA.inSpanAddressA",
              },
            ],
          },
          inSpanAddressA: {
            schemaItemType: "StructClass",
            description: "Linear draft InSpanAddress Class A",
          },
        },
      }, contextA);

      const schemaB = await Schema.fromJson({
        ...schemaBJson,
        items: {
          inSpan: {
            schemaItemType: "StructClass",
            description: "Linear draft InSpan Class",
            properties: [
              {
                name: "Address",
                type: "StructProperty",
                typeName: "SchemaB.inSpanAddressB",
              },
            ],
          },
          inSpanAddressB: {
            schemaItemType: "StructClass",
            description: "Linear draft InSpanAddress Class B",
          },
        },
      }, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);
      const foundDiag = findDiagnostic(reporter.changes[0].allDiagnostics, "SC-106", "SchemaA.inSpanAddressA", "SchemaB.inSpanAddressB", "structClass");
      expect(foundDiag).to.equal(true);
    });

    it("should report property delta for typeName of the property with the same name but defined in a referenced schema", async () => {
      const _dummyRefOne = await Schema.fromJson({
        ...dummyRefOneJson,
        items: {
          inSpanAddress: {
            schemaItemType: "StructClass",
            label: "In span address Ref",
            description: "Linear draft InSpanAddress Class Ref",
          },
        },
      }, contextA);

      const schemaA = await Schema.fromJson({
        ...schemaAJson,
        references: [
          {
            name: "DummyReferenceOne",
            version: "01.00.01",
          },
        ],
        items: {
          inSpan: {
            schemaItemType: "StructClass",
            description: "Linear draft InSpan Class",
            properties: [
              {
                name: "Address",
                type: "StructProperty",
                typeName: "DummyReferenceOne.inSpanAddress",
              },
            ],
          },
        },
      }, contextA);

      const schemaB = await Schema.fromJson({
        ...schemaBJson,
        items: {
          inSpan: {
            schemaItemType: "StructClass",
            description: "Linear draft InSpan Class",
            properties: [
              {
                name: "Address",
                type: "StructProperty",
                typeName: "SchemaB.inSpanAddress",
              },
            ],
          },
          inSpanAddress: {
            schemaItemType: "StructClass",
            description: "Linear draft InSpanAddress Class",
          },
        },
      }, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);
      const foundDiag = findDiagnostic(reporter.changes[0].allDiagnostics, "SC-106", "DummyReferenceOne.inSpanAddress", "SchemaB.inSpanAddress", "structClass");
      expect(foundDiag).to.equal(true);
    });
  });

  describe("Property comparison of entity classes tests", ()=>{
    it("should not report property delta for category with same name and defined in schemas being compared", async ()=> {
      const schemaA = await Schema.fromJson({
        ...schemaAJson,
        items: {
          categoryTest: {
            schemaItemType: "PropertyCategory",
            type: "string",
            typeName: "test",
            priority: 1,
          },
          testEntityClass: {
            schemaItemType: "EntityClass",
            properties: [
              {
                name: "PropertyA",
                type: "PrimitiveArrayProperty",
                typeName: "string",
                description: "test description",
                category: "SchemaA.categoryTest",
              },
            ],
          },
        },
      }, contextA);

      const schemaB = await Schema.fromJson({
        ...schemaBJson,
        items: {
          categoryTest: {
            schemaItemType: "PropertyCategory",
            type: "string",
            typeName: "test",
            priority: 1,
          },
          testEntityClass: {
            schemaItemType: "EntityClass",
            properties: [
              {
                name: "PropertyA",
                type: "PrimitiveArrayProperty",
                typeName: "string",
                description: "test description",
                category: "SchemaB.categoryTest",
              },
            ],
          },
        },
      }, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);
      const foundDiag = findDiagnostic(reporter.changes[0].allDiagnostics, "SC-106", "SchemaA.categoryTest", "SchemaB.categoryTest", "category");
      expect(foundDiag).to.equal(false);
    });

    it("should report property delta for category with same name but defined in a reference schema", async ()=> {
      const _dummyRefOne = await Schema.fromJson({
        ...dummyRefOneJson,
        items: {
          categoryTest: {
            schemaItemType: "PropertyCategory",
            type: "string",
            typeName: "test",
            priority: 1,
          },
        },
      }, contextA);

      const schemaA = await Schema.fromJson({
        ...schemaAJson,
        references: [
          {
            name: "DummyReferenceOne",
            version: "01.00.01",
          },
        ],
        items: {
          testEntityClass: {
            schemaItemType: "EntityClass",
            properties: [
              {
                name: "PropertyA",
                type: "PrimitiveArrayProperty",
                typeName: "string",
                description: "test description",
                category: "DummyReferenceOne.categoryTest",
              },
            ],
          },
        },
      }, contextA);

      const schemaB = await Schema.fromJson({
        ...schemaBJson,
        items: {
          categoryTest: {
            schemaItemType: "PropertyCategory",
            type: "string",
            typeName: "test",
            priority: 1,
          },
          testEntityClass: {
            schemaItemType: "EntityClass",
            properties: [
              {
                name: "PropertyA",
                type: "PrimitiveArrayProperty",
                typeName: "string",
                description: "test description",
                category: "SchemaB.categoryTest",
              },
            ],
          },
        },
      }, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);
      const foundDiag = findDiagnostic(reporter.changes[0].allDiagnostics, "SC-106", "DummyReferenceOne.categoryTest", "SchemaB.categoryTest", "category");
      expect(foundDiag).to.equal(true);
    });
  });
});
