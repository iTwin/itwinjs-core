/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/naming-convention */

export default {
  $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
  name: "ConflictingPrimitiveType",
  version: "01.00.00",
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
      schemaItemType: "EntityClass",
      properties: [
        {
          name: "OVERAL_HEIGHT",
          type: "PrimitiveProperty",
          typeName: "string",
        },
        {
          name: "OVERAL_WIDTH",
          type: "PrimitiveProperty",
          typeName: "double",
        },
        {
          name: "OVERAL_LENGTH",
          type: "PrimitiveProperty",
          typeName: "double",
        },
      ],
    },
  },
};
