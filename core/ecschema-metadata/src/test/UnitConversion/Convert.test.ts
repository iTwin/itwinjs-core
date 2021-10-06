/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as almostEqual from "almost-equal";
import * as fs from "fs";
import * as path from "path";
import { expect } from "chai";
import { SchemaContext } from "../../Context";
import { deserializeXmlSync } from "../TestUtils/DeserializationHelpers";
import { UnitConverter } from "../../UnitConversion/UnitConverter";

interface TestData {
  from: string;
  input: number;
  to: string;
  expect: number;
}

describe("Unit Conversion tests", () => {
  const context = new SchemaContext();

  const testData: TestData[] = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "assets", "./UnitTests.json"), "utf-8")
  );

  before(() => {
    const schemaFile = path.join(__dirname, "..", "..", "..", "..", "node_modules", "@bentley", "units-schema", "Units.ecschema.xml");
    const schemaXml = fs.readFileSync(schemaFile, "utf-8");
    deserializeXmlSync(schemaXml, context);
  });

  testData.forEach((test: TestData) => {
    it(`should convert ${test.from} to ${test.to}`, async () => {
      const converter = new UnitConverter(context);
      const fromFullName = `Units:${test.from}`;
      const toFullName = `Units:${test.to}`;
      const map = await converter.calculateConversion(fromFullName, toFullName);
      const actual = map.evaluate(test.input);
      expect(
        almostEqual(test.expect, actual, almostEqual.FLT_EPSILON, almostEqual.FLT_EPSILON),
        `${test.input} ${test.from} in ${test.to} should be ${test.expect}
         and not ${actual} error = ${Math.abs(test.expect - actual)} > ${almostEqual.FLT_EPSILON}`
      ).to.be.true;
    });
  });
});
