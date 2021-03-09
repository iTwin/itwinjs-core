/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  SchemaContext,
  SchemaItemKey,
  SchemaKey,
} from "../../src/ecschema-metadata";
import { expect } from "chai";
import * as fs from "fs";
import * as path from "path";
import { Float } from "../../src/UnitConversion/Float";
import { deserializeXml } from "./DeserializeSchema";
import { UnitConvertorContext } from "../../src/UnitConversion/Convert";

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
    fs.readFileSync(
      path.join(__dirname, "./cross-schema-test-data.json"),
      "utf-8"
    )
  );

  before(() => {
    const siSchemaFile = path.join(__dirname, "SIUnits.ecschema.xml");
    const siSchemaXml = fs.readFileSync(siSchemaFile, "utf-8");
    deserializeXml(context, siSchemaXml);

    const metricSchemaFile = path.join(__dirname, "MetricUnits.ecschema.xml");
    const metricSchemaXml = fs.readFileSync(metricSchemaFile, "utf-8");
    deserializeXml(context, metricSchemaXml);

    const usSchemaFile = path.join(__dirname, "USUnits.ecschema.xml");
    const usSchemaXml = fs.readFileSync(usSchemaFile, "utf-8");
    deserializeXml(context, usSchemaXml);
  });

  testData.forEach((test: TestData) => {
    it(`should convert ${test.FromSchema}:${test.From} to ${test.ToSchema}:${test.To}`, async () => {
      const converter = new UnitConvertorContext(context);
      const fromSchemaKey = new SchemaKey(test.FromSchema);
      const toSchemaKey = new SchemaKey(test.ToSchema);
      const from = new SchemaItemKey(test.From, fromSchemaKey);
      const to = new SchemaItemKey(test.To, toSchemaKey);
      const map = await converter.processSchemaItem(from, to);
      const actual = map.evaluate(test.Input);
      const ulp = Float.ulp(Math.max(test.Input, test.Expect));
      expect(
        Float.equals(test.Expect, actual, 3 * ulp),
        `${test.Input} ${test.From} in ${test.To} should be ${
          test.Expect
        } and not ${actual} error = ${Math.abs(test.Expect - actual)} > ${
          3 * ulp
        }`
      ).to.be.true;
    });
  });

  it("should throw when schema name is not in context", async () => {
    const converter = new UnitConvertorContext(context);
    const schemaKey = new SchemaKey("MockSchema");

    const mockUnit = new SchemaItemKey("MockUnit", schemaKey);
    const meter = new SchemaItemKey("M", schemaKey);
    try {
      await converter.processSchemaItem(mockUnit, meter);
    } catch (err) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Schema item is not a unit or a constant");
    }
    try {
      await converter.processSchemaItem(meter, mockUnit);
    } catch (err) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Schema item is not a unit or a constant");
    }
  });

  it("should throw when schema item is not in schema ", async () => {
    const converter = new UnitConvertorContext(context);
    const schemaKey = new SchemaKey("SIUnits");

    const unitA11 = new SchemaItemKey("NonexistentUnit", schemaKey);
    const meter = new SchemaItemKey("M", schemaKey);
    try {
      await converter.processSchemaItem(unitA11, meter);
    } catch (err) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Schema item is not a unit or a constant");
    }
    try {
      await converter.processSchemaItem(meter, unitA11);
    } catch (err) {
      expect(err).to.be.an("error");
      expect(err.message).to.equal("Schema item is not a unit or a constant");
    }
  });
});
