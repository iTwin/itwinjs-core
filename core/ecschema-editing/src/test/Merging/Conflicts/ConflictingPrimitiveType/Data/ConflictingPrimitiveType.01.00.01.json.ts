/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/naming-convention */

export default {
  $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
  name: "ConflictingPrimitiveType",
  version: "01.00.01",
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
    ARCWALL: {
      label: "Basic Wall",
      schemaItemType: "EntityClass",
      properties: [
        {
          name: "OVERAL_HEIGHT",
          type: "PrimitiveProperty",
          typeName: "double",
        },
        {
          name: "OVERAL_WIDTH",
          type: "PrimitiveProperty",
          label: "Overall Width",
          typeName: "double",
        },
        {
          name: "OVERAL_LENGTH",
          type: "PrimitiveProperty",
          description: "overall length along the centerline of the wall",
          typeName: "double",
        },
        {
          name: "WALL_HEIGHT_TYPE",
          type: "PrimitiveProperty",
          label: "Top Constraint",
          typeName: "string",
        },
      ],
    },
  },
};
