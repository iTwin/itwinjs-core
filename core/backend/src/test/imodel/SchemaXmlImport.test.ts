/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as fs from "fs";
import * as path from "path";
import { PhysicalElement, SnapshotDb } from "../../core-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import { Logger, LogLevel } from "@itwin/core-bentley";
import { KnownTestLocations } from "../KnownTestLocations";
import { ECSpecVersion, EntityClass, Format } from "@itwin/ecschema-metadata";

describe("Schema XML Import Tests", () => {
  before(() => {
    // initialize logging
    if (false) {
      Logger.initializeToConsole();
      Logger.setLevelDefault(LogLevel.Error);
    }
  });

  it("should import schema XML", async () => {
    const testFileName = IModelTestUtils.prepareOutputFile("SchemaXMLImport", "SchemaXMLImport.bim");
    const imodel = SnapshotDb.createEmpty(testFileName, { rootSubject: { name: "SchemaXMLImportTest" } });

    try {
      const schemaFilePath = path.join(KnownTestLocations.assetsDir, "Test3.ecschema.xml");
      const schemaString = fs.readFileSync(schemaFilePath, "utf8");

      await imodel.importSchemaStrings([schemaString]); // will throw an exception if import fails

      const testDomainClass = await imodel.schemaContext.getSchemaItem("Test3.Test3Element", EntityClass);
      assert.isDefined(testDomainClass);

      assert.isDefined(testDomainClass?.baseClass);

      assert.equal(testDomainClass?.baseClass?.fullName, PhysicalElement.classFullName.replace(":", "."));
    } finally {
      imodel.close();
    }
  });

  it("Schema import for newer ECXml Versions", async () => {
    const testFileName = IModelTestUtils.prepareOutputFile("SchemaXMLImport", "SchemaVersionTest.bim");
    const imodel = SnapshotDb.createEmpty(testFileName, { rootSubject: { name: "SchemaVersionTest" } });

    try {
      const helperFunction = async (imodelDb: SnapshotDb, xmlSchema: string[], importSchema: boolean) => {
        try {
          // ECObjects is expected to throw for schemas that fail to import
          if (importSchema)
            await imodelDb.importSchemaStrings(xmlSchema);
          else
            imodelDb.getSchemaProps(xmlSchema[0]);
        } catch {
          return false;
        }
        return true;
      };

      // Incrementing major ECXml version is not supported
      for (const testCase of [`4.1`, `5.10`]) {
        assert(!(await helperFunction(imodel, [`<ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.${testCase}"/>`], true)), `Schema ${testCase} import should not have succeeded.`);
        assert(!(await helperFunction(imodel, [`TestSchema`], false)), `Schema ${testCase} test should not have succeeded.`);
      }

      // Importing a set of schemas should all fail if any one of them fails
      {
        const schemaXmls = [`<ECSchema schemaName="TestSchema1" alias="ts1" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2"/>`,
          `<ECSchema schemaName="TestSchema2" alias="ts2" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.8"/>`,
          `<ECSchema schemaName="TestSchema3" alias="ts3" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.4.5"/>`];

        assert(!(await helperFunction(imodel, schemaXmls, true)), `Schema import should not have succeeded.`);
        assert(!(await helperFunction(imodel, [`TestSchema1`], false)), `Schema TestSchema1 import should not have succeeded.`);
        assert(!(await helperFunction(imodel, [`TestSchema2`], false)), `Schema TestSchema2 import should not have succeeded.`);
        assert(!(await helperFunction(imodel, [`TestSchema3`], false)), `Schema TestSchema3 import should not have succeeded.`);
      }

      // Schema should be imported successfully
      for (const testCase of [`3.2`, `3.5`]) {
        assert(await helperFunction(imodel, [`<ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.${testCase}"/>`], true), `Schema ${testCase} import should have succeeded.`);
        assert(await helperFunction(imodel, [`TestSchema`], false), `Schema ${testCase} test should have succeeded.`);
      }
    } finally {
      imodel.close();
    }
  });

  it.skip("should roundtrip ratio format properties", async () => {
    // Create a separate iModel for this test
    const testFileName = IModelTestUtils.prepareOutputFile("SchemaXMLImport", "RatioFormatRoundtrip.bim");
    const testIModel = SnapshotDb.createEmpty(testFileName, { rootSubject: { name: "RatioFormatTest" } });

    try {
      const schemaXml = `<?xml version="1.0" encoding="UTF-8"?>
      <ECSchema schemaName="RatioFormatTest" alias="rft" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECSchemaReference name="Units" version="01.00.09" alias="u"/>
        <Format typeName="TestRatioFormat" type="Ratio" ratioType="OneToN" ratioSeparator=":" ratioFormatType="Decimal" precision="4" formatTraits="trailZeroes|showUnitLabel">
          <Composite>
            <Unit>u:M</Unit>
          </Composite>
        </Format>
        <Format typeName="TestRatioFormat2" type="Ratio" ratioType="NToOne" ratioSeparator="=" ratioFormatType="Fractional" precision="8" formatTraits="keepSingleZero">
          <Composite>
            <Unit>u:M</Unit>
          </Composite>
        </Format>
      </ECSchema>`;

      // Import schema into iModel
      await testIModel.importSchemaStrings([schemaXml]);

      // Read back the format from the iModel's schema context
      const format1 = await testIModel.schemaContext.getSchemaItem("RatioFormatTest.TestRatioFormat", Format);
      assert.isDefined(format1);
      assert.strictEqual(format1?.ratioType, "OneToN");
      assert.strictEqual(format1?.ratioSeparator, ":");
      assert.strictEqual(format1?.ratioFormatType, "Decimal");

      const format2 = await testIModel.schemaContext.getSchemaItem("RatioFormatTest.TestRatioFormat2", Format);
      assert.isDefined(format2);
      assert.strictEqual(format2?.ratioType, "NToOne");
      assert.strictEqual(format2?.ratioSeparator, "=");
      assert.strictEqual(format2?.ratioFormatType, "Fractional");
    } finally {
      testIModel.close();
    }
  });
});

describe("exportSchemaXmlString", () => {
  const schemaXml32 = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestSchema" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="1.0.23" alias="bis"/>

      <ECEntityClass typeName="TestClass">
        <BaseClass>bis:GraphicalElement2d</BaseClass>
        <ECProperty propertyName="Name" typeName="string"/>
      </ECEntityClass>
    </ECSchema>`;

  let imodel: SnapshotDb;

  before(async () => {
    const filePath = IModelTestUtils.prepareOutputFile("exportSchemaXmlString", "exportSchemaXmlString.bim");
    imodel = SnapshotDb.createEmpty(filePath, { rootSubject: { name: "exportSchemaXmlStringTest" } });
    await imodel.importSchemaStrings([schemaXml32]);
  });

  after(() => {
    imodel.close();
  });

  it("default ECSpecVersion arg return an 3.2 XML", () => {
    const xml = imodel.exportSchemaXmlString("TestSchema");
    assert.isDefined(xml, "expected a non-undefined result for an existing schema");
    assert.include(xml, "Bentley.ECXML.3.2", "expected EC 3.2 namespace when no version is supplied");
    assert.include(xml, "TestSchema", "schema name should be present in output");
  });

  it("returns undefined for a schema that does not exist", () => {
    const xml = imodel.exportSchemaXmlString("NonExistentSchema");
    assert.isUndefined(xml, "expected undefined for an unknown schema name");
  });

  it("test returned XML contains the entity class", () => {
    const xml = imodel.exportSchemaXmlString("TestSchema");
    assert.isDefined(xml);
    assert.match(xml!, /^<\?xml|^<ECSchema/, "output should start with an XML declaration or root element");
    assert.include(xml, "TestClass", "ECEntityClass 'TestClass' should be present in serialised output");
    assert.include(xml, "Name", "property 'Name' should be present in serialised output");
  });

  it("ECSpecVersion 3.2 version returns 3.2 XML", () => {
    const version: ECSpecVersion = { readVersion: 3, writeVersion: 2 };
    const xml = imodel.exportSchemaXmlString("TestSchema", version);
    assert.isDefined(xml);
    assert.include(xml, "Bentley.ECXML.3.2");
    assert.include(xml, "TestSchema");
  });

  it("ECSpecVersion 3.1 version returns 3.1 XML", () => {
    const version: ECSpecVersion = { readVersion: 3, writeVersion: 1 };
    const xml = imodel.exportSchemaXmlString("TestSchema", version);
    assert.isDefined(xml);
    assert.include(xml, "Bentley.ECXML.3.1", "expected EC 3.1 namespace");
    assert.notInclude(xml, "Bentley.ECXML.3.2", "should not contain 3.2 namespace when requesting 3.1");
  });

  it("ECSpecVersion 3.0 version returns 3.0 XML", () => {
    const version: ECSpecVersion = { readVersion: 3, writeVersion: 0 };
    const xml = imodel.exportSchemaXmlString("TestSchema", version);
    assert.isDefined(xml);
    assert.include(xml, "Bentley.ECXML.3.0", "expected EC 3.0 namespace");
    assert.notInclude(xml, "Bentley.ECXML.3.2", "should not contain 3.2 namespace when requesting 3.0");
  });

  it("ECSpecVersion 2.0 version returns 2.0 XML", () => {
    const version: ECSpecVersion = { readVersion: 2, writeVersion: 0 };
    const xml = imodel.exportSchemaXmlString("TestSchema", version);
    assert.isDefined(xml, "expected a result for EC 2.0 export");
    assert.notInclude(xml, "Bentley.ECXML.3.", "EC 2.0 output should not contain an EC 3.x namespace URI");
  });
});
