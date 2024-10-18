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
    TestFormat: {
      schemaItemType: "Format",
      label: "real",
      type: "Decimal",
      precision: 6,
      formatTraits: [
        "KeepSingleZero",
        "KeepDecimalPoint",
        "ShowUnitLabel",
      ],
      decimalSeparator: ",",
      thousandSeparator: " ",
    },
    TestUnit: {
      schemaItemType: "Unit",
      label: "m",
      phenomenon: "SourceSchema.AreaPhenomenon",
      unitSystem: "SourceSchema.TestUnitSystem",
      definition: "M",
    },
    ChangedKoq: {
      schemaItemType: "KindOfQuantity",
      label: "Koq",
      relativeError: 0.09290304,
      persistenceUnit: "SourceSchema.TestUnit",
      presentationUnits: [
        "SourceSchema.TestFormat(4)[SourceSchema.TestUnit|m]",
      ],
    },
    AreaPhenomenon: {
      schemaItemType: "Phenomenon",
      label: "Area",
      description: "Area description",
      definition: "Units.LENGTH(4)",
    },
    MissingUnitSystem: {
      schemaItemType: "UnitSystem",
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
      properties: [{
        name: "BooleanProperty",
        type: "PrimitiveProperty",
        typeName: "boolean",
        customAttributes: [{ className: "CustomAttributeSchema.InternalId" }],
      },
      {
        name: "StructProperty",
        type: "StructArrayProperty",
        typeName: "SourceSchema.MissingStruct",
      }],
    },
    ChangedEntityBaseClass: {
      schemaItemType: "EntityClass",
      baseClass: "SourceSchema.ChangedEntity",
    },
    RelationshipSourceEntity: {
      schemaItemType: "EntityClass",
      label: "Source constraint class",
      modifier: "Abstract",
    },
    RelationshipTargetEntity: {
      schemaItemType: "EntityClass",
      label: "Target constraint class",
      baseClass: "SourceSchema.EmptyAbstractEntity",
      modifier: "Abstract",
    },
    RelationshipEntity: {
      schemaItemType: "RelationshipClass",
      description: "TestRelationship",
      strength: "Embedding",
      strengthDirection: "Forward",
      source: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "New Source RoleLabel",
        abstractConstraint: "SourceSchema.RelationshipSourceEntity",
        constraintClasses: [
          "SourceSchema.RelationshipSourceEntity",
        ],
      },
      target: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Target RoleLabel",
        customAttributes: [{ className: "CustomAttributeSchema.MissingCA" }],
        abstractConstraint: "SourceSchema.EmptyAbstractEntity",
        constraintClasses: [
          "SourceSchema.RelationshipTargetEntity",
        ],
      },
    },
    ChangedBaseClassEntity: {
      schemaItemType: "EntityClass",
      baseClass: "SourceSchema.ChangedEntityBaseClass",
    },
  },
};
