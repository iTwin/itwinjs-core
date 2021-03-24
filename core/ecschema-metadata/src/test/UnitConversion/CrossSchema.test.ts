/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { SchemaContext } from "../../Context";
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import * as almostEqual from "almost-equal";
import { deserializeXml } from "./DeserializeSchema";
import { UnitConverter } from "../../UnitConversion/UnitConverter";

interface TestData {
  fromSchema: string;
  from: string;
  toSchema: string;
  to: string;
  input: number;
  expect: number;
}

describe("Testing cross-schema unit definitions", () => {
  const context = new SchemaContext();

  const testData: TestData[] = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "assets", "./CrossSchemaTests.json"), "utf-8")
  );

  before(() => {
    const siSchemaFile = path.join(__dirname, "..", "assets", "SIUnits.ecschema.xml");
    const siSchemaXml = fs.readFileSync(siSchemaFile, "utf-8");
    deserializeXml(context, siSchemaXml);

    const metricSchemaFile = path.join(__dirname, "..", "assets", "MetricUnits.ecschema.xml");
    const metricSchemaXml = fs.readFileSync(metricSchemaFile, "utf-8");
    deserializeXml(context, metricSchemaXml);

    const usSchemaFile = path.join(__dirname, "..", "assets", "USUnits.ecschema.xml");
    const usSchemaXml = fs.readFileSync(usSchemaFile, "utf-8");
    deserializeXml(context, usSchemaXml);
  });

  testData.forEach((test: TestData) => {
    it(`should convert ${test.fromSchema}:${test.from} to ${test.toSchema}:${test.to}`, async () => {
      const converter = new UnitConverter(context);
      const fromFullName = `${test.fromSchema}.${test.from}`;
      const toFullName = `${test.toSchema}.${test.to}`;
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
