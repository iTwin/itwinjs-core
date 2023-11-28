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

function findDiagnostic(diagnostics: AnyDiagnostic[], code: string, fullNameA?: string, fullNameB?: string, propertyType?: string) {
  let found = false;
  diagnostics.find((anyDiagnostic) => {
    switch (code) {
      case SchemaCompareCodes.RelationshipConstraintClassMissing: {
        if (anyDiagnostic.code === code &&
                    anyDiagnostic.messageArgs?.at(0).fullName === fullNameA) {
          found = true;
        }
        break;
      }
      case SchemaCompareCodes.RelationshipConstraintDelta: {
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

describe("Custom attributes class comparison tests", () => {
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

  describe("Relationship class comparison tests", () => {
    it("should not report relationship constraint missing or abstractConstraint delta", async () => {
      const schemaA = await Schema.fromJson({
        ...schemaAJson,
        items: {
          relationshipOne: {
            schemaItemType: "RelationshipClass",
            strength: "Embedding",
            strengthDirection: "Forward",
            modifier: "Sealed",
            source: {
              polymorphic: true,
              multiplicity: "(0..*)",
              roleLabel: "Source RoleLabel",
              constraintClasses: [
                "SchemaA.testClassOne",
                "SchemaA.testClassTwo",
              ],
            },
            target: {
              polymorphic: true,
              multiplicity: "(0..*)",
              roleLabel: "Target RoleLabel",
              constraintClasses: [
                "SchemaA.testClassOne",
                "SchemaA.testClassTwo",
              ],
            },
          },
          testClassOne: {
            schemaItemType: "EntityClass",
            description: "Test class one",
          },
          testClassTwo: {
            schemaItemType: "EntityClass",
            description: "Test class two",
          },
        },
      }, contextA);

      const schemaB = await Schema.fromJson({
        ...schemaBJson,
        items: {
          relationshipOne: {
            schemaItemType: "RelationshipClass",
            strength: "Embedding",
            strengthDirection: "Forward",
            modifier: "Sealed",
            source: {
              polymorphic: true,
              multiplicity: "(0..*)",
              roleLabel: "Source RoleLabel",
              constraintClasses: [
                "SchemaB.testClassOne",
                "SchemaB.testClassTwo",
              ],
            },
            target: {
              polymorphic: true,
              multiplicity: "(0..*)",
              roleLabel: "Target RoleLabel",
              constraintClasses: [
                "SchemaB.testClassOne",
                "SchemaB.testClassTwo",
              ],
            },
          },
          testClassOne: {
            schemaItemType: "EntityClass",
            description: "Test class one",
          },
          testClassTwo: {
            schemaItemType: "EntityClass",
            description: "Test class two",
          },
        },
      }, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(findDiagnostic(reporter.changes[0].allDiagnostics, "SC-112", "SchemaA.testClassOne")).to.equal(false);
      expect(findDiagnostic(reporter.changes[0].allDiagnostics, "SC-111", "SchemaA.testClassOne", "SchemaB.testClassOne", "abstractConstraint")).to.equal(false);

    });

    it("should not report relationship constraint missing or abstractConstraint delta", async () => {
      const schemaA = await Schema.fromJson({
        ...schemaAJson,
        items: {
          relationshipOne: {
            schemaItemType: "RelationshipClass",
            strength: "Embedding",
            strengthDirection: "Forward",
            modifier: "Sealed",
            source: {
              polymorphic: true,
              multiplicity: "(0..*)",
              roleLabel: "Source RoleLabel",
              constraintClasses: [
                "SchemaA.testClassOne",
                "SchemaA.testClassTwo",
              ],
            },
            target: {
              polymorphic: true,
              multiplicity: "(0..*)",
              roleLabel: "Target RoleLabel",
              constraintClasses: [
                "SchemaA.testClassOne",
                "SchemaA.testClassTwo",
              ],
            },
          },
          testClassOne: {
            schemaItemType: "EntityClass",
            description: "Test class one",
            properties: [
              {
                name: "PropertyOne",
                type: "NavigationProperty",
                relationshipName: "SchemaA.relationshipOne",
                direction: "forward",
              },
            ],
          },
          testClassTwo: {
            schemaItemType: "EntityClass",
            description: "Test class two",
          },
        },
      }, contextA);

      const schemaB = await Schema.fromJson({
        ...schemaBJson,
        items: {
          relationshipOne: {
            schemaItemType: "RelationshipClass",
            strength: "Embedding",
            strengthDirection: "Forward",
            modifier: "Sealed",
            source: {
              polymorphic: true,
              multiplicity: "(0..*)",
              roleLabel: "Source RoleLabel",
              constraintClasses: [
                "SchemaB.testClassOne",
                "SchemaB.testClassTwo",
              ],
            },
            target: {
              polymorphic: true,
              multiplicity: "(0..*)",
              roleLabel: "Target RoleLabel",
              constraintClasses: [
                "SchemaB.testClassOne",
                "SchemaB.testClassTwo",
              ],
            },
          },
          testClassOne: {
            schemaItemType: "EntityClass",
            description: "Test class one",
            properties: [
              {
                name: "PropertyA",
                type: "NavigationProperty",
                relationshipName: "SchemaB.relationshipOne",
                direction: "forward",
              },
            ],
          },
          testClassTwo: {
            schemaItemType: "EntityClass",
            description: "Test class two",
          },
        },
      }, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaB);

      expect(findDiagnostic(reporter.changes[0].allDiagnostics, "SC-112", "SchemaA.testClassOne")).to.equal(false);
      expect(findDiagnostic(reporter.changes[0].allDiagnostics, "SC-111", "SchemaA.testClassOne", "SchemaB.testClassOne", "abstractConstraint")).to.equal(false);

    });
  });
});
