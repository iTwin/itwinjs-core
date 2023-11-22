/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

import * as fs from "fs-extra";
import * as path from "path";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { Schema } from "@itwin/ecschema-metadata";

/**
 * Utility class to assist in creating serialized EC Schemas on the file system.
 * @beta
 */
export namespace SchemaXml {

  /**
   * Writes a Schema to an xml file to the specified output path.
   * @param schema The Schema to serialize.
   * @param outputPath The directory in which to create the file.
   */
  export async function writeFile(schema: Schema, outputPath: string) {
    const xml = await writeString(schema);

    const baseFile = getSchemaPath(schema, outputPath);
    try {
      await fs.writeFile(baseFile, xml);
    } catch (err: any) {
      const msg = `An error occurred writing to file '${baseFile}': ${err.message}`;
      throw new Error(msg);
    }
  }

  /**
   * Writes a Schema to an xml string.
   * @param schema The Schema to serialize.
   */
  export async function writeString(schema: Schema): Promise<string> {
    let xmlDoc = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>`, "application/xml");

    xmlDoc = await schema.toXml(xmlDoc);
    const serializer = new XMLSerializer();
    return serializer.serializeToString(xmlDoc);
  }

  function getSchemaPath(schema: Schema, outputPath: string): string {
    const realDir = path.normalize(outputPath);
    const test = fs.pathExistsSync(realDir);
    if (!test) {
      const msg = `The output directory '${realDir}' does not exist.`;
      throw new Error(msg);
    }

    return path.resolve(realDir, `${schema.name}.ecschema.xml`);
  }
}
