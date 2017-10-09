/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import * as Ajv from "ajv";
import { assert } from "chai";
import * as fs from "fs-extra";
import * as utils from "./utils";

function getECClassJsonSchema(): any {
  const classSchema = require(utils.getSpecDir() + "ecschema-child.schema.json");
  return classSchema;
}

function getECSchemaJsonSchema(): any {
  const classSchema = require(utils.getSpecDir() + "ecschema.schema.json");
  return classSchema;
}

const reportingOptions = {
  allErrors: true,
};

describe("Validate ECMetadataJson Specs against draft-06 spec", () => {
  let ajv: Ajv.Ajv;

  beforeEach(() => {
    // Setup a new instance of the Ajv object with some options for validation.
    ajv = Ajv(reportingOptions);
  });

  it("schema spec", () => {
    ajv.addMetaSchema(getECClassJsonSchema());
    const result = ajv.compile(getECSchemaJsonSchema());
    if (!result)
      assert.isTrue(result, ajv.errorsText());
  });

  it("class spec", () => {
    const result = ajv.compile(getECClassJsonSchema());
    if (!result)
      assert.isTrue(result, ajv.errorsText());
  });
});

interface TestDataInterface {
  description: string;
  valid: boolean;
  data: object;
}

function instanceOfTestData(object: any): object is TestDataInterface {
  return "description" in object && "valid" in object && "data" in object;
}

describe("Class spec test", () => {
  let ajv: Ajv.Ajv;

  const classSpecAssetsDir = "./spectests/assets/class/";

  before(() => {
    ajv = new Ajv();
    ajv.compile(getECClassJsonSchema());
    ajv.compile(getECSchemaJsonSchema());
  });

  const filesName = fs.readdirSync(classSpecAssetsDir);

  function testRun(testData: TestDataInterface) {
    it(testData.description, () => {
      assert.isDefined(testData.data);
      const result = ajv.validate("https://dev.bentley.com/json_schemas/ec/31/draft-01/schemachild", testData.data);
      if (testData.valid)
        assert.isTrue(result, ajv.errorsText());
      else
        assert.isFalse(result);
    });
  }

  filesName.forEach((testFile: string) => {
    if (testFile === "." || testFile === "..")
      return; // Skipping

    const testData = fs.readJsonSync(classSpecAssetsDir + testFile);

    if (Array.isArray(testData)) {
      testData.forEach((arrayMember) => {
        if (!instanceOfTestData(arrayMember))
          return;

        testRun(arrayMember);
      });
    } else if (instanceOfTestData(testData)) {
      testRun(testData);
    }
  });
});

describe("Schema spec test", () => {
  let ajv: Ajv.Ajv;

  const schemaSpecTestAssetsDir = "./spectests/assets/schema/";

  before(() => {
    ajv = new Ajv();
    ajv.compile(getECClassJsonSchema());
    ajv.compile(getECSchemaJsonSchema());
  });

  const filesName = fs.readdirSync(schemaSpecTestAssetsDir);

  function testRun(testData: TestDataInterface) {
    it(testData.description, () => {
      assert.isDefined(testData.data);
      const result = ajv.validate("https://dev.bentley.com/json_schemas/ec/31/draft-01/ecschema", testData.data);
      if (testData.valid)
        assert.isTrue(result, ajv.errorsText());
      else
        assert.isFalse(result);
    });
  }

  filesName.forEach((testFile: string) => {
    if (testFile === "." || testFile === "..")
      return; // Skipping

    const testData = fs.readJsonSync(schemaSpecTestAssetsDir + testFile);

    if (Array.isArray(testData)) {
      testData.forEach((arrayMember) => {
        if (!instanceOfTestData(arrayMember))
          return;

        testRun(arrayMember);
      });
    } else if (instanceOfTestData(testData)) {
      testRun(testData);
    }
  });
});
