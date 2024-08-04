/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/naming-convention */

export default {
  $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
  name: "ConflictingPropertyType",
  version: "01.00.02",
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
    DAMPER_TYPES: {
      schemaItemType: "Enumeration",
      isStrict: false,
      type: "int",
      enumerators: [
        {
          name: "FIRE_DAMPER",
          value: 0,
        },
        {
          name: "SMOKE_DAMPER",
          value: 1,
        },
        {
          name: "VOLUME_DAMPER",
          value: 2,
        },
      ],
    },
    DAMPER: {
      schemaItemType: "EntityClass",
      label: "Damper",
      description: "A device for suppressing unfavourable characteristics or behavior",
      properties: [
        {
          name: "TYPE",
          type: "PrimitiveArrayProperty",
          typeName: "ConflictingPropertyType.DAMPER_TYPES",
          label: "Damper Type",
          minOccurs: 1,
          maxOccurs: 5,
          priority: 1,
        },
        {
          name: "NAME",
          type: "PrimitiveProperty",
          typeName: "string",
          label: "Damper Name",
        },
      ],
    },
  },
};
