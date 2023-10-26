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
      case SchemaCompareCodes.MixinDelta: {
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

describe("Mixin comparison tests", () => {
  let reporter: TestSchemaCompareReporter;
  let contextA: SchemaContext;
  let contextB: SchemaContext;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const dummyRefJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "DummyReference",
    version: "01.00.01",
    alias: "dumRef",
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

  describe("Mixin class comparison tests", () => {
    it("should not report mixin delta", async () => {
      const schemaA = await Schema.fromJson({
        ...schemaAJson,
        items: {
          testClass: {
            schemaItemType: "EntityClass",
            description: "Test class",
          },
          testMixinClass: {
            schemaItemType: "Mixin",
            description: "mixin class for testing",
            label: "test mixin class",
            modifier: "None",
            appliesTo: "SchemaA.testClass",
          },
        },
      }, contextA);

      const schemaB = await Schema.fromJson({
        ...schemaBJson,
        items: {
          testClass: {
            schemaItemType: "EntityClass",
            description: "Test class",
          },
          testMixinClass: {
            schemaItemType: "Mixin",
            description: "mixin class for testing",
            label: "test mixin class",
            modifier: "None",
            appliesTo: "SchemaB.testClass",
          },
        },
      }, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const foundDiag = findDiagnostic(reporter.changes[0].allDiagnostics, "SC-109", "SchemaA.testClass", "SchemaB.testClass", "appliesTo");
      expect(foundDiag).to.equal(false);
    });

    it("should report mixin delta", async () => {
      const schemaA = await Schema.fromJson({
        ...schemaAJson,
        items: {
          testClassA: {
            schemaItemType: "EntityClass",
            description: "Test class A",
          },
          testMixinClass: {
            schemaItemType: "Mixin",
            description: "mixin class for testing",
            label: "test mixin class",
            modifier: "None",
            appliesTo: "SchemaA.testClassA",
          },
        },
      }, contextA);

      const schemaB = await Schema.fromJson({
        ...schemaBJson,
        items: {
          testClassB: {
            schemaItemType: "EntityClass",
            description: "Test class B",
          },
          testMixinClass: {
            schemaItemType: "Mixin",
            description: "mixin class for testing",
            label: "test mixin class",
            modifier: "None",
            appliesTo: "SchemaB.testClassB",
          },
        },
      }, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      const foundDiag = findDiagnostic(reporter.changes[0].allDiagnostics, "SC-109", "SchemaA.testClassA", "SchemaB.testClassB", "appliesTo");
      expect(foundDiag).to.equal(true);
    });

    it("should report mixin delta", async () => {
      const schemaA = await Schema.fromJson({
        ...schemaAJson,
        items: {
          testClass: {
            schemaItemType: "EntityClass",
            description: "Test class",
          },
          testMixinClass: {
            schemaItemType: "Mixin",
            description: "mixin class for testing",
            label: "test mixin class",
            modifier: "None",
            appliesTo: "SchemaA.testClass",
          },
        },
      }, contextA);

      const schemaA2 = await Schema.fromJson({
        ...schemaAJson,
        items: {
          testClassB: {
            schemaItemType: "EntityClass",
            description: "Test class B",
          },
          testMixinClass: {
            schemaItemType: "Mixin",
            description: "mixin class for testing",
            label: "test mixin class",
            modifier: "None",
            appliesTo: "SchemaA.testClassB",
          },
        },
      }, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaA2);

      const foundDiag = findDiagnostic(reporter.changes[0].allDiagnostics, "SC-109", "SchemaA.testClass", "SchemaA.testClassB", "appliesTo");
      expect(foundDiag).to.equal(true);
    });
  });
});
