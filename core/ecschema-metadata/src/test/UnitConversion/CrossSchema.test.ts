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
  fromSchema: string;
  from: string;
  toSchema: string;
  to: string;
  input: number;
  expect: number;
}

describe("Cross Schema unit definitions tests", () => {
  const tolerance = 1.19209290e-7;
  const context = new SchemaContext();

  const testData: TestData[] = JSON.parse(
    fs.readFileSync(path.join(import.meta.dirname, "..", "assets", "./CrossSchemaTests.json"), "utf-8"),
  );

  before(() => {
    const siSchemaFile = path.join(import.meta.dirname, "..", "assets", "SIUnits.ecschema.xml");
    const siSchemaXml = fs.readFileSync(siSchemaFile, "utf-8");
    deserializeXmlSync(siSchemaXml, context);

    const metricSchemaFile = path.join(import.meta.dirname, "..", "assets", "MetricUnits.ecschema.xml");
    const metricSchemaXml = fs.readFileSync(metricSchemaFile, "utf-8");
    deserializeXmlSync(metricSchemaXml, context);

    const usSchemaFile = path.join(import.meta.dirname, "..", "assets", "USUnits.ecschema.xml");
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
        almostEqual(test.expect, actual, tolerance),
        `${test.input} ${test.from} in ${test.to} should be ${test.expect}
         and not ${actual} error = ${Math.abs(test.expect - actual)} > ${tolerance}`,
      ).to.be.true;
    });
  });
});
