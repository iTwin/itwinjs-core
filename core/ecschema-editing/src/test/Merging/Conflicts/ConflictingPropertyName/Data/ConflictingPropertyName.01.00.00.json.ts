/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/naming-convention */

export default {
  $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
  name: "ConflictingPropertyName",
  version: "01.00.00",
  alias: "c_1300",
  label: "Conflicting Property Name",
  references: [
    {
      name: "CoreCustomAttributes",
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
      schemaItemType: "UnitSystem",
    },
    CONSTRUCTION_STATUS: {
      schemaItemType: "Phenomenon",
      definition: "ConstructionStatus",
    },
    WALL_HAS_LAYER: {
      schemaItemType: "PropertyCategory",
    },
    WALL_TYPE: {
      schemaItemType: "StructClass",
    },
    DEFINITION_ARCWALL: {
      schemaItemType: "CustomAttributeClass",
      properties: [{
        name: "LABEL",
        type: "PrimitiveProperty",
        typeName: "string",
      }],
      appliesTo: "Any",
    },
    CATEGORY_WALL_COMMON: {
      schemaItemType: "Mixin",
      appliesTo: "ConflictingPropertyName.ARCWALL",
    },
    ARCWALL: {
      schemaItemType: "EntityClass",
      properties: [
        {
          name: "HEIGHT",
          type: "PrimitiveProperty",
          typeName: "string",
        },
        {
          name: "TYPE",
          type: "PrimitiveProperty",
          typeName: "int",
        },
        {
          name: "DEFINITION",
          type: "PrimitiveProperty",
          typeName: "string",
        },
        {
          name: "LAYER",
          type: "PrimitiveArrayProperty",
          typeName: "string",
        },
        {
          name: "AREA",
          type: "PrimitiveProperty",
          typeName: "string",
        },
      ],
    },
  },
};
