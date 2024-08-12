/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { DbResult, Id64, Id64String } from "@itwin/core-bentley";
import {
  BriefcaseIdValue, Code, ColorDef, ElementAspectProps, ElementGeometry, GeometricElementProps, GeometryStreamProps, IModel, PhysicalElementProps,
  Placement3dProps, QueryRowFormat, SubCategoryAppearance,
} from "@itwin/core-common";
import { Angle, Arc3d, Cone, IModelJson as GeomJson, LineSegment3d, Point2d, Point3d } from "@itwin/core-geometry";
import { _nativeDb, ECSqlStatement, IModelDb, IModelJsFs, PhysicalModel, PhysicalObject, SnapshotDb, SpatialCategory } from "../../core-backend";
import { ElementRefersToElements } from "../../Relationship";
import { IModelTestUtils } from "../IModelTestUtils";

/* eslint-disable @typescript-eslint/naming-convention */

interface IPrimitiveBase {
  i?: number;
  l?: number;
  d?: number;
  b?: boolean;
  dt?: string;
  s?: string;
  bin?: Uint8Array;
  p2d?: Point2d;
  p3d?: Point3d;
  g?: GeometryStreamProps;
}

interface IPrimitive extends IPrimitiveBase {
  st?: ComplexStruct;
}

interface IPrimitiveArrayBase {
  array_i?: number[];
  array_l?: number[];
  array_d?: number[];
  array_b?: boolean[];
  array_dt?: string[];
  array_s?: string[];
  array_bin?: Uint8Array[];
  array_p2d?: Point2d[];
  array_p3d?: Point3d[];
  array_g?: GeometryStreamProps[];
  array_st?: ComplexStruct[];
}

interface IPrimitiveArray extends IPrimitiveArrayBase {
  array_st?: ComplexStruct[];
}

interface ComplexStruct extends IPrimitiveArrayBase, IPrimitiveBase { }

interface TestElement extends IPrimitive, IPrimitiveArray, GeometricElementProps { }

interface TestElementAspect extends IPrimitive, IPrimitiveArray, ElementAspectProps { }

interface TestElementRefersToElements extends IPrimitive, IPrimitiveArray, ElementRefersToElements { }

function verifyPrimitiveBase(actualValue: IPrimitiveBase, expectedValue: IPrimitiveBase) {
  if (expectedValue.i !== undefined)
    assert.equal(actualValue.i, expectedValue.i, "'integer' type property did not roundtrip as expected");
  if (expectedValue.l !== undefined)
    assert.equal(actualValue.l, expectedValue.l, "'long' type property did not roundtrip as expected");
  if (expectedValue.d !== undefined)
    assert.equal(actualValue.d, expectedValue.d, "'double' type property did not roundtrip as expected");
  if (expectedValue.b !== undefined)
    assert.equal(actualValue.b, expectedValue.b, "'boolean' type property did not roundtrip as expected");
  if (expectedValue.dt !== undefined)
    assert.equal(actualValue.dt, expectedValue.dt, "'dateTime' type property did not roundtrip as expected");
  if (expectedValue.s !== undefined)
    assert.equal(actualValue.s, expectedValue.s, "'string' type property did not roundtrip as expected");
  if (expectedValue.p2d) {
    assert.equal(actualValue.p2d?.x, expectedValue.p2d.x, "'Point2d.x' type property did not roundtrip as expected");
    assert.equal(actualValue.p2d?.y, expectedValue.p2d.y, "'Point2d.y' type property did not roundtrip as expected");
  } else if(expectedValue.p2d === null) {
    assert.equal(actualValue.p2d, expectedValue.p2d, "'Point2d' type property did not roundtrip as expected.");
  }
  if (expectedValue.p3d) {
    assert.equal(actualValue.p3d?.x, expectedValue.p3d.x, "'Point3d.x' type property did not roundtrip as expected");
    assert.equal(actualValue.p3d?.y, expectedValue.p3d.y, "'Point3d.y' type property did not roundtrip as expected");
    assert.equal(actualValue.p3d?.z, expectedValue.p3d.z, "'Point3d.z' type property did not roundtrip as expected");
  } else if(expectedValue.p3d === null) {
    assert.equal(actualValue.p3d, expectedValue.p3d, "'Point3d' type property did not roundtrip as expected.");
  }
  if (expectedValue.bin) {
    assert.isTrue(blobEqual(actualValue.bin, expectedValue.bin), "'binary' type property did not roundtrip as expected");
  } else if(expectedValue.bin === null) {
    assert.equal(actualValue.bin, expectedValue.bin, "'binary' type property did not roundtrip as expected.");
  }
  if (expectedValue.g) {
    expect(actualValue.g, "'geometry' type property did not roundtrip as expected.").to.deep.equal(expectedValue.g);
  } else if(expectedValue.g === null) {
    assert.equal(actualValue.g, expectedValue.g, "'geometry' type property did not roundtrip as expected.");
  }
}

function verifyPrimitiveArrayBase(actualValue: IPrimitiveArrayBase, expectedValue: IPrimitiveArrayBase) {
  if (expectedValue.array_bin) {
    assert.equal(actualValue.array_bin!.length, expectedValue.array_bin.length, "'binary[].length' array length mismatch");
    expectedValue.array_bin.forEach((value, index) => {
      if(value) {
        assert.isTrue(blobEqual(actualValue.array_bin![index], value), "'binary[]' type property did not roundtrip as expected");
      } else if(value === null) {
        assert.equal(actualValue.array_bin![index], value, "'binary[]' type property did not roundtrip as expected");
      }
    });
  } else if(expectedValue.array_bin === null) {
    assert.equal(actualValue.array_bin, expectedValue.array_bin, "'binary[]' type property did not roundtrip as expected.");
  }

  if (expectedValue.array_i) {
    assert.equal(actualValue.array_i!.length, expectedValue.array_i.length, "'integer[].length' array length mismatch");
    expectedValue.array_i.forEach((value, index) => {
      assert.equal(actualValue.array_i![index], value, "'integer[]' type property did not roundtrip as expected");
    });
  } else if(expectedValue.array_i === null) {
    assert.equal(actualValue.array_i, expectedValue.array_i, "'integer[]' type property did not roundtrip as expected.");
  }

  if (expectedValue.array_l) {
    assert.equal(actualValue.array_l!.length, expectedValue.array_l.length, "'long[].length' array length mismatch");
    expectedValue.array_l.forEach((value, index) => {
      assert.equal(actualValue.array_l![index], value, "'long[]' type property did not roundtrip as expected");
    });
  } else if(expectedValue.array_l === null) {
    assert.equal(actualValue.array_l, expectedValue.array_l, "'long[]' type property did not roundtrip as expected.");
  }

  if (expectedValue.array_d) {
    assert.equal(actualValue.array_d!.length, expectedValue.array_d.length, "'double[].length' array length mismatch");
    expectedValue.array_d.forEach((value, index) => {
      assert.equal(actualValue.array_d![index], value, "'double[]' type property did not roundtrip as expected");
    });
  } else if(expectedValue.array_d === null) {
    assert.equal(actualValue.array_d, expectedValue.array_d, "'double[]' type property did not roundtrip as expected.");
  }

  if (expectedValue.array_b) {
    assert.equal(actualValue.array_b!.length, expectedValue.array_b.length, "'boolean[].length' array length mismatch");
    expectedValue.array_b.forEach((value, index) => {
      assert.equal(actualValue.array_b![index], value, "'boolean[]' type property did not roundtrip as expected");
    });
  } else if(expectedValue.array_b === null) {
    assert.equal(actualValue.array_b, expectedValue.array_b, "'boolean[]' type property did not roundtrip as expected.");
  }

  if (expectedValue.array_dt) {
    assert.equal(actualValue.array_dt!.length, expectedValue.array_dt.length, "'dateTime[].length' array length mismatch");
    expectedValue.array_dt.forEach((value, index) => {
      assert.equal(actualValue.array_dt![index], value, "'dateTime[]' type property did not roundtrip as expected");
    });
  } else if(expectedValue.array_dt === null) {
    assert.equal(actualValue.array_dt, expectedValue.array_dt, "'dateTime[]' type property did not roundtrip as expected.");
  }

  if (expectedValue.array_g) {
    assert.equal(actualValue.array_g!.length, expectedValue.array_g.length, "'geometry[].length' array length mismatch");
    expectedValue.array_g.forEach((value, index) => {
      if(value) {
        expect(actualValue.array_g![index], "'geometry[]' type property did not roundtrip as expected").to.deep.equal(value);
      } else if(value === null) {
        assert.equal(actualValue.array_g![index], value, "'geometry[]' type property did not roundtrip as expected");
      }
    });
  } else if(expectedValue.array_g === null) {
    assert.equal(actualValue.array_g, expectedValue.array_g, "'geometry[]' type property did not roundtrip as expected.");
  }

  if (expectedValue.array_s) {
    assert.equal(actualValue.array_s!.length, expectedValue.array_s.length, "'string[].length' array length mismatch");
    expectedValue.array_s.forEach((value, index) => {
      assert.equal(actualValue.array_s![index], value, "'string[]' type property did not roundtrip as expected");
    });
  } else if(expectedValue.array_s === null) {
    assert.equal(actualValue.array_s, expectedValue.array_s, "'string[]' type property did not roundtrip as expected.");
  }

  if (expectedValue.array_p2d) {
    assert.equal(actualValue.array_p2d!.length, expectedValue.array_p2d.length, "'point2d[].length' array length mismatch");
    expectedValue.array_p2d.forEach((value, index) => {
      if (value) {
        assert.equal(actualValue.array_p2d![index].x, value.x, "'point2d[].x' type property did not roundtrip as expected");
        assert.equal(actualValue.array_p2d![index].y, value.y, "'point2d[].y' type property did not roundtrip as expected");
      } else if (value === null) {
        assert.equal(actualValue.array_p2d![index], value, "'point2d[]' type property did not roundtrip as expected.");
      }
    });
  } else if(expectedValue.array_p2d === null) {
    assert.equal(actualValue.array_p2d, expectedValue.array_p2d, "'point2d[]' type property did not roundtrip as expected.");
  }

  if (expectedValue.array_p3d) {
    assert.equal(actualValue.array_p3d!.length, expectedValue.array_p3d.length, "'point3d[].length' array length mismatch");
    expectedValue.array_p3d.forEach((value, index) => {
      if(value) {
        assert.equal(actualValue.array_p3d![index].x, value.x, "'point3d[].x' type property did not roundtrip as expected");
        assert.equal(actualValue.array_p3d![index].y, value.y, "'point3d[].y' type property did not roundtrip as expected");
        assert.equal(actualValue.array_p3d![index].z, value.z, "'point3d[].z' type property did not roundtrip as expected");
      } else if(value === null) {
        assert.equal(actualValue.array_p3d![index], value, "'point3d[]' type property did not roundtrip as expected.");
      }
    });
  } else if(expectedValue.array_p3d === null) {
    assert.equal(actualValue.array_p3d, expectedValue.array_p3d, "'point3d[]' type property did not roundtrip as expected.");
  }
}

function verifyPrimitive(actualValue: IPrimitive, expectedValue: IPrimitive) {
  verifyPrimitiveBase(actualValue, expectedValue);
  if (expectedValue.st) {
    verifyPrimitive(actualValue.st!, expectedValue.st);
    verifyPrimitiveArray(actualValue.st!, expectedValue.st);
  } else if(expectedValue.st === null) {
    assert.equal(actualValue.st, expectedValue.st, "'ComplexStruct' type property did not roundtrip as expected.");
  }
}

function verifyPrimitiveArray(actualValue: IPrimitiveArray, expectedValue: IPrimitiveArray) {
  verifyPrimitiveArrayBase(actualValue, expectedValue);
  if (expectedValue.array_st) {
    assert.equal(actualValue.array_st!.length, expectedValue.array_st.length, "'struct[].length' array length mismatch");
    actualValue.array_st!.forEach((lhs: ComplexStruct, i: number) => {
      verifyPrimitiveBase(lhs, expectedValue.array_st![i]);
      verifyPrimitiveArrayBase(lhs, expectedValue.array_st![i]);
    });
  } else if(expectedValue.array_st === null) {
    assert.equal(actualValue.array_st, expectedValue.array_st, "'ComplexStruct[]' type property did not roundtrip as expected.");
  }
}

function verifyTestElement(actualValue: TestElement, expectedValue: TestElement) {
  verifyPrimitive(actualValue, expectedValue);
  verifyPrimitiveArray(actualValue, expectedValue);
}

function verifyTestElementAspect(actualValue: TestElementAspect, expectedValue: TestElementAspect) {
  verifyPrimitive(actualValue, expectedValue);
  verifyPrimitiveArray(actualValue, expectedValue);
}

function initElemProps(className: string, _iModelName: IModelDb, modId: Id64String, catId: Id64String, autoHandledProp: any): GeometricElementProps {
  // add Geometry
  const geomArray: Arc3d[] = [
    Arc3d.createXY(Point3d.create(0, 0), 5),
    Arc3d.createXY(Point3d.create(5, 5), 2),
    Arc3d.createXY(Point3d.create(-5, -5), 20),
  ];
  const geometryStream: GeometryStreamProps = [];
  for (const geom of geomArray) {
    const arcData = GeomJson.Writer.toIModelJson(geom);
    geometryStream.push(arcData);
  }
  // Create props
  const elementProps: GeometricElementProps = {
    classFullName: `ElementRoundTripTest:${className}`,
    model: modId,
    category: catId,
    code: Code.createEmpty(),
    geom: geometryStream,
  };

  if (autoHandledProp)
    Object.assign(elementProps, autoHandledProp);

  return elementProps;
}

function initElementAspectProps(className: string, _iModelName: IModelDb, elId: Id64String, autoHandledProp: any) {
  // Create props
  const elementProps: ElementAspectProps = {
    classFullName: `ElementRoundTripTest:${className}`,
    element: { id: elId },
  };

  if (autoHandledProp)
    Object.assign(elementProps, autoHandledProp);

  return elementProps;
}

function blobEqual(lhs: any, rhs: any) {
  if (!(lhs instanceof Uint8Array) || !(rhs instanceof Uint8Array))
    throw new Error("expecting uint8array");

  if (lhs.byteLength !== rhs.byteLength)
    return false;

  for (let i = 0; i < lhs.byteLength; i++) {
    if (lhs[i] !== rhs[i])
      return false;
  }
  return true;
}

function initElementRefersToElementsProps(className: string, _iModelName: IModelDb, elId1: Id64String, elId2: Id64String, autoHandledProp: any): TestElementRefersToElements {
  // Create props
  const result: TestElementRefersToElements = {
    classFullName: `ElementRoundTripTest:${className}`,
    sourceId: elId1,
    targetId: elId2,
  } as TestElementRefersToElements;

  if (autoHandledProp)
    Object.assign(result, autoHandledProp);

  return result;
}

describe("Element and ElementAspect roundtrip test for all type of properties", () => {
  const testSchema = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="ElementRoundTripTest" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
      <ECSchemaReference name="BisCore" version="01.00.04" alias="bis"/>
      <ECSchemaReference name="CoreCustomAttributes" version="01.00.03" alias="CoreCA"/>
      <ECEntityClass typeName="TestElement" modifier="None">
        <BaseClass>bis:PhysicalElement</BaseClass>
        <BaseClass>IPrimitive</BaseClass>
        <BaseClass>IPrimitiveArray</BaseClass>
      </ECEntityClass>
      <ECEntityClass typeName="TestElementAspect" modifier="None">
        <BaseClass>bis:ElementUniqueAspect</BaseClass>
        <BaseClass>IPrimitiveAspect</BaseClass>
        <BaseClass>IPrimitiveArrayAspect</BaseClass>
      </ECEntityClass>
      <ECRelationshipClass typeName="TestElementRefersToElements" strength="referencing" modifier="Sealed">
        <BaseClass>bis:ElementRefersToElements</BaseClass>
        <Source multiplicity="(0..*)" roleLabel="refers to" polymorphic="true">
            <Class class="TestElement"/>
        </Source>
        <Target multiplicity="(0..*)" roleLabel="is referenced by" polymorphic="true">
            <Class class="TestElement"/>
        </Target>
        <ECProperty propertyName="i" typeName="int"/>
        <ECProperty propertyName="l" typeName="long"/>
        <ECProperty propertyName="d" typeName="double"/>
        <ECProperty propertyName="b" typeName="boolean"/>
        <ECProperty propertyName="dt" typeName="dateTime"/>
        <ECProperty propertyName="s" typeName="string"/>
        <ECProperty propertyName="bin" typeName="binary"/>
        <ECProperty propertyName="p2d" typeName="point2d"/>
        <ECProperty propertyName="p3d" typeName="point3d"/>
        <ECProperty propertyName="g" typeName="Bentley.Geometry.Common.IGeometry"/>
        <!--<ECStructProperty propertyName="st" typeName="ComplexStruct"/>-->
        <ECArrayProperty propertyName="array_i" typeName="int"  minOccurs="0" maxOccurs="unbounded"/>
        <ECArrayProperty propertyName="array_l" typeName="long"  minOccurs="0" maxOccurs="unbounded"/>
        <ECArrayProperty propertyName="array_d" typeName="double"  minOccurs="0" maxOccurs="unbounded"/>
        <ECArrayProperty propertyName="array_b" typeName="boolean"  minOccurs="0" maxOccurs="unbounded"/>
        <ECArrayProperty propertyName="array_dt" typeName="dateTime"  minOccurs="0" maxOccurs="unbounded"/>
        <ECArrayProperty propertyName="array_s" typeName="string"  minOccurs="0" maxOccurs="unbounded"/>
        <ECArrayProperty propertyName="array_bin" typeName="binary"  minOccurs="0" maxOccurs="unbounded"/>
        <ECArrayProperty propertyName="array_p2d" typeName="point2d"  minOccurs="0" maxOccurs="unbounded"/>
        <ECArrayProperty propertyName="array_p3d" typeName="point3d"  minOccurs="0" maxOccurs="unbounded"/>
        <ECArrayProperty propertyName="array_g" typeName="Bentley.Geometry.Common.IGeometry"  minOccurs="0" maxOccurs="unbounded"/>
        <!--<ECStructArrayProperty propertyName="array_st" typeName="ComplexStruct"  minOccurs="0" maxOccurs="unbounded"/>-->
      </ECRelationshipClass>
      <ECEntityClass typeName="IPrimitive" modifier="Abstract">
        <ECCustomAttributes>
          <IsMixin xmlns="CoreCustomAttributes.01.00.03">
            <AppliesToEntityClass>bis:PhysicalElement</AppliesToEntityClass>
          </IsMixin>
        </ECCustomAttributes>
        <ECProperty propertyName="i" typeName="int"/>
        <ECProperty propertyName="l" typeName="long"/>
        <ECProperty propertyName="d" typeName="double"/>
        <ECProperty propertyName="b" typeName="boolean"/>
        <ECProperty propertyName="dt" typeName="dateTime"/>
        <ECProperty propertyName="s" typeName="string"/>
        <ECProperty propertyName="bin" typeName="binary"/>
        <ECProperty propertyName="p2d" typeName="point2d"/>
        <ECProperty propertyName="p3d" typeName="point3d"/>
        <ECProperty propertyName="g" typeName="Bentley.Geometry.Common.IGeometry"/>
        <ECStructProperty propertyName="st" typeName="ComplexStruct"/>
      </ECEntityClass>
      <ECEntityClass typeName="IPrimitiveAspect" modifier="Abstract">
        <ECCustomAttributes>
          <IsMixin xmlns="CoreCustomAttributes.01.00.03">
            <AppliesToEntityClass>bis:ElementUniqueAspect</AppliesToEntityClass>
          </IsMixin>
        </ECCustomAttributes>
        <ECProperty propertyName="i" typeName="int"/>
        <ECProperty propertyName="l" typeName="long"/>
        <ECProperty propertyName="d" typeName="double"/>
        <ECProperty propertyName="b" typeName="boolean"/>
        <ECProperty propertyName="dt" typeName="dateTime"/>
        <ECProperty propertyName="s" typeName="string"/>
        <ECProperty propertyName="bin" typeName="binary"/>
        <ECProperty propertyName="p2d" typeName="point2d"/>
        <ECProperty propertyName="p3d" typeName="point3d"/>
        <ECProperty propertyName="g" typeName="Bentley.Geometry.Common.IGeometry"/>
        <ECStructProperty propertyName="st" typeName="ComplexStruct"/>
      </ECEntityClass>
      <ECEntityClass typeName="IPrimitiveArray" modifier="Abstract">
        <ECCustomAttributes>
          <IsMixin xmlns="CoreCustomAttributes.01.00.03">
            <AppliesToEntityClass>bis:PhysicalElement</AppliesToEntityClass>
          </IsMixin>
        </ECCustomAttributes>
        <ECArrayProperty propertyName="array_i" typeName="int"  minOccurs="0" maxOccurs="unbounded"/>
        <ECArrayProperty propertyName="array_l" typeName="long"  minOccurs="0" maxOccurs="unbounded"/>
        <ECArrayProperty propertyName="array_d" typeName="double"  minOccurs="0" maxOccurs="unbounded"/>
        <ECArrayProperty propertyName="array_b" typeName="boolean"  minOccurs="0" maxOccurs="unbounded"/>
        <ECArrayProperty propertyName="array_dt" typeName="dateTime"  minOccurs="0" maxOccurs="unbounded"/>
        <ECArrayProperty propertyName="array_s" typeName="string"  minOccurs="0" maxOccurs="unbounded"/>
        <ECArrayProperty propertyName="array_bin" typeName="binary"  minOccurs="0" maxOccurs="unbounded"/>
        <ECArrayProperty propertyName="array_p2d" typeName="point2d"  minOccurs="0" maxOccurs="unbounded"/>
        <ECArrayProperty propertyName="array_p3d" typeName="point3d"  minOccurs="0" maxOccurs="unbounded"/>
        <ECArrayProperty propertyName="array_g" typeName="Bentley.Geometry.Common.IGeometry"  minOccurs="0" maxOccurs="unbounded"/>
        <ECStructArrayProperty propertyName="array_st" typeName="ComplexStruct"  minOccurs="0" maxOccurs="unbounded"/>
      </ECEntityClass>
      <ECEntityClass typeName="IPrimitiveArrayAspect" modifier="Abstract">
        <ECCustomAttributes>
          <IsMixin xmlns="CoreCustomAttributes.01.00.03">
            <AppliesToEntityClass>bis:ElementUniqueAspect</AppliesToEntityClass>
          </IsMixin>
        </ECCustomAttributes>
        <ECArrayProperty propertyName="array_i" typeName="int"  minOccurs="0" maxOccurs="unbounded"/>
        <ECArrayProperty propertyName="array_l" typeName="long"  minOccurs="0" maxOccurs="unbounded"/>
        <ECArrayProperty propertyName="array_d" typeName="double"  minOccurs="0" maxOccurs="unbounded"/>
        <ECArrayProperty propertyName="array_b" typeName="boolean"  minOccurs="0" maxOccurs="unbounded"/>
        <ECArrayProperty propertyName="array_dt" typeName="dateTime"  minOccurs="0" maxOccurs="unbounded"/>
        <ECArrayProperty propertyName="array_s" typeName="string"  minOccurs="0" maxOccurs="unbounded"/>
        <ECArrayProperty propertyName="array_bin" typeName="binary"  minOccurs="0" maxOccurs="unbounded"/>
        <ECArrayProperty propertyName="array_p2d" typeName="point2d"  minOccurs="0" maxOccurs="unbounded"/>
        <ECArrayProperty propertyName="array_p3d" typeName="point3d"  minOccurs="0" maxOccurs="unbounded"/>
        <ECArrayProperty propertyName="array_g" typeName="Bentley.Geometry.Common.IGeometry"  minOccurs="0" maxOccurs="unbounded"/>
        <ECStructArrayProperty propertyName="array_st" typeName="ComplexStruct"  minOccurs="0" maxOccurs="unbounded"/>
      </ECEntityClass>
      <ECStructClass typeName="ComplexStruct" modifier="None">
        <ECProperty propertyName="i" typeName="int"/>
        <ECProperty propertyName="l" typeName="long"/>
        <ECProperty propertyName="d" typeName="double"/>
        <ECProperty propertyName="b" typeName="boolean"/>
        <ECProperty propertyName="dt" typeName="dateTime"/>
        <ECProperty propertyName="s" typeName="string"/>
        <ECProperty propertyName="bin" typeName="binary"/>
        <ECProperty propertyName="p2d" typeName="point2d"/>
        <ECProperty propertyName="p3d" typeName="point3d"/>
        <ECProperty propertyName="g" typeName="Bentley.Geometry.Common.IGeometry"/>
        <ECArrayProperty propertyName="array_i" typeName="int"  minOccurs="0" maxOccurs="unbounded"/>
        <ECArrayProperty propertyName="array_l" typeName="long"  minOccurs="0" maxOccurs="unbounded"/>
        <ECArrayProperty propertyName="array_d" typeName="double"  minOccurs="0" maxOccurs="unbounded"/>
        <ECArrayProperty propertyName="array_b" typeName="boolean"  minOccurs="0" maxOccurs="unbounded"/>
        <ECArrayProperty propertyName="array_dt" typeName="dateTime"  minOccurs="0" maxOccurs="unbounded"/>
        <ECArrayProperty propertyName="array_s" typeName="string"  minOccurs="0" maxOccurs="unbounded"/>
        <ECArrayProperty propertyName="array_bin" typeName="binary"  minOccurs="0" maxOccurs="unbounded"/>
        <ECArrayProperty propertyName="array_p2d" typeName="point2d"  minOccurs="0" maxOccurs="unbounded"/>
        <ECArrayProperty propertyName="array_p3d" typeName="point3d"  minOccurs="0" maxOccurs="unbounded"/>
        <ECArrayProperty propertyName="array_g" typeName="Bentley.Geometry.Common.IGeometry"  minOccurs="0" maxOccurs="unbounded"/>
      </ECStructClass>
    </ECSchema>`;

  const schemaFileName = "ElementRoundTripTest.01.00.00.xml";
  const iModelFileName = "ElementRoundTripTest.bim";
  const categoryName = "RoundTripCategory";
  const subDirName = "ElementRoundTrip";
  const iModelPath = IModelTestUtils.prepareOutputFile(subDirName, iModelFileName);

  const primInst1: IPrimitiveBase = {
    i: 101,
    l: 12334343434,
    d: 1023.34,
    b: true,
    dt: "2017-01-01T00:00:00.000",
    s: "Test string Inst1",
    bin: new Uint8Array([1, 2, 3]),
    g: GeomJson.Writer.toIModelJson(Cone.createAxisPoints(Point3d.create(0, 0, 0), Point3d.create(0, 0, 1), 0.5, 0.5, false)),
    p2d: new Point2d(1.034, 2.034),
    p3d: new Point3d(-1.0, 2.3, 3.0001),
  };

  const primInst2: IPrimitiveBase = {
    i: 4322,
    l: 98283333,
    d: -2343.342,
    b: false,
    dt: "2010-01-01T11:11:11.000",
    s: "Test string Inst2",
    bin: new Uint8Array([11, 21, 31, 34, 53, 21, 14, 14, 55, 22]),
    g: GeomJson.Writer.toIModelJson(Cone.createAxisPoints(Point3d.create(0, 1, 0), Point3d.create(0, 0, 1), 0.5, 0.5, false)),
    p2d: new Point2d(1111.11, 2222.22),
    p3d: new Point3d(-111.11, -222.22, -333.33),
  };

  const primArrInst1: IPrimitiveArrayBase = {
    array_i: [101, 202, -345],
    array_l: [12334343434, 3434343434, 12],
    array_d: [1023.34, 3023.34, -3432.033],
    array_b: [true, false, true, false],
    array_dt: ["2017-01-01T00:00:00.000", "2018-01-01T00:00:00.000"],
    array_s: ["Test string 1", "Test string 2", "Test string 3"],
    array_bin: [new Uint8Array([1, 2, 3]), new Uint8Array([4, 2, 3, 3, 4, 55, 6, 65])],
    array_p2d: [new Point2d(1, 2), new Point2d(2, 4)],
    array_p3d: [new Point3d(1, 2, 3), new Point3d(4, 5, 6)],
    array_g: [
      GeomJson.Writer.toIModelJson(Cone.createAxisPoints(Point3d.create(0, 1, 0), Point3d.create(0, 0, 2), 0.5, 0.5, false)),
      GeomJson.Writer.toIModelJson(Cone.createAxisPoints(Point3d.create(0, 1, 1), Point3d.create(0, 0, 2), 0.5, 0.5, false)),
    ],
  };

  const primArrInst2: IPrimitiveArrayBase = {
    array_i: [0, 1, 2, 3, 4, 5, 6666],
    array_l: [-23422, -343343434, -12333434, 23423423],
    array_d: [-21023.34, -33023.34, -34432.033],
    array_b: [false, true],
    array_dt: ["2017-01-01T00:00:00.000", "2018-01-01T00:00:00.000", "2011-01-01T00:00:00.000"],
    array_s: ["Test string 1 - inst2", "Test string 2 - inst2", "Test string 3 - inst2"],
    array_bin: [new Uint8Array([1, 2, 3, 3, 4]), new Uint8Array([0, 0, 0, 0]), new Uint8Array([1, 2, 3, 4])],
    array_p2d: [new Point2d(-123, 244.23232), new Point2d(232, 324.2323), new Point2d(322, 2324.23322)],
    array_p3d: [new Point3d(133, 2333, 333), new Point3d(4123, 5123, 6123)],
    array_g: [
      GeomJson.Writer.toIModelJson(Cone.createAxisPoints(Point3d.create(0, 1, 0), Point3d.create(0, 0, 2), 0.5, 0.5, false)),
      GeomJson.Writer.toIModelJson(Cone.createAxisPoints(Point3d.create(0, 1, 1), Point3d.create(0, 0, 2), 0.5, 0.5, false)),
    ],
  };

  before(async () => {
    // write schema to disk as we do not have api to import xml directly
    const testSchemaPath = IModelTestUtils.prepareOutputFile(subDirName, schemaFileName);
    IModelJsFs.writeFileSync(testSchemaPath, testSchema);

    const imodel = SnapshotDb.createEmpty(iModelPath, { rootSubject: { name: "RoundTripTest" } });
    await imodel.importSchemas([testSchemaPath]);
    imodel[_nativeDb].resetBriefcaseId(BriefcaseIdValue.Unassigned);
    IModelTestUtils.createAndInsertPhysicalPartitionAndModel(imodel, Code.createEmpty(), true);
    let spatialCategoryId = SpatialCategory.queryCategoryIdByName(imodel, IModel.dictionaryId, categoryName);
    if (undefined === spatialCategoryId)
      spatialCategoryId = SpatialCategory.insert(imodel, IModel.dictionaryId, categoryName,
        new SubCategoryAppearance({ color: ColorDef.create("rgb(255,0,0)").toJSON() }));

    imodel.saveChanges();
    imodel.close();
  });

  it("Roundtrip all type of properties via ElementApi, ConcurrentQuery and ECSqlStatement via insert and update", async () => {
    const testFileName = IModelTestUtils.prepareOutputFile(subDirName, "roundtrip_correct_data.bim");
    const imodel = IModelTestUtils.createSnapshotFromSeed(testFileName, iModelPath);
    const spatialCategoryId = SpatialCategory.queryCategoryIdByName(imodel, IModel.dictionaryId, categoryName)!;
    const [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(imodel, Code.createEmpty(), true);

    // create element with auto handled properties
    const expectedValue = initElemProps("TestElement", imodel, newModelId, spatialCategoryId, {
      ...primInst1,
      ...primArrInst1,
      st: { ...primArrInst2, ...primInst1 },
      array_st: [{ ...primInst1, ...primArrInst2 }, { ...primInst2, ...primArrInst1 }],
    }) as TestElement;

    // insert a element
    const geomElement = imodel.elements.createElement(expectedValue);
    const id = imodel.elements.insertElement(geomElement.toJSON());
    assert.isTrue(Id64.isValidId64(id), "insert worked");
    imodel.saveChanges();

    // verify inserted element properties
    const actualValue = imodel.elements.getElementProps<TestElement>(id);
    verifyTestElement(actualValue, expectedValue);

    // verify via concurrent query
    let rowCount = 0;
    for await (const row of imodel.createQueryReader("SELECT * FROM ts.TestElement", undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
      verifyTestElement(row.toRow() as TestElement, expectedValue);
      rowCount++;
    }
    assert.equal(rowCount, 1);

    // verify via ecsql statement
    await imodel.withPreparedStatement("SELECT * FROM ts.TestElement", async (stmt: ECSqlStatement) => {
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      const stmtRow = stmt.getRow() as TestElement;
      verifyTestElement(stmtRow, expectedValue);
    });

    // update the element autohandled properties
    Object.assign(actualValue, {
      ...primInst2,
      ...primArrInst2,
      st: { ...primArrInst1, ...primInst2 },
      array_st: [{ ...primInst2, ...primArrInst2 }, { ...primInst1, ...primArrInst1 }],
    });

    // update element
    imodel.elements.updateElement(actualValue);
    imodel.saveChanges();

    // verify updated values
    const updatedValue = imodel.elements.getElementProps<TestElement>(id);
    verifyTestElement(updatedValue, actualValue);

    // verify via concurrent query
    rowCount = 0;
    for await (const row of imodel.createQueryReader("SELECT * FROM ts.TestElement", undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
      verifyTestElement(row.toRow() as TestElement, actualValue);
      rowCount++;
    }
    assert.equal(rowCount, 1);

    // verify via ecsql statement
    await imodel.withPreparedStatement("SELECT * FROM ts.TestElement", async (stmt: ECSqlStatement) => {
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      const stmtRow = stmt.getRow() as TestElement;
      verifyTestElement(stmtRow, actualValue);
    });

    imodel.close();
  });

  async function verifyElementAspect(elementAspect: ElementAspectProps, elementId: string, expectedAspectFullName: string, iModel: SnapshotDb): Promise<ElementAspectProps[]>{
    // Verify updated values
    const updatedAspectValue: ElementAspectProps[] = iModel.elements.getAspects(elementId, expectedAspectFullName).map((x) => x.toJSON());
    assert.equal(updatedAspectValue.length, 1);
    verifyTestElementAspect(updatedAspectValue[0], elementAspect);

    // Verify via a concurrent query
    let rowCount = 0;
    for await (const row of iModel.createQueryReader("SELECT * FROM ts.TestElementAspect", undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
      verifyTestElementAspect(row.toRow() as TestElementAspect, elementAspect);
      rowCount++;
    }
    assert.equal(rowCount, 1);

    // Verify via an ECSql statement
    await iModel.withPreparedStatement("SELECT * FROM ts.TestElementAspect", async (stmt: ECSqlStatement) => {
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      const stmtRow = stmt.getRow() as TestElementAspect;
      verifyTestElementAspect(stmtRow, elementAspect);
    });

    return updatedAspectValue;
  }

  it("Roundtrip all type of properties via ElementAspectApi, ConcurrentQuery and ECSqlStatement via insert and update", async () => {
    const testFileName = IModelTestUtils.prepareOutputFile(subDirName, "roundtrip_apsect_correct_data.bim");
    const imodel = IModelTestUtils.createSnapshotFromSeed(testFileName, iModelPath);
    const spatialCategoryId = SpatialCategory.queryCategoryIdByName(imodel, IModel.dictionaryId, categoryName)!;
    const [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(imodel, Code.createEmpty(), true);

    // Create an element to use with the ElementAspects
    const expectedValue = initElemProps("TestElement", imodel, newModelId, spatialCategoryId, {}) as TestElement;

    // Insert an element
    const geomElement = imodel.elements.createElement(expectedValue);
    const elId = imodel.elements.insertElement(geomElement.toJSON());
    assert.isTrue(Id64.isValidId64(elId), "Element insertion succeeded");

    const expectedAspectValue = initElementAspectProps("TestElementAspect", imodel, elId, {
      ...primInst1,
      ...primArrInst1,
      st: { ...primArrInst2, ...primInst1 },
      array_st: [{ ...primInst1, ...primArrInst2 }, { ...primInst2, ...primArrInst1 }],
    }) as TestElementAspect;

    // Insert an element aspect
    imodel.elements.insertAspect(expectedAspectValue);
    imodel.saveChanges();

    // Verify inserted element aspect properties
    const actualAspectValue = await verifyElementAspect(expectedAspectValue, elId, expectedAspectValue.classFullName, imodel);

    // Update the element's autohandled properties
    Object.assign(actualAspectValue[0], {
      ...primInst2,
      ...primArrInst2,
      st: { ...primArrInst1, ...primInst2 },
      array_st: [{ ...primInst2, ...primArrInst2 }, { ...primInst1, ...primArrInst1 }],
    });

    // Update the element
    imodel.elements.updateAspect(actualAspectValue[0]);
    imodel.saveChanges();

    // Verify updated element aspect properties
    await verifyElementAspect(actualAspectValue[0], elId, expectedAspectValue.classFullName, imodel);

    imodel.close();
  });

  function verifyTestElementRefersToElements(actualValue: TestElementRefersToElements, expectedValue: TestElementRefersToElements) {
    assert.equal(actualValue.sourceId, expectedValue.sourceId, "'sourceId' type property did not roundtrip as expected");
    assert.equal(actualValue.targetId, expectedValue.targetId, "'targetId' type property did not roundtrip as expected");
    verifyPrimitiveBase(actualValue, expectedValue);
    verifyPrimitiveArrayBase(actualValue, expectedValue);
  }

  it("Roundtrip all type of properties via ElementRefersToElements, ConcurrentQuery and ECSqlStatement via insert and update", async () => {
    const testFileName = IModelTestUtils.prepareOutputFile(subDirName, "roundtrip_relationships_correct_data.bim");
    const imodel = IModelTestUtils.createSnapshotFromSeed(testFileName, iModelPath);
    const spatialCategoryId = SpatialCategory.queryCategoryIdByName(imodel, IModel.dictionaryId, categoryName)!;
    const [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(imodel, Code.createEmpty(), true);

    // create elements to use
    const element1 = initElemProps("TestElement", imodel, newModelId, spatialCategoryId, {}) as TestElement;
    const element2 = initElemProps("TestElement", imodel, newModelId, spatialCategoryId, {}) as TestElement;

    const geomElement1 = imodel.elements.createElement(element1);
    const elId1 = imodel.elements.insertElement(geomElement1.toJSON());
    assert.isTrue(Id64.isValidId64(elId1), "insert of element 1 worked");
    const geomElement2 = imodel.elements.createElement(element2);
    const elId2 = imodel.elements.insertElement(geomElement2.toJSON());
    assert.isTrue(Id64.isValidId64(elId2), "insert of element 2 worked");

    // TODO: Skipping structs here, because of a bug that prevents querying from link tables that have an overflow table, by skipping the struct we reduce the amount of used columns
    const expectedRelationshipValue = initElementRefersToElementsProps("TestElementRefersToElements", imodel, elId1, elId2, {
      ...primInst1,
      ...primArrInst1,
      /* st: { ...primArrInst2, ...primInst1 },
      array_st: [{ ...primInst1, ...primArrInst2 }, { ...primInst2, ...primArrInst1 }], */
    });

    const instance = expectedRelationshipValue; // imodel.relationships.createInstance(expectedRelationshipValue);
    const relationshipId: Id64String = imodel.relationships.insertInstance(instance as any); // initElementRefersToElementsProps lies about return type.
    imodel.saveChanges();

    // verify inserted properties
    const actualRelationshipValue = imodel.relationships.getInstance<TestElementRefersToElements>(expectedRelationshipValue.classFullName, relationshipId);
    assert.exists(actualRelationshipValue);

    verifyTestElementRefersToElements(actualRelationshipValue, expectedRelationshipValue);

    // verify via concurrent query
    let rowCount = 0;
    for await (const row of imodel.createQueryReader("SELECT * FROM ts.TestElementRefersToElements", undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
      const val = row.toRow() as TestElementRefersToElements;
      verifyTestElementRefersToElements(val, expectedRelationshipValue);
      rowCount++;
    }
    assert.equal(rowCount, 1);

    // verify via ecsql statement614
    await imodel.withPreparedStatement("SELECT * FROM ts.TestElementRefersToElements", async (stmt: ECSqlStatement) => {
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      const stmtRow = stmt.getRow() as TestElementRefersToElements;
      verifyTestElementRefersToElements(stmtRow, expectedRelationshipValue);
    });

    const updatedExpectedValue = actualRelationshipValue;
    // update the element autohandled properties
    Object.assign(updatedExpectedValue, {
      ...primInst2,
      ...primArrInst2,
      /*      st: { ...primArrInst1, ...primInst2 },
            array_st: [{ ...primInst2, ...primArrInst2 }, { ...primInst1, ...primArrInst1 }],*/
    });

    // update
    imodel.relationships.updateInstance(updatedExpectedValue.toJSON());
    imodel.saveChanges();

    // verify updated values
    const updatedValue = imodel.relationships.getInstance<TestElementRefersToElements>(expectedRelationshipValue.classFullName, relationshipId);
    verifyTestElementRefersToElements(updatedValue, updatedExpectedValue);

    // verify via concurrent query
    rowCount = 0;
    for await (const row of imodel.createQueryReader("SELECT * FROM ts.TestElementRefersToElements", undefined, { rowFormat: QueryRowFormat.UseJsPropertyNames })) {
      verifyTestElementRefersToElements(row.toRow() as TestElementRefersToElements, updatedExpectedValue);
      rowCount++;
    }
    assert.equal(rowCount, 1);

    // verify via ecsql statement
    await imodel.withPreparedStatement("SELECT * FROM ts.TestElementRefersToElements", async (stmt: ECSqlStatement) => {
      assert.equal(stmt.step(), DbResult.BE_SQLITE_ROW);
      const stmtRow = stmt.getRow() as TestElementRefersToElements;
      verifyTestElementRefersToElements(stmtRow, updatedExpectedValue);
    });

    imodel.close();
  });

  it("Roundtrip placement when geom is undefined", async () => {
    const placement = {
      origin: { x: 10, y: 20, z: 30 },
      angles: {
        yaw: Angle.createDegrees(90),
        pitch: Angle.createDegrees(180),
        roll: Angle.createDegrees(270),
      },
      bbox: {
        low: { x: -1, y: -2, z: -3 },
        high: { x: 1, y: 2, z: 3 },
      },
    } as const;

    const insertAndVerifyPlacement = (
      name: string,
      extraProps: Partial<PhysicalElementProps> = {},
      {
        /**
         * setting some geometry will override the passed bounding box with a calculated one,
         * so we need to be able to override parts of the expected placement based on the geometry used
         */
        expectedPlacementOverrides = {},
      }: {
        expectedPlacementOverrides?: Partial<Placement3dProps>;
      } = {},
    ) => {
      const imodelPath = IModelTestUtils.prepareOutputFile(subDirName, `roundtrip_placement-${name}.bim`);
      let imodel = IModelTestUtils.createSnapshotFromSeed(imodelPath, iModelPath);
      const modelId = PhysicalModel.insert(imodel, IModelDb.rootSubjectId, "model");
      const categoryId = SpatialCategory.insert(imodel, IModelDb.dictionaryId, "model", {});

      const expectedPlacement = { ...placement, ...expectedPlacementOverrides };

      const objId = imodel.elements.insertElement({
        classFullName: PhysicalObject.classFullName,
        code: Code.createEmpty(),
        model: modelId,
        placement,
        category: categoryId,
        ...extraProps,
      });

      imodel.saveChanges();

      const inMemoryCopy = imodel.elements.getElement<PhysicalObject>({ id: objId, wantGeometry: true }, PhysicalObject);
      expect(inMemoryCopy.placement).to.deep.advancedEqual(expectedPlacement);

      // reload db since there is a different path for loading properties not in memory that we want to force
      imodel.close();
      imodel = SnapshotDb.openFile(imodelPath);

      const readFromDbCopy = imodel.elements.getElement<PhysicalObject>({ id: objId, wantGeometry: true }, PhysicalObject);
      expect(readFromDbCopy.placement).to.deep.advancedEqual(expectedPlacement);

      imodel.close();
    };

    insertAndVerifyPlacement("no-geom", {
      geom: undefined,
      elementGeometryBuilderParams: undefined,
    });

    const pts = [Point3d.create(5, 10, 0), Point3d.create(10, 10, 0)];
    const geomEntry = ElementGeometry.fromGeometryQuery(LineSegment3d.create(pts[0], pts[1]));
    assert(geomEntry !== undefined);

    const elementGeometryBuilderParams = { entryArray: [geomEntry] };
    insertAndVerifyPlacement(
      "geom-through-elementGeometryBuilderParams",
      {
        geom: undefined,
        elementGeometryBuilderParams,
      },
      {
        expectedPlacementOverrides: {
          bbox: {
            low: { x: 5, y: 10, z: 0 },
            high: { x: 10, y: 10, z: 0 },
          },
        },
      },
    );

    interface TestBoxProps {
      originX?: number;
      baseOriginX?: number;
    }

    // Previously, TypeScript BoxProps defined "origin" but native code only understood "baseOrigin".
    // Now, native code accepts either, preferring "origin" if both are specified.
    const testBox = (props: TestBoxProps, expectedXOffset: number) => {
      const box: any = {};
      if (undefined !== props.originX)
        box.origin = [props.originX, 1, 2];

      if (undefined !== props.baseOriginX)
        box.baseOrigin = [props.baseOriginX, 1, 2];

      const geom = [
        { header: { flags: 0 } },
        { box: { ...box, baseX: 10, baseY: 20 } },
      ];

      insertAndVerifyPlacement(
        "geom-through-json",
        {
          geom,
          elementGeometryBuilderParams: undefined,
        },
        {
          expectedPlacementOverrides: {
            bbox: {
              low: { x: expectedXOffset, y: 1, z: 2 },
              high: { x: expectedXOffset + 10, y: 21, z: 12 },
            },
          },
        },
      );
    };

    testBox({ originX: 0 }, 0);
    testBox({ baseOriginX: 5 }, 5);
    testBox({ originX: 2, baseOriginX: 4 }, 2);
  });

  it("Roundtrip updating properties to null", async () => {
    const testFileName = IModelTestUtils.prepareOutputFile(subDirName, "roundtrip_properties_null_update.bim");
    const imodel = IModelTestUtils.createSnapshotFromSeed(testFileName, iModelPath);
    const spatialCategoryId = SpatialCategory.queryCategoryIdByName(imodel, IModel.dictionaryId, categoryName)!;
    const [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(imodel, Code.createEmpty(), true);

    // Create an element to be used
    const expectedValue = initElemProps("TestElement", imodel, newModelId, spatialCategoryId, {
      ...primInst1,
      ...primArrInst1,
      st: { ...primArrInst2, ...primInst1 },
      array_st: [{ ...primInst1, ...primArrInst2 }, { ...primInst2, ...primArrInst1 }],
    }) as TestElement;

    // Insert an element
    const geomElement = imodel.elements.createElement(expectedValue);
    const id = imodel.elements.insertElement(geomElement.toJSON());
    assert.isTrue(Id64.isValidId64(id), "insert worked");
    imodel.saveChanges();

    // Verify inserted element properties
    const actualValue = imodel.elements.getElementProps<TestElement>(id);
    verifyTestElement(actualValue, expectedValue);

    // Update all properties to null
    {
      Object.assign(actualValue, {
        i: null,
        l: null,
        d: null,
        b: null,
        dt: null,
        s: null,
        bin: null,
        p2d: null,
        p3d: null,
        g: null,
        st: null,
        array_i: null,
        array_l: null,
        array_d: null,
        array_b: null,
        array_dt: null,
        array_s: null,
        array_bin: null,
        array_p2d: null,
        array_p3d: null,
        array_g: null,
        array_st: null,
      });

      // Update the element
      imodel.elements.updateElement(actualValue);
      imodel.saveChanges();

      // Verify updated value properties
      const updatedValue = imodel.elements.getElementProps<TestElement>(id);
      verifyTestElement(updatedValue, actualValue);
    }

    imodel.close();
  });
});
