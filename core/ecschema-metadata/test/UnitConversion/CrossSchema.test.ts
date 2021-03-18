/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { SchemaContext } from "../../src/ecschema-metadata";
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import * as almostEqual from "almost-equal";
import { deserializeXml } from "./DeserializeSchema";
import { UnitConverter } from "../../src/UnitConversion/UnitConverter";

interface TestData {
  FromSchema: string;
  From: string;
  ToSchema: string;
  To: string;
  Input: number;
  Expect: number;
}

describe("Testing creating second schema", () => {
  const context = new SchemaContext();

  const testData: TestData[] = JSON.parse(
    fs.readFileSync(path.join(__dirname, "assets", "./CrossSchemaTests.json"), "utf-8")
  );

  before(() => {
    const siSchemaFile = path.join(__dirname, "assets", "SIUnits.ecschema.xml");
    const siSchemaXml = fs.readFileSync(siSchemaFile, "utf-8");
    deserializeXml(context, siSchemaXml);

    const metricSchemaFile = path.join(__dirname, "assets", "MetricUnits.ecschema.xml");
    const metricSchemaXml = fs.readFileSync(metricSchemaFile, "utf-8");
    deserializeXml(context, metricSchemaXml);

    const usSchemaFile = path.join(__dirname, "assets", "USUnits.ecschema.xml");
    const usSchemaXml = fs.readFileSync(usSchemaFile, "utf-8");
    deserializeXml(context, usSchemaXml);
  });

  testData.forEach((test: TestData) => {
    it(`should convert ${test.FromSchema}:${test.From} to ${test.ToSchema}:${test.To}`, async () => {
      const converter = new UnitConverter(context);
      const fromFullName = `${test.FromSchema}.${test.From}`;
      const toFullName = `${test.ToSchema}.${test.To}`;
      const map = await converter.calculateConversion(fromFullName, toFullName);
      const actual = map.evaluate(test.Input);
      expect(
        almostEqual(test.Expect, actual, almostEqual.FLT_EPSILON, almostEqual.FLT_EPSILON),
        `${test.Input} ${test.From} in ${test.To} should be ${test.Expect}
         and not ${actual} error = ${Math.abs(test.Expect - actual)} > ${almostEqual.FLT_EPSILON}`
      ).to.be.true;
    });
  });

  it("should throw when schema name is not in context", async () => {
    const converter = new UnitConverter(context);
    try {
      await converter.calculateConversion("MockSchema:CM", "SIUnits:M");
    } catch (err) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Cannot find from's and/or to's schema");
    }
    try {
      await converter.calculateConversion("SIUnits:M", "MockSchema:CM");
    } catch (err) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Cannot find from's and/or to's schema");
    }
  });

  it("should throw when schema item is not in schema ", async () => {
    const converter = new UnitConverter(context);
    try {
      await converter.calculateConversion("SIUnits:MockUnit", "MetricUnits:CM");
    } catch (err) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Cannot find schema item");
    }
    try {
      await converter.calculateConversion("MetricUnits:CM", "SIUnits:MockUnit");
    } catch (err) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Cannot find schema item");
    }
  });
});
