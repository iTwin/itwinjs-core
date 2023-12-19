/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Schema, SchemaContext } from "@itwin/ecschema-metadata";
import { ISchemaChanges, ISchemaCompareReporter, SchemaChanges, SchemaComparer } from "../../ecschema-editing";
import { expect } from "chai";

class SchemaCompareReporter implements ISchemaCompareReporter {
  public changes: SchemaChanges[] = [];
  public report(schemaChanges: ISchemaChanges): void {
    this.changes.push(schemaChanges as SchemaChanges);
  }
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

  beforeEach(async () => {
    reporter = new SchemaCompareReporter();
    contextA = new SchemaContext();
    contextB = new SchemaContext();
  });

  describe("Compare same name, same version schemas with different contents", () => {
    it.only("Writing basic tests", async () => {
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
      expect(comparer).not.be.undefined;

    });
  });
});
