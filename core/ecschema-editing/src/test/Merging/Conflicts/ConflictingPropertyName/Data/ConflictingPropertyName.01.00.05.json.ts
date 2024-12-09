/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/naming-convention */

export default {
  $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
  name: "ConflictingPropertyName",
  version: "01.00.05",
  alias: "c_1300",
  label: "Conflicting Property Name",
  references: [
    {
      name: "BisCore",
      version: "01.00.01",
    },
    {
      name: "CoreCustomAttributes",
      version: "01.00.01",
    },
    {
      name: "Units",
      version: "01.00.01",
    },
    {
      name: "Formats",
      version: "01.00.01",
    },
  ],
  customAttributes: [
    {
      className: "CoreCustomAttributes.DynamicSchema",
    },
  ],
  items: {
    AREA: {
      schemaItemType: "KindOfQuantity",
      label: "Area",
      relativeError: 0.00101,
      persistenceUnit: "Units.SQ_M",
      presentationUnits: [
        "Formats.DefaultRealU(4)[Units.SQ_M|m²]",
      ],
    },
    CONSTRAINTS: {
      schemaItemType: "PropertyCategory",
      label: "Constraints",
      priority: 200000,
    },
    CATEGORY_WALL_COMMON: {
      schemaItemType: "PropertyCategory",
      description: "Wall_Common",
      priority: 0,
    },
    WALL_TYPE: {
      schemaItemType: "Enumeration",
      type: "int",
      isStrict: false,
      enumerators: [
        {
          name: "WallType10",
          value: 10,
          label: "Load Bearing",
        },
        {
          name: "WallType20",
          value: 20,
          label: "Self Bearing",
        },
      ],
    },
    DEFINITION_ARCWALL: {
      schemaItemType: "StructClass",
      properties: [{
        name: "LABEL",
        type: "PrimitiveProperty",
        typeName: "string",
      }],
    },
    MEASUREINFO: {
      schemaItemType: "CustomAttributeClass",
      appliesTo: "AnyProperty",
    },
    CONSTRUCTION_STATUS: {
      schemaItemType: "CustomAttributeClass",
      modifier: "Sealed",
      properties: [{
        name: "Value",
        type: "PrimitiveProperty",
        typeName: "string",
      }],
      appliesTo: "AnyProperty",
    },
    WALL_HAS_LAYER: {
      schemaItemType: "RelationshipClass",
      label: "Wall Has Layer",
      strength: "Referencing",
      strengthDirection: "Forward",
      source: {
        multiplicity: "(0..*)",
        roleLabel: "Wall Has Layer",
        polymorphic: true,
        constraintClasses: [
          "BisCore.Element",
        ],
      },
      target: {
        multiplicity: "(0..*)",
        roleLabel: "Wall Has Layer (Reversed)",
        polymorphic: true,
        constraintClasses: [
          "BisCore.Element",
        ],
      },
    },
    ARCWALL: {
      schemaItemType: "EntityClass",
      properties: [
        {
          name: "HEIGHT",
          type: "PrimitiveProperty",
          label: "Wall Height",
          category: "ConflictingPropertyName.CONSTRAINTS",
          minValue: 1.0,
          typeName: "double",
          customAttributes: [
            {
              className: "ConflictingPropertyName.MEASUREINFO",
            },
          ],
        },
        {
          name: "TYPE",
          description: "Wall Type",
          minOccurs: 1,
          maxOccurs: 11,
          type: "PrimitiveArrayProperty",
          typeName: "ConflictingPropertyName.WALL_TYPE",
          category: "ConflictingPropertyName.CATEGORY_WALL_COMMON",
        },
        {
          name: "DEFINITION",
          isReadOnly: true,
          type: "StructProperty",
          typeName: "ConflictingPropertyName.DEFINITION_ARCWALL",
          category: "ConflictingPropertyName.CATEGORY_WALL_COMMON",
          customAttributes: [
            {
              className: "ConflictingPropertyName.CONSTRUCTION_STATUS",
              Value: "Started",
            },
          ],
        },
        {
          name: "LAYER",
          type: "NavigationProperty",
          relationshipName: "ConflictingPropertyName.WALL_HAS_LAYER",
          direction: "Backward",
          priority: 102,
          customAttributes: [
            {
              className: "ConflictingPropertyName.MEASUREINFO",
            },
            {
              className: "ConflictingPropertyName.CONSTRUCTION_STATUS",
              Value: "Finished",
            },
          ],
        },
        {
          name: "AREA",
          type: "PrimitiveArrayProperty",
          typeName: "string",
          kindOfQuantity: "ConflictingPropertyName.AREA",
        },
      ],
    },
  },
};
