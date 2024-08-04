/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/naming-convention */

export default {
  $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
  name: "ConflictingSchemaItemName",
  version: "01.00.02",
  alias: "c_001",
  label: "Conflicting Schema Item Name",
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
    OPERATING_CONDITIONS: {
      schemaItemType: "PropertyCategory",
      label: "Operating Conditions",
      description: "Operating Condition Properties",
      priority: 101,
    },
    PIPE: {
      schemaItemType: "EntityClass",
      label: "Pipe",
      description: "an artefact which is a long tube intended for conducting liquid, gaseous or finely divided solid material or for structural purposes",
      properties: [{
        name: "LENGTH",
        type: "PrimitiveProperty",
        description: "a straight linear distance between extreme ends",
        label: "End To End Length",
        category: "ConflictingSchemaItemName.OPERATING_CONDITIONS",
        typeName: "double",
      },
      {
        name: "ROUNDNESS",
        type: "PrimitiveProperty",
        label: "Roundness",
        category: "ConflictingSchemaItemName.OPERATING_CONDITIONS",
        typeName: "string",
      },
      {
        name: "WEIGHT",
        type: "PrimitiveProperty",
        label: "Weight",
        category: "ConflictingSchemaItemName.OPERATING_CONDITIONS",
        typeName: "double",
      },
      {
        name: "DIRECTION",
        type: "PrimitiveProperty",
        label: "Direction",
        category: "ConflictingSchemaItemName.OPERATING_CONDITIONS",
        typeName: "string",
      }],
    },
  },
};
