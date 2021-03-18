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
  From: string;
  Input: number;
  To: string;
  Expect: number;
}

describe("A unit tree creator", () => {
  const context = new SchemaContext();

  const testData: TestData[] = JSON.parse(
    fs.readFileSync(path.join(__dirname, "assets", "./UnitTests.json"), "utf-8")
  );

  before(() => {
    const schemaFile = path.join(__dirname, "..", "..", "node_modules", "@bentley", "units-schema", "Units.ecschema.xml");
    const schemaXml = fs.readFileSync(schemaFile, "utf-8");
    deserializeXml(context, schemaXml as string);
  });

  testData.forEach((test: TestData) => {
    it(`should convert ${test.From} to ${test.To}`, async () => {
      const converter = new UnitConverter(context);
      const fromFullName = `Units:${test.From}`;
      const toFullName = `Units:${test.To}`;
      const map = await converter.calculateConversion(fromFullName, toFullName);
      const actual = map.evaluate(test.Input);
      expect(
        almostEqual(test.Expect, actual, almostEqual.FLT_EPSILON, almostEqual.FLT_EPSILON),
        `${test.Input} ${test.From} in ${test.To} should be ${test.Expect}
         and not ${actual} error = ${Math.abs(test.Expect - actual)} > ${almostEqual.FLT_EPSILON}`
      ).to.be.true;
    });
  });
});
