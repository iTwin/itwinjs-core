/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
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

export function createSchemaXmlWithItems(itemsXml: string | Element, referenceXml?: string | Element): Document {
  const parser = new DOMParser();

  let schemaDoc: Document;
  if (typeof itemsXml === "string") {
    const schemaString = `
    <?xml version="1.0" encoding="utf-8"?>
    <ECSchema schemaName="TestSchema" alias="testschema" version="01.00.00" description="A test schema" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
    ${referenceXml && typeof referenceXml === "string" ? referenceXml : ""}
    ${itemsXml}
    </ECSchema>
    `;

    schemaDoc = parser.parseFromString(schemaString);
    return schemaDoc;
  } else {
    const schemaString = `
    <?xml version="1.0" encoding="utf-8"?>
    <ECSchema schemaName="TestSchema" alias="testschema" version="01.00.00" description="A test schema" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
    ${referenceXml && typeof referenceXml === "string" ? referenceXml : ""}
    </ECSchema>
    `;

    schemaDoc = parser.parseFromString(schemaString);
    if (referenceXml && typeof referenceXml !== "string")
      schemaDoc.getElementsByTagName("ECSchema")[0].appendChild(referenceXml);
    schemaDoc.getElementsByTagName("ECSchema")[0].appendChild(itemsXml);
    return schemaDoc;
  }
}
