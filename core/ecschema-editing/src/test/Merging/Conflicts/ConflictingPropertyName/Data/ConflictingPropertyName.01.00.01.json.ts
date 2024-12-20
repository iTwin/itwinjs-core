/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/naming-convention */

export default {
  $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
  name: "ConflictingPropertyName",
  version: "01.00.01",
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
    ARCWALL: {
      schemaItemType: "EntityClass",
      properties: [
        {
          name: "HEIGHT",
          type: "PrimitiveProperty",
          typeName: "double",
        },
      ],
    },
  },
};
