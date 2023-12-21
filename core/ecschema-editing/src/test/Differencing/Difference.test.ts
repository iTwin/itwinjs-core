/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Schema, SchemaContext } from "@itwin/ecschema-metadata";
import { SchemaDifference } from "../../Differencing/SchemaDifference";
import { expect } from "chai";

/* eslint-disable @typescript-eslint/naming-convention */

function expectPartiallyEquals(actual: any, expected: any, message?: string) {
  if(typeof actual === "object") {
    for(const key of Object.keys(expected)) {
      expect(actual).to.haveOwnProperty(key);
      expectPartiallyEquals(actual[key], expected[key], message);
    }
  } else {
    expect(actual).equals(expected);
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

  const sourceJson = {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "SourceSchema",
    version: "1.2.3",
    alias: "source",

    label: "source label",
    description: "source description",

    references: [
      {
        name: "EmptySchema",
        version: "01.00.00",
      },
      {
        name: "CustomAttributeSchema",
        version: "01.00.00",
      },
      {
        name: "MissingSchema",
        version: "04.00.00",
      },
    ],

    customAttributes: [{ className: "CustomAttributeSchema.MissingCA" }],

    items: {
      AreaPhenomenon: {
        schemaItemType: "Phenomenon",
        name: "AREA",
        label: "Area",
        description: "Area description",
        definition: "Units.LENGTH(4)",
      },
      TestUnitSystem: {
        schemaItemType: "UnitSystem",
        name: "IMPERIAL",
        label: "Imperial",
      },
      MissingEnumeration: {
        schemaItemType: "Enumeration",
        type: "int",
        isStrict: true,
        enumerators: [
          {
            name: "EnumeratorOne",
            label: "Enumerator One",
            value: 200,
          },
        ],
      },
      ChangedEnumeration: {
        schemaItemType: "Enumeration",
        type: "string",
        label: "Source ChangedEnumeration",
        enumerators: [
          {
            name: "EnumeratorOne",
            label: "Enumerator One",
            value: "1",
          },
          {
            name: "EnumeratorTwo",
            label: "Enumerator Two",
            value: "2",
          },
          {
            name: "EnumeratorThree",
            label: "Enumerator Three",
            value: "3",
          },
        ],
      },
      MissingMixin: {
        schemaItemType: "Mixin",
        label: "Missing Mixin",
        appliesTo: "SourceSchema.EmptyAbstractEntity",
      },
      TestCategory: {
        schemaItemType: "PropertyCategory",
        priority: 4,
      },
      MissingStruct: {
        schemaItemType: "StructClass",
        properties: [{
          name: "BooleanProperty",
          type: "PrimitiveProperty",
          typeName: "boolean",
          customAttributes: [{ className: "CustomAttributeSchema.MissingCA" }],
        },
        {
          name: "IntegerProperty",
          type: "PrimitiveArrayProperty",
          typeName: "int",
        }],
      },
      EmptyAbstractEntity: {
        schemaItemType: "EntityClass",
        modifier: "Abstract",
      },
      ChangedEntity: {
        schemaItemType: "EntityClass",
        baseClass: "SourceSchema.EmptyAbstractEntity",
        description: "The entity got a new base type a fancy description and a mixin",
        mixins: [
          "SourceSchema.MissingMixin",
        ],
        customAttributes: [{ className: "CustomAttributeSchema.MissingCA" }],
      },
    },
  };

  const targetJson =  {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "TargetSchema",
    version: "1.0.0",
    alias: "target",

    description: "target description",

    references: [
      {
        name: "EmptySchema",
        version: "01.00.00",
      },
      {
        name: "CustomAttributeSchema",
        version: "01.00.00",
      },
    ],

    items: {
      AreaPhenomenon: {
        schemaItemType: "Phenomenon",
        name: "AREA",
        label: "Area",
        description: "Area description",
        definition: "Units.LENGTH(4)",
      },
      TargetPropertyCategory: {
        schemaItemType:"PropertyCategory",
        label:"Target Schema Category",
        priority: 100000,
      },
      ChangedEnumeration: {
        schemaItemType: "Enumeration",
        type: "string",
        isStrict: true,
        enumerators: [
          {
            name: "EnumeratorOne",
            label: "Enumerator One",
            value: "1",
          },
          {
            name: "EnumeratorTwo",
            value: "2",
          },
        ],
      },
      ChangedEntity: {
        schemaItemType: "EntityClass",
      },
    },
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

  it("should return missing struct", async () => {
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

  it("should return changed entity with baseclass and mixin added", async () => {
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
        baseClass: "SourceSchema.EmptyAbstractEntity",
        description: "The entity got a new base type a fancy description and a mixin",
        mixins: [
          "SourceSchema.MissingMixin",
        ],
      },
    });
  });
});
