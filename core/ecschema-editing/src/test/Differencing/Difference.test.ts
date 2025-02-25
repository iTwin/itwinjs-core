/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Schema, SchemaContext } from "@itwin/ecschema-metadata";
import { DifferenceType, getSchemaDifferences, SchemaDifferenceResult, SchemaOtherTypes } from "../../Differencing/SchemaDifference";
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
  if (actual === undefined && expected !== undefined) {
    expect(actual, message || "Actual does not have a value.").is.not.undefined;
  }

  if (typeof actual === "object") {
    for (const key of Object.keys(expected)) {
      expect(actual).to.haveOwnProperty(key);
      expectPartiallyEquals(actual[key], expected[key], `expected '${expected[key]}' to equal '${actual[key]}' on property ${key}`);
    }
  } else {
    expect(actual).equals(expected, message);
  }
}

/* eslint-disable @typescript-eslint/naming-convention */

describe("Schema Differences", () => {

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

  let differenceResult: SchemaDifferenceResult;

  function findEntry(args: LookupArgs) {
    const entries = findEntries(args);
    return entries ? entries[0] : undefined;
  }

  function findEntries(args: LookupArgs) {
    return differenceResult.differences && differenceResult.differences.filter((change: any) => {
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

    differenceResult = await getSchemaDifferences(targetSchema, sourceSchema);
    expect(differenceResult.conflicts, `This test suite should not have conflicts.\n${JSON.stringify(differenceResult.conflicts, null, 2)}`).to.be.undefined;
    expect(differenceResult.differences).has.a.lengthOf(47, "Unexpected count of differences.");
  });

  it("should have the expected source and target schema names in differences", () => {
    expect(differenceResult.sourceSchemaName).equals("SourceSchema.01.02.03", "unexpected difference source name");
    expect(differenceResult.targetSchemaName).equals("TargetSchema.01.00.00", "unexpected difference target name");
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

    const differences = await getSchemaDifferences(targetSchema, sourceSchema);
    expect(differences.differences).has.lengthOf(0, "This test should not have differences.");
    expect(differences.conflicts).equals(undefined, "This test should not have conflicts.");
  });

  it("should return changed or missing references", () => {
    // There are three references in this workflow. Both target and source reference to the same
    // CustomAttributesSchema so this should not appear in the list, EmptySchema has a more recent
    // version in source and MissingSchema is not referenced by the target schema.
    expectPartiallyEquals(findEntries({ schemaType: SchemaOtherTypes.SchemaReference }), [
      {
        changeType: "modify",
        schemaType: SchemaOtherTypes.SchemaReference,
        difference: {
          name: "EmptySchema",
          version: "01.00.01",
        },
      }, {
        changeType: "add",
        schemaType: SchemaOtherTypes.SchemaReference,
        difference: {
          name: "MissingSchema",
          version: "04.00.00",
        },
      },
    ]);
  });

  it("should set schema label and description", () => {
    expectPartiallyEquals(findEntry({ changeType: "modify", schemaType: "Schema" }), {
      changeType: "modify",
      schemaType: "Schema",
      difference: {
        label: sourceJson.label,
        description: sourceJson.description,
      },
    });
  });

  it("should not return items that exists in both or in target schema", () => {
    // The TestPhenomenon exists in the target schema and is not expected to appear in the diff.
    expect(findEntry({ itemName: "TestPhenomenon" }), "Unexpected changes for TestPhenomenon").to.be.undefined;
    // The TestUnit exists in the target schema and is not expected to appear in the diff.
    expect(findEntry({ itemName: "TestUnit" }), "Unexpected changes for TestUnit").to.be.undefined;
  });

  describe("Missing schema item differences", () => {
    it("should return missing unit system", () => {
      expectPartiallyEquals(findEntry({ changeType: "add", schemaType: "UnitSystem", itemName: "MissingUnitSystem" }), {
        changeType: "add",
        schemaType: "UnitSystem",
        itemName: "MissingUnitSystem",
        difference: {
          label: "Missing",
          description: "Missing System",
        },
      });
    });

    it("should return missing property category", () => {
      expectPartiallyEquals(findEntry({ changeType: "add", schemaType: "PropertyCategory", itemName: "MissingCategory" }), {
        changeType: "add",
        schemaType: "PropertyCategory",
        itemName: "MissingCategory",
        difference: {
          label: "Missing",
          description: "Missing Category",
          priority: 4,
        },
      });
    });

    it("should return missing enumeration", () => {
      expectPartiallyEquals(findEntry({ changeType: "add", itemName: "MissingEnumeration" }), {
        changeType: "add",
        schemaType: "Enumeration",
        itemName: "MissingEnumeration",
        difference: {
          type: "int",
          label: "Missing",
          description: "Missing Enumeration",
          isStrict: true,
          enumerators: [
            {
              name: "EnumeratorOne",
              label: "Enumerator One",
              value: 200,
            },
          ],
        },
      });
    });

    it("should return added enumeration enumerators", () => {
      expectPartiallyEquals(findEntries({ changeType: "add", itemName: "ChangedEnumeration", path: "$enumerators" }), [{
        changeType: "add",
        schemaType: "Enumerator",
        itemName: "ChangedEnumeration",
        path: "$enumerators",
        difference: {
          name: "EnumeratorThree",
          label: "Enumerator Three",
          value: "3",
        },
      }]);
    });

    it("should return missing phenomenon", () => {
      expectPartiallyEquals(findEntry({ changeType: "add", schemaType: "Phenomenon", itemName: "MissingPhenomenon" }), {
        changeType: "add",
        schemaType: "Phenomenon",
        itemName: "MissingPhenomenon",
        difference: {
          label: "Missing",
          description: "Missing Phenomenon",
          definition: "LENGTH",
        },
      });
    });

    it("should return missing constant", () => {
      expectPartiallyEquals(findEntry({ changeType: "add", schemaType: "Constant", itemName: "MissingConstant" }), {
        changeType: "add",
        schemaType: "Constant",
        itemName: "MissingConstant",
        difference: {
          label: "Missing",
          description: "Missing Constant",
          phenomenon: "SourceSchema.TestPhenomenon",
          definition: "ONE",
          numerator: 1,
          denominator: 0.001,
        },
      });
    });

    it("should return missing unit", () => {
      expectPartiallyEquals(findEntry({ changeType: "add", schemaType: "Unit", itemName: "MissingUnit" }), {
        changeType: "add",
        schemaType: "Unit",
        itemName: "MissingUnit",
        difference: {
          label: "Missing",
          description: "Missing Unit",
          phenomenon: "SourceSchema.TestPhenomenon",
          unitSystem: "SourceSchema.MissingUnitSystem",
          definition: "FOUR",
          numerator: 66,
          denominator: 33,
          offset: 0.01,
        },
      });
    });

    it("should return missing invertedUnit", () => {
      expectPartiallyEquals(findEntry({ changeType: "add", schemaType: "InvertedUnit", itemName: "MissingInvertedUnit" }), {
        changeType: "add",
        schemaType: "InvertedUnit",
        itemName: "MissingInvertedUnit",
        difference: {
          label: "Missing",
          description: "Missing InvertedUnit",
          unitSystem: "SourceSchema.MissingUnitSystem",
          invertsUnit: "SourceSchema.MissingUnit",
        },
      });
    });

    it("should return missing format", () => {
      expectPartiallyEquals(findEntry({ changeType: "add", schemaType: "Format", itemName: "MissingFormat" }), {
        changeType: "add",
        schemaType: "Format",
        itemName: "MissingFormat",
        difference: {
          label: "Missing",
          description: "Missing Format",
          type: "Decimal",
          precision: 4,
          formatTraits: [
            "KeepSingleZero",
            "KeepDecimalPoint",
            "ShowUnitLabel",
          ],
          decimalSeparator: ",",
          thousandSeparator: " ",
          uomSeparator: "",
          composite: {
            spacer: "",
            units: [
              {
                name: "SourceSchema.MissingUnit",
                label: "four",
              }, 
              {
                name: "SourceSchema.MissingInvertedUnit",
              },
            ],
          },
        },
      });
    });

    it("should return missing kindOfQuantity", () => {
      expectPartiallyEquals(findEntry({ changeType: "add", schemaType: "KindOfQuantity", itemName: "MissingKoq" }), {
        changeType: "add",
        schemaType: "KindOfQuantity",
        itemName: "MissingKoq",
        difference: {
          label: "Missing",
          description: "Missing KindOfQuantity",
          persistenceUnit: "SourceSchema.TestUnit",
          presentationUnits: [
            "SourceSchema.MissingFormat(4)[SourceSchema.MissingUnit][SourceSchema.MissingInvertedUnit]",
          ],
          relativeError: 0.328,
        },
      });
    });
  });

  describe("Missing class differences", () => {
    it("should return missing struct class", () => {
      expectPartiallyEquals(findEntry({ changeType: "add", itemName: "MissingStruct" }), {
        changeType: "add",
        schemaType: "StructClass",
        itemName: "MissingStruct",
        difference: {
          label: "Missing",
          description: "Missing Struct",
          properties: [{
            name: "IntegerArrayProperty",
            description: "Integer Array Property",
            minValue: 1,
            maxValue: 101,
            type: "PrimitiveArrayProperty",
            typeName: "int",
            customAttributes: [{ className: "CustomAttributeSchema.MissingCA" }],
          }],
        },
      });
    });

    it("should return struct class added properties", () => {
      expectPartiallyEquals(findEntry({ changeType: "add", schemaType: "Property", itemName: "ChangedStruct", path: "StructProperty" }), {
        changeType: "add",
        schemaType: "Property",
        itemName: "ChangedStruct",
        path: "StructProperty",
        difference: {
          label: "Struct",
          description: "Struct Property",
          type: "StructProperty",
          typeName: "SourceSchema.MissingStruct",
          category: "SourceSchema.MissingCategory",
          customAttributes: [{ className: "CustomAttributeSchema.MissingCA" }],
        },
      });
    });

    it("should return missing customAttribute class", () => {
      expectPartiallyEquals(findEntry({ changeType: "add", itemName: "MissingCA" }), {
        changeType: "add",
        schemaType: "CustomAttributeClass",
        itemName: "MissingCA",
        difference: {
          baseClass: "CustomAttributeSchema.MissingCA",
          appliesTo: "Any",
          modifier: "Sealed",
          label: "Missing",
          description: "Missing CustomAttribute",
          properties: [{
            name: "EnumerationProperty",
            description: "Enumeration Property",
            type: "PrimitiveProperty",
            typeName: "SourceSchema.ChangedEnumeration",
          }],
        },
      });
    });

    it("should return customAttribute class added properties", () => {
      expectPartiallyEquals(findEntry({ changeType: "add", schemaType: "Property", itemName: "ChangedCA", path: "StringProperty" }), {
        changeType: "add",
        schemaType: "Property",
        itemName: "ChangedCA",
        path: "StringProperty",
        difference: {
          label: "String",
          description: "String Property",
          type: "PrimitiveProperty",
          typeName: "string",
          extendedTypeName: "JSON",
          kindOfQuantity: "SourceSchema.MissingKoq",
        },
      });
    });

    it("should return missing mixin class", () => {
      expectPartiallyEquals(findEntry({ changeType: "add", itemName: "MissingMixin" }), {
        changeType: "add",
        schemaType: "Mixin",
        itemName: "MissingMixin",
        difference: {
          label: "Missing",
          description: "Missing Mixin",
          appliesTo: "SourceSchema.TestEntity",
        },
      });
    });

    it("should return missing relationship class", () => {
      expectPartiallyEquals(findEntry({ changeType: "add", itemName: "MissingRelationship" }), {
        changeType: "add",
        schemaType: "RelationshipClass",
        itemName: "MissingRelationship",
        difference: {
          label: "Missing",
          description: "Missing Relationship",
          strength: "Embedding",
          strengthDirection: "Forward",
          source: {
            polymorphic: true,
            multiplicity: "(0..*)",
            roleLabel: "Source RoleLabel",
            abstractConstraint: "SourceSchema.TestEntity",
            constraintClasses: [
              "SourceSchema.MissingEntity",
            ],
          },
          target: {
            polymorphic: true,
            multiplicity: "(0..*)",
            roleLabel: "Target RoleLabel",
            customAttributes: [{ className: "CustomAttributeSchema.MissingCA" }],
            abstractConstraint: "SourceSchema.TestEntity",
            constraintClasses: [
              "SourceSchema.MissingEntity",
            ],
          },
        },
      });
    });
  });

  describe("Changed schema item differences", () => {
    it("should return changed unit system properties", () => {
      expectPartiallyEquals(findEntry({ changeType: "modify", schemaType: "UnitSystem", itemName: "ChangedUnitSystem" }), {
        changeType: "modify",
        schemaType: "UnitSystem",
        itemName: "ChangedUnitSystem",
        difference: {
          label: "Changed",
          description: "Changed System",
        },
      });
    });

    it("should return changed property category properties", () => {
      expectPartiallyEquals(findEntry({ changeType: "modify", schemaType: "PropertyCategory", itemName: "ChangedCategory" }), {
        changeType: "modify",
        schemaType: "PropertyCategory",
        itemName: "ChangedCategory",
        difference: {
          label: "Changed",
          description: "Changed Category",
          priority: 104,
        },
      });
    });

    it("should return changed enumeration", () => {
      expectPartiallyEquals(findEntry({ changeType: "modify", itemName: "ChangedEnumeration" }), {
        changeType: "modify",
        schemaType: "Enumeration",
        itemName: "ChangedEnumeration",
        difference: {
          label: "Changed",
          description: "Changed Enumeration",
          isStrict: false,
        },
      });
    });

    it("should return changed enumeration enumerators", () => {
      expectPartiallyEquals(findEntry({ changeType: "modify", itemName: "ChangedEnumeration", path: "EnumeratorTwo" }), {
        changeType: "modify",
        schemaType: "Enumerator",
        itemName: "ChangedEnumeration",
        path: "EnumeratorTwo",
        difference: {
          label: "Enumerator Two",
        },
      });
    });

    it("should return changed phenomenon properties", () => {
      expectPartiallyEquals(findEntry({ changeType: "modify", schemaType: "Phenomenon", itemName: "ChangedPhenomenon" }), {
        changeType: "modify",
        schemaType: "Phenomenon",
        itemName: "ChangedPhenomenon",
        difference: {
          label: "Changed",
          description: "Changed Phenomenon",
          definition: "MASS",
        },
      });
    });

    it("should return changed constant properties", () => {
      expectPartiallyEquals(findEntry({ changeType: "modify", schemaType: "Constant", itemName: "ChangedConstant" }), {
        changeType: "modify",
        schemaType: "Constant",
        itemName: "ChangedConstant",
        difference: {
          label: "Changed",
          description: "Changed Constant",
          phenomenon: "SourceSchema.MissingPhenomenon",
          definition: "FOOT",
          numerator: 907,
          denominator: 2,
        },
      });
    });

    it("should return changed unit properties", () => {
      expectPartiallyEquals(findEntry({ changeType: "modify", schemaType: "Unit", itemName: "ChangedUnit" }), {
        changeType: "modify",
        schemaType: "Unit",
        itemName: "ChangedUnit",
        difference: {
          label: "Changed",
          description: "Changed Unit",
          phenomenon: "SourceSchema.MissingPhenomenon",
          definition: "KM",
          numerator: 1,
          denominator: 0.2,
          offset: 0.101325,
        },
      });
    });

    it("should return changed invertedUnit properties", () => {
      expectPartiallyEquals(findEntry({ changeType: "modify", schemaType: "InvertedUnit", itemName: "ChangedInvertedUnit" }), {
        changeType: "modify",
        schemaType: "InvertedUnit",
        itemName: "ChangedInvertedUnit",
        difference: {
          label: "Changed",
          description: "Changed InvertedUnit",
          unitSystem: "SourceSchema.ChangedUnitSystem",
          invertsUnit: "SourceSchema.ChangedUnit",
        },
      });
    });

    it("should return changed kindOfQuantity properties", () => {
      expectPartiallyEquals(findEntry({ changeType: "modify", schemaType: "KindOfQuantity", itemName: "ChangedKoq" }), {
        changeType: "modify",
        schemaType: "KindOfQuantity",
        itemName: "ChangedKoq",
        difference: {
          label: "Changed",
          description: "Changed KindOfQuantity",
        },
      });
    });

    it("should return changed kindOfQuantity presentation formats", () => {
      expectPartiallyEquals(findEntry({ changeType: "add", schemaType: "KindOfQuantityPresentationFormat", itemName: "ChangedKoq" }), {
        changeType: "add",
        schemaType: "KindOfQuantityPresentationFormat",
        itemName: "ChangedKoq",
        difference: [
          "SourceSchema.TestFormat(6)[SourceSchema.TestUnit|1000]",
        ],
      });
    });

    it("should return changed format unit labels", () => {
      expectPartiallyEquals(findEntry({ changeType: "modify", schemaType: "FormatUnitLabel", itemName: "TestFormat", path: "SourceSchema.TestUnit" }), {
        changeType: "modify",
        schemaType: "FormatUnitLabel",
        itemName: "TestFormat",
        path: "SourceSchema.TestUnit",
        difference: {
          label: "two",
        },
      });
    });

    it("should return changed format units", () => {
      expect(findEntry({ changeType: "modify", schemaType: "FormatUnitLabel", itemName: "ChangedFormat", path: "SourceSchema.TestUnit" }), "Unexpected changes for ChangedFormat").to.be.undefined;
      expectPartiallyEquals(findEntry({ changeType: "modify", schemaType: "FormatUnit", itemName: "ChangedFormat" }), {
        changeType: "modify",
        schemaType: "FormatUnit",
        itemName: "ChangedFormat",
        difference: [
          {
            name: "SourceSchema.TestUnit",
            label: "two",
          },
          {
            name: "SourceSchema.MissingUnit",
            label: "four",
          },
        ],
      });
    });
  });

  describe("Changed class differences", () => {
    it("should return changed struct class properties", () => {
      expectPartiallyEquals(findEntry({ changeType: "modify", schemaType: "StructClass", itemName: "ChangedStruct" }), {
        changeType: "modify",
        schemaType: "StructClass",
        itemName: "ChangedStruct",
        difference: {
          description: "Changed Struct",
          label: "Changed",
          modifier: "None",
        },
      });
    });

    it("should return struct class changed properties", () => {
      expectPartiallyEquals(findEntry({ changeType: "modify", schemaType: "Property", itemName: "ChangedStruct", path: "BoolProperty" }), {
        changeType: "modify",
        schemaType: "Property",
        itemName: "ChangedStruct",
        path: "BoolProperty",
        difference: {
          label: "Bool",
          description: "Bool Property",
          isReadOnly: true,
          category: "SourceSchema.ChangedCategory",
        },
      });
    });

    it("should return changed customAttribute class properties", () => {
      expectPartiallyEquals(findEntry({ changeType: "modify", schemaType: "CustomAttributeClass", itemName: "ChangedCA" }), {
        changeType: "modify",
        schemaType: "CustomAttributeClass",
        itemName: "ChangedCA",
        difference: {
          label: "Changed",
          description: "Changed CustomAttribute",
          appliesTo: "AnyProperty",
          modifier: "None",
        },
      });
    });

    it("should return customAttribute class changed properties", () => {
      expectPartiallyEquals(findEntry({ changeType: "modify", schemaType: "Property", itemName: "ChangedCA", path: "EnumerationProperty" }), {
        changeType: "modify",
        schemaType: "Property",
        itemName: "ChangedCA",
        path: "EnumerationProperty",
        difference: {
          label: "Enumeration",
          description: "Enumeration Property",
          priority: 101,
          category: "SourceSchema.MissingCategory",
        },
      });
    });

    it("should return changed entity properties", () => {
      expectPartiallyEquals(findEntry({ changeType: "modify", itemName: "ChangedEntity" }), {
        changeType: "modify",
        schemaType: "EntityClass",
        itemName: "ChangedEntity",
        difference: {
          baseClass: "SourceSchema.MissingEntity",
          label: "Changed",
          description: "Changed Entity",
        },
      });
    });

    it("should return changed mixin properties", () => {
      expectPartiallyEquals(findEntry({ changeType: "modify", itemName: "ChangedMixin" }), {
        changeType: "modify",
        schemaType: "Mixin",
        itemName: "ChangedMixin",
        difference: {
          label: "Changed",
          description: "Changed Mixin",
        },
      });
    });

    it("should return relationship class changed properties", () => {
      expectPartiallyEquals(findEntry({ changeType: "modify", itemName: "ChangedRelationship" }), {
        changeType: "modify",
        schemaType: "RelationshipClass",
        itemName: "ChangedRelationship",
        difference: {
          description: "Changed Relationship",
          label: "Changed",
          strength: "Holding",
          strengthDirection: "Backward",
        },
      });
    });

    it("should return changed source relationship constraint with added constraint classes", () => {
      expectPartiallyEquals(findEntry({ changeType: "add", schemaType: "RelationshipConstraintClass", itemName: "ChangedRelationship", path: "$source" }), {
        changeType: "add",
        schemaType: "RelationshipConstraintClass",
        itemName: "ChangedRelationship",
        path: "$source",
        difference: [
          "SourceSchema.ChangedEntity",
        ],
      });
    });

    it("should return changed source relationship constraint properties", () => {
      expectPartiallyEquals(findEntry({ changeType: "modify", schemaType: "RelationshipConstraint", itemName: "ChangedRelationship", path: "$source" }), {
        changeType: "modify",
        schemaType: "RelationshipConstraint",
        itemName: "ChangedRelationship",
        path: "$source",
        difference: {
          multiplicity: "(0..1)",
          roleLabel: "Changed Source RoleLabel",
          polymorphic: false,
          abstractConstraint: "SourceSchema.MissingEntity",
        },
      });
    });

    it("should return changed entity with mixin added", () => {
      expectPartiallyEquals(findEntry({ changeType: "add", itemName: "ChangedEntity" }), {
        changeType: "add",
        schemaType: "EntityClassMixin",
        itemName: "ChangedEntity",
        difference: [
          "SourceSchema.MissingMixin",
        ],
      });
    });
  });

  describe("Missing custom attribute differences", () => {
    it("should return missing schema custom attribute", () => {
      expectPartiallyEquals(findEntry({ changeType: "add", schemaType: "CustomAttributeInstance" }), {
        changeType: "add",
        schemaType: "CustomAttributeInstance",
        appliedTo: "Schema",
        difference: {
          className: "CustomAttributeSchema.MissingCA",
        },
      });
    });

    it("should return missing custom attribute on entity", () => {
      expectPartiallyEquals(findEntry({ schemaType: "CustomAttributeInstance", itemName: "ChangedEntity" }), {
        changeType: "add",
        schemaType: "CustomAttributeInstance",
        appliedTo: "SchemaItem",
        itemName: "ChangedEntity",
        difference: {
          className: "SourceSchema.MissingCA",
        },
      });
    });

    it("should return missing property custom attribute", () => {
      expectPartiallyEquals(findEntry({ changeType: "add", schemaType: "CustomAttributeInstance", itemName: "ChangedCA", path: "EnumerationProperty" }), {
        changeType: "add",
        schemaType: "CustomAttributeInstance",
        appliedTo: "Property",
        itemName: "ChangedCA",
        path: "EnumerationProperty",
        difference: {
          className: "SourceSchema.MissingCA",
          EnumerationProperty: "EnumeratorOne",
        },
      });
    });

    it("should return a missing custom attribute on RelationshipConstraint", () => {
      expectPartiallyEquals(findEntry({ schemaType: "CustomAttributeInstance", itemName: "ChangedRelationship", path: "$target" }), {
        changeType: "add",
        schemaType: "CustomAttributeInstance",
        appliedTo: "RelationshipConstraint",
        itemName: "ChangedRelationship",
        path: "$target",
        difference: {
          className: "SourceSchema.MissingCA",
        },
      });
    });
  });
});
