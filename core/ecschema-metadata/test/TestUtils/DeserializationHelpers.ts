/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

export function createSchemaJsonWithItems(itemsJson: any, useEC32: boolean = false, referenceJson?: any): any {
  let schemaUri;
  if (useEC32)
    schemaUri = "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema";
  else
    schemaUri = "https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema";

  return {
    $schema: schemaUri,
    name: "TestSchema",
    version: "1.2.3",
    items: {
      ...itemsJson,
    },
    ...referenceJson,
  };
}
