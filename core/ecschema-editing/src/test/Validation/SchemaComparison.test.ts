/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Schema, SchemaContext } from "@itwin/ecschema-metadata";
import { AnyDiagnostic, ISchemaChanges, ISchemaCompareReporter, SchemaChanges, SchemaComparer } from "../../ecschema-editing";
import { expect } from "chai";

class TestSchemaCompareReporter implements ISchemaCompareReporter {
  public changes: SchemaChanges[] = [];
  public report(schemaChanges: ISchemaChanges): void {
    this.changes.push(schemaChanges as SchemaChanges);
  }
}

function findDiagnostic(diagnostics: AnyDiagnostic[], code: string, fullNameA: string, fullNameB: string) {
  let found = false;

  diagnostics.find((anyDiagnostic) => {
    if (anyDiagnostic.code === code &&
        anyDiagnostic.messageArgs?.at(0).fullName === fullNameA &&
        anyDiagnostic.messageArgs?.at(1).fullName === fullNameB ) {
      found = true;
    }
  });

  return found;
}

describe("Schema comparison tests to filter out cases", () => {
  let reporter: TestSchemaCompareReporter;
  let contextA: SchemaContext;
  let contextB: SchemaContext;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    it("should not report baseClass delta when comparing testEntityClass", async () => {
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

    it("should report baseClass delta for testEntityClass", async () => {
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
        ...schemaAJson, // Using schemaAJson
        items: {
          testBaseClassB: {
            schemaItemType: "EntityClass",
            description: "Test base class B",
          },
          testEntityClass: {
            schemaItemType: "EntityClass",
            description: "Test entity class",
            baseClass: "SchemaA.testBaseClassB",
          },
        },
      }, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const foundDiag = findDiagnostic(reporter.changes[0].allDiagnostics, "SC-105", "SchemaA.testBaseClassA", "SchemaA.testBaseClassB");
      expect(foundDiag).to.equal(true);
    });

    it("should not report baseClass delta when comparing testEntityClass", async () => {
      const schemaA = await Schema.fromJson({
        ...schemaAJson,
        items: {
          testEntityClass: {
            schemaItemType: "EntityClass",
            baseClass: "SchemaA.testBaseClass",
          },
          testBaseClass: {
            schemaItemType: "EntityClass",
          },
        },
      }, contextA);

      const schemaB = await Schema.fromJson({
        ...schemaBJson,
        items: {
          testEntityClass: {
            schemaItemType: "EntityClass",
            baseClass: "SchemaB.testBaseClass",
          },
          testBaseClass: {
            schemaItemType: "EntityClass",
            description: "Test base class",
            label: "Base class",
          },
        },
      }, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const foundDiag = findDiagnostic(reporter.changes[0].allDiagnostics, "SC-105", "SchemaA.testBaseClass", "SchemaB.testBaseClass");
      expect(foundDiag).to.equal(false);
    });

    /**
     * This case should register testBaseClass differences as usual.
     * Then baseClass should be reported as difference because the baseClass is in another schema.
     */
    it("should report baseClass delta for baseClass in referenced schema", async () => {
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

    /**
     * Linear draft schema example, typeName are identical, should not report a difference
     */
    describe("Struct Class comparisons", () => {
      it("should compare struct classes with properties and only register schema props differences", async () => {
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
        expect(reporter.changes[0].allDiagnostics.length).to.equal(4);
      });
    });

  });
});
