/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/naming-convention */

export default {
  $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
  name: "TargetSchema",
  version: "1.0.0",
  alias: "target",

  description: "target description",

  references: [
    {
      name: "EmptySchema",
      version: "01.00.00",
    },
    {
      name: "CustomAttributeSchema",
      version: "01.00.00",
    },
  ],

  items: {
    AreaPhenomenon: {
      schemaItemType: "Phenomenon",
      name: "AREA",
      label: "Area",
      description: "Area description",
      definition: "Units.LENGTH(4)",
    },
    TargetPropertyCategory: {
      schemaItemType:"PropertyCategory",
      label:"Target Schema Category",
      priority: 100000,
    },
    ChangedEnumeration: {
      schemaItemType: "Enumeration",
      type: "string",
      isStrict: true,
      enumerators: [
        {
          name: "EnumeratorOne",
          label: "Enumerator One",
          value: "1",
        },
        {
          name: "EnumeratorTwo",
          value: "2",
        },
      ],
    },
    ChangedEntity: {
      schemaItemType: "EntityClass",
    },
    ChangedBaseClassEntity: {
      schemaItemType: "EntityClass",
      baseClass: "TargetSchema.ChangedEntity",
    },
  },
};
