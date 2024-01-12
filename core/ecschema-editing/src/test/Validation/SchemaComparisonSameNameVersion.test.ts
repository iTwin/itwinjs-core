/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Property, Schema, SchemaContext, SchemaItem } from "@itwin/ecschema-metadata";
import { AnyDiagnostic, ISchemaChanges, ISchemaCompareReporter, SchemaChanges, SchemaCompareCodes, SchemaComparer } from "../../ecschema-editing";
import { expect } from "chai";

class SchemaCompareReporter implements ISchemaCompareReporter {
  public changes: SchemaChanges[] = [];
  public report(schemaChanges: ISchemaChanges): void {
    this.changes.push(schemaChanges as SchemaChanges);
  }
}

function findDiagnostic(diagnostics: AnyDiagnostic[], code: string, fullNameA: string) {
  let found = false;
  for (const diagnostic of diagnostics) {
    if (SchemaCompareCodes.SchemaItemMissing === code &&
      (diagnostic.ecDefinition as SchemaItem).fullName === fullNameA) {
      found = true;
      break;
    }

    if (SchemaCompareCodes.CustomAttributeInstanceClassMissing === code &&
      diagnostic.messageArgs?.at(0).className === fullNameA) {
      found = true;
      break;
    }

    if (SchemaCompareCodes.SchemaReferenceMissing === code &&
      diagnostic.messageArgs?.at(0).fullName === fullNameA) {
      found = true;
      break;
    }

    if (SchemaCompareCodes.PropertyMissing === code &&
      (diagnostic.ecDefinition as Property).fullName === fullNameA) {
      found = true;
      break;
    }
  }

  return found;
}

describe("Comparison tests for schemas with same name and version", () => {
  let reporter: SchemaCompareReporter;
  let contextA: SchemaContext;
  let contextB: SchemaContext;

  const schemaAJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "SchemaA",
    version: "1.0.1",
    alias: "a",
    label: "labelA",
    description: "descriptionA",
  };

  const refOneJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "RefOne",
    version: "1.0.1",
    alias: "rOne",
    label: "Ref One",
    description: "Reference One",
  };

  const refTwoJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "RefTwo",
    version: "1.0.1",
    alias: "rTwo",
    label: "Ref Two",
    description: "Reference Two",
  };

  beforeEach(async () => {
    reporter = new SchemaCompareReporter();
    contextA = new SchemaContext();
    contextB = new SchemaContext();
  });

  describe("Compare same name, same version schemas that live in different context and with different contents", () => {
    it("should generate a report for each schema that live in different context with same name and version", async () => {
      const schemaA = await Schema.fromJson({
        ...schemaAJson,
        items: {
          testClassOne: {
            schemaItemType: "EntityClass",
            description: "test class one for testing",
            label: "test class one",
          },
        },
      }, contextA);

      const schemaA2 = await Schema.fromJson({
        ...schemaAJson,
        items: {
          testClassOne: {
            schemaItemType: "EntityClass",
            description: "test class one for testing",
            label: "test class one",
          },
        },
      }, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaA2);
      expect(reporter.changes.length).to.equal(2);
      expect(reporter.changes[0]).not.be.undefined;
      expect(reporter.changes[1]).not.be.undefined;
    });

    it("should return false to finding schemaItemMissing diagnostic from schemaB in schemaAChanges", async () => {
      const schemaA = await Schema.fromJson({
        ...schemaAJson,
        items: {
          testClassOne: {
            schemaItemType: "EntityClass",
            description: "test class one for testing",
            label: "test class one",
          },
        },
      }, contextA);

      const schemaA2 = await Schema.fromJson({
        ...schemaAJson,
        items: {
          testClassTwo: {
            schemaItemType: "EntityClass",
            description: "test class two for testing",
            label: "test class two",
          },
          testClassThree: {
            schemaItemType: "EntityClass",
            description: "test class three for testing",
            label: "test class three",
          },
        },
      }, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaA2);

      const schemaAChanges = reporter.changes[0].allDiagnostics;
      const findTestClassTwoMissing = findDiagnostic(schemaAChanges, SchemaCompareCodes.SchemaItemMissing, "SchemaA.testClassTwo");
      const findTestClassThreeMissing = findDiagnostic(schemaAChanges, SchemaCompareCodes.SchemaItemMissing, "SchemaA.testClassThree");

      expect(findTestClassTwoMissing).to.be.false;
      expect(findTestClassThreeMissing).to.be.false;

    });

    it("should return true to finding schemaItemMissing diagnostic from schemaB in schemaBChanges", async () => {
      const schemaA = await Schema.fromJson({
        ...schemaAJson,
      }, contextA);

      const schemaA2 = await Schema.fromJson({
        ...schemaAJson,
        items: {
          testClassTwo: {
            schemaItemType: "EntityClass",
            description: "test class two for testing",
            label: "test class two",
          },
          testClassThree: {
            schemaItemType: "EntityClass",
            description: "test class three for testing",
            label: "test class three",
          },
        },
      }, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaA2);

      const schemaBChanges = reporter.changes[1].allDiagnostics;
      const findTestClassTwoMissing = findDiagnostic(schemaBChanges, SchemaCompareCodes.SchemaItemMissing, "SchemaA.testClassTwo");
      const findTestClassThreeMissing = findDiagnostic(schemaBChanges, SchemaCompareCodes.SchemaItemMissing, "SchemaA.testClassThree");

      expect(findTestClassTwoMissing).to.be.true;
      expect(findTestClassThreeMissing).to.be.true;
    });

    it("should return false to finding references and custom attributes missing from schemaB in schemaAChanges report", async () => {
      await Schema.fromJson({
        ...refOneJson,
        items: {
          testClassRefOne: {
            schemaItemType: "EntityClass",
            description: "test class one for ref one",
            label: "test class one ref one",
          },
        },

      }, contextA);

      await Schema.fromJson({
        ...refTwoJson,
        items: {
          testClassRefTwo: {
            schemaItemType: "EntityClass",
            description: "test class one for ref two",
            label: "test class one ref two",
          },
        },
      }, contextB);

      const schemaA = await Schema.fromJson({
        ...schemaAJson,
        references: [
          {
            name: "RefOne",
            version: "01.00.01",
          },
        ],
        customAttributes: [
          {
            className: "RefOne.testClassRefOne",
          },
        ],
        items: {
          testClassOne: {
            schemaItemType: "EntityClass",
            description: "test class one for testing",
            label: "test class one",
          },
        },
      }, contextA);

      const schemaA2 = await Schema.fromJson({
        ...schemaAJson,
        references: [
          {
            name: "RefTwo",
            version: "01.00.01",
          },
        ],
        customAttributes: [
          {
            className: "RefTwo.testClassRefTwo",
          },
        ],
        items: {
          testClassOne: {
            schemaItemType: "EntityClass",
            description: "test class one for testing",
            label: "test class one",
          },
        },
      }, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaA2);
      const schemaAChanges = reporter.changes[0].allDiagnostics;
      const schemaBChanges = reporter.changes[1].allDiagnostics;

      expect(findDiagnostic(schemaAChanges, SchemaCompareCodes.CustomAttributeInstanceClassMissing, "RefTwo.testClassRefTwo")).to.be.false;
      expect(findDiagnostic(schemaAChanges, SchemaCompareCodes.SchemaReferenceMissing, "RefTwo")).to.be.false;

      expect(findDiagnostic(schemaBChanges, SchemaCompareCodes.CustomAttributeInstanceClassMissing, "RefTwo.testClassRefTwo")).to.be.true;
      expect(findDiagnostic(schemaBChanges, SchemaCompareCodes.SchemaReferenceMissing, "RefTwo")).to.be.true;
    });

    it("should return false to finding property missing diagnostic from schemaB in schemaAChanges", async () => {
      const schemaA = await Schema.fromJson({
        ...schemaAJson,
        items: {
          testClassOne: {
            schemaItemType: "EntityClass",
            description: "test class one for testing",
            label: "test class one",
            properties: [
              {
                name: "PropertyOne",
                type: "PrimitiveProperty",
                isReadOnly: true,
                typeName: "boolean",
              },
            ],
          },
        },
      }, contextA);

      const schemaA2 = await Schema.fromJson({
        ...schemaAJson,
        items: {
          testClassOne: {
            schemaItemType: "EntityClass",
            description: "test class one for testing",
            label: "test class one",
            properties: [
              {
                name: "PropertyOne",
                type: "PrimitiveProperty",
                isReadOnly: true,
                typeName: "boolean",
              },
              {
                name: "PropertyTwo",
                type: "PrimitiveProperty",
                isReadOnly: true,
                typeName: "int",
              },
            ],
          },
        },
      }, contextB);

      const comparer = new SchemaComparer(reporter);
      await comparer.compareSchemas(schemaA, schemaA2);

      const schemaAChanges = reporter.changes[0].allDiagnostics;
      const schemaBChanges = reporter.changes[1].allDiagnostics;

      expect(findDiagnostic(schemaAChanges, SchemaCompareCodes.PropertyMissing, "testClassOne.PropertyTwo")).to.be.false;

      expect(findDiagnostic(schemaBChanges, SchemaCompareCodes.PropertyMissing, "testClassOne.PropertyTwo")).to.be.true;

    });
  });
});
