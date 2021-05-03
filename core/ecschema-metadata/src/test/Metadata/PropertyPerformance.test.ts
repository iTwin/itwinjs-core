/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { SchemaContext } from "../../Context";
import { EntityClass } from "../../Metadata/EntityClass";
import { Schema } from "../../Metadata/Schema";

interface TestTime {
  msg: string,
  time: number
}

describe("measuring deserialization performance with 400 properties", () => {
  const TEST_REPS = 5;
  const PROPERTIES_REPS = 100;
  let testTimes: TestTime[] = [];

  afterEach(() => {
    let totalTime = 0;
    for (const time of testTimes) {
      console.log(time.msg);
      totalTime += time.time;
    }
    const averageTime = totalTime / TEST_REPS;
    console.log(`Tests total time taken: ~${totalTime}ms; Tests average time: ~${averageTime}ms`)
  })

  it.skip("synchronous deserialization", () => {
    testTimes = []
    for (let i = 0; i < TEST_REPS; i++) {
      const properties = [];
      for (let j = 0; j < PROPERTIES_REPS; j++) {
        properties.push(              {
          type: "PrimitiveProperty",
          typeName: "double",
          name: "testPrimProp" + j,
        },
        {
          type: "StructProperty",
          name: "testStructProp" + j,
          typeName: "TestSchema.testStruct",
        },
        {
          type: "PrimitiveArrayProperty",
          typeName: "string",
          name: "testPrimArrProp" + j,
        },
        {
          type: "StructArrayProperty",
          name: "testStructArrProp" + j,
          typeName: "TestSchema.testStruct",
        });
      }

      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        items: {
          testStruct: {
            schemaItemType: "StructClass",
          },
          testClass: {
            schemaItemType: "EntityClass",
            properties
          },
        },
      }
      const startTime = new Date().getTime();
      const ecSchema = Schema.fromJsonSync(schemaJson, new SchemaContext());
      assert.isDefined(ecSchema);
      const testEntity = ecSchema.getItemSync<EntityClass>("testClass");
      assert.isDefined(testEntity);
      for (let j = 0; j < PROPERTIES_REPS; j++) {
        const testPrimProp = testEntity!.getPropertySync("testPrimProp" + j);
        assert.isDefined(testPrimProp);
        const testPrimArrProp = testEntity!.getPropertySync("testPrimArrProp" + j);
        assert.isDefined(testPrimArrProp);
        const testStructProp = testEntity!.getPropertySync("testStructProp" + j);
        assert.isDefined(testStructProp);
        const testStructArrProp = testEntity!.getPropertySync("testStructArrProp"+ j);
        assert.isDefined(testStructArrProp);
      }
      const endTime = new Date().getTime();
      testTimes.push({
        msg: `Synchronous deserialization test ${i+1} took ~${endTime - startTime}ms`,
        time: endTime - startTime
      });
    }
  });

  it.skip("asynchronous deserialization", async () => {
    testTimes = []
    for (let i = 0; i < TEST_REPS; i++) {
      const properties = [];
      for (let j = 0; j < PROPERTIES_REPS; j++) {
        properties.push(              {
          type: "PrimitiveProperty",
          typeName: "double",
          name: "testPrimProp" + j,
        },
        {
          type: "StructProperty",
          name: "testStructProp" + j,
          typeName: "TestSchema.testStruct",
        },
        {
          type: "PrimitiveArrayProperty",
          typeName: "string",
          name: "testPrimArrProp" + j,
        },
        {
          type: "StructArrayProperty",
          name: "testStructArrProp" + j,
          typeName: "TestSchema.testStruct",
        });
      }

      const schemaJson = {
        $schema: "https://dev.bentley.com/json_schemas/ec/32/ecschema",
        name: "TestSchema",
        version: "1.2.3",
        items: {
          testStruct: {
            schemaItemType: "StructClass",
          },
          testClass: {
            schemaItemType: "EntityClass",
            properties
          },
        },
      }

      const startTime = new Date().getTime();
      const ecSchema = await Schema.fromJson(schemaJson, new SchemaContext());
      assert.isDefined(ecSchema);
      const testEntity = await ecSchema.getItem<EntityClass>("testClass");
      assert.isDefined(testEntity);

      const getPropertiesAsync = []
      for (let j = 0; j < PROPERTIES_REPS; j++) {
        getPropertiesAsync.push(testEntity!.getProperty("testPrimProp" + j));
        getPropertiesAsync.push(testEntity!.getProperty("testPrimArrProp" + j));
        getPropertiesAsync.push(testEntity!.getProperty("testStructProp" + j));
        getPropertiesAsync.push(testEntity!.getProperty("testStructArrProp"+ j));
      }

      const props = await Promise.all(getPropertiesAsync);
      props.forEach(prop => assert.isDefined(prop));
      const endTime = new Date().getTime();
      testTimes.push({
        msg: `Asynchronous deserialization test ${i+1} took ~${endTime - startTime}ms`,
        time: endTime - startTime
      });
    }
  });
});