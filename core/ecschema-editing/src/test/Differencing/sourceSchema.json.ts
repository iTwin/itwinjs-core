/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/naming-convention */

export default {
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
      phenomenon: "SourceSchema.TestPhenomenon",
      unitSystem: "SourceSchema.TestUnitSystem",
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
            name: "SourceSchema.TestUnit",
            label: "two",
          },
        ],
      },
    },
    TestEntity: {
      schemaItemType: "EntityClass",
      modifier: "Abstract",
    },
    MissingUnitSystem: {
      schemaItemType: "UnitSystem",
      label: "Missing",
      description: "Missing System",
    },
    MissingCategory: {
      schemaItemType: "PropertyCategory",
      label: "Missing",
      description: "Missing Category",
      priority: 4,
    },
    MissingEnumeration: {
      schemaItemType: "Enumeration",
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
    MissingPhenomenon: {
      schemaItemType: "Phenomenon",
      label: "Missing",
      description: "Missing Phenomenon",
      definition: "LENGTH",
    },    
    MissingConstant: {
      schemaItemType: "Constant",
      label: "Missing",
      description: "Missing Constant",
      phenomenon: "SourceSchema.TestPhenomenon",
      definition: "ONE",
      numerator: 1,
      denominator: 0.001,
    },
    MissingUnit: {
      schemaItemType: "Unit",
      label: "Missing",
      description: "Missing Unit",
      phenomenon: "SourceSchema.TestPhenomenon",
      unitSystem: "SourceSchema.MissingUnitSystem",
      definition: "FOUR",
      numerator: 66,
      denominator: 33,
      offset: 0.01,
    },
    MissingInvertedUnit: {
      schemaItemType: "InvertedUnit",
      label: "Missing",
      description: "Missing InvertedUnit",
      unitSystem: "SourceSchema.MissingUnitSystem",
      invertsUnit: "SourceSchema.MissingUnit",
    },
    MissingFormat: {
      schemaItemType: "Format",
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
          },{
            name: "SourceSchema.MissingInvertedUnit",
          },
        ],
      },
    },
    MissingKoq: {
      schemaItemType: "KindOfQuantity",
      label: "Missing",
      description: "Missing KindOfQuantity",
      persistenceUnit: "SourceSchema.TestUnit",
      presentationUnits: [
        "SourceSchema.MissingFormat(4)[SourceSchema.MissingUnit][SourceSchema.MissingInvertedUnit]",
      ],
      relativeError: 0.328,
    },
    MissingStruct: {
      schemaItemType: "StructClass",
      label: "Missing",
      description: "Missing Struct",
      modifier: "None",
      properties: [{
        name: "IntegerArrayProperty",
        description: "Integer Array Property",
        minValue: 1,
        maxValue: 101,
        type: "PrimitiveArrayProperty",
        typeName: "int",
        customAttributes: [{ 
          className: "CustomAttributeSchema.MissingCA" 
        }],
      }],
    },
    MissingCA: {
      schemaItemType: "CustomAttributeClass",
      baseClass: "CustomAttributeSchema.MissingCA",
      appliesTo: "Any",
      modifier: "Sealed",
      label: "Missing",
      description: "Missing CustomAttribute",
      customAttributes: [{ className: "CustomAttributeSchema.MissingCA" }],
      properties: [{
        name: "EnumerationProperty",
        description: "Enumeration Property",
        type: "PrimitiveProperty",
        typeName: "SourceSchema.ChangedEnumeration",
      }],
    },
    MissingMixin: {
      schemaItemType: "Mixin",
      label: "Missing",
      description: "Missing Mixin",
      appliesTo: "SourceSchema.TestEntity",
    },
    MissingEntity: {
      schemaItemType: "EntityClass",
      baseClass: "SourceSchema.TestEntity",
      label: "Missing",
      description: "Missing Entity",
    },
    MissingRelationship: {
      schemaItemType: "RelationshipClass",
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
    ChangedUnitSystem: {
      schemaItemType: "UnitSystem",
      label: "Changed",
      description: "Changed System",
    },
    ChangedCategory: {
      schemaItemType: "PropertyCategory",
      label: "Changed",
      description: "Changed Category",
      priority: 104,
    },
    ChangedEnumeration: {
      schemaItemType: "Enumeration",
      type: "string",
      label: "Changed",
      description: "Changed Enumeration",
      isStrict: false,
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
    ChangedPhenomenon: {
      schemaItemType: "Phenomenon",
      label: "Changed",
      description: "Changed Phenomenon",
      definition: "MASS",
    },
    ChangedConstant: {
      schemaItemType: "Constant",
      label: "Changed",
      description: "Changed Constant",
      phenomenon: "SourceSchema.MissingPhenomenon",
      definition: "FOOT",
      numerator: 907,
      denominator: 2,
    },
    ChangedUnit: {
      schemaItemType: "Unit",
      label: "Changed",
      description: "Changed Unit",
      phenomenon: "SourceSchema.MissingPhenomenon",
      unitSystem: "SourceSchema.TestUnitSystem",
      definition: "KM",
      numerator: 1,
      denominator: 0.2,
      offset: 0.101325,
    },
    ChangedInvertedUnit: {
      schemaItemType: "InvertedUnit",
      label: "Changed",
      description: "Changed InvertedUnit",
      unitSystem: "SourceSchema.ChangedUnitSystem",
      invertsUnit: "SourceSchema.ChangedUnit",
    },
    ChangedFormat: {
      schemaItemType: "Format",
      label: "Changed",
      description: "Changed Format",
      type: "Fractional",
      precision: 8,
      formatTraits: "KeepSingleZero",
      decimalSeparator: ".",
      thousandSeparator: ",",
      composite: {
        spacer: "",
        units: [
          {
            name: "SourceSchema.TestUnit",
            label: "two",
          },
          {
            name: "SourceSchema.MissingUnit",
            label: "four",
          },
        ],
      },
    },
    ChangedKoq: {
      schemaItemType: "KindOfQuantity",
      label: "Changed",
      description: "Changed KindOfQuantity",
      persistenceUnit: "SourceSchema.TestUnit",
      presentationUnits: [
        "SourceSchema.TestFormat(6)[SourceSchema.TestUnit|1000]",
      ],
      relativeError: 0.35314,
    },
    ChangedStruct: {
      schemaItemType: "StructClass",
      label: "Changed",
      description: "Changed Struct",
      modifier: "None",
      properties: [{
        name: "BoolProperty",
        label: "Bool",
        description: "Bool Property",
        type: "PrimitiveProperty",
        typeName: "bool",
        isReadOnly: true,
        category: "SourceSchema.ChangedCategory",
      },
      {
        name: "StructProperty",
        label: "Struct",
        description: "Struct Property",
        type: "StructProperty",
        typeName: "SourceSchema.MissingStruct",
        category: "SourceSchema.MissingCategory",
        customAttributes: [{ className: "CustomAttributeSchema.MissingCA" }],
      }],
    },
    ChangedCA: {
      schemaItemType:"CustomAttributeClass",
      label: "Changed",
      description: "Changed CustomAttribute",
      appliesTo: "AnyProperty",
      modifier: "None",
      properties: [{
        name: "StringProperty",
        label: "String",
        description: "String Property",
        type: "PrimitiveProperty",
        typeName: "string",
        extendedTypeName: "JSON",
        kindOfQuantity: "SourceSchema.MissingKoq",
      },
      {
        name: "EnumerationProperty",
        label: "Enumeration",
        description: "Enumeration Property",
        type: "PrimitiveProperty",
        typeName: "SourceSchema.ChangedEnumeration",
        category: "SourceSchema.MissingCategory",
        priority: 101,
        customAttributes: [{ 
          className: "SourceSchema.MissingCA",
          EnumerationProperty: "EnumeratorOne",
        }],
      }],
    },
    ChangedMixin: {
      schemaItemType: "Mixin",
      label: "Changed",
      description: "Changed Mixin",
      appliesTo: "SourceSchema.TestEntity",
    },
    ChangedEntity: {
      schemaItemType: "EntityClass",
      baseClass: "SourceSchema.MissingEntity",
      label: "Changed",
      description: "Changed Entity",
      mixins: ["SourceSchema.MissingMixin"],
      customAttributes: [{ className: "SourceSchema.MissingCA" }],
    },
    ChangedRelationship: {
      schemaItemType: "RelationshipClass",
      label: "Changed",
      description: "Changed Relationship",
      strength: "Holding",
      strengthDirection: "Backward",
      source: {
        polymorphic: false,
        multiplicity: "(0..1)",
        roleLabel: "Changed Source RoleLabel",
        abstractConstraint: "SourceSchema.MissingEntity",
        constraintClasses: [
          "SourceSchema.ChangedEntity",
        ],
      },
      target: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Target RoleLabel",
        abstractConstraint: "SourceSchema.TestEntity",
        constraintClasses: [
          "SourceSchema.TestEntity",
        ],
        customAttributes: [{ className: "SourceSchema.MissingCA" }],
      },
    },
  },
};
