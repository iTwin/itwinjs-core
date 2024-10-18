/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable @typescript-eslint/naming-convention */

export default {
  $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
  name: "ConflictingSchemaItemName",
  version: "01.00.04",
  alias: "c_001",
  label: "Conflicting Schema Item Name",
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
    EXECUTION_STATUS: {
      schemaItemType: "CustomAttributeClass",
      modifier: "Sealed",
      properties: [{
        name: "INSTALLED_TIMESTAMP",
        type: "PrimitiveProperty",
        label: "Installed Timestamp",
        priority: 87,
        typeName: "dateTime",
      },
	  {
        name: "CORROSION_LEVEL",
        type: "PrimitiveProperty",
        label: "Corrosion level",
        priority: 56,
        typeName: "string",
      }],
      appliesTo: "AnyClass",
    },
    OPERATING_CONDITIONS: {
      schemaItemType: "PropertyCategory",
      label: "Operating Conditions",
      description: "Operating Condition Properties",
      priority: 101,
    },
    WALL_PIPE: {
      schemaItemType: "EntityClass",
      label: "Wall Pipe",
      description: "pipe with radial fin which sits in the concret wall",
      baseClass: "ConflictingSchemaItemName.PIPE",
      properties: [{
        name: "MIN_LENGTH",
        type: "PrimitiveProperty",
        description: "minimum pipe length for variable length wall/puddle pipes",
        label: "Min Pipe Length",
        typeName: "double",
      },
      {
        name: "MAX_LENGTH",
        type: "PrimitiveProperty",
        description: "maximum pipe length for variable length wall/puddle pipes",
        label: "Max Pipe Length",
        typeName: "double",
      }],
      customAttributes: [
        {
          Corrosion_level: "C2",
          className: "ConflictingSchemaItemName.EXECUTION_STATUS",
        },
      ],
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
        minValue: 1,
        typeName: "double",
      },
      {
        name: "ROUNDNESS",
        description: "an amount of surface roughness that exists inside the pipe",
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
        maxValue: 1000,
        typeName: "double",
      },
      {
        name: "DIRECTION",
        type: "PrimitiveProperty",
        label: "Flow Direction",
        category: "ConflictingSchemaItemName.OPERATING_CONDITIONS",
        typeName: "string",
      },
      {
        name: "MATERIAL_MARK",
        type: "PrimitiveProperty",
        label: "Material Mark",
        category: "ConflictingSchemaItemName.OPERATING_CONDITIONS",
        isReadOnly: true,
        typeName: "string",
      }],
      customAttributes: [
        {
          Corrosion_level: "C1",
          className: "ConflictingSchemaItemName.EXECUTION_STATUS",
        },
      ],
    },
  },
};
