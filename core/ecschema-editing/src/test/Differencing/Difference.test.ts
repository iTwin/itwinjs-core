/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Schema, SchemaContext } from "@itwin/ecschema-metadata";
import { DifferenceType, SchemaDifference, SchemaDifferences } from "../../Differencing/SchemaDifference";
import { expect } from "chai";

import sourceJson from "./sourceSchema.json";
import targetJson from "./targetSchema.json";

interface LookupArgs {
  changeType?: DifferenceType;
  schemaType?: string;
  itemName?: string;
  path?: string;
}

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

  function findEntry(args: LookupArgs) {
    const entries = findEntries(args);
    return entries ? entries[0] : undefined;
  }

  function findEntries(args: LookupArgs) {
    return schemaDifferences.changes && schemaDifferences.changes.filter((change) => {
      return (!args.changeType || change.changeType === args.changeType)
      && (!args.schemaType || change.schemaType === args.schemaType)
      && (!args.itemName || change.itemName === args.itemName)
      && change.path === args.path;
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
    expectPartiallyEquals(findEntry({ changeType: "modify", schemaType: "Schema" }), {
      changeType: "modify",
      schemaType: "Schema",
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
    expect(findEntry({ itemName: "TargetPropertyCategory" }), "Unexpected changes for TargetPropertyCategory").to.be.undefined;
    // The AreaPhenomenon appears in both schemas, so it's not expected to appear in the diff.
    expect(findEntry({ itemName: "AreaPhenomenon" }), "Unexpected changes for AreaPhenomenon").to.be.undefined;
  });

  it("should return changed or missing references", () => {
    // There are three references in this workflow. Both target and source reference to the same
    // CustomAttributesSchema so this should not appear in the list, EmptySchema has a more recent
    // version in source and MissingSchema is not referenced by the target schema.
    expectPartiallyEquals(findEntries({ schemaType: "Schema", path: "$references" }), [
      {
        changeType: "modify",
        schemaType: "Schema",
        path:       "$references",
        json: {
          name:      "EmptySchema",
          version:   "01.00.01",
        },
      }, {
        changeType: "add",
        schemaType: "Schema",
        path:       "$references",
        json: {
          name:      "MissingSchema",
          version:   "04.00.00",
        },
      },
    ]);
  });

  it("should return a missing custom attribute on the schema", () => {
    expectPartiallyEquals(findEntry({ changeType: "add", schemaType: "Schema", path: "$customAttributes" }), {
      changeType: "add",
      schemaType: "Schema",
      path:       "$customAttributes",
      json: {
        className: "CustomAttributeSchema.MissingCA",
      },
    });
  });

  it("should return a missing custom attribute on entity", () => {
    expectPartiallyEquals(findEntry({ itemName: "ChangedEntity", path: "$customAttributes"}), {
      changeType: "add",
      schemaType: "EntityClass",
      itemName:   "ChangedEntity",
      path:       "$customAttributes",
      json: {
        className: "CustomAttributeSchema.MissingCA",
      },
    });
  });

  it("should return a missing custom attribute on property", () => {
    expectPartiallyEquals(findEntry({ itemName: "ChangedEntity", path: "BooleanProperty.$customAttributes"}), {
      changeType: "add",
      schemaType: "Property",
      itemName:   "ChangedEntity",
      path:       "BooleanProperty.$customAttributes",
      json: {
        className: "CustomAttributeSchema.InternalId",
      },
    });
  });

  it("should return a missing custom attribute on RelationshipConstraint", () => {
    expectPartiallyEquals(findEntry({ itemName: "RelationshipEntity", path: "$target.$customAttributes"}), {
      changeType: "add",
      schemaType: "RelationshipClass",
      itemName:   "RelationshipEntity",
      path:       "$target.$customAttributes",
      json: {
        className: "CustomAttributeSchema.MissingCA",
      },
    });
  });

  it("should return missing schema items", () => {
    expectPartiallyEquals(findEntry({ changeType: "add", itemName: "TestUnitSystem"}), {
      changeType:   "add",
      schemaType:   "UnitSystem",
      itemName:     "TestUnitSystem",
      json: {
        label:       "Imperial",
        // [...]
      },
    });
  });

  it("should return missing enumeration", () => {
    expectPartiallyEquals(findEntry({ changeType: "add", itemName: "MissingEnumeration"}), {
      changeType:   "add",
      schemaType:   "Enumeration",
      itemName:     "MissingEnumeration",
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
    expectPartiallyEquals(findEntry({changeType: "modify", itemName: "ChangedEnumeration", path: "$enumerators.EnumeratorTwo"}), {
      changeType: "modify",
      schemaType: "Enumeration",
      itemName:   "ChangedEnumeration",
      path:       "$enumerators.EnumeratorTwo",
      json: {
        label: "Enumerator Two",
      },
    });
  });

  it("should return added enumeration enumerators", () => {
    expectPartiallyEquals(findEntries({changeType: "add", itemName: "ChangedEnumeration", path: "$enumerators" }), [{
      changeType: "add",
      schemaType: "Enumeration",
      itemName:   "ChangedEnumeration",
      path:       "$enumerators",
      json: {
        name:  "EnumeratorThree",
        label: "Enumerator Three",
        value: "3",
      },
    }]);
  });

  it("should return missing struct", () => {
    expectPartiallyEquals(findEntry({ changeType: "add", itemName: "MissingStruct" }), {
      changeType: "add",
      schemaType: "StructClass",
      itemName:   "MissingStruct",
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
    expectPartiallyEquals(findEntry({ changeType: "add", itemName: "ChangedEntity", path: "StructProperty" }), {
      changeType: "add",
      schemaType: "Property",
      itemName:   "ChangedEntity",
      path:       "StructProperty",
      json: {
        name: "StructProperty",
        type: "StructArrayProperty",
        typeName: "SourceSchema.MissingStruct",
      },
    });
  });

  it("should return changed entity with baseclass change", () => {
    expectPartiallyEquals(findEntry({ changeType: "modify", itemName: "ChangedBaseClassEntity" }), {
      changeType: "modify",
      schemaType: "EntityClass",
      itemName:   "ChangedBaseClassEntity",
      json: {
        baseClass: "SourceSchema.ChangedEntityBaseClass",
        // [...]
      },
    });
  });

  it("should return changed entity with mixin added", () => {
    expect(findEntry({ changeType: "add", itemName: "EmptyAbstractEntity"}), "Expected EmptyAbstractEntity to be added").to.not.be.undefined;
    expect(findEntry({ changeType: "add", itemName: "MissingMixin" }), "Expected MissingMixin to be added").to.not.be.undefined;
    expectPartiallyEquals(findEntry({ changeType: "modify", itemName: "ChangedEntity", path: "$mixins" }), {
      changeType: "modify",
      schemaType: "EntityClass",
      itemName:   "ChangedEntity",
      path:       "$mixins",
      json: [
        "SourceSchema.MissingMixin",
      ],
    });
  });

  it("should return changed source relationship constraint properties", () => {
    expectPartiallyEquals(findEntry({ changeType: "modify", itemName: "RelationshipEntity", path: "$source"}), {
      changeType: "modify",
      schemaType: "RelationshipConstraint",
      itemName:   "RelationshipEntity",
      json: {
        roleLabel: "New Source RoleLabel",
        abstractConstraint: "SourceSchema.RelationshipSourceEntity",
      },
    });
  });

  it("should return changed source relationship constraint with added constraint classes", () => {
    expectPartiallyEquals(findEntry({ changeType: "modify", itemName: "RelationshipEntity", path: "$source.constraintClasses"}), {
      changeType: "modify",
      schemaType: "RelationshipClass",
      itemName:   "RelationshipEntity",
      json: [
        "SourceSchema.RelationshipSourceEntity",
      ],
    });
  });
});
