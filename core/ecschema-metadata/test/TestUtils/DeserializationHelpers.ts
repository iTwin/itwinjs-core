/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { DOMParser } from "xmldom";

export function createSchemaJsonWithItems(itemsJson: any, referenceJson?: any): any {
  return {
    $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
    name: "TestSchema",
    version: "1.2.3",
    items: {
      ...itemsJson,
    },
    ...referenceJson,
  };
}

export function createSchemaXmlWithItems(itemsXml: string | Element, ec32: boolean = false): Document {
  const parser = new DOMParser();

  const ecVersion = ec32 ? "3.2" : "3.1";

  let schemaDoc: Document;
  if (typeof itemsXml === "string") {
    const schemaString = `<?xml version="1.0" encoding="utf-8"?>
      <ECSchema schemaName="TestSchema" alias="testschema" version="01.00.00" description="A test schema" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.${ecVersion}">
        ${itemsXml}
      </ECSchema>`;

    schemaDoc = parser.parseFromString(schemaString);
  } else {
    const schemaString = `<?xml version="1.0" encoding="utf-8"?>
      <ECSchema schemaName="TestSchema" alias="testschema" version="01.00.00" description="A test schema" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.${ecVersion}">
      </ECSchema>`;
    schemaDoc = parser.parseFromString(schemaString);
    schemaDoc.getElementsByTagName("ECSchema")[0].appendChild(itemsXml);
  }
  return schemaDoc;
}
