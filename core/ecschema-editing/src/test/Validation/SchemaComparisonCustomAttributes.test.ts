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

function findDiagnostic(diagnostics: AnyDiagnostic[], code: string, fullNameA?: string, _fullNameB?: string, _propertyType?: string) {
  let found = false;
  diagnostics.find((anyDiagnostic) => {
    switch (code) {
      case SchemaCompareCodes.CustomAttributeInstanceClassMissing: {
        if (anyDiagnostic.code === code &&
                    anyDiagnostic.messageArgs?.at(0).className === fullNameA) {
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

  describe("Custom attribute class comparisons", () => {
    it("should not report custom attribute instance class missing", async () => {
      const schemaA = await Schema.fromJson({
        ...schemaAJson,
        items: {
          testClass: {
            schemaItemType: "EntityClass",
            customAttributes: [
              {
                className: "SchemaA.customAttributeOne",
                showClasses: true,
              },
            ],
          },
          customAttributeOne: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "AnyClass",
          },
        },
      }, contextA);

      const schemaB = await Schema.fromJson({
        ...schemaBJson,
        items: {
          testClass: {
            schemaItemType: "EntityClass",
            customAttributes: [
              {
                className: "SchemaB.customAttributeOne",
                showClasses: true,
              },
            ],
          },
          customAttributeOne: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "AnyClass",
          },
        },
      }, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(findDiagnostic(reporter.changes[0].allDiagnostics, "SC-114", "SchemaA.customAttributeOne")).to.equal(false);
    });

    it("should report custom attribute instance class missing for referenced class", async () => {
      const _dummyRefOne = await Schema.fromJson({
        ...dummyRefJson,
        items: {
          customAttributeOne: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "AnyClass",
          },
        },
      }, contextA);

      const schemaA = await Schema.fromJson({
        ...schemaAJson,
        references: [
          {
            name: "DummyReference",
            version: "01.00.01",
          },
        ],
        items: {
          testClass: {
            schemaItemType: "EntityClass",
            customAttributes: [
              {
                className: "DummyReference.customAttributeOne",
                showClasses: true,
              },
            ],
          },
        },
      }, contextA);

      const schemaB = await Schema.fromJson({
        ...schemaBJson,
        items: {
          testClass: {
            schemaItemType: "EntityClass",
            customAttributes: [
              {
                className: "SchemaB.customAttributeOne",
                showClasses: true,
              },
            ],
          },
          customAttributeOne: {
            schemaItemType: "CustomAttributeClass",
            appliesTo: "AnyClass",
          },
        },
      }, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(findDiagnostic(reporter.changes[0].allDiagnostics, "SC-114", "DummyReference.customAttributeOne")).to.equal(true);
    });

  });
});
