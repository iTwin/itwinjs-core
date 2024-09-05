/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
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

/**
 * Checks if two numbers are approximately equal within a given tolerance.
 * @param a - The first number to compare.
 * @param b - The second number to compare.
 * @param epsilon - The tolerance within which the numbers are considered equal.
 * @returns True if the numbers are approximately equal, false otherwise.
 */
function almostEqual(a: number, b: number, epsilon: number = 1.19209290e-7): boolean {
  return Math.abs(a - b) < epsilon;
}

describe("Unit Conversion tests", () => {
  const context = new SchemaContext();
  const testData: TestData[] = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "assets", "./UnitTests.json"), "utf-8"),
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
        almostEqual(test.expect, actual),
        `${test.input} ${test.from} in ${test.to} should be ${test.expect}
         and not ${actual} error = ${Math.abs(test.expect - actual)} > ${1.19209290e-7}`,
      ).to.be.true;
    });
  });
});
