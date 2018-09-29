/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

export function createSchemaJsonWithItems(itemsJson: any, referenceJson?: any): any {
  return {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/draft-01/ecschema",
    name: "TestSchema",
    version: "1.2.3",
    items: {
      ...itemsJson,
    },
    ...referenceJson,
  };
}
