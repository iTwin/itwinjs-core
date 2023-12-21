/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Schema, SchemaContext } from "@itwin/ecschema-metadata";
import { SchemaDifference } from "../../Differencing/SchemaDifference";
import { expect } from "chai";

import sourceJson from "./sourceSchema.json";
import targetJson from "./targetSchema.json";

/* eslint-disable @typescript-eslint/naming-convention */

function expectPartiallyEquals(actual: any, expected: any, message?: string) {
  if(typeof actual === "object") {
    for(const key of Object.keys(expected)) {
      expect(actual).to.haveOwnProperty(key);
      expectPartiallyEquals(actual[key], expected[key], `expected 'changed' to equal 'missing' on property ${key}`);
    }
  } else {
    expect(actual).equals(expected, message);
  }
}

describe("Create Difference Report", () => {

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
    },
  };

  const emptySchemaJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "EmptySchema",
    version: "1.0.0",
    alias: "empty",
  };

  let schemaDifference: SchemaDifference;

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

    schemaDifference = await SchemaDifference.fromSchemas(targetSchema, sourceSchema);
  });

  it("should set schema label and description", () => {
    expect(schemaDifference.label).equals(sourceJson.label, "expected unset schema label property is set");
    expect(schemaDifference.description).equals(sourceJson.description, "expected schema description gets overriden");
  });

  it("should not return items that exists in both or in target schema", () => {
    // The PropertyCategory exists in the target schema and is not expected to appear in the diff.
    expect(schemaDifference.items).does.not.haveOwnProperty("TargetPropertyCategory");
    // The AreaPhenomenon appears in both schemas, so it's not expected to appear in the diff.
    expect(schemaDifference.items).does.not.haveOwnProperty("AreaPhenomenon");
  });

  it("should return changed or missing references", () => {
    // There are three references in this workflow. Both target and source reference to the same
    // CustomAttributesSchema so this should not appear in the list, EmptySchema has a more recent
    // version in source and MissingSchema is not referenced by the target schema.
    expectPartiallyEquals(schemaDifference.references, [{
      schemaChangeType: "changed",
      name:             "EmptySchema",
      version:          "01.00.01",
    }, {
      schemaChangeType: "missing",
      name:             "MissingSchema",
      version:          "04.00.00",
    }]);
  });

  it("should return a missing custom attribute on the schema", () => {
    expectPartiallyEquals(schemaDifference.customAttributes, [{
      schemaChangeType: "missing",
      className:        "CustomAttributeSchema.MissingCA",
    }]);
  });

  it("should return a missing custom attribute on entity", () => {
    expectPartiallyEquals(schemaDifference.items, {
      ChangedEntity: {
        schemaChangeType: "changed",
        customAttributes: [{
          schemaChangeType: "missing",
          className:        "CustomAttributeSchema.MissingCA",
        }],
      },
    });
  });

  it("should return a missing custom attribute on property", () => {
    expectPartiallyEquals(schemaDifference.items, {
      MissingStruct: {
        schemaChangeType: "missing",
        properties: {
          BooleanProperty: {
            schemaChangeType: "missing",
            customAttributes: [{
              schemaChangeType: "missing",
              className:        "CustomAttributeSchema.MissingCA",
            }],
          },
        },
      },
    });
  });

  it("should return a missing custom attribute on RelationshipConstraint", () => {
    expectPartiallyEquals(schemaDifference.items, {
      RelationshipEntity: {
        target: {
          customAttributes: [{
            schemaChangeType: "missing",
            className: "CustomAttributeSchema.MissingCA",
          }],
        },
      },
    });
  });

  it("should return missing schema items", () => {
    expectPartiallyEquals(schemaDifference.items, {
      TestUnitSystem: {
        schemaChangeType: "missing",
        schemaItemType:   "UnitSystem",
        label:            "Imperial",
      },
    });
  });

  it("should return missing or changed enumerators", () => {
    // Tests two enumerations. The first one exists in both schemas, but the source schema one adds
    // one missing enumerators and one changed enumerator. The second is missing entirely in the
    // target schema.
    expectPartiallyEquals(schemaDifference.items, {
      MissingEnumeration: {
        schemaChangeType: "missing",
        schemaItemType: "Enumeration",
        type: "int",
        isStrict: true,
        enumerators: {
          EnumeratorOne: {
            schemaChangeType: "missing",
            name: "EnumeratorOne",
            label: "Enumerator One",
            value: 200,
          },
        },
      },
      ChangedEnumeration: {
        schemaItemType: "Enumeration",
        label: "Source ChangedEnumeration",
        enumerators: {
          EnumeratorTwo: {
            schemaChangeType: "changed",
            name: "EnumeratorTwo",
            label: "Enumerator Two",
          },
          EnumeratorThree: {
            schemaChangeType: "missing",
            name: "EnumeratorThree",
            label: "Enumerator Three",
            value: "3",
          },
        },
      },
    });
  });

  it("should return missing struct", () => {
    expectPartiallyEquals(schemaDifference.items, {
      MissingStruct: {
        schemaChangeType: "missing",
        schemaItemType: "StructClass",
        properties: {
          BooleanProperty: {
            schemaChangeType: "missing",
            name: "BooleanProperty",
            type: "PrimitiveProperty",
            primitiveType: "boolean",
          },
          IntegerProperty: {
            schemaChangeType: "missing",
            name: "IntegerProperty",
            type: "PrimitiveArrayProperty",
            primitiveType: "int",
          },
        },
      },
    });
  });

  it("should return changed entity with baseclass change", () => {
    expectPartiallyEquals(schemaDifference.items, {
      ChangedBaseClassEntity: {
        schemaChangeType: "changed",
        baseClass: {
          schemaChangeType: "changed",
          className: "SourceSchema.EmptyAbstractEntity",
        },
      },
    });
  });

  it("should return changed entity with baseclass and mixin added", () => {
    expectPartiallyEquals(schemaDifference.items, {
      EmptyAbstractEntity: {
        schemaChangeType: "missing",
        schemaItemType: "EntityClass",
        modifier: "Abstract",
      },
      MissingMixin: {
        schemaChangeType: "missing",
        schemaItemType: "Mixin",
        label: "Missing Mixin",
        appliesTo: "SourceSchema.EmptyAbstractEntity",
      },
      ChangedEntity: {
        schemaChangeType: "changed",
        schemaItemType: "EntityClass",
        baseClass: {
          schemaChangeType: "missing",
          className: "SourceSchema.EmptyAbstractEntity",
        },
        description: "The entity got a new base type a fancy description and a mixin",
        mixins: [
          "SourceSchema.MissingMixin",
        ],
      },
    });
  });

  it("should return missing RelationshipEntity", () => {
    expectPartiallyEquals(schemaDifference.items, {
      RelationshipSourceEntity: {
        schemaChangeType: "missing",
        schemaItemType: "EntityClass",
        label: "Source constraint class",
        modifier: "Abstract",
      },
      RelationshipTargetEntity: {
        schemaChangeType: "missing",
        schemaItemType: "EntityClass",
        label: "Target constraint class",
        baseClass: {
          schemaChangeType: "missing",
          className: "SourceSchema.EmptyAbstractEntity",
        },
        modifier: "Abstract",
      },
      RelationshipEntity: {
        schemaChangeType: "missing",
        schemaItemType: "RelationshipClass",
        strength: "Embedding",
        strengthDirection: "Forward",
        source: {
          schemaChangeType: "missing",
          polymorphic: true,
          multiplicity: "(0..*)",
          roleLabel: "Source RoleLabel",
          abstractConstraint: "SourceSchema.RelationshipSourceEntity",
        },
        target: {
          // This falsely is set to 'changed' at the moment because the missing custom attribute is
          // reported before the RelationshipConstraint is missing. Investigated in issue #6320
          // schemaChangeType: "missing",
          polymorphic: true,
          multiplicity: "(0..*)",
          roleLabel: "Target RoleLabel",
          abstractConstraint: "SourceSchema.EmptyAbstractEntity",
        },
      },
    });
  });
});
