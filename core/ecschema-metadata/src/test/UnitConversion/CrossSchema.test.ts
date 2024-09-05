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
  fromSchema: string;
  from: string;
  toSchema: string;
  to: string;
  input: number;
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

describe("Cross Schema unit definitions tests", () => {
  const context = new SchemaContext();

  const testData: TestData[] = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "assets", "./CrossSchemaTests.json"), "utf-8"),
  );

  before(() => {
    const siSchemaFile = path.join(__dirname, "..", "assets", "SIUnits.ecschema.xml");
    const siSchemaXml = fs.readFileSync(siSchemaFile, "utf-8");
    deserializeXmlSync(siSchemaXml, context);

    const metricSchemaFile = path.join(__dirname, "..", "assets", "MetricUnits.ecschema.xml");
    const metricSchemaXml = fs.readFileSync(metricSchemaFile, "utf-8");
    deserializeXmlSync(metricSchemaXml, context);

    const usSchemaFile = path.join(__dirname, "..", "assets", "USUnits.ecschema.xml");
    const usSchemaXml = fs.readFileSync(usSchemaFile, "utf-8");
    deserializeXmlSync(usSchemaXml, context);
  });

  testData.forEach((test: TestData) => {
    it(`should convert ${test.fromSchema}:${test.from} to ${test.toSchema}:${test.to}`, async () => {
      const converter = new UnitConverter(context);
      const fromFullName = `${test.fromSchema}.${test.from}`;
      const toFullName = `${test.toSchema}.${test.to}`;
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
