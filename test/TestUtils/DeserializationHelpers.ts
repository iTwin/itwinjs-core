/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

export function createSchemaJsonWithItems(itemsJson: any, useEC32: boolean = false): any {
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
  };
}
