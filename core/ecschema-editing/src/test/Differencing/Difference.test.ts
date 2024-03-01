/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Schema, SchemaContext } from "@itwin/ecschema-metadata";
import { DifferenceType, SchemaDifference, SchemaDifferences } from "../../Differencing/SchemaDifference";
import { expect } from "chai";

import sourceJson from "./sourceSchema.json";
import targetJson from "./targetSchema.json";

function expectPartiallyEquals(actual: any, expected: any, message?: string) {
  if(actual === undefined && expected !== undefined) {
    expect(actual, message || "Actual does not have a value.").is.not.undefined;
  }

  if(typeof actual === "object") {
    for(const key of Object.keys(expected)) {
      expect(actual).to.haveOwnProperty(key);
      expectPartiallyEquals(actual[key], expected[key], `expected '${expected[key]}' to equal '${actual[key]}' on property ${key}`);
    }
  } else {
    expect(actual).equals(expected, message);
  }
}

/* eslint-disable @typescript-eslint/naming-convention */

describe("Schema Difference Reporting", () => {

  const customAttributeSchemaJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "CustomAttributeSchema",
    version: "1.0.0",
    alias: "ca",

    items: {
      MissingCA: {
        schemaItemType: "CustomAttributeClass",
        appliesTo: "Schema",
      },
      InternalId: {
        schemaItemType: "CustomAttributeClass",
        appliesTo: "Schema",
      },
    },
  };

  const emptySchemaJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "EmptySchema",
    version: "1.0.0",
    alias: "empty",
  };

  let schemaDifferences: SchemaDifferences;

  function findEntry(changeType: DifferenceType | "any", item: string, path?: string) {
    const entries = findEntries(changeType, item, path);
    return entries ? entries[0] : undefined;
  }

  function findEntries(changeType: DifferenceType | "any", item: string, path?: string) {
    return schemaDifferences.changes && schemaDifferences.changes.filter((change) => {
      return ((changeType === "any") || (change.changeType === changeType))
      && change.item === item
      && change.path === path;
    });
  }

  before(async () => {
    const sourceContext = new SchemaContext();
    await Schema.fromJson({ ...emptySchemaJson, version: "01.00.01" }, sourceContext);
    await Schema.fromJson(customAttributeSchemaJson, sourceContext);
    await Schema.fromJson({
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "MissingSchema",
      version: "4.0.0",
      alias: "miss",
    }, sourceContext);
    const sourceSchema = await Schema.fromJson(sourceJson, sourceContext);

    const targetContext = new SchemaContext();
    await Schema.fromJson(emptySchemaJson, targetContext);
    await Schema.fromJson(customAttributeSchemaJson, targetContext);
    const targetSchema = await Schema.fromJson(targetJson, targetContext);

    schemaDifferences = await SchemaDifference.fromSchemas(targetSchema, sourceSchema);
    expect(schemaDifferences.conflicts).has.lengthOf(0, `This test suite should not have conflicts.`);
  });

  it("should have the expected source and target schema names in differences", () => {
    expect(schemaDifferences.sourceSchemaName).equals("SourceSchema.01.02.03", "unexpected difference source name");
    expect(schemaDifferences.targetSchemaName).equals("TargetSchema.01.00.00", "unexpected difference target name");
  });

  it("should set schema label and description", () => {
    expectPartiallyEquals(findEntry("modify", "schema"), {
      changeType: "modify",
      item:       "schema",
      json: {
        label: sourceJson.label,
        description: sourceJson.description,
      },
    });
  });

  it("should not create a modify entry if only schema name and alias differs", async () => {
    const sourceSchema = await Schema.fromJson({
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "SourceSchema",
      version: "1.0.0",
      alias: "source",
    }, new SchemaContext());
    const targetSchema = await Schema.fromJson({
      $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
      name: "TargetSchema",
      version: "1.0.0",
      alias: "target",
    }, new SchemaContext());

    const differences = await SchemaDifference.fromSchemas(targetSchema, sourceSchema);
    expect(differences.conflicts).has.lengthOf(0, `This test should not have conflicts.`);
    expect(differences.changes).has.lengthOf(0, `This test should not have changes.`);
  });

  it("should not return items that exists in both or in target schema", () => {
    // The PropertyCategory exists in the target schema and is not expected to appear in the diff.
    expect(findEntry("any", "TargetPropertyCategory"), "Unexpected changes for TargetPropertyCategory").to.be.undefined;
    // The AreaPhenomenon appears in both schemas, so it's not expected to appear in the diff.
    expect(findEntry("any", "AreaPhenomenon"), "Unexpected changes for AreaPhenomenon").to.be.undefined;
  });

  it("should return changed or missing references", () => {
    // There are three references in this workflow. Both target and source reference to the same
    // CustomAttributesSchema so this should not appear in the list, EmptySchema has a more recent
    // version in source and MissingSchema is not referenced by the target schema.
    expectPartiallyEquals(findEntries("any", "schema", "$references"), [
      {
        changeType: "modify",
        item:       "schema",
        path:       "$references",
        json: {
          name:      "EmptySchema",
          version:   "01.00.01",
        },
      }, {
        changeType: "add",
        item:       "schema",
        path:       "$references",
        json: {
          name:      "MissingSchema",
          version:   "04.00.00",
        },
      },
    ]);
  });

  it("should return a missing custom attribute on the schema", () => {
    expectPartiallyEquals(findEntry("add", "schema", "$customAttributes"), {
      changeType: "add",
      item:       "schema",
      path:       "$customAttributes",
      json: {
        className: "CustomAttributeSchema.MissingCA",
      },
    });
  });

  it("should return a missing custom attribute on entity", () => {
    expectPartiallyEquals(findEntry("add", "ChangedEntity", "$customAttributes"), {
      changeType: "add",
      item:       "ChangedEntity",
      path:       "$customAttributes",
      json: {
        className: "CustomAttributeSchema.MissingCA",
      },
    });
  });

  it("should return a missing custom attribute on property", () => {
    expectPartiallyEquals(findEntry("add", "ChangedEntity", "BooleanProperty.$customAttributes"), {
      changeType: "add",
      item:       "ChangedEntity",
      path:       "BooleanProperty.$customAttributes",
      json: {
        className: "CustomAttributeSchema.InternalId",
      },
    });
  });

  it("should return a missing custom attribute on RelationshipConstraint", () => {
    expectPartiallyEquals(findEntry("add", "RelationshipEntity", "$target.$customAttributes"), {
      changeType: "add",
      item:       "RelationshipEntity",
      path:       "$target.$customAttributes",
      json: {
        className: "CustomAttributeSchema.MissingCA",
      },
    });
  });

  it("should return missing schema items", () => {
    expectPartiallyEquals(findEntry("add", "TestUnitSystem"), {
      changeType:   "add",
      item:         "TestUnitSystem",
      json: {
        label:       "Imperial",
        // [...]
      },
    });
  });

  it("should return missing enumeration", () => {
    expectPartiallyEquals(findEntry("add", "MissingEnumeration"), {
      changeType:   "add",
      item:         "MissingEnumeration",
      json: {
        type: "int",
        isStrict: true,
        enumerators: [{
          name: "EnumeratorOne",
          label: "Enumerator One",
          value: 200,
        }],
      },
    });
  });

  it("should return changed enumeration enumerators", () => {
    expectPartiallyEquals(findEntry("modify", "ChangedEnumeration", "$enumerators.EnumeratorTwo"), {
      changeType: "modify",
      item:       "ChangedEnumeration",
      path:       "$enumerators.EnumeratorTwo",
      json: {
        label: "Enumerator Two",
      },
    });
  });

  it("should return added enumeration enumerators", () => {
    expectPartiallyEquals(findEntries("add", "ChangedEnumeration", "$enumerators"), [{
      changeType: "add",
      item:       "ChangedEnumeration",
      path:       "$enumerators",
      json: {
        name:  "EnumeratorThree",
        label: "Enumerator Three",
        value: "3",
      },
    }]);
  });

  it("should return missing struct", () => {
    expectPartiallyEquals(findEntry("add", "MissingStruct"), {
      changeType: "add",
      item:       "MissingStruct",
      json: {
        properties: [{
          name: "BooleanProperty",
          type: "PrimitiveProperty",
          typeName: "boolean",
          customAttributes: [{
            className: "CustomAttributeSchema.MissingCA",
          }],
        },
        {
          name: "IntegerProperty",
          type: "PrimitiveArrayProperty",
          typeName: "int",
        }],
      },
    });
  });

  it("should return changed entity with an added property", () => {
    expectPartiallyEquals(findEntry("add", "ChangedEntity", "StructProperty"), {
      changeType: "add",
      item:       "ChangedEntity",
      path:       "StructProperty",
      json: {
        name: "StructProperty",
        type: "StructArrayProperty",
        typeName: "SourceSchema.MissingStruct",
      },
    });
  });

  it("should return changed entity with baseclass change", () => {
    expectPartiallyEquals(findEntry("modify", "ChangedBaseClassEntity"), {
      changeType: "modify",
      item:       "ChangedBaseClassEntity",
      json: {
        baseClass: "SourceSchema.ChangedEntityBaseClass",
        // [...]
      },
    });
  });

  it("should return changed entity with mixin added", () => {
    expect(findEntry("add", "EmptyAbstractEntity"), "Expected EmptyAbstractEntity to be added").to.not.be.undefined;
    expect(findEntry("add", "MissingMixin"), "Expected MissingMixin to be added").to.not.be.undefined;
    expectPartiallyEquals(findEntry("modify", "ChangedEntity", "$mixins"), {
      changeType: "modify",
      item:       "ChangedEntity",
      path:       "$mixins",
      json: [
        "SourceSchema.MissingMixin",
      ],
    });
  });

  it("should return changed source relationship constraint properties", () => {
    expectPartiallyEquals(findEntry("modify", "RelationshipEntity", "$source"), {
      changeType: "modify",
      item:       "RelationshipEntity",
      json: {
        roleLabel: "New Source RoleLabel",
        abstractConstraint: "SourceSchema.RelationshipSourceEntity",
      },
    });
  });

  it("should return changed source relationship constraint with added constraint classes", () => {
    expectPartiallyEquals(findEntry("modify", "RelationshipEntity", "$source.constraintClasses"), {
      changeType: "modify",
      item:       "RelationshipEntity",
      json: [
        "SourceSchema.RelationshipSourceEntity",
      ],
    });
  });
});
