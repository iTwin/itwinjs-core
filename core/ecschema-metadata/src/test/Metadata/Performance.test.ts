/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { beforeEach, describe, expect, it } from "vitest";
import { SchemaContext } from "../../Context";
import { ECClass } from "../../Metadata/Class";
import { Schema } from "../../Metadata/Schema";
import { ECSchemaNamespaceUris } from "../../Constants";

/* eslint-disable @typescript-eslint/naming-convention */

describe("Performance Tests", () => {
  let schema: Schema;

  describe("get properties", () => {
    beforeEach(() => {
      schema = new Schema(new SchemaContext(), "TestSchema", "ts", 1, 0, 0);
    });

    it("measures caching performance for getProperties", async () => {
      function generateSchemaJson(baseClassPropertiesCount: number, derivedClassesCount: number) {
        return {
          $schema: ECSchemaNamespaceUris.SCHEMAURL3_2_JSON,
          name: "TestSchema",
          version: "1.2.3",
          alias: "ts",
          items: {
            BaseClass: {
              schemaItemType: "EntityClass",
              properties: Array.from({ length: baseClassPropertiesCount }, (_, i) => ({
                type: "PrimitiveProperty",
                typeName: "string",
                name: `BaseProp${i + 1}`,
              })),
            },
            ...Array.from({ length: derivedClassesCount }, (_, i) => {
              const derivedClassName = `DerivedClass${i + 1}`;
              const baseClassName = i === 0 ? "TestSchema.BaseClass" : `TestSchema.DerivedClass${i}`;
              const properties = [
                  ...Array.from({ length: baseClassPropertiesCount/derivedClassesCount }, (__, j) => ({
                    type: "PrimitiveProperty",
                    typeName: "string",
                    name: `DerivedProp${i * (baseClassPropertiesCount/derivedClassesCount) + j + 1}`,
                  })),
                  ...Array.from({ length: baseClassPropertiesCount/derivedClassesCount }, (__, j) => ({
                    type: "PrimitiveProperty",
                    typeName: "string",
                    name: `BaseProp${i * (baseClassPropertiesCount/derivedClassesCount) + j + 1}`,
                  })),
                ];

              return {
                [derivedClassName]: {
                  schemaItemType: "EntityClass",
                  baseClass: baseClassName,
                  ...(properties ? { properties } : {}),
                },
              };
            }).reduce((acc, curr) => ({ ...acc, ...curr }), {}),
          },
        };
      }

      const schemaJson = generateSchemaJson(500, 20);
      schema = await Schema.fromJson(schemaJson, new SchemaContext());
      expect(schema).toBeDefined();

      const stringSearch = "DerivedClass20";
      const testClass = schema.getItemSync(stringSearch) as ECClass;
      expect(testClass).toBeDefined();
      let timeWithCache = 10000000;
      //Running the test 10 times to get a more accurate time
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();
        for (let j = 0; j < 1000; j++) {
          const props = await testClass.getProperties().then((x) => [...x]);
          expect(props).toHaveLength(1000);
        }
        const endTime = performance.now();
        const elapsedTime = endTime - startTime;
        timeWithCache = Math.min(timeWithCache, elapsedTime);
      }
      //checking if the excludeInherited flag works correctly
      const localProp = await testClass.getProperty("DerivedProp1", true);
      expect(localProp).toBeUndefined();
      const inheritedProp = await testClass.getProperty("BaseProp1", true);
      expect(inheritedProp).toBeUndefined();

      //checking order of props
      const allProps = await testClass.getProperties().then((x)=>[...x]);
      expect(allProps[0].name).toEqual("BaseProp1");
      expect(allProps[1].name).toEqual("BaseProp2");
      expect(allProps[999].name).toEqual("DerivedProp500");
    });
  });
});
