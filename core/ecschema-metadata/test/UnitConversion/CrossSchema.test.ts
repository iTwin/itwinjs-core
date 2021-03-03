/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  Schema,
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
  Comment?: string;
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
    const schemaFileC = path.join(__dirname, "TestUnitsC.ecschema.xml");
    const schemaXmlC = fs.readFileSync(schemaFileC, "utf-8");
    deserializeXml(context, schemaXmlC);

    const schemaFileB = path.join(__dirname, "TestUnitsB.ecschema.xml");
    const schemaXmlB = fs.readFileSync(schemaFileB, "utf-8");
    deserializeXml(context, schemaXmlB);

    const schemaFileA = path.join(__dirname, "TestUnitsA.ecschema.xml");
    const schemaXmlA = fs.readFileSync(schemaFileA, "utf-8");
    deserializeXml(context, schemaXmlA);
  });

  testData.forEach((test: TestData) => {
    it(`should convert ${test.From} to ${test.To}`, async () => {
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
});
