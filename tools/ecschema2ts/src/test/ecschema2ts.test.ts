/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ECSchemaToTs } from "../ecschema2ts";
import { assert } from "chai";
import * as utils from "./utilities/utils";
import { SchemaContext } from "@itwin/ecschema-metadata";
import { SchemaXmlFileLocater } from "@itwin/ecschema-locaters";

describe("Convert schema xml string to typescript string", () => {
  let ecschema2ts: ECSchemaToTs;
  let context: SchemaContext;
  beforeEach(() => {
    const locator = new SchemaXmlFileLocater();
    locator.addSchemaSearchPath(`${utils.getAssetsDir()}schema3.2`);
    context = new SchemaContext();
    context.addLocater(locator);

    ecschema2ts = new ECSchemaToTs();
  });

  it("Get SchemaName from valid xml", () => {
    const schemaXml = `
      <?xml version="1.0" encoding="utf-8"?>
      <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      </ECSchema>`;

    const expectedSchemaTsString = utils.dedent`import { ClassRegistry, Schema, Schemas } from "@itwin/core-backend";
      import * as elementsModule from "./TestSchemaElements";

      export class TestSchema extends Schema {
        public static get schemaName(): string { return "TestSchema"; }

        public static registerSchema() {
          if (!Schemas.getRegisteredSchema(TestSchema.name))
            Schemas.registerSchema(TestSchema);
        }

        protected constructor() {
          super();
          ClassRegistry.registerModule(elementsModule, TestSchema);
        }
      }\n\n`;

    const schema = utils.deserializeXml(context, schemaXml);
    const { schemaTsString, elemTsString, propsTsString } = ecschema2ts.convertSchemaToTs(schema);
    assert.equal(schemaTsString, expectedSchemaTsString);
    assert.equal(elemTsString, `\n`);
    assert.equal(propsTsString, `\n`);
  });

  it("Does not crash with full schema", () => {
    const schemaXml = `
      <?xml version="1.0" encoding="utf-8"?>
      <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
        <ECSchemaReference name="CoreCustomAttributes" version="1.0.0" alias="CoreCA"/>
        <ECEntityClass typeName="TestEntity">
          <ECProperty propertyName="primPropString" typeName="string" />
          <ECProperty propertyName="primPropInt" typeName="int" />
          <ECProperty propertyName="primPropBool" typeName="bool" />
          <ECProperty propertyName="primPropPoint2d" typeName="point2d" />
          <ECProperty propertyName="primPropPoint3d" typeName="point3d" />
        </ECEntityClass>
        <ECEntityClass typeName="TestMixin">
          <ECCustomAttributes>
            <IsMixin xmlns="CoreCustomAttributes.1.0">
              <AppliesToEntityClass>TestEntity</AppliesToEntityClass>
            </IsMixin>
          </ECCustomAttributes>
        </ECEntityClass>
        <ECStructClass typeName="TestStruct">
        </ECStructClass>
      </ECSchema>`;

    const expectedSchemaTsString = utils.dedent`import { ClassRegistry, Schema, Schemas } from "@itwin/core-backend";
      import * as elementsModule from "./TestSchemaElements";

      export class TestSchema extends Schema {
        public static get schemaName(): string { return "TestSchema"; }

        public static registerSchema() {
          if (!Schemas.getRegisteredSchema(TestSchema.name))
            Schemas.registerSchema(TestSchema);
        }

        protected constructor() {
          super();
          ClassRegistry.registerModule(elementsModule, TestSchema);
        }
      }\n\n`;

    const expectedElementTsString = utils.dedent`import { Entity, IModelDb } from "@itwin/core-backend";
      import { TestEntityProps } from "./TestSchemaElementProps";

      export class TestEntity extends Entity implements TestEntityProps {
        public static get className(): string { return "TestEntity"; }

        public constructor (props: TestEntityProps, iModel: IModelDb) {
          super(props, iModel);
        }
      }\n\n`;

    const expectedPropTsString = utils.dedent`import { EntityProps } from "@itwin/core-common";
      import { Point2d, Point3d } from "@itwin/core-geometry";

      export interface TestEntityProps extends EntityProps {
        primPropString?: string;
        primPropInt?: number;
        primPropBool?: boolean;
        primPropPoint2d?: Point2d;
        primPropPoint3d?: Point3d;
      }

      export interface TestMixin {
      }

      export interface TestStruct {
      }\n\n`;

    const schema = utils.deserializeXml(context, schemaXml);
    const { schemaTsString, elemTsString, propsTsString } = ecschema2ts.convertSchemaToTs(schema);
    assert.equal(schemaTsString, expectedSchemaTsString);
    assert.equal(elemTsString, expectedElementTsString);
    assert.equal(propsTsString, expectedPropTsString);
  });
});

describe("ecxml to typescript string", () => {
  describe("for entity classes", () => {
    const testCases: utils.SchemaTestCase[] = [
      // Test Case: Basic Entity
      {
        testName:
          `Basic entity`,
        referenceXmls: [],
        schemaXml:
          `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECEntityClass typeName="EntityTest" modified="None">
            </ECEntityClass>
          </ECSchema>`,
        expectedSchemaImportTs: utils.createExpectedSchemaImportTs("TestSchema"),
        expectedSchemaTs: utils.createExpectedSchemaTsString("TestSchema"),
        expectedPropsImportTs: [],
        expectedPropsTs: [],
        expectedElemImportTs: [
          new RegExp(`import { (?=.*\\b(Entity)\\b)(?=.*\\b(IModelDb)\\b).* } from "@itwin/core-backend";`),
          new RegExp(`import { EntityProps } from "@itwin/core-common";`),
        ],
        expectedElemTs: [utils.dedent`
          export class EntityTest extends Entity {
            public static get className(): string { return "EntityTest"; }

            public constructor (props: EntityProps, iModel: IModelDb) {
              super(props, iModel);
            }
          }`,
        ],
      },

      // Test Case: Entity with description
      {
        testName: `Basic entity with description`,
        referenceXmls: [],
        schemaXml: `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECEntityClass typeName="EntityTest" description="Test Description" modified="None">
            </ECEntityClass>
          </ECSchema>`,
        expectedSchemaImportTs: utils.createExpectedSchemaImportTs("TestSchema"),
        expectedSchemaTs: utils.createExpectedSchemaTsString("TestSchema"),
        expectedPropsImportTs: [],
        expectedPropsTs: [],
        expectedElemImportTs: [
          new RegExp(`import { (?=.*\\b(Entity)\\b)(?=.*\\b(IModelDb)\\b).* } from "@itwin/core-backend";`),
          new RegExp(`import { EntityProps } from "@itwin/core-common";`),
        ],
        expectedElemTs: [utils.dedent`
          /**
           * Test Description
           */
          export class EntityTest extends Entity {
            public static get className(): string { return "EntityTest"; }

            public constructor (props: EntityProps, iModel: IModelDb) {
              super(props, iModel);
            }
          }`,
        ],
      },

      // Test Case: Entity with abstract modifier
      {
        testName: `Entity with abstract modifier`,
        referenceXmls: [],
        schemaXml: `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECEntityClass typeName="EntityTest" modifier="abstract">
            </ECEntityClass>
          </ECSchema>`,
        expectedSchemaImportTs: utils.createExpectedSchemaImportTs("TestSchema"),
        expectedSchemaTs: utils.createExpectedSchemaTsString("TestSchema"),
        expectedPropsImportTs: [],
        expectedPropsTs: [],
        expectedElemImportTs: [
          new RegExp(`import { (?=.*\\b(Entity)\\b)(?=.*\\b(IModelDb)\\b).* } from "@itwin/core-backend";`),
          new RegExp(`import { EntityProps } from "@itwin/core-common";`),
        ],
        expectedElemTs: [utils.dedent`
          export abstract class EntityTest extends Entity {
            public static get className(): string { return "EntityTest"; }

            public constructor (props: EntityProps, iModel: IModelDb) {
              super(props, iModel);
            }
          }`,
        ],
      },

      // Test Case: Entity with base class
      {
        testName: `Entity with base class`,
        referenceXmls: [],
        schemaXml: `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECEntityClass typeName="BaseEntityTest" modified="None">
            </ECEntityClass>
            <ECEntityClass typeName="EntityTest" modified="None">
              <BaseClass>BaseEntityTest</BaseClass>
              <ECProperty propertyName="TestProp" typeName="int"/>
            </ECEntityClass>
          </ECSchema>`,
        expectedSchemaImportTs: utils.createExpectedSchemaImportTs("TestSchema"),
        expectedSchemaTs: utils.createExpectedSchemaTsString("TestSchema"),
        expectedPropsImportTs: [
          new RegExp(`import { EntityProps } from "@itwin/core-common";`),
        ],
        expectedPropsTs: [utils.dedent`
          export interface EntityTestProps extends EntityProps {
            testProp?: number;
          }`,
        ],
        expectedElemImportTs: [
          new RegExp(`import { (?=.*\\b(Entity)\\b)(?=.*\\b(IModelDb)\\b).* } from "@itwin/core-backend";`),
          new RegExp(`import { EntityProps } from "@itwin/core-common";`),
          new RegExp(`import { EntityTestProps } from "./TestSchemaElementProps";`),
        ],
        expectedElemTs: [utils.dedent`
          export class BaseEntityTest extends Entity {
            public static get className(): string { return "BaseEntityTest"; }

            public constructor (props: EntityProps, iModel: IModelDb) {
              super(props, iModel);
            }
          }

          export class EntityTest extends BaseEntityTest implements EntityTestProps {
            public static get className(): string { return "EntityTest"; }

            public constructor (props: EntityTestProps, iModel: IModelDb) {
              super(props, iModel);
            }
          }`,
        ],
      },

      // Test Case: Entity with multiple base classes should assume the second is a mixin
      {
        testName: `Entity with multiple base classes should assume the second is a mixin`,
        referenceXmls: [],
        schemaXml: `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECSchemaReference name="CoreCustomAttributes" version="1.0.0" alias="CoreCA"/>
            <ECEntityClass typeName="EntityTest" modified="None">
              <BaseClass>BaseEntityTest</BaseClass>
              <BaseClass>IMixin</BaseClass>
              <ECProperty propertyName="TestEntityIntProp" typeName="int"/>
            </ECEntityClass>
            <ECEntityClass typeName="IMixin">
              <ECCustomAttributes>
                <IsMixin xmlns="CoreCustomAttributes.1.0.0">
                  <AppliesToEntityClass>BaseEntityTest</AppliesToEntityClass>
                </IsMixin>
              </ECCustomAttributes>
              <ECProperty propertyName="IMixinIntProp" typeName="int"/>
            </ECEntityClass>
            <ECEntityClass typeName="BaseEntityTest" modified="None">
              <ECProperty propertyName="BaseEntityTestIntProp" typeName="int"/>
            </ECEntityClass>
          </ECSchema>`,
        expectedSchemaImportTs: utils.createExpectedSchemaImportTs("TestSchema"),
        expectedSchemaTs: utils.createExpectedSchemaTsString("TestSchema"),
        expectedPropsImportTs: [
          new RegExp(`import { EntityProps } from "@itwin/core-common";`),
        ],
        expectedPropsTs: [utils.dedent`
          export interface IMixin {
            iMixinIntProp?: number;
          }

          export interface BaseEntityTestProps extends EntityProps {
            baseEntityTestIntProp?: number;
          }

          export interface EntityTestProps extends BaseEntityTestProps, IMixin {
            testEntityIntProp?: number;
          }`,
        ],
        expectedElemImportTs: [
          new RegExp(`import { (?=.*\\b(Entity)\\b)(?=.*\\b(IModelDb)\\b).* } from "@itwin/core-backend";`),
          new RegExp(`import { (?=.*\\b(EntityTestProps)\\b)(?=.*\\b(BaseEntityTestProps)\\b).* } from "./TestSchemaElementProps";`),
        ],
        expectedElemTs: [utils.dedent`
          export class BaseEntityTest extends Entity implements BaseEntityTestProps {
            public static get className(): string { return "BaseEntityTest"; }

            public constructor (props: BaseEntityTestProps, iModel: IModelDb) {
              super(props, iModel);
            }
          }

          export class EntityTest extends BaseEntityTest implements EntityTestProps {
            public static get className(): string { return "EntityTest"; }

            public constructor (props: EntityTestProps, iModel: IModelDb) {
              super(props, iModel);
            }
          }`,
        ],
      },

      // Test Case: Entity with base class in a reference schema
      {
        testName: `Entity with multiple base classes should assume the second is a mixin`,
        referenceXmls: [
          `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="ReferenceSchema" alias="ref" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECEntityClass typeName="BaseEntityTest" modified="None">
              <ECProperty propertyName="BaseEntityTestIntProp" typeName="int"/>
            </ECEntityClass>
          </ECSchema>`,
        ],
        schemaXml: `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECSchemaReference name="CoreCustomAttributes" version="1.0.0" alias="CoreCA"/>
            <ECSchemaReference name="ReferenceSchema" version="1.0.0" alias="ref"/>
            <ECEntityClass typeName="EntityTest" modified="None">
              <BaseClass>ref:BaseEntityTest</BaseClass>
              <ECProperty propertyName="TestEntityIntProp" typeName="int"/>
            </ECEntityClass>
          </ECSchema>`,
        expectedSchemaImportTs: utils.createExpectedSchemaImportTs("TestSchema"),
        expectedSchemaTs: utils.createExpectedSchemaTsString("TestSchema"),
        expectedPropsImportTs: [
          new RegExp(`import { BaseEntityTestProps } from "./ReferenceSchemaElementProps";`),
        ],
        expectedPropsTs: [utils.dedent`
          export interface EntityTestProps extends BaseEntityTestProps {
            testEntityIntProp?: number;
          }`,
        ],
        expectedElemImportTs: [
          new RegExp(`import { IModelDb } from "@itwin/core-backend";`),
          new RegExp(`import { EntityTestProps } from "./TestSchemaElementProps";`),
          new RegExp(`import { BaseEntityTest } from "./ReferenceSchemaElements";`),
        ],
        expectedElemTs: [utils.dedent`
          export class EntityTest extends BaseEntityTest implements EntityTestProps {
            public static get className(): string { return "EntityTest"; }

            public constructor (props: EntityTestProps, iModel: IModelDb) {
              super(props, iModel);
            }
          }`,
        ],
      },
    ];

    utils.testGeneratedSchemaTypescript(testCases);
  });

  describe("Mixins classes", () => {
    const testCases: utils.SchemaTestCase[] = [
      // Test Case: Basic mixin
      {
        testName: `Basic mixin`,
        referenceXmls: [],
        schemaXml: `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECSchemaReference name="CoreCustomAttributes" version="1.0.0" alias="CoreCA"/>
            <ECSchemaReference name="BisCore" version="1.0.0" alias="bis"/>
            <ECEntityClass typeName="MixinTest" modified="None">
              <ECCustomAttributes>
                <IsMixin xmlns="CoreCustomAttributes.1.0.0">
                  <AppliesToEntityClass>bis:Element</AppliesToEntityClass>
                </IsMixin>
              </ECCustomAttributes>
              <ECProperty propertyName="MixinIntProp" typeName="int"/>
            </ECEntityClass>
          </ECSchema>`,
        expectedSchemaImportTs: utils.createExpectedSchemaImportTs("TestSchema"),
        expectedSchemaTs: utils.createExpectedSchemaTsString("TestSchema"),
        expectedPropsImportTs: [],
        expectedPropsTs: [utils.dedent`
          export interface MixinTest {
            mixinIntProp?: number;
          }`,
        ],
        expectedElemImportTs: [],
        expectedElemTs: [],
      },

      // Test Case: Mixin has base class
      {
        testName: `Mixin has base class`,
        referenceXmls: [],
        schemaXml: `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECSchemaReference name="CoreCustomAttributes" version="1.0.0" alias="CoreCA"/>
            <ECSchemaReference name="BisCore" version="1.0.0" alias="bis"/>
            <ECEntityClass typeName="BaseMixinTest" modified="None">
              <ECCustomAttributes>
                <IsMixin xmlns="CoreCustomAttributes.1.0.0">
                  <AppliesToEntityClass>bis:Element</AppliesToEntityClass>
                </IsMixin>
              </ECCustomAttributes>
              <ECProperty propertyName="BaseMixinIntProp" typeName="int"/>
            </ECEntityClass>
            <ECEntityClass typeName="MixinTest" modified="None">
              <ECCustomAttributes>
                <IsMixin xmlns="CoreCustomAttributes.1.0.0">
                  <AppliesToEntityClass>bis:Element</AppliesToEntityClass>
                </IsMixin>
              </ECCustomAttributes>
              <BaseClass>BaseMixinTest</BaseClass>
              <ECProperty propertyName="MixinIntProp" typeName="int"/>
            </ECEntityClass>
          </ECSchema>`,
        expectedSchemaImportTs: utils.createExpectedSchemaImportTs("TestSchema"),
        expectedSchemaTs: utils.createExpectedSchemaTsString("TestSchema"),
        expectedPropsImportTs: [],
        expectedPropsTs: [utils.dedent`
          export interface BaseMixinTest {
            baseMixinIntProp?: number;
          }

          export interface MixinTest extends BaseMixinTest {
            mixinIntProp?: number;
          }`,
        ],
        expectedElemImportTs: [],
        expectedElemTs: [],
      },
    ];

    utils.testGeneratedSchemaTypescript(testCases);
  });

  describe("Struct classes", () => {
    const testCases: utils.SchemaTestCase[] = [
      // Test Case: Basic struct with no description
      {
        testName: `Basic struct with no description`,
        referenceXmls: [],
        schemaXml: `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECSchemaReference name="CoreCustomAttributes" version="1.0.0" alias="CoreCA"/>
            <ECSchemaReference name="BisCore" version="1.0.0" alias="bis"/>
            <ECStructClass typeName="StructTest">
              <ECProperty propertyName="PrimitiveProp" typeName="string" readOnly="false"/>
              <ECProperty propertyName="EnumProp" typeName="IntEnumeration"/>
            </ECStructClass>
            <ECEnumeration typeName="IntEnumeration" backingTypeName="int" description="Int Enumeration" displayLabel="This is a display label." isStrict="true">
              <ECEnumerator name="IntEnumeration1" value="1" displayLabel="First"/>
              <ECEnumerator name="IntEnumeration2" value="2" displayLabel="Second"/>
              <ECEnumerator name="IntEnumeration3" value="3" displayLabel="Third"/>
            </ECEnumeration>
          </ECSchema>`,
        expectedSchemaImportTs: utils.createExpectedSchemaImportTs("TestSchema"),
        expectedSchemaTs: utils.createExpectedSchemaTsString("TestSchema"),
        expectedPropsImportTs: [
          new RegExp(`import { IntEnumeration } from "./TestSchemaElements";`),
        ],
        expectedPropsTs: [utils.dedent`
          export interface StructTest {
            primitiveProp?: string;
            enumProp?: IntEnumeration;
          }`,
        ],
        expectedElemImportTs: [],
        expectedElemTs: [utils.dedent`
          /**
           * Int Enumeration
           */
          export const enum IntEnumeration {
            First = 1,
            Second = 2,
            Third = 3,
          }`,
        ],
      },

      // Test Case: Basic struct with description
      {
        testName: `Basic struct with description`,
        referenceXmls: [],
        schemaXml: `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECSchemaReference name="CoreCustomAttributes" version="1.0.0" alias="CoreCA"/>
            <ECSchemaReference name="BisCore" version="1.0.0" alias="bis"/>
            <ECStructClass typeName="StructTest" description="Test Description">
              <ECProperty propertyName="PrimitiveProp" typeName="string" readOnly="false"/>
              <ECProperty propertyName="EnumProp" typeName="IntEnumeration"/>
            </ECStructClass>
            <ECEnumeration typeName="IntEnumeration" backingTypeName="int" description="Int Enumeration" displayLabel="This is a display label." isStrict="true">
              <ECEnumerator name="IntEnumeration1" value="1" displayLabel="First"/>
              <ECEnumerator name="IntEnumeration2" value="2" displayLabel="Second"/>
              <ECEnumerator name="IntEnumeration3" value="3" displayLabel="Third"/>
            </ECEnumeration>
          </ECSchema>`,
        expectedSchemaImportTs: utils.createExpectedSchemaImportTs("TestSchema"),
        expectedSchemaTs: utils.createExpectedSchemaTsString("TestSchema"),
        expectedPropsImportTs: [
          new RegExp(`import { IntEnumeration } from "./TestSchemaElements";`),
        ],
        expectedPropsTs: [utils.dedent`
          /**
           * Test Description
           */
          export interface StructTest {
            primitiveProp?: string;
            enumProp?: IntEnumeration;
          }`,
        ],
        expectedElemImportTs: [],
        expectedElemTs: [utils.dedent`
          /**
           * Int Enumeration
           */
          export const enum IntEnumeration {
            First = 1,
            Second = 2,
            Third = 3,
          }`,
        ],
      },

      // Test Case: Struct has base class
      {
        testName: "Struct has base class",
        referenceXmls: [],
        schemaXml: `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECSchemaReference name="CoreCustomAttributes" version="1.0.0" alias="CoreCA"/>
            <ECSchemaReference name="BisCore" version="1.0.0" alias="bis"/>
            <ECStructClass typeName="StructTest">
              <BaseClass>BaseStructTest</BaseClass>
              <ECProperty propertyName="PrimitiveProp" typeName="string" readOnly="false"/>
            </ECStructClass>
            <ECStructClass typeName="BaseStructTest">
              <ECProperty propertyName="BasePrimitiveProp" typeName="string" readOnly="false"/>
            </ECStructClass>
          </ECSchema>`,
        expectedSchemaImportTs: utils.createExpectedSchemaImportTs("TestSchema"),
        expectedSchemaTs: utils.createExpectedSchemaTsString("TestSchema"),
        expectedPropsImportTs: [],
        expectedPropsTs: [utils.dedent`
          export interface BaseStructTest {
            basePrimitiveProp?: string;
          }

          export interface StructTest extends BaseStructTest {
            primitiveProp?: string;
          }`,
        ],
        expectedElemImportTs: [],
        expectedElemTs: [],
      },

      // Test Case: Struct has base class in reference schema
      {
        testName: `Struct has base class`,
        referenceXmls: [
          `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="ReferenceSchema" alias="ref" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECSchemaReference name="CoreCustomAttributes" version="1.0.0" alias="CoreCA"/>
            <ECSchemaReference name="BisCore" version="1.0.0" alias="bis"/>
            <ECStructClass typeName="BaseStructTest">
              <ECProperty propertyName="BasePrimitiveProp" typeName="string" readOnly="false"/>
            </ECStructClass>
          </ECSchema>`,
        ],
        schemaXml: `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECSchemaReference name="CoreCustomAttributes" version="1.0.0" alias="CoreCA"/>
            <ECSchemaReference name="BisCore" version="1.0.0" alias="bis"/>
            <ECSchemaReference name="ReferenceSchema" version="1.0.0" alias="ref"/>
            <ECStructClass typeName="StructTest">
              <BaseClass>ref:BaseStructTest</BaseClass>
              <ECProperty propertyName="PrimitiveProp" typeName="string" readOnly="false"/>
            </ECStructClass>
          </ECSchema>`,
        expectedSchemaImportTs: utils.createExpectedSchemaImportTs("TestSchema"),
        expectedSchemaTs: utils.createExpectedSchemaTsString("TestSchema"),
        expectedPropsImportTs: [
          new RegExp(`import { BaseStructTest } from "./ReferenceSchemaElementProps";`),
        ],
        expectedPropsTs: [utils.dedent`
          export interface StructTest extends BaseStructTest {
            primitiveProp?: string;
          }`,
        ],
        expectedElemImportTs: [],
        expectedElemTs: [],
      },
    ];

    utils.testGeneratedSchemaTypescript(testCases);
  });

  // TODO: fix naming conflict
  describe("Schema references", () => {
    const testCases: utils.SchemaTestCase[] = [
      // Test Case: Reference with a single class to import
      {
        testName: "Reference with a single class to import",
        referenceXmls: [
          `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="RefSchema" alias="ref" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECEntityClass typeName="TestBase">
              <ECProperty propertyName="BasePrimitiveProp" typeName="string" readOnly="false"/>
            </ECEntityClass>
          </ECSchema>`,
        ],
        schemaXml: `<?xml version="1.0" encoding="utf-8"?>
        <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECSchemaReference name="RefSchema" alias="ref" version="1.0.0"/>
          <ECEntityClass typeName="TestClass">
            <BaseClass>ref:TestBase</BaseClass>
          </ECEntityClass>
        </ECSchema>`,
        expectedSchemaImportTs: utils.createExpectedSchemaImportTs("TestSchema"),
        expectedSchemaTs: utils.createExpectedSchemaTsString("TestSchema"),
        expectedPropsImportTs: [],
        expectedPropsTs: [],
        expectedElemImportTs: [
          new RegExp(`import { IModelDb } from "@itwin/core-backend";`),
          new RegExp(`import { TestBase } from "./RefSchemaElements";`),
          new RegExp(`import { TestBaseProps } from "./RefSchemaElementProps";`),
        ],
        expectedElemTs: [utils.dedent`
          export class TestClass extends TestBase {
            public static get className(): string { return "TestClass"; }

            public constructor (props: TestBaseProps, iModel: IModelDb) {
              super(props, iModel);
            }
          }`,
        ],
      },

      // Test Case: 2 References with 2 classes to import
      {
        testName: `2 References with 2 classes to import`,
        referenceXmls: [
          `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="RefSchema" alias="ref" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECEntityClass typeName="TestBase">
              <ECProperty propertyName="BasePrimitiveProp" typeName="string" readOnly="false"/>
            </ECEntityClass>
          </ECSchema>`,
          `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="SecondRefSchema" alias="ref2" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECEntityClass typeName="TestBase">
              <ECProperty propertyName="BasePrimitiveProp" typeName="string" readOnly="false"/>
            </ECEntityClass>
          </ECSchema>`,
        ],
        schemaXml: `<?xml version="1.0" encoding="utf-8"?>
        <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECSchemaReference name="RefSchema" alias="ref" version="1.0.0"/>
          <ECSchemaReference name="SecondRefSchema" alias="ref2" version="1.0.0"/>
          <ECEntityClass typeName="TestClass">
            <BaseClass>ref:TestBase</BaseClass>
          </ECEntityClass>
          <ECEntityClass typeName="TestClass2">
            <BaseClass>ref2:TestBase</BaseClass>
          </ECEntityClass>
        </ECSchema>`,
        expectedSchemaImportTs: utils.createExpectedSchemaImportTs("TestSchema"),
        expectedSchemaTs: utils.createExpectedSchemaTsString("TestSchema"),
        expectedPropsImportTs: [],
        expectedPropsTs: [],
        expectedElemImportTs: [
          new RegExp(`import { IModelDb } from "@itwin/core-backend";`),
          new RegExp(`import { TestBase } from "./RefSchemaElements";`),
          new RegExp(`import { TestBase as SecondRefSchemaElementsTestBase } from "./SecondRefSchemaElements";`),
          new RegExp(`import { TestBaseProps } from "./RefSchemaElementProps";`),
          new RegExp(`import { TestBaseProps as SecondRefSchemaElementPropsTestBaseProps } from "./SecondRefSchemaElementProps";`),
        ],
        expectedElemTs: [utils.dedent`
          export class TestClass extends TestBase {
            public static get className(): string { return "TestClass"; }

            public constructor (props: TestBaseProps, iModel: IModelDb) {
              super(props, iModel);
            }
          }`, utils.dedent`
          export class TestClass2 extends SecondRefSchemaElementsTestBase {
            public static get className(): string { return "TestClass2"; }

            public constructor (props: SecondRefSchemaElementPropsTestBaseProps, iModel: IModelDb) {
              super(props, iModel);
            }
          }`,
        ],
      },

      // Test Case: 2 References with 3 classes to import
      {
        testName: `2 References with 3 classes to import`,
        referenceXmls: [
          `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="RefSchema" alias="ref" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECEntityClass typeName="TestBase">
              <ECProperty propertyName="BasePrimitiveProp" typeName="string" readOnly="false"/>
            </ECEntityClass>
            <ECEntityClass typeName="TestBase2">
              <ECProperty propertyName="Base2PrimitiveProp" typeName="string" readOnly="false"/>
            </ECEntityClass>
          </ECSchema>`,

          `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="SecondRefSchema" alias="ref2" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECEntityClass typeName="TestBase">
              <ECProperty propertyName="BasePrimitiveProp" typeName="string" readOnly="false"/>
            </ECEntityClass>
          </ECSchema>`,
        ],
        schemaXml: `<?xml version="1.0" encoding="utf-8"?>
        <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECSchemaReference name="RefSchema" alias="ref" version="1.0.0"/>
          <ECSchemaReference name="SecondRefSchema" alias="ref2" version="1.0.0"/>
          <ECEntityClass typeName="TestClass">
            <BaseClass>ref:TestBase</BaseClass>
          </ECEntityClass>
          <ECEntityClass typeName="TestClass2">
            <BaseClass>ref:TestBase2</BaseClass>
          </ECEntityClass>
          <ECEntityClass typeName="TestClass3">
            <BaseClass>ref2:TestBase</BaseClass>
          </ECEntityClass>
        </ECSchema>`,
        expectedSchemaImportTs: utils.createExpectedSchemaImportTs("TestSchema"),
        expectedSchemaTs: utils.createExpectedSchemaTsString("TestSchema"),
        expectedPropsImportTs: [],
        expectedPropsTs: [],
        expectedElemImportTs: [
          new RegExp(`import { IModelDb } from "@itwin/core-backend";`),
          new RegExp(`import { (?=.*\\b(TestBase)\\b)(?=.*\\b(TestBase2)\\b).* } from "./RefSchemaElements";`),
          new RegExp(`import { TestBase as SecondRefSchemaElementsTestBase } from "./SecondRefSchemaElements";`),
          new RegExp(`import { (?=.*\\b(TestBaseProps)\\b)(?=.*\\b(TestBase2Props)\\b).* } from "./RefSchemaElementProps";`),
          new RegExp(`import { TestBaseProps as SecondRefSchemaElementPropsTestBaseProps } from "./SecondRefSchemaElementProps";`),
        ],
        expectedElemTs: [utils.dedent`
          export class TestClass extends TestBase {
            public static get className(): string { return "TestClass"; }

            public constructor (props: TestBaseProps, iModel: IModelDb) {
              super(props, iModel);
            }
          }`, utils.dedent`
          export class TestClass2 extends TestBase2 {
            public static get className(): string { return "TestClass2"; }

            public constructor (props: TestBase2Props, iModel: IModelDb) {
              super(props, iModel);
            }
          }`, utils.dedent`
          export class TestClass3 extends SecondRefSchemaElementsTestBase {
            public static get className(): string { return "TestClass3"; }

            public constructor (props: SecondRefSchemaElementPropsTestBaseProps, iModel: IModelDb) {
              super(props, iModel);
            }
          }`,
        ],
      },

      // Test Case: property in reference
      {
        testName: `Property in reference schema`,
        referenceXmls: [
          `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="RefSchema" alias="ref" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECStructClass typeName="StructClass">
              <ECProperty propertyName="PrimitiveProp" typeName="string" readOnly="false"/>
            </ECStructClass>
            <ECEnumeration typeName="PropEnum" backingTypeName="int" description="Int Enumeration" displayLabel="This is a display label." isStrict="true">
              <ECEnumerator name="IntEnumeration1" value="1" displayLabel="First"/>
              <ECEnumerator name="IntEnumeration2" value="2" displayLabel="Second"/>
              <ECEnumerator name="IntEnumeration3" value="3" displayLabel="Third"/>
            </ECEnumeration>
          </ECSchema>`,
        ],
        schemaXml: `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECSchemaReference name="RefSchema" alias="ref" version="1.0.0"/>
            <ECEntityClass typeName="TestClass">
              <ECProperty propertyName="testProp" typeName="ref:PropEnum"/>
              <ECProperty propertyName="point2dProp" typeName="point2d"/>
              <ECProperty propertyName="point3dProp" typeName="point3d"/>
              <ECProperty propertyName="testProp2" typeName="string" extendedTypeName="BeGuid"/>
              <ECStructProperty propertyName="testStructProp" typeName="ref:StructClass"/>
            </ECEntityClass>
          </ECSchema>`,
        expectedSchemaImportTs: utils.createExpectedSchemaImportTs("TestSchema"),
        expectedSchemaTs: utils.createExpectedSchemaTsString("TestSchema"),
        expectedPropsImportTs: [
          new RegExp(`import { GuidString } from "@itwin/core-bentley";`),
          new RegExp(`import { (?=.*\\b(Point2d)\\b)(?=.*\\b(Point3d)\\b).* } from "@itwin/core-geometry";`),
          new RegExp(`import { StructClass } from "./RefSchemaElementProps";`),
          new RegExp(`import { PropEnum } from "./RefSchemaElements";`),
        ],
        expectedPropsTs: [utils.dedent`
          export interface TestClassProps extends EntityProps {
            testProp?: PropEnum;
            point2dProp?: Point2d;
            point3dProp?: Point3d;
            testProp2?: GuidString;
            testStructProp?: StructClass;
          }`,
        ],
        expectedElemImportTs: [
          new RegExp(`import { (?=.*\\b(IModelDb)\\b)(?=.*\\b(Entity)\\b).* } from "@itwin/core-backend";`),
          new RegExp(`import { TestClassProps } from "./TestSchemaElementProps";`),
        ],
        expectedElemTs: [utils.dedent`
          export class TestClass extends Entity implements TestClassProps {
            public static get className(): string { return "TestClass"; }

            public constructor (props: TestClassProps, iModel: IModelDb) {
              super(props, iModel);
            }
          }`,
        ],
      },

      // Test Case: Duplicate classes are not imported
      {
        testName: `Duplicate classes are not imported`,
        referenceXmls: [],
        schemaXml: `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECEntityClass typeName="TestClass"/>
            <ECEntityClass typeName="TestClass2"/>
          </ECSchema>`,
        expectedSchemaImportTs: utils.createExpectedSchemaImportTs("TestSchema"),
        expectedSchemaTs: utils.createExpectedSchemaTsString("TestSchema"),
        expectedPropsImportTs: [],
        expectedPropsTs: [],
        expectedElemImportTs: [
          new RegExp(`import { (?=.*\\b(IModelDb)\\b)(?=.*\\b(Entity)\\b).* } from "@itwin/core-backend";`),
          new RegExp(`import { EntityProps } from "@itwin/core-common";`),
        ],
        expectedElemTs: [utils.dedent`
          export class TestClass extends Entity {
            public static get className(): string { return "TestClass"; }

            public constructor (props: EntityProps, iModel: IModelDb) {
              super(props, iModel);
            }
          }`, utils.dedent`
          export class TestClass2 extends Entity {
            public static get className(): string { return "TestClass2"; }

            public constructor (props: EntityProps, iModel: IModelDb) {
              super(props, iModel);
            }
          }`,
        ],
      },
    ];

    utils.testGeneratedSchemaTypescript(testCases);
  });

  describe("enumeration", () => {
    const testCases: utils.SchemaTestCase[] = [
      // Test Case: Schema with enum
      {
        testName: "Schema with enum",
        referenceXmls: [],
        schemaXml: `<?xml version="1.0" encoding="utf-8"?>
        <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECEnumeration typeName="TestEnum" backingTypeName="int" isStrict="true">
            <ECEnumerator name="Enumerator1" value="1" displayLabel="TestEnumerator1"/>
            <ECEnumerator name="Enumerator2" value="2" displayLabel="TestEnumerator2"/>
          </ECEnumeration>
          <ECEnumeration typeName="TestEnum2" backingTypeName="string" isStrict="false">
            <ECEnumerator name="Enumerator1" value="testing" displayLabel="TestEnumerator1"/>
            <ECEnumerator name="Enumerator2" value="testing2" displayLabel="TestEnumerator2"/>
          </ECEnumeration>
        </ECSchema>`,
        expectedSchemaImportTs: utils.createExpectedSchemaImportTs("TestSchema"),
        expectedSchemaTs: utils.createExpectedSchemaTsString("TestSchema"),
        expectedPropsImportTs: [],
        expectedPropsTs: [],
        expectedElemImportTs: [],
        expectedElemTs: [utils.dedent`
          export const enum TestEnum {
            TestEnumerator1 = 1,
            TestEnumerator2 = 2,
          }`, utils.dedent`
          export const enum TestEnum2 {
            TestEnumerator1 = "testing",
            TestEnumerator2 = "testing2",
          }`,
        ],
      },

      // Test Case: Schema with empty enum
      {
        testName: "Schema with empty enum",
        referenceXmls: [],
        schemaXml: `<?xml version="1.0" encoding="utf-8"?>
        <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECEnumeration typeName="TestEnum" backingTypeName="int" isStrict="true"/>
        </ECSchema>`,
        expectedSchemaImportTs: utils.createExpectedSchemaImportTs("TestSchema"),
        expectedSchemaTs: utils.createExpectedSchemaTsString("TestSchema"),
        expectedPropsImportTs: [],
        expectedPropsTs: [],
        expectedElemImportTs: [],
        expectedElemTs: [utils.dedent`
          export const enum TestEnum {
          }`,
        ],
      },

      // Test Case: Schema with enum description
      {
        testName: "Schema with enum description",
        referenceXmls: [],
        schemaXml: `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECEnumeration typeName="TestEnum" description="This is a test enum description" backingTypeName="int" isStrict="true">
              <ECEnumerator name="Enumerator1" value="1" displayLabel="TestEnumerator1"/>
              <ECEnumerator name="Enumerator2" value="2" displayLabel="TestEnumerator2"/>
            </ECEnumeration>
          </ECSchema>`,
        expectedSchemaImportTs: utils.createExpectedSchemaImportTs("TestSchema"),
        expectedSchemaTs: utils.createExpectedSchemaTsString("TestSchema"),
        expectedPropsImportTs: [],
        expectedPropsTs: [],
        expectedElemImportTs: [],
        expectedElemTs: [utils.dedent`
          /**
           * This is a test enum description
           */
          export const enum TestEnum {
            TestEnumerator1 = 1,
            TestEnumerator2 = 2,
          }`,
        ],
      },
    ];

    utils.testGeneratedSchemaTypescript(testCases);
  });

  describe("split description", () => {
    const testCases: utils.SchemaTestCase[] = [
      // Test Case: Schema with long description
      {
        testName: "Schema with enum description",
        referenceXmls: [],
        schemaXml: `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECEntityClass typeName="TestEntity"
                description="This is a long description. This is a long boring description. This is a long long long long boring description. This is a long long long long boring description"
                modifier="None" />
          </ECSchema>`,
        expectedSchemaImportTs: utils.createExpectedSchemaImportTs("TestSchema"),
        expectedSchemaTs: utils.createExpectedSchemaTsString("TestSchema"),
        expectedPropsImportTs: [],
        expectedPropsTs: [],
        expectedElemImportTs: [],
        expectedElemTs: [utils.dedent`
          /**
           * This is a long description. This is a long boring description. This is a long long long long boring description.
           * This is a long long long long boring description
           */
          export class TestEntity extends Entity {
            public static get className(): string { return "TestEntity"; }

            public constructor (props: EntityProps, iModel: IModelDb) {
              super(props, iModel);
            }
          }`,
        ],
      },
    ];

    utils.testGeneratedSchemaTypescript(testCases);
  });

  describe("Package references no longer look in the lib directory", () => {
    const testCases: utils.SchemaTestCase[] = [
      // Test Case: Package references no longer look in the lib directory
      {
        testName: "Package references no longer look in the lib directory",
        referenceXmls: [],
        schemaXml: `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="MyDomain" alias="mydomain" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
            <ECSchemaReference name="ECDbMap" version="02.00.00" alias="ecdbmap"/>
            <ECEntityClass typeName="Building" modifier="Sealed"/>
          </ECSchema>`,
        expectedSchemaImportTs: utils.createExpectedSchemaImportTs("MyDomain"),
        expectedSchemaTs: utils.createExpectedSchemaTsString("MyDomain"),
        expectedPropsImportTs: [],
        expectedPropsTs: [],
        expectedElemImportTs: [
          new RegExp(`import { Entity, IModelDb } from "@itwin/core-backend";`),
          new RegExp(`import { EntityProps } from "@itwin/core-common";`),
        ],
        expectedElemTs: [utils.dedent`
          export class Building extends Entity {
            public static get className(): string { return "Building"; }

            public constructor (props: EntityProps, iModel: IModelDb) {
              super(props, iModel);
            }
          }`,
        ],
      },

      // Test Case: Package references no longer look in the lib directory
      {
        testName: "ECEntity with base class",
        referenceXmls: [],
        schemaXml: `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="MyDomain" alias="mydomain" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
            <ECSchemaReference name="ECDbMap" version="02.00.00" alias="ecdbmap"/>
            <ECEntityClass typeName="Building" modifier="Sealed">
              <BaseClass>bis:SpatialLocationElement</BaseClass>
              <BaseClass>bis:IParentElement</BaseClass>
            </ECEntityClass>
          </ECSchema>`,
        expectedSchemaImportTs: utils.createExpectedSchemaImportTs("MyDomain"),
        expectedSchemaTs: utils.createExpectedSchemaTsString("MyDomain"),
        expectedPropsImportTs: [],
        expectedPropsTs: [],
        expectedElemImportTs: [
          new RegExp(`import { SpatialLocationElement, IModelDb } from "@itwin/core-backend";`),
          new RegExp(`import { GeometricElement3dProps } from "@itwin/core-common";`),
        ],
        expectedElemTs: [utils.dedent`
          export class Building extends SpatialLocationElement {
            public static get className(): string { return "Building"; }

            public constructor (props: GeometricElement3dProps, iModel: IModelDb) {
              super(props, iModel);
            }
          }`,
        ],
      },
    ];

    utils.testGeneratedSchemaTypescript(testCases);
  });

  describe("Handling ECSchemas which extend BisCore", () => {
    const testCases: utils.SchemaTestCase[] = [
      // Test Case: Handling ECSchemas which extend BisCore
      {
        testName: "Handling ECSchemas which extend BisCore",
        referenceXmls: [],
        schemaXml: `<?xml version="1.0" encoding="utf-8"?>
          <ECSchema schemaName="MyDomain" alias="mydomain" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
            <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
            <ECSchemaReference name="ECDbMap" version="02.00.00" alias="ecdbmap"/>
            <ECEntityClass typeName="Building" modifier="Sealed">
              <BaseClass>bis:Sheet</BaseClass>
            </ECEntityClass>
          </ECSchema>`,
        expectedSchemaImportTs: utils.createExpectedSchemaImportTs("MyDomain"),
        expectedSchemaTs: utils.createExpectedSchemaTsString("MyDomain"),
        expectedPropsImportTs: [],
        expectedPropsTs: [],
        expectedElemImportTs: [
          new RegExp(`import { Sheet, IModelDb } from "@itwin/core-backend";`),
          new RegExp(`import { SheetProps } from "@itwin/core-common";`),
        ],
        expectedElemTs: [utils.dedent`
          export class Building extends Sheet {
            public static get className(): string { return "Building"; }

            public constructor (props: SheetProps, iModel: IModelDb) {
              super(props, iModel);
            }
          }`,
        ],
      },
    ];

    utils.testGeneratedSchemaTypescript(testCases);
  });
});
