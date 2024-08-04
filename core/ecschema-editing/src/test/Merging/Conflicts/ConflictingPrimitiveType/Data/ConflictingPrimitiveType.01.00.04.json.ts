/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/naming-convention */

export default {
  $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
  name: "ConflictingPrimitiveType",
  version: "01.00.04",
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
    MEASUREINFO: {
      schemaItemType: "CustomAttributeClass",
      modifier: "Sealed",
      properties: [
        {
          name: "Value",
          type: "PrimitiveProperty",
          typeName: "string",
        },
      ],
      appliesTo: "AnyProperty",
    },
    ARCWALL: {
      label: "Basic Wall",
      schemaItemType: "EntityClass",
      properties: [
        {
          name: "OVERAL_HEIGHT",
          type: "PrimitiveProperty",
          description: "overall height of the wall",
          label: "Overall Wall Height",
          category: "ConflictingPrimitiveType.CONSTRAINTS",
          isReadOnly: true,
          typeName: "double",
          customAttributes: [
            {
              Value: "total square feet of the wall by multiplying ceiling height by total wall length",
              className: "ConflictingPrimitiveType.MEASUREINFO",
            },
          ],
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
          customAttributes: [
            {
              Value: "the distance from end to end of the wall equals the entire length of the wall",
              className: "ConflictingPrimitiveType.MEASUREINFO",
            },
          ],
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
        {
          name: "WALL_LENGTH_TYPE",
          type: "PrimitiveProperty",
          label: "Length Constraint",
          typeName: "string",
        },
      ],
    },
  },
};
