/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs-extra";
import * as path from "path";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { Schema } from "@itwin/ecschema-metadata";

/** @packageDocumentation
 * @module Utils
 */

/**
 * Utility class to assist in creating serialized EC Schemas on the file system.
 * @beta
 */
export class SchemaFileUtility {

  /**
   * Writes a Schema to an xml file to the specified output path.
   * @param schema The Schema to serialize.
   * @param outputPath The directory in which to create the file.
   */
  public static async writeSchemaXmlFile(schema: Schema, outputPath: string) {
    let xmlDoc = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>`, "application/xml");
    const baseFile = this.getSchemaPath(schema, outputPath);

    xmlDoc = await schema.toXml(xmlDoc);
    const serializer = new XMLSerializer();
    const xml = serializer.serializeToString(xmlDoc);

    try {
      fs.writeFileSync(baseFile, xml);
    } catch (err: any) {
      const msg = `An error occurred writing to file '${baseFile}': ${err.message}`;
      throw new Error(msg);
    }
  }

  private static getSchemaPath(schema: Schema, outputPath: string): string {
    const realDir = path.normalize(outputPath);
    const test = fs.pathExistsSync(realDir);
    if (!test) {
      const msg = `The output directory '${realDir}' does not exist.`;
      throw new Error(msg);
    }

    return path.resolve(realDir, `${schema.name}.ecschema.xml`);
  }
}
