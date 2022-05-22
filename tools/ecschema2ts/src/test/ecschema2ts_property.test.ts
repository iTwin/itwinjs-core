/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as utils from "./utilities/utils";

describe("ecjson properties to ts", () => {
  describe("primitive property", () => {
    const testCases: utils.PropertyTestCase[] = [
      // Test Case: Class with binary property
      {
        testName: `Class with binary property`,
        referenceXmls: [],
        schemaXml: `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECEntityClass typeName="TestClass" modifier="None">
              <ECProperty propertyName="BinaryProp" typeName="binary"/>
            </ECEntityClass>
          </ECSchema>`,
        expectedPropsImportTs: [
          new RegExp(`import { EntityProps } from "@itwin/core-common";`),
        ],
        expectedPropsTs: [utils.dedent`
          export interface TestClassProps extends EntityProps {
            binaryProp?: any;
          }`,
        ],
      },

      // Test Case: Class with point3d type
      {
        testName: `Class with point3d property`,
        referenceXmls: [],
        schemaXml: `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECEntityClass typeName="TestClass" modifier="None">
              <ECProperty propertyName="Point3dProp" typeName="point3d"/>
            </ECEntityClass>
          </ECSchema>`,
        expectedPropsImportTs: [
          new RegExp(`import { EntityProps } from "@itwin/core-common";`),
          new RegExp(`import { (?=.*\\b(Point3d)\\b).* } from "@itwin/core-geometry";`),
        ],
        expectedPropsTs: [utils.dedent`
          export interface TestClassProps extends EntityProps {
            point3dProp?: Point3d;
          }`,
        ],
      },

      // Test Case: Class with point2d type
      {
        testName: `Class with point2d property`,
        referenceXmls: [],
        schemaXml: `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECEntityClass typeName="TestClass" modifier="None">
              <ECProperty propertyName="Point2dProp" typeName="point2d"/>
            </ECEntityClass>
          </ECSchema>`,
        expectedPropsImportTs: [
          new RegExp(`import { EntityProps } from "@itwin/core-common";`),
          new RegExp(`import { (?=.*\\b(Point2d)\\b).* } from "@itwin/core-geometry";`),
        ],
        expectedPropsTs: [utils.dedent`
          export interface TestClassProps extends EntityProps {
            point2dProp?: Point2d;
          }`,
        ],
      },

      // Test Case: Class with bool type
      {
        testName: `Class with bool property`,
        referenceXmls: [],
        schemaXml: `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECEntityClass typeName="TestClass" modifier="None">
              <ECProperty propertyName="BoolProp" typeName="bool"/>
            </ECEntityClass>
          </ECSchema>`,
        expectedPropsImportTs: [
          new RegExp(`import { EntityProps } from "@itwin/core-common";`),
        ],
        expectedPropsTs: [utils.dedent`
          export interface TestClassProps extends EntityProps {
            boolProp?: boolean;
          }`,
        ],
      },

      // Test Case: Class with int type
      {
        testName: `Class with int property`,
        referenceXmls: [],
        schemaXml: `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECEntityClass typeName="TestClass" modifier="None">
              <ECProperty propertyName="IntProp" typeName="int"/>
            </ECEntityClass>
          </ECSchema>`,
        expectedPropsImportTs: [
          new RegExp(`import { EntityProps } from "@itwin/core-common";`),
        ],
        expectedPropsTs: [utils.dedent`
          export interface TestClassProps extends EntityProps {
            intProp?: number;
          }`,
        ],
      },

      // Test Case: Class with double type
      {
        testName: `Class with double property`,
        referenceXmls: [],
        schemaXml: `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECEntityClass typeName="TestClass" modifier="None">
              <ECProperty propertyName="DoubleProp" typeName="double"/>
            </ECEntityClass>
          </ECSchema>`,
        expectedPropsImportTs: [
          new RegExp(`import { EntityProps } from "@itwin/core-common";`),
        ],
        expectedPropsTs: [utils.dedent`
          export interface TestClassProps extends EntityProps {
            doubleProp?: number;
          }`,
        ],
      },

      // Test Case: Class with datetime
      {
        testName: `Class with datetime property`,
        referenceXmls: [],
        schemaXml: `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECEntityClass typeName="TestClass" modifier="None">
              <ECProperty propertyName="DateTimeProp" typeName="dateTime"/>
            </ECEntityClass>
          </ECSchema>`,
        expectedPropsImportTs: [
          new RegExp(`import { EntityProps } from "@itwin/core-common";`),
        ],
        expectedPropsTs: [utils.dedent`
          export interface TestClassProps extends EntityProps {
            dateTimeProp?: Date;
          }`,
        ],
      },

      // Test Case: Class with string
      {
        testName: `Class with string property`,
        referenceXmls: [],
        schemaXml: `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECEntityClass typeName="TestClass" modifier="None">
              <ECProperty propertyName="StringProp" typeName="string"/>
            </ECEntityClass>
          </ECSchema>`,
        expectedPropsImportTs: [
          new RegExp(`import { EntityProps } from "@itwin/core-common";`),
        ],
        expectedPropsTs: [utils.dedent`
          export interface TestClassProps extends EntityProps {
            stringProp?: string;
          }`,
        ],
      },

      // Test Case: Class with long
      {
        testName: `Class with long property`,
        referenceXmls: [],
        schemaXml: `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECEntityClass typeName="TestClass" modifier="None">
              <ECProperty propertyName="LongProp" typeName="long"/>
            </ECEntityClass>
          </ECSchema>`,
        expectedPropsImportTs: [
          new RegExp(`import { EntityProps } from "@itwin/core-common";`),
        ],
        expectedPropsTs: [utils.dedent`
          export interface TestClassProps extends EntityProps {
            longProp?: any;
          }`,
        ],
      }];

    utils.testGeneratedTypescriptProperty(testCases);
  });

  describe("navigation", () => {
    const testCases: utils.PropertyTestCase[] = [
      // Test Case: Class with navigation
      {
        testName: `Class with navigation property`,
        referenceXmls: [],
        schemaXml: `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECSchemaReference name="CoreCustomAttributes" version="01.00.00" alias="CoreCA"/>
            <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
            <ECEntityClass typeName="TestClass" modifier="None">
              <ECNavigationProperty propertyName="NavProp" relationshipName="bis:ElementScopesCode" direction="backward"/>
            </ECEntityClass>
          </ECSchema>`,
        expectedPropsImportTs: [
          new RegExp(`import { (?=.*\\b(EntityProps)\\b)(?=.*\\b(RelatedElementProps)\\b).* } from "@itwin/core-common";`),
        ],
        expectedPropsTs: [utils.dedent`
          export interface TestClassProps extends EntityProps {
            navProp?: RelatedElementProps;
          }`,
        ],
      }];

    utils.testGeneratedTypescriptProperty(testCases);
  });

  describe("struct property", () => {
    const testCases: utils.PropertyTestCase[] = [
      // Test Case: Class with struct
      {
        testName: `Class with struct property`,
        referenceXmls: [],
        schemaXml: `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECStructClass typeName="DerivedStruct" modifier="None">
                <ECProperty propertyName="IntProp" typeName="int"/>
                <ECProperty propertyName="DoubleProp" typeName="double"/>
            </ECStructClass>
            <ECEntityClass typeName="TestClass" modifier="None">
                <ECStructProperty propertyName="StructProp" typeName="DerivedStruct"/>
            </ECEntityClass>
          </ECSchema>`,
        expectedPropsImportTs: [
          new RegExp(`import { EntityProps } from "@itwin/core-common";`),
        ],
        expectedPropsTs: [utils.dedent`
          export interface TestClassProps extends EntityProps {
            structProp?: DerivedStruct;
          }`,
        ],
      },

      // Test Case: Class with struct in reference schema
      {
        testName: `Class with struct property in reference schema`,
        referenceXmls: [
          `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="RefTest" alias="ref" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECStructClass typeName="DerivedStruct" modifier="None">
                <ECProperty propertyName="IntProp" typeName="int"/>
                <ECProperty propertyName="DoubleProp" typeName="double"/>
            </ECStructClass>
          </ECSchema>`,
        ],
        schemaXml: `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECSchemaReference name="RefTest" version="01.00.00" alias="ref"/>
            <ECEntityClass typeName="TestClass" modifier="None">
                <ECStructProperty propertyName="StructProp" typeName="ref:DerivedStruct"/>
            </ECEntityClass>
          </ECSchema>`,
        expectedPropsImportTs: [
          new RegExp(`import { EntityProps } from "@itwin/core-common";`),
          new RegExp(`import { DerivedStruct } from "./RefTestElementProps";`),
        ],
        expectedPropsTs: [utils.dedent`
          export interface TestClassProps extends EntityProps {
            structProp?: DerivedStruct;
          }`,
        ],
      },
    ];

    utils.testGeneratedTypescriptProperty(testCases);
  });

  describe("primitive array property", () => {
    const testCases: utils.PropertyTestCase[] = [
      // Test Case: Class with primitive array property
      {
        testName: `Class with primitive array property`,
        referenceXmls: [],
        schemaXml: `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECEntityClass typeName="TestClass" modifier="None">
                <ECArrayProperty propertyName="BinaryArrayProp" typeName="binary" minOccurs="0" maxOccurs="unbounded"/>
                <ECArrayProperty propertyName="BoolArrayProp" typeName="bool" minOccurs="0" maxOccurs="unbounded"/>
                <ECArrayProperty propertyName="DoubleArrayProp" typeName="double" minOccurs="0" maxOccurs="unbounded"/>
                <ECArrayProperty propertyName="IntArrayProp" typeName="int" minOccurs="0" maxOccurs="unbounded"/>
                <ECArrayProperty propertyName="Point2dArrayProp" typeName="point2d" minOccurs="0" maxOccurs="unbounded"/>
                <ECArrayProperty propertyName="Point3dArrayProp" typeName="point3d" minOccurs="0" maxOccurs="unbounded"/>
                <ECArrayProperty propertyName="StringArrayProp" typeName="string" minOccurs="0" maxOccurs="unbounded"/>
            </ECEntityClass>
          </ECSchema>`,
        expectedPropsImportTs: [
          new RegExp(`import { EntityProps } from "@itwin/core-common";`),
          new RegExp(`import { (?=.*\\b(Point2d)\\b)(?=.*\\b(Point3d)\\b).* } from "@itwin/core-geometry";`),
        ],
        expectedPropsTs: [utils.dedent`
          export interface TestClassProps extends EntityProps {
            binaryArrayProp?: any[];
            boolArrayProp?: boolean[];
            doubleArrayProp?: number[];
            intArrayProp?: number[];
            point2dArrayProp?: Point2d[];
            point3dArrayProp?: Point3d[];
            stringArrayProp?: string[];
          }`,
        ],
      }];

    utils.testGeneratedTypescriptProperty(testCases);
  });

  describe("struct array property", () => {
    const testCases: utils.PropertyTestCase[] = [
      // Test Case: Class with struct array property
      {
        testName: `Class with struct array property`,
        referenceXmls: [],
        schemaXml: `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECStructClass typeName="TestStruct" modifier="None">
                <ECProperty propertyName="IntProp" typeName="int"/>
                <ECProperty propertyName="DoubleProp" typeName="double"/>
            </ECStructClass>
            <ECEntityClass typeName="TestClass" modifier="None">
                <ECStructArrayProperty propertyName="StructArrayProp" typeName="TestStruct" minOccurs="0" maxOccurs="unbounded"/>
            </ECEntityClass>
          </ECSchema>`,
        expectedPropsImportTs: [
          new RegExp(`import { EntityProps } from "@itwin/core-common";`),
        ],
        expectedPropsTs: [utils.dedent`
          export interface TestClassProps extends EntityProps {
            structArrayProp?: TestStruct[];
          }`,
        ],
      },

      // Test Case: Class with struct array property in reference schema
      {
        testName: `Class with struct array property in reference schema`,
        referenceXmls: [
          `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="RefTest" alias="ref" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECStructClass typeName="TestStruct" modifier="None">
                <ECProperty propertyName="IntProp" typeName="int"/>
                <ECProperty propertyName="DoubleProp" typeName="double"/>
            </ECStructClass>
          </ECSchema>`,
        ],
        schemaXml: `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECSchemaReference name="RefTest" version="01.00.00" alias="ref"/>
            <ECEntityClass typeName="TestClass" modifier="None">
                <ECStructArrayProperty propertyName="StructArrayProp" typeName="ref:TestStruct" minOccurs="0" maxOccurs="unbounded"/>
            </ECEntityClass>
          </ECSchema>`,
        expectedPropsImportTs: [
          new RegExp(`import { EntityProps } from "@itwin/core-common";`),
          new RegExp(`import { TestStruct } from "./RefTestElementProps";`),
        ],
        expectedPropsTs: [utils.dedent`
          export interface TestClassProps extends EntityProps {
            structArrayProp?: TestStruct[];
          }`,
        ],
      },
    ];

    utils.testGeneratedTypescriptProperty(testCases);
  });

  describe("do not add custom handled properties", () => {
    const testCases: utils.PropertyTestCase[] = [
      // Test Case: Class with struct array property
      {
        testName: `Class with struct array property`,
        referenceXmls: [],
        schemaXml: `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECSchemaReference name="CoreCustomAttributes" version="01.00.00" alias="CoreCA"/>
            <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
            <ECStructClass typeName="TestStruct" modifier="None">
                <ECProperty propertyName="IntProp" typeName="int"/>
            </ECStructClass>
            <ECEntityClass typeName="TestClass" modifier="None">
                <ECProperty propertyName="StringProp" typeName="string">
                  <ECCustomAttributes>
                      <CustomHandledProperty xmlns="BisCore.01.00.00"/>
                  </ECCustomAttributes>
                </ECProperty>
                <ECProperty propertyName="IntProp" typeName="int"/>
                <ECStructArrayProperty propertyName="StructArrayProp" typeName="TestStruct" minOccurs="0" maxOccurs="unbounded"/>
                <ECStructArrayProperty propertyName="StructCustomHandledArrayProp" typeName="TestStruct" minOccurs="0" maxOccurs="unbounded">
                  <ECCustomAttributes>
                      <CustomHandledProperty xmlns="BisCore.01.00.00"/>
                  </ECCustomAttributes>
                </ECStructArrayProperty>
                <ECNavigationProperty propertyName="NavProp" relationshipName="bis:ElementScopesCode" direction="backward">
                  <ECCustomAttributes>
                      <CustomHandledProperty xmlns="BisCore.01.00.00"/>
                  </ECCustomAttributes>
                </ECNavigationProperty>
            </ECEntityClass>
          </ECSchema>`,
        expectedPropsImportTs: [
          new RegExp(`import { EntityProps } from "@itwin/core-common";`),
        ],
        expectedPropsTs: [utils.dedent`
          export interface TestClassProps extends EntityProps {
            intProp?: number;
            structArrayProp?: TestStruct[];
          }`,
        ],
      }];

    utils.testGeneratedTypescriptProperty(testCases);
  });
});
