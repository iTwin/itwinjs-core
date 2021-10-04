/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as fs from "fs-extra";
import * as path from "path";
import { SchemaXmlFileLocater } from "@itwin/ecschema-locaters";
import { Schema, SchemaContext, SchemaReadHelper, XmlParser } from "@itwin/ecschema-metadata";
import { DOMParser } from "@xmldom/xmldom";
import { ECSchemaToTs } from "../../ecschema2ts";

declare const __dirname: string; // eslint-disable-line @typescript-eslint/naming-convention

export interface PropertyTestCase {
  testName: string;
  referenceXmls: string[];
  schemaXml: string;
  expectedPropsImportTs: RegExp[];
  expectedPropsTs: string[];
}

export interface SchemaTestCase {
  testName: string;
  referenceXmls: string[];
  schemaXml: string;
  expectedSchemaImportTs: RegExp[];
  expectedSchemaTs: string;
  expectedPropsImportTs: RegExp[];
  expectedPropsTs: string[];
  expectedElemImportTs: RegExp[];
  expectedElemTs: string[];
}

export function getAssetsDir(): string {
  return path.normalize(`${__dirname}/../assets/`);
}

export function getOutDir(): string {
  const outputDir = path.normalize(`${__dirname}/../../../lib/test/output/`);
  fs.ensureDirSync(outputDir);
  return outputDir;
}

export function getHeaderString(): string {
  return `/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/\n\n`;
}

export function getTestSchemaString(classString?: string, classPropsString?: string, expectedImportsString?: string): string {
  let returnString = "";
  if (expectedImportsString) returnString += expectedImportsString;
  if (classPropsString) returnString += classPropsString;
  if (classString) returnString += classString;

  return returnString;
}

/**
 * Convert schema xml to Schema object. Work around for Schema.fromXml() not implemented yet
 * TODO: remove it after Schema.fromXml() is implemented. We don't want to export it to client
 * @param context Schema context used to find reference schema
 * @param schemaXml Schema xml string
 */
export function deserializeXml(context: SchemaContext, schemaXml: string) {
  let schema: Schema = new Schema(context);

  const parser = new DOMParser();
  const document = parser.parseFromString(schemaXml);
  const reader = new SchemaReadHelper(XmlParser, context);
  schema = reader.readSchemaSync(schema, document);
  return schema;
}

export function testGeneratedTypescriptProperty(testCases: PropertyTestCase[]): void {
  testCases.forEach((testCase) => {
    it(testCase.testName, () => {
      const schemaLocator = new SchemaXmlFileLocater();
      schemaLocator.addSchemaSearchPath(`${getAssetsDir()}schema3.2`);
      const context = new SchemaContext();
      context.addLocater(schemaLocator);

      for (const referenceXml of testCase.referenceXmls)
        deserializeXml(context, referenceXml);

      const testSchema = deserializeXml(context, testCase.schemaXml);
      const converter = new ECSchemaToTs();
      const result = converter.convertSchemaToTs(testSchema);
      for (const expectedImport of testCase.expectedPropsImportTs)
        expect(result.propsTsString).to.match(expectedImport);

      for (const expectedProp of testCase.expectedPropsTs)
        expect(result.propsTsString).to.have.string(expectedProp);
    });
  });
}

export function testGeneratedSchemaTypescript(testCases: SchemaTestCase[]): void {
  testCases.forEach((testCase) => {
    it(testCase.testName, () => {
      const schemaLocator = new SchemaXmlFileLocater();
      schemaLocator.addSchemaSearchPath(`${getAssetsDir()}schema3.2`);
      const context = new SchemaContext();
      context.addLocater(schemaLocator);

      for (const referenceXml of testCase.referenceXmls)
        deserializeXml(context, referenceXml);

      const testSchema = deserializeXml(context, testCase.schemaXml);
      const converter = new ECSchemaToTs();
      const result = converter.convertSchemaToTs(testSchema);
      for (const expectedImport of testCase.expectedSchemaImportTs)
        expect(result.schemaTsString).to.match(expectedImport);

      expect(result.schemaTsString).to.have.string(testCase.expectedSchemaTs);

      for (const expectedImport of testCase.expectedPropsImportTs)
        expect(result.propsTsString).to.match(expectedImport);

      for (const expectedProp of testCase.expectedPropsTs)
        expect(result.propsTsString).to.have.string(expectedProp);

      for (const expectedImport of testCase.expectedElemImportTs)
        expect(result.elemTsString).to.match(expectedImport);

      for (const expectedElem of testCase.expectedElemTs)
        expect(result.elemTsString).to.have.string(expectedElem);
    });
  });
}

export function createExpectedSchemaTsString(schemaName: string): string {
  const schemaTsString: string =
    `export class ${schemaName} extends Schema {
  public static get schemaName(): string { return "${schemaName}"; }

  public static registerSchema() {
    if (!Schemas.getRegisteredSchema(${schemaName}.name))
      Schemas.registerSchema(${schemaName});
  }\n
  protected constructor() {
    super();
    ClassRegistry.registerModule(elementsModule, ${schemaName});
  }
}`;

  return schemaTsString;
}

export function createExpectedSchemaImportTs(schemaName: string): RegExp[] {
  const importTs: RegExp[] = [
    new RegExp(`import { (?=.*\\b(ClassRegistry)\\b)(?=.*\\b(Schema)\\b)(?=.*\\b(Schemas)\\b).* } from "@itwin/core-backend";`),
    new RegExp(`import \\* as elementsModule from "./${schemaName}Elements";`),
  ];

  return importTs;
}

export function dedent(callSite: TemplateStringsArray | string, ...args: any[]): string {
  function format(str: string) {
    let size = -1;

    return str.replace(/\n(\s+)/g, (_m: string, m1: string) => {
      if (size < 0)
        size = m1.replace(/\t/g, "  ").length;

      if (m1.match(/\n/) && m1.length === 1)
        return _m;

      if (m1.match(/\n/) && m1.length > 1)
        return _m.slice(0, m1.length - size + 1);
      return `\n${m1.slice(Math.min(m1.length, size))}`;
    });
  }

  if (typeof callSite === "string")
    return format(callSite);

  const output = callSite
    .slice(0, args.length + 1)
    .map((text, i) => (i === 0 ? "" : args[i - 1]) + text)
    .join("");

  return format(output);
}
