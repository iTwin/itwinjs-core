/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/naming-convention */

export default {
  $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
  name: "ConflictingSchemaItemName",
  version: "01.00.01",
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
    PIPE: {
      schemaItemType: "EntityClass",
      label: "Pipe",
      description: "an artefact which is a long tube intended for conducting liquid, gaseous or finely divided solid material or for structural purposes",
      properties: [{
        name: "LENGTH",
        type: "PrimitiveProperty",
        description: "a straight linear distance between extreme ends",
        label: "End To End Length",
        typeName: "double",
      },
      {
        name: "ROUNDNESS",
        type: "PrimitiveProperty",
        label: "Roundness",
        typeName: "string",
      },
      {
        name: "WEIGHT",
        type: "PrimitiveProperty",
        label: "Weight",
        typeName: "double",
      }],
    },
  },
};
