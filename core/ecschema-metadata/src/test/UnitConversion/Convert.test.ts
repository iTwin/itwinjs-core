/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { almostEqual } from "@itwin/core-quantity";
import { expect } from "chai";
import fs from "fs";
import path from "path";
import { SchemaContext } from "../../Context.js";
import { UnitConverter } from "../../UnitConversion/UnitConverter.js";
import { deserializeXmlSync } from "../TestUtils/DeserializationHelpers.js";

interface TestData {
  from: string;
  input: number;
  to: string;
  expect: number;
}

describe("Unit Conversion tests", () => {
  const tolerance = 1.19209290e-7;
  const context = new SchemaContext();
  const testData: TestData[] = JSON.parse(
    fs.readFileSync(path.join(import.meta.dirname, "..", "assets", "./UnitTests.json"), "utf-8"),
  );

  before(() => {
    const schemaFile = path.join(import.meta.dirname, "..", "..", "..", "..", "node_modules", "@bentley", "units-schema", "Units.ecschema.xml");
    const schemaXml = fs.readFileSync(schemaFile, "utf-8");
    deserializeXmlSync(schemaXml, context);
  });

  async function convertAndVerifyTestData(test: TestData, converter: UnitConverter) {
    const fromFullName = `Units:${test.from}`;
    const toFullName = `Units:${test.to}`;
    const map = await converter.calculateConversion(fromFullName, toFullName);
    const actual = map.evaluate(test.input);
    expect(
      almostEqual(test.expect, actual, tolerance),
      `${test.input} ${test.from} in ${test.to} should be ${test.expect}
       and not ${actual} error = ${Math.abs(test.expect - actual)} > ${tolerance}`,
    ).to.be.true;
  }

  testData.forEach((test: TestData) => {
    it(`should convert ${test.from} to ${test.to}`, async () => {
      const converter = new UnitConverter(context);
      await convertAndVerifyTestData(test, converter);
    });
  });

  it(`should convert units parallel`, async () => {
    const converter = new UnitConverter(context);
    await Promise.all(testData.map(async (test: TestData) => {
      await convertAndVerifyTestData(test, converter);
    }));
  });
});
