/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Schema, SchemaContext, SchemaReadHelper, XmlParser } from "../../src/ecschema-metadata";
import { DOMParser } from "xmldom";

export function deserializeXml(
  context: SchemaContext,
  schemaXml: string
): Schema {
  let schema: Schema = new Schema(context);
  const parser = new DOMParser();
  const document = parser.parseFromString(schemaXml, "application/xml");
  const reader = new SchemaReadHelper(XmlParser, context);
  schema = reader.readSchemaSync(schema, document);
  return schema;
}
