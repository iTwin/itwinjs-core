/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/naming-convention */

export default {
  $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
  name: "ConflictingSchemaItemName",
  version: "01.00.00",
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
      schemaItemType: "StructClass",
      label: "Pipe",
      description: "an artefact which is a long tube intended for conducting liquid, gaseous or finely divided solid material or for structural purposes",
      properties: [{
        name: "INSIDE_DIAMETER_RANGE",
        type: "PrimitiveProperty",
        label: "Inside Diameter Range",
        typeName: "double",
      },
      {
        name: "NOMINAL_INSIDE_DIAMETER",
        type: "PrimitiveProperty",
        label: "Nominal Inside Diameter",
        typeName: "double",
      },
      {
        name: "NOMINAL_OUTSIDE_DIAMETER",
        type: "PrimitiveProperty",
        label: "Nominal Outside Diameter",
        typeName: "double",
      },
      {
        name: "OUTSIDE_DIAMETER_RANGE",
        type: "PrimitiveProperty",
        label: "Outside Diameter Range",
        typeName: "double",
      }],
    },
  },
};
