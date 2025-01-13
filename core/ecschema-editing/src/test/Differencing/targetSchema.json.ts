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
      phenomenon: "TargetSchema.AreaPhenomenon",
      unitSystem: "TargetSchema.TestUnitSystem",
      definition: "M",
    },
    ChangedKoq: {
      schemaItemType: "KindOfQuantity",
      relativeError: 0.09290306,
      persistenceUnit: "TargetSchema.TestUnit",
    },
    AreaPhenomenon: {
      schemaItemType: "Phenomenon",
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
      properties: [{
        name: "BooleanProperty",
        type: "PrimitiveProperty",
        typeName: "boolean",
      }],
    },
    ChangedBaseClassEntity: {
      schemaItemType: "EntityClass",
      baseClass: "TargetSchema.ChangedEntity",
    },
    RelationshipEntity: {
      schemaItemType: "RelationshipClass",
      description: "TestRelationship",
      strength: "Embedding",
      strengthDirection: "Forward",
      source: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Source RoleLabel",
        abstractConstraint: "TargetSchema.ChangedEntity",
        constraintClasses: [
        ],
      },
      target: {
        polymorphic: true,
        multiplicity: "(0..*)",
        roleLabel: "Target RoleLabel",
        abstractConstraint: "TargetSchema.ChangedEntity",
        constraintClasses: [
        ],
      },
    },
  },
};
