/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/naming-convention */

export default {
  $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
  name: "ConflictingPropertyName",
  version: "01.00.02",
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
    CONSTRAINTS: {
      schemaItemType: "PropertyCategory",
      label: "Constraints",
      priority: 200000,
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
        },
        {
          name: "TYPE",
          description: "Type",
          type: "PrimitiveArrayProperty",
          typeName: "ConflictingPropertyName.WALL_TYPE",
          category: "ConflictingPropertyName.CONSTRAINTS",
        },
      ],
    },
  },
};
