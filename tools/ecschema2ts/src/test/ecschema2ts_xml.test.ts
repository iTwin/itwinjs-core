/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as utils from "./utilities/utils";

describe("convert schema xml string to ts", () => {
  const testCases: utils.SchemaTestCase[] = [
    // Test Case: Class with long description
    {
      testName: `Class with long description`,
      referenceXmls: [],
      schemaXml: `<?xml version="1.0" encoding="utf-8"?>
        <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECEntityClass typeName="EntityTest"
                        description="This is a long description for a class. This is a long description for a class. This is a long description for a class. This is a long description for a class."
                        modifier="None">
            <ECProperty propertyName="booleanProps" typeName="boolean"/>
            <ECProperty propertyName="stringProps" typeName="string"/>
          </ECEntityClass>
        </ECSchema>`,
      expectedSchemaImportTs: utils.createExpectedSchemaImportTs("TestSchema"),
      expectedSchemaTs: utils.createExpectedSchemaTsString("TestSchema"),
      expectedPropsImportTs: [ new RegExp(`import { EntityProps } from "@itwin/core-common";`) ],
      expectedPropsTs: [utils.dedent`
        export interface EntityTestProps extends EntityProps {
          booleanProps?: boolean;
          stringProps?: string;
        }`,
      ],
      expectedElemImportTs: [
        new RegExp(`import { (?=.*\\b(Entity)\\b)(?=.*\\b(IModelDb)\\b).* } from "@itwin/core-backend";`),
        new RegExp(`import { EntityTestProps } from "./TestSchemaElementProps";`),
      ],
      expectedElemTs: [utils.dedent`
        /**
         * This is a long description for a class. This is a long description for a class. This is a long
         * description for a class. This is a long description for a class.
         */
        export class EntityTest extends Entity implements EntityTestProps {
          public static get className(): string { return "EntityTest"; }

          public constructor (props: EntityTestProps, iModel: IModelDb) {
            super(props, iModel);
          }
        }`,
      ],
    },

    // Test Case: Entity class with only primitive properties
    {
      testName: `Entity class with only primitive properties`,
      referenceXmls: [],
      schemaXml: `<?xml version="1.0" encoding="utf-8"?>
        <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECEntityClass typeName="EntityTest" description="Instantiable" modifier="None">
            <ECProperty propertyName="booleanProps" typeName="boolean"/>
            <ECProperty propertyName="stringProps" typeName="string"/>
            <ECProperty propertyName="binaryProps" typeName="binary"/>
            <ECProperty propertyName="intProps" typeName="int"/>
            <ECProperty propertyName="doubleProps" typeName="double"/>
            <ECProperty propertyName="longProps" typeName="long"/>
            <ECProperty propertyName="point2DProps" typeName="point2d"/>
            <ECProperty propertyName="point3DProps" typeName="point3d"/>
          </ECEntityClass>
        </ECSchema>`,
      expectedSchemaImportTs: utils.createExpectedSchemaImportTs("TestSchema"),
      expectedSchemaTs: utils.createExpectedSchemaTsString("TestSchema"),
      expectedPropsImportTs: [
        new RegExp(`import { EntityProps } from "@itwin/core-common";`),
        new RegExp(`import { (?=.*\\b(Point2d)\\b)(?=.*\\b(Point3d)\\b).* } from "@itwin/core-geometry";`),
      ],
      expectedPropsTs: [utils.dedent`
        export interface EntityTestProps extends EntityProps {
          booleanProps?: boolean;
          stringProps?: string;
          binaryProps?: any;
          intProps?: number;
          doubleProps?: number;
          longProps?: any;
          point2DProps?: Point2d;
          point3DProps?: Point3d;
        }`,
      ],
      expectedElemImportTs: [
        new RegExp(`import { (?=.*\\b(Entity)\\b)(?=.*\\b(IModelDb)\\b).* } from "@itwin/core-backend";`),
        new RegExp(`import { EntityTestProps } from "./TestSchemaElementProps";`),
      ],
      expectedElemTs: [utils.dedent`
        export class EntityTest extends Entity implements EntityTestProps {
          public static get className(): string { return "EntityTest"; }

          public constructor (props: EntityTestProps, iModel: IModelDb) {
            super(props, iModel);
          }
        }`,
      ],
    },

    // Test Case: Struct class with only primitive properties
    {
      testName: `struct class with only primitive properties`,
      referenceXmls: [],
      schemaXml: `<?xml version="1.0" encoding="utf-8"?>
        <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECStructClass typeName="StructTest" description="struct" modifier="None">
            <ECProperty propertyName="booleanProps" typeName="boolean"/>
            <ECProperty propertyName="stringProps" typeName="string"/>
            <ECProperty propertyName="binaryProps" typeName="binary"/>
            <ECProperty propertyName="point2DProps" typeName="point2d"/>
            <ECProperty propertyName="point3DProps" typeName="point3d"/>
          </ECStructClass>
        </ECSchema>`,
      expectedSchemaImportTs: utils.createExpectedSchemaImportTs("TestSchema"),
      expectedSchemaTs: utils.createExpectedSchemaTsString("TestSchema"),
      expectedPropsImportTs: [ new RegExp(`import { (?=.*\\b(Point2d)\\b)(?=.*\\b(Point3d)\\b).* } from "@itwin/core-geometry";`) ],
      expectedPropsTs: [utils.dedent`
        export interface StructTest {
          booleanProps?: boolean;
          stringProps?: string;
          binaryProps?: any;
          point2DProps?: Point2d;
          point3DProps?: Point3d;
        }`,
      ],
      expectedElemImportTs: [],
      expectedElemTs: [],
    },

    // Test Case: Mixin with only primitive properties
    {
      testName: `Mixin class with only primitive properties`,
      referenceXmls: [],
      schemaXml: `<?xml version="1.0" encoding="utf-8"?>
        <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECSchemaReference name="CoreCustomAttributes" version="01.00.00" alias="CoreCA"/>
          <ECEntityClass typeName="MixinTest" description="mixin" modifier="None">
            <ECCustomAttributes>
                <IsMixin xmlns="CoreCustomAttributes.01.00.00">
                    <AppliesToEntityClass>BaseEntity</AppliesToEntityClass>
                </IsMixin>
            </ECCustomAttributes>
            <ECProperty propertyName="booleanProps" typeName="boolean"/>
            <ECProperty propertyName="stringProps" typeName="string"/>
            <ECProperty propertyName="binaryProps" typeName="binary"/>
            <ECProperty propertyName="doubleProps" typeName="double"/>
          </ECEntityClass>
          <ECEntityClass typeName="BaseEntity" modifier="None">
          </ECEntityClass>
        </ECSchema>`,
      expectedSchemaImportTs: utils.createExpectedSchemaImportTs("TestSchema"),
      expectedSchemaTs: utils.createExpectedSchemaTsString("TestSchema"),
      expectedPropsImportTs: [],
      expectedPropsTs: [utils.dedent`
        export interface MixinTest {
          booleanProps?: boolean;
          stringProps?: string;
          binaryProps?: any;
          doubleProps?: number;
        }`,
      ],
      expectedElemImportTs: [
        new RegExp(`import { (?=.*\\b(Entity)\\b)(?=.*\\b(IModelDb)\\b).* } from "@itwin/core-backend";`),
      ],
      expectedElemTs: [utils.dedent`
        export class BaseEntity extends Entity {
          public static get className(): string { return "BaseEntity"; }

          public constructor (props: EntityProps, iModel: IModelDb) {
            super(props, iModel);
          }
        }`,
      ],
    },

    // Test Case: Enumeration
    {
      testName: `convert Enumeration to Ts`,
      referenceXmls: [],
      schemaXml: `<?xml version="1.0" encoding="utf-8"?>
        <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECEnumeration typeName="IntEnumeration" backingTypeName="int" description="Int Enumeration" displayLabel="This is a display label." isStrict="true">
              <ECEnumerator name="IntEnumeration1" value="1" displayLabel="First"/>
              <ECEnumerator name="IntEnumeration2" value="2" displayLabel="Second"/>
              <ECEnumerator name="IntEnumeration3" value="3" displayLabel="Third"/>
          </ECEnumeration>
          <ECEnumeration typeName="StringEnumeration" backingTypeName="string" description="String Enumeration" isStrict="true">
              <ECEnumerator name="spring" value="spring" displayLabel="FirstSeason"/>
              <ECEnumerator name="summer" value="summer" displayLabel="SecondSeason"/>
              <ECEnumerator name="fall" value="fall" displayLabel="ThirdSeason"/>
              <ECEnumerator name="winter" value="winter" displayLabel="FourthSeason"/>
          </ECEnumeration>
          <ECEntityClass typeName="BaseEntity" modifier="None">
            <ECProperty propertyName="intEnumProps" typeName="IntEnumeration"/>
            <ECProperty propertyName="stringEnumProps" typeName="StringEnumeration"/>
          </ECEntityClass>
        </ECSchema>`,
      expectedSchemaImportTs: utils.createExpectedSchemaImportTs("TestSchema"),
      expectedSchemaTs: utils.createExpectedSchemaTsString("TestSchema"),
      expectedPropsImportTs: [
        new RegExp(`import { (?=.*\\b(IntEnumeration)\\b)(?=.*\\b(StringEnumeration)\\b).* } from "./TestSchemaElements";`),
        new RegExp(`import { EntityProps } from "@itwin/core-common";`),
      ],
      expectedPropsTs: [utils.dedent`
        export interface BaseEntityProps extends EntityProps {
          intEnumProps?: IntEnumeration;
          stringEnumProps?: StringEnumeration;
        }`,
      ],
      expectedElemImportTs: [
        new RegExp(`import { (?=.*\\b(Entity)\\b)(?=.*\\b(IModelDb)\\b).* } from "@itwin/core-backend";`),
        new RegExp(`import { BaseEntityProps } from "./TestSchemaElementProps";`),
      ],
      expectedElemTs: [utils.dedent`
        export const enum IntEnumeration {
          First = 1,
          Second = 2,
          Third = 3,
        }`, utils.dedent`
        export const enum StringEnumeration {
          FirstSeason = "spring",
          SecondSeason = "summer",
          ThirdSeason = "fall",
          FourthSeason = "winter",
        }`, utils.dedent`
        export class BaseEntity extends Entity implements BaseEntityProps {
          public static get className(): string { return "BaseEntity"; }

          public constructor (props: BaseEntityProps, iModel: IModelDb) {
            super(props, iModel);
          }
        }`,
      ],
    },

    // Test Case: Entity class with struct, enumeration, primitive and struct array properties
    {
      testName: `convert Entity class derived from another entity class to Ts`,
      referenceXmls: [],
      schemaXml: `<?xml version="1.0" encoding="utf-8"?>
        <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECEntityClass typeName="EntityTest" modifier="None">
              <ECStructProperty propertyName="structProps" typeName="StructTest"/>
              <ECProperty propertyName="intEnumProps" typeName="IntEnumeration"/>
              <ECProperty propertyName="stringEnumProps" typeName="StringEnumeration"/>
              <ECArrayProperty propertyName="stringArrayProps" typeName="string" minOccurs="0" maxOccurs="unbounded"/>
              <ECStructArrayProperty propertyName="structArrayProps" typeName="StructTest" minOccurs="0" maxOccurs="unbounded"/>
          </ECEntityClass>
          <ECStructClass typeName="StructTest" description="struct" modifier="None">
            <ECProperty propertyName="booleanProps" typeName="boolean"/>
            <ECProperty propertyName="stringProps" typeName="string"/>
            <ECProperty propertyName="binaryProps" typeName="binary"/>
            <ECProperty propertyName="point2DProps" typeName="point2d"/>
            <ECProperty propertyName="point3DProps" typeName="point3d"/>
          </ECStructClass>
          <ECEnumeration typeName="IntEnumeration" backingTypeName="int" description="Int Enumeration" displayLabel="This is a display label." isStrict="true">
              <ECEnumerator name="IntEnumeration1" value="1" displayLabel="First"/>
              <ECEnumerator name="IntEnumeration2" value="2" displayLabel="Second"/>
              <ECEnumerator name="IntEnumeration3" value="3" displayLabel="Third"/>
          </ECEnumeration>
          <ECEnumeration typeName="StringEnumeration" backingTypeName="string" description="String Enumeration" isStrict="true">
              <ECEnumerator name="spring" value="spring" displayLabel="FirstSeason"/>
              <ECEnumerator name="summer" value="summer" displayLabel="SecondSeason"/>
              <ECEnumerator name="fall" value="fall" displayLabel="ThirdSeason"/>
              <ECEnumerator name="winter" value="winter" displayLabel="FourthSeason"/>
          </ECEnumeration>
        </ECSchema>`,
      expectedSchemaImportTs: utils.createExpectedSchemaImportTs("TestSchema"),
      expectedSchemaTs: utils.createExpectedSchemaTsString("TestSchema"),
      expectedPropsImportTs: [
        new RegExp(`import { (?=.*\\b(EntityProps)\\b).* } from "@itwin/core-common";`),
        new RegExp(`import { (?=.*\\b(Point2d)\\b)(?=.*\\b(Point3d)\\b).* } from "@itwin/core-geometry";`),
        new RegExp(`import { (?=.*\\b(IntEnumeration)\\b)(?=.*\\b(StringEnumeration)\\b).* } from "./TestSchemaElements";`),
      ],
      expectedPropsTs: [utils.dedent`
        export interface StructTest {
          booleanProps?: boolean;
          stringProps?: string;
          binaryProps?: any;
          point2DProps?: Point2d;
          point3DProps?: Point3d;
        }`, utils.dedent`
        export interface EntityTestProps extends EntityProps {
          structProps?: StructTest;
          intEnumProps?: IntEnumeration;
          stringEnumProps?: StringEnumeration;
          stringArrayProps?: string[];
          structArrayProps?: StructTest[];
        }`,
      ],
      expectedElemImportTs: [
        new RegExp(`import { (?=.*\\b(Entity)\\b)(?=.*\\b(IModelDb)\\b).* } from "@itwin/core-backend";`),
        new RegExp(`import { (?=.*\\b(EntityTestProps)\\b).* } from "./TestSchemaElementProps";`),
      ],
      expectedElemTs: [utils.dedent`
        export const enum IntEnumeration {
          First = 1,
          Second = 2,
          Third = 3,
        }`, utils.dedent`
        export const enum StringEnumeration {
          FirstSeason = "spring",
          SecondSeason = "summer",
          ThirdSeason = "fall",
          FourthSeason = "winter",
        }`, utils.dedent`
        export class EntityTest extends Entity implements EntityTestProps {
          public static get className(): string { return "EntityTest"; }

          public constructor (props: EntityTestProps, iModel: IModelDb) {
            super(props, iModel);
          }
        }`,
      ],
    },

    // Test Case: Entity class derived from another entity class (only one inheritance)
    {
      testName: `convert Entity class derived from another entity class to Ts`,
      referenceXmls: [],
      schemaXml: `<?xml version="1.0" encoding="utf-8"?>
        <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECEntityClass typeName="DerivedEntityTest" modifier="None">
              <BaseClass>BaseEntityTest</BaseClass>
              <ECProperty propertyName="derivedIntProps" typeName="int"/>
          </ECEntityClass>
          <ECEntityClass typeName="BaseEntityTest" modifier="None">
              <ECProperty propertyName="intProps" typeName="int"/>
              <ECProperty propertyName="stringProps" typeName="string"/>
          </ECEntityClass>
        </ECSchema>`,
      expectedSchemaImportTs: utils.createExpectedSchemaImportTs("TestSchema"),
      expectedSchemaTs: utils.createExpectedSchemaTsString("TestSchema"),
      expectedPropsImportTs: [
        new RegExp(`import { EntityProps } from "@itwin/core-common";`),
      ],
      expectedPropsTs: [utils.dedent`
        export interface BaseEntityTestProps extends EntityProps {
          intProps?: number;
          stringProps?: string;
        }`, utils.dedent`
        export interface DerivedEntityTestProps extends BaseEntityTestProps {
          derivedIntProps?: number;
        }`,
      ],
      expectedElemImportTs: [
        new RegExp(`import { (?=.*\\b(Entity)\\b)(?=.*\\b(IModelDb)\\b).* } from "@itwin/core-backend";`),
        new RegExp(`import { (?=.*\\b(DerivedEntityTestProps)\\b)(?=.*\\b(BaseEntityTestProps)\\b).* } from "./TestSchemaElementProps";`),
      ],
      expectedElemTs: [utils.dedent`
        export class BaseEntityTest extends Entity implements BaseEntityTestProps {
          public static get className(): string { return "BaseEntityTest"; }

          public constructor (props: BaseEntityTestProps, iModel: IModelDb) {
            super(props, iModel);
          }
        }`, utils.dedent`
        export class DerivedEntityTest extends BaseEntityTest implements DerivedEntityTestProps {
          public static get className(): string { return "DerivedEntityTest"; }

          public constructor (props: DerivedEntityTestProps, iModel: IModelDb) {
            super(props, iModel);
          }
        }`,
      ],
    },

    // Test Case: convert Entity class derived from another entity and mixin to ts
    {
      testName: `convert Entity class derived from another entity class and mixin to Ts`,
      referenceXmls: [],
      schemaXml: `<?xml version="1.0" encoding="utf-8"?>
        <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECEntityClass typeName="DerivedEntityTest" modifier="None">
              <BaseClass>BaseEntityTest</BaseClass>
              <BaseClass>MixinTest</BaseClass>
              <BaseClass>DerivedMixinTest</BaseClass>
              <ECProperty propertyName="derivedIntProps" typeName="int"/>
          </ECEntityClass>
          <ECEntityClass typeName="BaseEntityTest" modifier="None">
              <ECProperty propertyName="intProps" typeName="int"/>
              <ECProperty propertyName="stringProps" typeName="string"/>
          </ECEntityClass>
          <ECEntityClass typeName="DerivedMixinTest" description="derived mixin" modifier="None">
            <ECCustomAttributes>
                <IsMixin xmlns="CoreCustomAttributes.01.00.00">
                    <AppliesToEntityClass>DerivedEntityTest</AppliesToEntityClass>
                </IsMixin>
            </ECCustomAttributes>
            <BaseClass>MixinTest</BaseClass>
            <ECProperty propertyName="binaryProps" typeName="binary"/>
            <ECProperty propertyName="doubleProps" typeName="double"/>
          </ECEntityClass>
          <ECEntityClass typeName="MixinTest" description="mixin" modifier="None">
            <ECCustomAttributes>
                <IsMixin xmlns="CoreCustomAttributes.01.00.00">
                    <AppliesToEntityClass>DerivedEntityTest</AppliesToEntityClass>
                </IsMixin>
            </ECCustomAttributes>
            <ECProperty propertyName="booleanProps" typeName="boolean"/>
            <ECProperty propertyName="stringProps" typeName="string"/>
            <ECProperty propertyName="binaryProps" typeName="binary"/>
            <ECProperty propertyName="doubleProps" typeName="double"/>
          </ECEntityClass>
        </ECSchema>`,
      expectedSchemaImportTs: utils.createExpectedSchemaImportTs("TestSchema"),
      expectedSchemaTs: utils.createExpectedSchemaTsString("TestSchema"),
      expectedPropsImportTs: [
        new RegExp(`import { EntityProps } from "@itwin/core-common";`),
      ],
      expectedPropsTs: [utils.dedent`
        export interface MixinTest {
          booleanProps?: boolean;
          stringProps?: string;
          binaryProps?: any;
          doubleProps?: number;
        }`, utils.dedent`
        export interface DerivedMixinTest extends MixinTest {
          binaryProps?: any;
          doubleProps?: number;
        }`, utils.dedent`
        export interface BaseEntityTestProps extends EntityProps {
          intProps?: number;
          stringProps?: string;
        }`, utils.dedent`
        export interface DerivedEntityTestProps extends BaseEntityTestProps, MixinTest, DerivedMixinTest {
          derivedIntProps?: number;
        }`,
      ],
      expectedElemImportTs: [
        new RegExp(`import { (?=.*\\b(Entity)\\b)(?=.*\\b(IModelDb)\\b).* } from "@itwin/core-backend";`),
        new RegExp(`import { (?=.*\\b(DerivedEntityTestProps)\\b)(?=.*\\b(BaseEntityTestProps)\\b).* } from "./TestSchemaElementProps";`),
      ],
      expectedElemTs: [utils.dedent`
        export class BaseEntityTest extends Entity implements BaseEntityTestProps {
          public static get className(): string { return "BaseEntityTest"; }

          public constructor (props: BaseEntityTestProps, iModel: IModelDb) {
            super(props, iModel);
          }
        }`, utils.dedent`
        export class DerivedEntityTest extends BaseEntityTest implements DerivedEntityTestProps {
          public static get className(): string { return "DerivedEntityTest"; }

          public constructor (props: DerivedEntityTestProps, iModel: IModelDb) {
            super(props, iModel);
          }
        }`,
      ],
    },

    // Test Case: convert Struct class derived from another struct to Ts
    {
      testName: `convert struct class derived from another struct class to Ts`,
      referenceXmls: [],
      schemaXml: `<?xml version="1.0" encoding="utf-8"?>
        <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECStructClass typeName="DerivedStructTest" description="derived struct" modifier="None">
            <BaseClass>StructTest</BaseClass>
            <ECProperty propertyName="derivedIntProps" typeName="int"/>
          </ECStructClass>
          <ECStructClass typeName="StructTest" description="struct" modifier="None">
            <ECProperty propertyName="booleanProps" typeName="boolean"/>
            <ECProperty propertyName="stringProps" typeName="string"/>
            <ECProperty propertyName="binaryProps" typeName="binary"/>
            <ECProperty propertyName="point2DProps" typeName="point2d"/>
            <ECProperty propertyName="point3DProps" typeName="point3d"/>
          </ECStructClass>
        </ECSchema>`,
      expectedSchemaImportTs: utils.createExpectedSchemaImportTs("TestSchema"),
      expectedSchemaTs: utils.createExpectedSchemaTsString("TestSchema"),
      expectedPropsImportTs: [
        new RegExp(`import { (?=.*\\b(Point2d)\\b)(?=.*\\b(Point3d)\\b).* } from "@itwin/core-geometry";`),
      ],
      expectedPropsTs: [utils.dedent`
        export interface StructTest {
          booleanProps?: boolean;
          stringProps?: string;
          binaryProps?: any;
          point2DProps?: Point2d;
          point3DProps?: Point3d;
        }`, utils.dedent`
        export interface DerivedStructTest extends StructTest {
          derivedIntProps?: number;
        }`,
      ],
      expectedElemImportTs: [],
      expectedElemTs: [],
    },

    // Test Case: Entity class derived from one of the class in the BisCore
    {
      testName: `convert entity class derived from one of the class in BisCore to Ts`,
      referenceXmls: [],
      schemaXml: `<?xml version="1.0" encoding="utf-8"?>
        <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECSchemaReference name="CoreCustomAttributes" version="01.00.00" alias="CoreCA"/>
          <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
          <ECEntityClass typeName="DerivedGeometricElement2d" modifier="None">
            <BaseClass>bis:GeometricElement2d</BaseClass>
            <ECProperty propertyName="intProps" typeName="int"/>
            <ECProperty propertyName="doubleProps" typeName="double"/>
          </ECEntityClass>
          <ECEntityClass typeName="DerivedElement" modifier="None">
            <BaseClass>bis:Element</BaseClass>
            <ECProperty propertyName="intProps" typeName="int"/>
          </ECEntityClass>
          <ECEntityClass typeName="DerivedAnnotationElement2d" modifier="None">
            <BaseClass>bis:AnnotationElement2d</BaseClass>
          </ECEntityClass>
        </ECSchema>`,
      expectedSchemaImportTs: utils.createExpectedSchemaImportTs("TestSchema"),
      expectedSchemaTs: utils.createExpectedSchemaTsString("TestSchema"),
      expectedPropsImportTs: [
        new RegExp(`import { (?=.*\\b(GeometricElement2dProps)\\b)(?=.*\\b(ElementProps)\\b).* } from "@itwin/core-common";`),
      ],
      expectedPropsTs: [utils.dedent`
        export interface DerivedGeometricElement2dProps extends GeometricElement2dProps {
          intProps?: number;
          doubleProps?: number;
        }`, utils.dedent`
        export interface DerivedElementProps extends ElementProps {
          intProps?: number;
        }`,
      ],
      expectedElemImportTs: [
        new RegExp(`import { (?=.*\\b(IModelDb)\\b)(?=.*\\b(Element)\\b)(?=.*\\b(AnnotationElement2d)\\b)(?=.*\\b(GeometricElement2d)\\b).* } from "@itwin/core-backend";`),
        new RegExp(`import { (?=.*\\b(GeometricElement2dProps)\\b).* } from "@itwin/core-common";`),
        new RegExp(`import { (?=.*\\b(DerivedGeometricElement2dProps)\\b)(?=.*\\b(DerivedElementProps)\\b).* } from "./TestSchemaElementProps";`),
      ],
      expectedElemTs: [utils.dedent`
        export class DerivedGeometricElement2d extends GeometricElement2d implements DerivedGeometricElement2dProps {
          public static get className(): string { return "DerivedGeometricElement2d"; }

          public constructor (props: DerivedGeometricElement2dProps, iModel: IModelDb) {
            super(props, iModel);
          }
        }`, utils.dedent`
        export class DerivedElement extends Element implements DerivedElementProps {
          public static get className(): string { return "DerivedElement"; }

          public constructor (props: DerivedElementProps, iModel: IModelDb) {
            super(props, iModel);
          }
        }`, utils.dedent`
        export class DerivedAnnotationElement2d extends AnnotationElement2d {
          public static get className(): string { return "DerivedAnnotationElement2d"; }

          public constructor (props: GeometricElement2dProps, iModel: IModelDb) {
            super(props, iModel);
          }
        }`,
      ],
    },

    // Test Case: Entity class has no properties
    {
      testName: `convert entity class has no properties to Ts`,
      referenceXmls: [],
      schemaXml: `<?xml version="1.0" encoding="utf-8"?>
        <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECSchemaReference name="CoreCustomAttributes" version="01.00.00" alias="CoreCA"/>
          <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
          <ECEntityClass typeName="DerivedElementTest" description="Derived Element Test class" modifier="None">
            <BaseClass>bis:Element</BaseClass>
          </ECEntityClass>
          <ECEntityClass typeName="DerivedEntityTest" description="Derived Entity Test class" modifier="None">
              <BaseClass>BaseEntityTest</BaseClass>
          </ECEntityClass>
          <ECEntityClass typeName="BaseEntityTest" description="Base Entity Test class" modifier="None">
            <ECProperty propertyName="intProps" typeName="int"/>
            <ECProperty propertyName="stringProps" typeName="string"/>
          </ECEntityClass>
        </ECSchema>`,
      expectedSchemaImportTs: utils.createExpectedSchemaImportTs("TestSchema"),
      expectedSchemaTs: utils.createExpectedSchemaTsString("TestSchema"),
      expectedPropsImportTs: [
        new RegExp(`import { (?=.*\\b(EntityProps)\\b).* } from "@itwin/core-common";`),
      ],
      expectedPropsTs: [utils.dedent`
        export interface BaseEntityTestProps extends EntityProps {
          intProps?: number;
          stringProps?: string;
        }`,
      ],
      expectedElemImportTs: [
        new RegExp(`import { (?=.*\\b(Entity)\\b)(?=.*\\b(IModelDb)\\b)(?=.*\\b(Element)\\b).* } from "@itwin/core-backend";`),
        new RegExp(`import { (?=.*\\b(ElementProps)\\b).* } from "@itwin/core-common";`),
        new RegExp(`import { (?=.*\\b(BaseEntityTestProps)\\b).* } from "./TestSchemaElementProps";`),
      ],
      expectedElemTs: [utils.dedent`
        export class DerivedElementTest extends Element {
          public static get className(): string { return "DerivedElementTest"; }

          public constructor (props: ElementProps, iModel: IModelDb) {
            super(props, iModel);
          }
        }`, utils.dedent`
        export class BaseEntityTest extends Entity implements BaseEntityTestProps {
          public static get className(): string { return "BaseEntityTest"; }

          public constructor (props: BaseEntityTestProps, iModel: IModelDb) {
            super(props, iModel);
          }
        }`, utils.dedent`
        export class DerivedEntityTest extends BaseEntityTest {
          public static get className(): string { return "DerivedEntityTest"; }

          public constructor (props: BaseEntityTestProps, iModel: IModelDb) {
            super(props, iModel);
          }
        }`,
      ],
    },

    // Test Case: correct order of base classes
    {
      testName: `Test Order of Base Classes`,
      referenceXmls: [],
      schemaXml: `<?xml version="1.0" encoding="utf-8"?>
        <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECSchemaReference name="CoreCustomAttributes" version="01.00.00" alias="CoreCA"/>
          <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
          <ECEntityClass typeName="DerivedElementTest" description="Derived Element Test class" modifier="None">
            <BaseClass>BaseEntity</BaseClass>
            <ECProperty propertyName="stringProps" typeName="string"/>
          </ECEntityClass>
          <ECEntityClass typeName="BaseEntity" description="Base Entity Test class" modifier="None">
            <BaseClass>NormalEntity</BaseClass>
            <ECProperty propertyName="intProps" typeName="int"/>
          </ECEntityClass>
          <ECEntityClass typeName="Mixin" description="This Is A Mixin class" modifier="None">
            <ECCustomAttributes>
              <IsMixin xmlns="CoreCustomAttributes.01.00.00">
                  <AppliesToEntityClass>NormalEntity</AppliesToEntityClass>
              </IsMixin>
            </ECCustomAttributes>
            <ECProperty propertyName="booleanProps" typeName="boolean"/>
            <ECProperty propertyName="stringProps" typeName="string"/>
            <ECProperty propertyName="binaryProps" typeName="binary"/>
            <ECProperty propertyName="doubleProps" typeName="double"/>
          </ECEntityClass>
          <ECEntityClass typeName="NormalEntity" description="Normal Test class" modifier="None">
            <BaseClass>bis:AnnotationElement2d</BaseClass>
            <BaseClass>Mixin</BaseClass>
            <ECProperty propertyName="intProps" typeName="int"/>
            <ECProperty propertyName="stringProps" typeName="string"/>
          </ECEntityClass>
        </ECSchema>`,
      expectedSchemaImportTs: utils.createExpectedSchemaImportTs("TestSchema"),
      expectedSchemaTs: utils.createExpectedSchemaTsString("TestSchema"),
      expectedPropsImportTs: [
        new RegExp(`import { (?=.*\\b(GeometricElement2dProps)\\b).* } from "@itwin/core-common";`),
      ],
      expectedPropsTs: [utils.dedent`
        /**
         * This Is A Mixin class
         */
        export interface Mixin {
          booleanProps?: boolean;
          stringProps?: string;
          binaryProps?: any;
          doubleProps?: number;
        }

        export interface NormalEntityProps extends GeometricElement2dProps, Mixin {
          intProps?: number;
          stringProps?: string;
        }

        export interface BaseEntityProps extends NormalEntityProps {
          intProps?: number;
        }

        export interface DerivedElementTestProps extends BaseEntityProps {
          stringProps?: string;
        }`,
      ],
      expectedElemImportTs: [
        new RegExp(`import { (?=.*\\b(AnnotationElement2d)\\b)(?=.*\\b(IModelDb)\\b).* } from "@itwin/core-backend";`),
        new RegExp(`import { (?=.*\\b(NormalEntityProps)\\b)(?=.*\\b(BaseEntityProps)\\b)(?=.*\\b(DerivedElementTestProps)\\b).* } from "./TestSchemaElementProps";`),
      ],
      expectedElemTs: [utils.dedent`
        /**
         * Normal Test class
         */
        export class NormalEntity extends AnnotationElement2d implements NormalEntityProps {
          public static get className(): string { return "NormalEntity"; }

          public constructor (props: NormalEntityProps, iModel: IModelDb) {
            super(props, iModel);
          }
        }

        /**
         * Base Entity Test class
         */
        export class BaseEntity extends NormalEntity implements BaseEntityProps {
          public static get className(): string { return "BaseEntity"; }

          public constructor (props: BaseEntityProps, iModel: IModelDb) {
            super(props, iModel);
          }
        }

        /**
         * Derived Element Test class
         */
        export class DerivedElementTest extends BaseEntity implements DerivedElementTestProps {
          public static get className(): string { return "DerivedElementTest"; }

          public constructor (props: DerivedElementTestProps, iModel: IModelDb) {
            super(props, iModel);
          }
        }`,
      ],
    },

    // Test Case: Xml Deserialization should not crash when references Units and Formats
    {
      testName: "Xml Deserialization should not crash when parsing Units and Formats",
      referenceXmls: [],
      schemaXml: `<?xml version="1.0" encoding="utf-8"?>
        <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECSchemaReference name="Units" version="01.00.00" alias="u"/>
          <ECSchemaReference name="Formats" version="01.00.00" alias="f"/>
        </ECSchema>`,
      expectedSchemaImportTs: utils.createExpectedSchemaImportTs("TestSchema"),
      expectedSchemaTs: utils.createExpectedSchemaTsString("TestSchema"),
      expectedPropsImportTs: [],
      expectedPropsTs: [],
      expectedElemImportTs: [],
      expectedElemTs: [],
    },

    // Test Case: Xml Deserialization should not crash when parsing KoQ's persistentUnit and presentationUnits
    {
      testName: "Xml Deserialization should not crash when parsing KoQ's persistentUnit and presentationUnits",
      referenceXmls: [],
      schemaXml: `<?xml version="1.0" encoding="utf-8"?>
        <ECSchema schemaName="TestSchema" alias="ts" version="1.0.0" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECSchemaReference name="Units" version="01.00.00" alias="u"/>
          <ECSchemaReference name="Formats" version="01.00.00" alias="f"/>
          <ECEntityClass typeName="TestEntity" description="TestEntity Test class" modifier="None">
            <ECArrayProperty propertyName="intArrayProp" typeName="int" minimumValue="0" maximumValue="10000" kindOfQuantity="KindOfQuantity"/>
            <ECProperty propertyName="doubleProp" typeName="double" minimumValue="0" maximumValue="10000" kindOfQuantity="KindOfQuantityAlternative"/>
          </ECEntityClass>
          <KindOfQuantity typeName="KindOfQuantity"
                          description="Kind of Quantity Description"
                          displayLabel="Kind of Quantity"
                          persistenceUnit="u:CM"
                          relativeError="0.001"
                          presentationUnits="f:DefaultReal(6)[u:FT|feet];f:DefaultReal[u:IN|inch];f:DefaultReal(8)[u:CM|centimeter][u:M|meter]"/>
          <KindOfQuantity typeName="KindOfQuantityAlternative"
                          description="Kind of Quantity Description"
                          displayLabel="Kind of Quantity"
                          persistenceUnit="u:CM"
                          relativeError="1E-3"
                          presentationUnits="f:DefaultReal(6)[u:FT|feet];f:DefaultReal[u:IN|inch];f:DefaultReal(8)[u:CM|centimeter][u:M|meter]"/>
        </ECSchema>`,
      expectedSchemaImportTs: utils.createExpectedSchemaImportTs("TestSchema"),
      expectedSchemaTs: utils.createExpectedSchemaTsString("TestSchema"),
      expectedPropsImportTs: [
        new RegExp(`import { EntityProps } from "@itwin/core-common";`),
      ],
      expectedPropsTs: [utils.dedent`
        export interface TestEntityProps extends EntityProps {
          intArrayProp?: number[];
          doubleProp?: number;
        }`,
      ],
      expectedElemImportTs: [
        new RegExp(`import { (?=.*\\b(Entity)\\b)(?=.*\\b(IModelDb)\\b).* } from "@itwin/core-backend";`),
        new RegExp(`import { TestEntityProps } from "./TestSchemaElementProps";`),
      ],
      expectedElemTs: [utils.dedent`
        export class TestEntity extends Entity implements TestEntityProps {
          public static get className(): string { return "TestEntity"; }

          public constructor (props: TestEntityProps, iModel: IModelDb) {
            super(props, iModel);
          }
        }`,
      ],
    },
  ];

  utils.testGeneratedSchemaTypescript(testCases);
});
