/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/naming-convention */

export default {
  $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
  name: "ConflictingPropertyType",
  version: "01.00.00",
  alias: "c_1300",
  label: "Conflicting Property Type",
  /* references: [
    {
      name: "CoreCustomAttributes",
      version: "01.00.03",
    },
  ],
  customAttributes: [
    {
      className: "CoreCustomAttributes.DynamicSchema",
    },
  ], */
  items: {
    DAMPER: {
      schemaItemType: "EntityClass",
      label: "Damper",
      description: "A device for suppressing unfavourable characteristics or behavior",
      properties: [
        {
          name: "TYPE",
          type: "PrimitiveProperty",
          typeName: "int",
          label: "Damper Type",
        },
      ],
    },
  },
};
