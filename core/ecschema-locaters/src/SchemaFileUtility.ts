/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs-extra";
import * as path from "path";
import { Schema } from "@itwin/ecschema-metadata";

export class SchemaFileUtility {

  public static async writeSchemaXmlFile(schema: Schema, outputPath: string) {
    let xmlDoc = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>`, "application/xml");
    const baseFile = this.getSchemaPath(schema, outputPath);

    try {
      xmlDoc = await schema.toXml(xmlDoc);
    } catch (err: any) {
      const msg = `An error occurred serializing schema '${schema.fullName}': ${err.message}`;
      throw new Error(msg);
    }

    const serializer = new XMLSerializer();
    const xml = serializer.serializeToString(xmlDoc);
    try {
      await fs.writeFile(baseFile, xml);
    } catch (err: any) {
      const msg = `An error occurred writing to file '${baseFile}': ${err.message}`;
      throw new Error(msg);
    }
  }

  private static getSchemaPath(schema: Schema, outputPath: string): string {
    const realDir = path.normalize(outputPath) + path.sep;
    const test = fs.pathExistsSync(realDir);
    if (!test) {
      const msg = `The output directory '${realDir}' does not exist.`;
      throw new Error(msg);
    }

    return path.resolve(realDir, `${schema.name}.ecschema.xml`);
  }
}
