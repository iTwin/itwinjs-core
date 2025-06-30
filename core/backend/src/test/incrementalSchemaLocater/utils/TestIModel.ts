
import { DbResult } from "@itwin/core-bentley";
import { Schema, SchemaKey } from "@itwin/ecschema-metadata";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import * as path from "path";
import * as fs from "fs";
import { BriefcaseDb } from "../../../IModelDb";
import { IModelHost } from "../../../IModelHost";

export class TestIModel {
  private _iModel: BriefcaseDb | undefined;
  public get iModel(): BriefcaseDb {
    if(this._iModel === undefined)
      throw new Error("iModel not loaded");
    return this._iModel;
  }

  public get isLoaded(): boolean {
    return this._iModel !== undefined;
  }

  public get name(): string {
    return this.iModel.name;
  }

  public get schemaNames(): string[] {
    const result = new Array<string>();
    const sqlQuery = "SELECT Name, VersionMajor, VersionWrite, VersionMinor FROM meta.ECSchemaDef ORDER BY Name";
    this.iModel.withPreparedStatement(sqlQuery, (stmt) => {
      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        const name = stmt.getValue(0).getString();
        const versionMajor = stmt.getValue(1).getInteger();
        const versionWrite = stmt.getValue(2).getInteger();
        const versionMinor = stmt.getValue(3).getInteger();

        result.push(`${name}.${versionMajor}.${versionWrite}.${versionMinor}`);
      }
    });
    return result;
  }

  public async load(pathToBriefcase: string): Promise<void> {
    if(this._iModel !== undefined)
      throw new Error("iModel already loaded");

    if(!IModelHost.isValid) {
      await IModelHost.startup();
    }
    this._iModel = await BriefcaseDb.open({
      fileName: pathToBriefcase,
      readonly: true,
      key: "test-iModel",
    });
  }

  public async close(): Promise<void> {
    if(this._iModel !== undefined) {
      await IModelHost.shutdown();
    }
  }

  public async writeSchemaToFile (schemaName: string) {
      const schemaFullName = this.schemaNames.find((name) => name.startsWith(schemaName));
      if (schemaFullName === undefined) {
        throw new Error(`Test schema '${schemaName}' not found`);
      }
      const schemaKey = SchemaKey.parseString(schemaFullName);
      const schema = await this.iModel.schemaContext.getSchema(schemaKey) as Schema;
      const schemaXml = await this.getSchemaString(schema);
      const file = path.join(__dirname, "../../../test_results", `${schema.name}.ecschema.xml`);
      if (fs.existsSync(file))
        fs.rmSync(file);

      fs.writeFileSync(file, schemaXml);
    }

  private async getSchemaString(schema: Schema): Promise<string> {
    // Serialize schema to the document object
    let doc = new DOMParser().parseFromString(`<?xml version="1.0" encoding="UTF-8"?>`, "application/xml");
    doc = await schema.toXml(doc);

    const serializer = new XMLSerializer();
    const xml = serializer.serializeToString(doc);

    return xml;
  }
};