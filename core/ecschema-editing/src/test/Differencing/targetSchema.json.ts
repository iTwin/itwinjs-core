/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/naming-convention */

export default {
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
    TestUnitSystem: {
      schemaItemType: "UnitSystem",
    },
    TestPhenomenon: {
      schemaItemType: "Phenomenon",
      label: "Number",
      description: "Number Phenomenon",
      definition: "NUMBER",
    },
    TestUnit: {
      schemaItemType: "Unit",
      label: "two",
      phenomenon: "TargetSchema.TestPhenomenon",
      unitSystem: "TargetSchema.TestUnitSystem",
      definition: "TWO",
    },
    TestFormat: {
      schemaItemType: "Format",
      label: "real",
      type: "Scientific",
      scientificType: "Normalized",
      precision: 12,
      showSignOption: "NegativeParentheses",
      formatTraits: "ExponentOnlyNegative",
      uomSeparator: "",
      composite: {
        spacer: "",
        units: [
          {
            name: "TargetSchema.TestUnit",
            label: "du",
          },
        ],
      },
    },
    TestEntity: {
      schemaItemType: "EntityClass",
      modifier: "Abstract",
    },
    ChangedUnitSystem: {
      schemaItemType: "UnitSystem",
    },
    ChangedCategory: {
      schemaItemType: "PropertyCategory",
      label: "Struct",
      description: "Struct Category",
      priority: 4,
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
    ChangedPhenomenon: {
      schemaItemType: "Phenomenon",
      definition: "MOLE",
    },
    ChangedConstant: {
      schemaItemType: "Constant",
      label: "Tau",
      phenomenon: "TargetSchema.ChangedPhenomenon",
      definition: "TAU",
      numerator: 6.2,
      denominator: 3,
    },
    ChangedUnit: {
      schemaItemType: "Unit",
      label: "metre",
      phenomenon: "TargetSchema.TestPhenomenon",
      unitSystem: "TargetSchema.TestUnitSystem",
      definition: "Metre",
      numerator: 3,
      denominator: 0.4,
      offset: 0.101326,
    },
    ChangedInvertedUnit: {
      schemaItemType: "InvertedUnit",
      unitSystem: "TargetSchema.TestUnitSystem",
      invertsUnit: "TargetSchema.TestUnit",
    },
    ChangedFormat: {
      schemaItemType: "Format",
      label: "Fractional",
      description: "Fractional Format",
      type: "Fractional",
      precision: 64,
      formatTraits: [
        "KeepSingleZero",
        "KeepDecimalPoint",
      ],
      decimalSeparator: ",",
      thousandSeparator: " ",
      composite: {
        spacer: "",
          units: [
          {
            name: "TargetSchema.TestUnit",
            label: "2",
          },
        ],
      },
    },
    ChangedKoq: {
      schemaItemType: "KindOfQuantity",
      label: "Width",
      description: "Width KindOfQuantity",
      persistenceUnit: "TargetSchema.TestUnit",
      relativeError: 0.35352,
      presentationUnits: [
        "TargetSchema.TestFormat(4)[TargetSchema.TestUnit|1000]",
      ],
    },
    ChangedStruct: {
      schemaItemType: "StructClass",
      label: "Test",
      description: "Test Class",
      modifier: "Abstract",
      properties: [{
        name: "BoolProperty",
        label: "Test",
        description: "Test Property",
        type: "PrimitiveProperty",
        typeName: "bool",
        isReadOnly: false,
      }],
    },
    ChangedCA: {
      schemaItemType:"CustomAttributeClass",
      appliesTo: "AnyClass",
      modifier: "Sealed",
      properties: [{
        name: "EnumerationProperty",
        type: "PrimitiveProperty",
        priority: 102,
        category: "TargetSchema.ChangedCategory",
        typeName: "TargetSchema.ChangedEnumeration",
      }],
    },
    ChangedMixin: {
      schemaItemType: "Mixin",
      label: "Test",
      description: "Test Mixin",
      appliesTo: "TargetSchema.TestEntity",
    },
    ChangedEntity: {
      schemaItemType: "EntityClass",
      baseClass: "TargetSchema.TestEntity",
      label: "Test",
    },
    ChangedRelationship: {
      schemaItemType: "RelationshipClass",
      label: "Test",
      description: "Test Relationship",
      strength: "Embedding",
      strengthDirection: "Forward",
      source: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Source RoleLabel",
        abstractConstraint: "TargetSchema.TestEntity",
        constraintClasses: [
          "TargetSchema.TestEntity",
        ],
      },
      target: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Target RoleLabel",
        abstractConstraint: "TargetSchema.TestEntity",
        constraintClasses: [
          "TargetSchema.TestEntity",
        ],
      },
    },
  },
};
