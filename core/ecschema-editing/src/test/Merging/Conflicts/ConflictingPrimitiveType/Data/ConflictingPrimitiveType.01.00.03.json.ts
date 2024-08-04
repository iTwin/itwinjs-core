/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/naming-convention */

export default {
  $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
  name: "ConflictingPrimitiveType",
  version: "01.00.03",
  alias: "c_1300",
  label: "Conflicting Primitive Type",
  /* references: [
    {
      name: "CoreCustomAttributes",
      version: "01.00.03"
    }
  ],
  customAttributes: [
    {
      className: "CoreCustomAttributes.DynamicSchema"
    }
  ], */
  items: {
    CONSTRAINTS: {
      schemaItemType: "PropertyCategory",
      label: "Constraints",
      priority: 200000,
    },
    ARCWALL: {
      label: "Basic Wall",
      schemaItemType: "EntityClass",
      properties: [
        {
          name: "OVERAL_HEIGHT",
          type: "PrimitiveProperty",
          description: "overall height of the wall",
          label: "Overall Height",
          category: "ConflictingPrimitiveType.CONSTRAINTS",
          isReadOnly: true,
          typeName: "double",
        },
        {
          name: "OVERAL_WIDTH",
          type: "PrimitiveProperty",
          label: "Overall Width",
          description: "overall width (thickness) of the wall",
          category: "ConflictingPrimitiveType.CONSTRAINTS",
          typeName: "double",
        },
        {
          name: "OVERAL_LENGTH",
          type: "PrimitiveProperty",
          label: "Overall Length",
          description: "overall length along the centerline of the wall",
          category: "ConflictingPrimitiveType.CONSTRAINTS",
          typeName: "double",
        },
        {
          name: "WALL_HEIGHT_TYPE",
          type: "PrimitiveProperty",
          label: "Top Constraint",
          typeName: "string",
        },
        {
          name: "WALL_WIDTH_TYPE",
          type: "PrimitiveProperty",
          label: "Width Constraint",
          typeName: "string",
        },
      ],
    },
  },
};
