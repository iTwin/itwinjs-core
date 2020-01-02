/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { ECSchemaToTsXmlWriter } from "../ecschema2ts_io";
import { assert } from "chai";
import * as fs from "fs-extra";
import * as path from "path";
import * as utils from "./utilities/utils";
import { SchemaContext } from "@bentley/ecschema-metadata";

const assetDir: string = utils.getAssetsDir();
const ec32ReferenceDir: string = path.join(assetDir, "schema3.2");
const ec3132ReferenceDir: string = path.join(assetDir, "schema3.1_3.2");

function cleanGeneratedTsFile(outputDir: string, schemaName: string) {
  fs.removeSync(path.join(outputDir, `${schemaName}.ts`));
  fs.removeSync(path.join(outputDir, `${schemaName}Elements.ts`));
  fs.removeSync(path.join(outputDir, `${schemaName}ElementProps.ts`));
}

async function testFileConverterFailure(context: SchemaContext, schemaFileName: string, outputDir: string, referenceDir: string[]): Promise<void> {
  const writer = new ECSchemaToTsXmlWriter(outputDir);
  await writer.convertSchemaFile(context, schemaFileName, referenceDir)
    .then(() => {
      assert.fail();
    })
    .catch((err) => {
      assert.isTrue(err instanceof Error);
    });
}

function testFileConverterFailureSync(context: SchemaContext, schemaFileName: string, outputDir: string, referenceDir: string[]): void {
  const writer = new ECSchemaToTsXmlWriter(outputDir);
  assert.throw(() => writer.convertSchemaFileSync(context, schemaFileName, referenceDir));
}

async function testFileConverterSuccess(context: SchemaContext, schemaFileName: string, schemaName: string, outputDir: string, referenceDir: string[]): Promise<void> {
  const writer = new ECSchemaToTsXmlWriter(outputDir);
  await writer.convertSchemaFile(context, schemaFileName, referenceDir);
  assert.isTrue(fs.existsSync(path.join(outputDir, `${schemaName}.ts`)));
  assert.isTrue(fs.existsSync(path.join(outputDir, `${schemaName}Elements.ts`)));
  assert.isTrue(fs.existsSync(path.join(outputDir, `${schemaName}ElementProps.ts`)));
}

function testFileConverterSuccessSync(context: SchemaContext, schemaFileName: string, schemaName: string, outputDir: string, referenceDir: string[]): void {
  const writer = new ECSchemaToTsXmlWriter(outputDir);
  writer.convertSchemaFileSync(context, schemaFileName, referenceDir);
  assert.isTrue(fs.existsSync(path.join(outputDir, `${schemaName}.ts`)));
  assert.isTrue(fs.existsSync(path.join(outputDir, `${schemaName}Elements.ts`)));
  assert.isTrue(fs.existsSync(path.join(outputDir, `${schemaName}ElementProps.ts`)));
}

describe("Convert from ECSchema xml file to typescript string", () => {
  describe("async", () => {
    it("Expect failure with bad schema path",  async () => {
      const context = new SchemaContext();
      const badSchemaPath = "bad/path";
      const badSchemaOutputPath = "bad";
      await testFileConverterFailure(context, badSchemaPath, badSchemaOutputPath, [ec32ReferenceDir]);
    });
  });

  describe("sync", () => {
    it("Expect failure with bad schema path",  () => {
      const context = new SchemaContext();
      const badSchemaPath = "bad/path";
      const badSchemaOutputPath = "bad";
      testFileConverterFailureSync(context, badSchemaPath, badSchemaOutputPath, [ec32ReferenceDir]);
    });
  });
});

describe("Convert from ECSchema xml file to typescript file", () => {
  describe("async", () => {
    it("Success 3.2 Schema File Tests", async () => {
      const outDir = path.join(utils.getOutDir(), "schema3.2", "async");
      fs.ensureDirSync(outDir);

      let schemaFilePath = path.join(assetDir, "BasicTest.01.00.00.ecschema.xml");
      cleanGeneratedTsFile(outDir, "BasicTest");
      await testFileConverterSuccess(new SchemaContext(), schemaFilePath, "BasicTest", outDir, [ec32ReferenceDir]);

      schemaFilePath = path.join(assetDir, "schema3.2", "ComprehensiveSchema.01.00.00.ecschema.xml");
      cleanGeneratedTsFile(outDir, "ComprehensiveSchema");
      await testFileConverterSuccess(new SchemaContext(), schemaFilePath, "ComprehensiveSchema", outDir, [ec32ReferenceDir]);

      schemaFilePath = path.join(assetDir, "schema3.2", "Units.01.00.00.ecschema.xml");
      cleanGeneratedTsFile(outDir, "Units");
      await testFileConverterSuccess(new SchemaContext(), schemaFilePath, "Units", outDir, [ec32ReferenceDir]);

      schemaFilePath = path.join(assetDir, "schema3.2", "Formats.01.00.00.ecschema.xml");
      cleanGeneratedTsFile(outDir, "Formats");
      await testFileConverterSuccess(new SchemaContext(), schemaFilePath, "Formats", outDir, [ec32ReferenceDir]);

      schemaFilePath = path.join(assetDir, "schema3.2", "BisCore.01.00.00.ecschema.xml");
      cleanGeneratedTsFile(outDir, "BisCore");
      await testFileConverterSuccess(new SchemaContext(), schemaFilePath, "BisCore", outDir, [ec32ReferenceDir]);
    });

    it("Success 3.1 and 3.2 Schema File Tests", async () => {
      const outDir = path.join(utils.getOutDir(), "schema3.1_3.2", "async");
      fs.ensureDirSync(outDir);

      let schemaFilePath = path.join(assetDir, "schema3.1_3.2", "ComprehensiveSchema.01.00.00.ecschema.xml");
      cleanGeneratedTsFile(outDir, "ComprehensiveSchema");
      await testFileConverterSuccess(new SchemaContext(), schemaFilePath, "ComprehensiveSchema", outDir, [ec3132ReferenceDir]);

      schemaFilePath = path.join(assetDir, "schema3.1_3.2", "Units.01.00.00.ecschema.xml");
      cleanGeneratedTsFile(outDir, "Units");
      await testFileConverterSuccess(new SchemaContext(), schemaFilePath, "Units", outDir, [ec3132ReferenceDir]);

      schemaFilePath = path.join(assetDir, "schema3.1_3.2", "Formats.01.00.00.ecschema.xml");
      cleanGeneratedTsFile(outDir, "Formats");
      await testFileConverterSuccess(new SchemaContext(), schemaFilePath, "Formats", outDir, [ec3132ReferenceDir]);

      schemaFilePath = path.join(assetDir, "schema3.1_3.2", "BisCore.01.00.00.ecschema.xml");
      cleanGeneratedTsFile(outDir, "BisCore");
      await testFileConverterSuccess(new SchemaContext(), schemaFilePath, "BisCore", outDir, [ec3132ReferenceDir]);
    });

    it("Test failure when empty schema path", async () => {
      await testFileConverterFailure(new SchemaContext(), "", utils.getOutDir(), [ec32ReferenceDir]);
    });

    it("Test failure when bad schema path", async () => {
      await testFileConverterFailure(new SchemaContext(), path.join("bad", "path"), utils.getOutDir(), [ec32ReferenceDir]);
    });

    it("Failure with non-existent out directory", async () => {
      const schemaFilePath = path.join(assetDir, "BasicTest.01.00.00.ecschema.xml");
      await testFileConverterFailure(new SchemaContext(), schemaFilePath, path.join("bad", "path"), [ec32ReferenceDir]);
    });

    it("success without trailing slash on out directory", async () => {
      const schemaFilePath = path.join(assetDir, "BasicTest.01.00.00.ecschema.xml");
      let outdir = utils.getOutDir() + "async/";
      fs.ensureDirSync(outdir);
      outdir = outdir.slice(0, outdir.length - 1);
      cleanGeneratedTsFile(assetDir, "BasicTest");
      await testFileConverterSuccess(new SchemaContext(), schemaFilePath, "BasicTest", outdir, [ec32ReferenceDir]);
    });
  });

  describe("sync", () => {
    it("Success 3.2 Schema File Tests", () => {
      const outDir = path.join(utils.getOutDir(), "schema3.2", "sync");
      fs.ensureDirSync(outDir);

      let schemaFilePath = path.join(assetDir, "BasicTest.01.00.00.ecschema.xml");
      cleanGeneratedTsFile(outDir, "BasicTest");
      testFileConverterSuccessSync(new SchemaContext(), schemaFilePath, "BasicTest", outDir, [ec32ReferenceDir]);

      schemaFilePath = path.join(assetDir, "schema3.2", "ComprehensiveSchema.01.00.00.ecschema.xml");
      cleanGeneratedTsFile(outDir, "ComprehensiveSchema");
      testFileConverterSuccessSync(new SchemaContext(), schemaFilePath, "ComprehensiveSchema", outDir, [ec32ReferenceDir]);

      schemaFilePath = path.join(assetDir, "schema3.2", "Units.01.00.00.ecschema.xml");
      cleanGeneratedTsFile(outDir, "Units");
      testFileConverterSuccessSync(new SchemaContext(), schemaFilePath, "Units", outDir, [ec32ReferenceDir]);

      schemaFilePath = path.join(assetDir, "schema3.2", "Formats.01.00.00.ecschema.xml");
      cleanGeneratedTsFile(outDir, "Formats");
      testFileConverterSuccessSync(new SchemaContext(), schemaFilePath, "Formats", outDir, [ec32ReferenceDir]);

      schemaFilePath = path.join(assetDir, "schema3.2", "BisCore.01.00.00.ecschema.xml");
      cleanGeneratedTsFile(outDir, "BisCore");
      testFileConverterSuccessSync(new SchemaContext(), schemaFilePath, "BisCore", outDir, [ec32ReferenceDir]);
    });

    it("Success 3.1 and 3.2 Schema File Tests", () => {
      const outDir = path.join(utils.getOutDir(), "schema3.1_3.2", "sync");
      fs.ensureDirSync(outDir);

      let schemaFilePath = path.join(assetDir, "schema3.1_3.2", "ComprehensiveSchema.01.00.00.ecschema.xml");
      cleanGeneratedTsFile(outDir, "ComprehensiveSchema");
      testFileConverterSuccessSync(new SchemaContext(), schemaFilePath, "ComprehensiveSchema", outDir, [ec3132ReferenceDir]);

      schemaFilePath = path.join(assetDir, "schema3.1_3.2", "Units.01.00.00.ecschema.xml");
      cleanGeneratedTsFile(outDir, "Units");
      testFileConverterSuccessSync(new SchemaContext(), schemaFilePath, "Units", outDir, [ec3132ReferenceDir]);

      schemaFilePath = path.join(assetDir, "schema3.1_3.2", "Formats.01.00.00.ecschema.xml");
      cleanGeneratedTsFile(outDir, "Formats");
      testFileConverterSuccessSync(new SchemaContext(), schemaFilePath, "Formats", outDir, [ec3132ReferenceDir]);

      schemaFilePath = path.join(assetDir, "schema3.1_3.2", "BisCore.01.00.00.ecschema.xml");
      cleanGeneratedTsFile(outDir, "BisCore");
      testFileConverterSuccessSync(new SchemaContext(), schemaFilePath, "BisCore", outDir, [ec3132ReferenceDir]);
    });

    it("Test failure when empty schema path", () => {
      testFileConverterFailureSync(new SchemaContext(), "", utils.getOutDir(), [ec32ReferenceDir]);
    });

    it("Test failure when bad schema path", () => {
      testFileConverterFailureSync(new SchemaContext(), path.join("bad", "path"), utils.getOutDir(), [ec32ReferenceDir]);
    });

    it("Failure with non-existent out directory", () => {
      const schemaFilePath = path.join(assetDir, "BasicTest.01.00.00.ecschema.xml");
      testFileConverterFailureSync(new SchemaContext(), schemaFilePath, path.join("bad", "path"), [ec32ReferenceDir]);
    });

    it("success without trailing slash on out directory", () => {
      const schemaFilePath = path.join(assetDir, "BasicTest.01.00.00.ecschema.xml");
      let outdir = utils.getOutDir() + "sync/";
      fs.ensureDirSync(outdir);
      outdir = outdir.slice(0, outdir.length - 1);
      cleanGeneratedTsFile(assetDir, "BasicTest");
      testFileConverterSuccessSync(new SchemaContext(), schemaFilePath, "BasicTest", outdir, [ec32ReferenceDir]);
    });
  });
});
