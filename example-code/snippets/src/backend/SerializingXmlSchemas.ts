/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// __PUBLISH_EXTRACT_START__ Serialize_Schema_To_XML_Imports
import * as fs from "fs-extra"; // file system api
import { DOMParser, XMLSerializer } from "@xmldom/xmldom"; // XML support
import { SchemaContext } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "@itwin/ecschema-editing"; // For creating a small sample Schema for this tutorial
// __PUBLISH_EXTRACT_END__

export class SchemaXmlSerializer {

  public async serializeSchemaToXmlSample() {
    // __PUBLISH_EXTRACT_START__ Serialize_Schema_To_XML_Create
    const context = new SchemaContext();
    const editor = new SchemaContextEditor(context);
    const results = await editor.createSchema("sampleSchema", "sampleAlias", 1, 0, 0);
    const sampleSchema = await editor.getSchema(results.schemaKey!);
    // __PUBLISH_EXTRACT_END__

    // __PUBLISH_EXTRACT_START__ Serialize_Schema_To_XML
    let xmlDoc = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>`, "application/xml");
    xmlDoc = await sampleSchema!.toXml(xmlDoc);
    const serializer = new XMLSerializer();
    const xml = serializer.serializeToString(xmlDoc);
    // __PUBLISH_EXTRACT_END__

    // __PUBLISH_EXTRACT_START__ Serialize_Schema_To_XML_Write
    fs.writeFileSync("c:\\sample\\path\\to\\file", xml);
    // __PUBLISH_EXTRACT_END__
  }
}
