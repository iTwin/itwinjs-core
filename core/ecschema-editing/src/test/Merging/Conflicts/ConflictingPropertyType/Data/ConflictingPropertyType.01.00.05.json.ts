/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/naming-convention */

export default {
  $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
  name: "ConflictingPropertyType",
  version: "01.00.05",
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
    SPECIFICATION: {
      schemaItemType: "CustomAttributeClass",
      properties: [
        {
          name: "FORCE_CAPACITY",
          type: "PrimitiveProperty",
          typeName: "int",
        },
        {
          name: "FORM",
          type: "PrimitiveProperty",
          typeName: "string",
        },
      ],
      appliesTo: "Any",
    },
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
    CONSTRAINTS: {
      schemaItemType: "PropertyCategory",
      label: "Constraints",
      priority: 200000,
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
          description: "Classification based on damper application",
          minOccurs: 2,
          maxOccurs: 5,
          isReadOnly: true,
          priority: 2,
          customAttributes: [
            {
              FORCE_CAPACITY: 5,
              FORM: "Round",
              className: "ConflictingPropertyType.SPECIFICATION",
            },
          ],
        },
        {
          name: "NAME",
          type: "PrimitiveProperty",
          typeName: "string",
          label: "Damper Name",
          category: "ConflictingPropertyType.CONSTRAINTS",
        },
        {
          name: "LENGTH",
          type: "PrimitiveProperty",
          typeName: "int",
          label: "Damper Length",
          category: "ConflictingPropertyType.CONSTRAINTS",
        },
      ],
    },
  },
};
