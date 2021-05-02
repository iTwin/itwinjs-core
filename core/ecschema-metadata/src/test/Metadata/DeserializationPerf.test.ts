/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as fs from "fs";
import * as path from "path";
import { SchemaContext } from "../../Context";
import { EntityClass } from "../../Metadata/EntityClass";
import { Schema } from "../../Metadata/Schema";

describe("Measuring deserialization performance with properties", () => {
  for (let i = 0; i < 3; i++) {
    it.only("synchronous deserialization", () => {
      const schemaJson = JSON.parse(
        fs.readFileSync(path.join(__dirname, "..", "assets", "./PerformanceSchema.json"), "utf-8")
      );

      const ecSchema = Schema.fromJsonSync(schemaJson, new SchemaContext());
      assert.isDefined(ecSchema);

      const testEntity = ecSchema.getItemSync<EntityClass>("testClass");
      assert.isDefined(testEntity);

      const testPrimProp1 = testEntity!.getPropertySync("testPrimProp1");
      assert.isDefined(testPrimProp1);
      const testPrimArrProp1 = testEntity!.getPropertySync("testPrimArrProp1");
      assert.isDefined(testPrimArrProp1);
      const testStructProp1 = testEntity!.getPropertySync("testStructProp1");
      assert.isDefined(testStructProp1);
      const testStructArrProp1 = testEntity!.getPropertySync("testStructArrProp1");
      assert.isDefined(testStructArrProp1);

      const testPrimProp2 = testEntity!.getPropertySync("testPrimProp2");
      assert.isDefined(testPrimProp2);
      const testPrimArrProp2 = testEntity!.getPropertySync("testPrimArrProp2");
      assert.isDefined(testPrimArrProp2);
      const testStructProp2 = testEntity!.getPropertySync("testStructProp2");
      assert.isDefined(testStructProp2);
      const testStructArrProp2 = testEntity!.getPropertySync("testStructArrProp2");
      assert.isDefined(testStructArrProp2);

      const testPrimProp5 = testEntity!.getPropertySync("testPrimProp5");
      assert.isDefined(testPrimProp5);
      const testPrimArrProp5 = testEntity!.getPropertySync("testPrimArrProp5");
      assert.isDefined(testPrimArrProp5);
      const testStructProp5 = testEntity!.getPropertySync("testStructProp5");
      assert.isDefined(testStructProp5);
      const testStructArrProp5 = testEntity!.getPropertySync("testStructArrProp5");
      assert.isDefined(testStructArrProp5);

      const testPrimProp10 = testEntity!.getPropertySync("testPrimProp10");
      assert.isDefined(testPrimProp10);
      const testPrimArrProp10 = testEntity!.getPropertySync("testPrimArrProp10");
      assert.isDefined(testPrimArrProp10);
      const testStructProp10 = testEntity!.getPropertySync("testStructProp10");
      assert.isDefined(testStructProp10);
      const testStructArrProp10 = testEntity!.getPropertySync("testStructArrProp10");
      assert.isDefined(testStructArrProp10);
    });

    it.only("asynchronous deserialization", async () => {
      const schemaJson = JSON.parse(
        fs.readFileSync(path.join(__dirname, "..", "assets", "./PerformanceSchema.json"), "utf-8")
      );

      const ecSchema = await Schema.fromJson(schemaJson, new SchemaContext());
      assert.isDefined(ecSchema);

      const testEntity = await ecSchema.getItem<EntityClass>("testClass");
      assert.isDefined(testEntity);

      const testPrimProp1 = await testEntity!.getProperty("testPrimProp1");
      assert.isDefined(testPrimProp1);
      const testPrimArrProp1 = await testEntity!.getProperty("testPrimArrProp1");
      assert.isDefined(testPrimArrProp1);
      const testStructProp1 = await testEntity!.getProperty("testStructProp1");
      assert.isDefined(testStructProp1);
      const testStructArrProp1 = await testEntity!.getProperty("testStructArrProp1");
      assert.isDefined(testStructArrProp1);

      const testPrimProp2 = await testEntity!.getProperty("testPrimProp2");
      assert.isDefined(testPrimProp2);
      const testPrimArrProp2 = await testEntity!.getProperty("testPrimArrProp2");
      assert.isDefined(testPrimArrProp2);
      const testStructProp2 = await testEntity!.getProperty("testStructProp2");
      assert.isDefined(testStructProp2);
      const testStructArrProp2 = await testEntity!.getProperty("testStructArrProp2");
      assert.isDefined(testStructArrProp2);

      const testPrimProp5 = await testEntity!.getProperty("testPrimProp5");
      assert.isDefined(testPrimProp5);
      const testPrimArrProp5 = await testEntity!.getProperty("testPrimArrProp5");
      assert.isDefined(testPrimArrProp5);
      const testStructProp5 = await testEntity!.getProperty("testStructProp5");
      assert.isDefined(testStructProp5);
      const testStructArrProp5 = await testEntity!.getProperty("testStructArrProp5");
      assert.isDefined(testStructArrProp5);

      const testPrimProp10 = await testEntity!.getProperty("testPrimProp10");
      assert.isDefined(testPrimProp10);
      const testPrimArrProp10 = await testEntity!.getProperty("testPrimArrProp10");
      assert.isDefined(testPrimArrProp10);
      const testStructProp10 = await testEntity!.getProperty("testStructProp10");
      assert.isDefined(testStructProp10);
      const testStructArrProp10 = await testEntity!.getProperty("testStructArrProp10");
      assert.isDefined(testStructArrProp10);
    });
  }
})