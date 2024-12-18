/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { Id64, Id64String } from "@itwin/core-bentley";
import { _nativeDb, IModelDb, IModelHost, SnapshotDb, SpatialCategory } from "../../../core-backend";
import { IModelTestUtils } from "../../IModelTestUtils";
import { Code, ColorDef, ElementAspectProps, GeometryStreamProps, IModel, PhysicalElementProps, RelatedElementProps, SubCategoryAppearance } from "@itwin/core-common";
import { Arc3d, IModelJson, Point2d, Point3d } from "@itwin/core-geometry";
import { KnownTestLocations } from "../../KnownTestLocations";


interface IPrimitiveBase {
  i?: number;
  l?: number;
  d?: number;
  b?: boolean;
  dt?: string;
  s?: string;
  j?: string;
  bin?: Uint8Array;
  p2d?: Point2d;
  p3d?: Point3d;
  g?: GeometryStreamProps;
}

interface IPrimitive extends IPrimitiveBase {
  st?: ComplexStruct;
}

interface IPrimitiveArrayBase {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  array_i?: number[];
  // eslint-disable-next-line @typescript-eslint/naming-convention
  array_l?: number[];
  // eslint-disable-next-line @typescript-eslint/naming-convention
  array_d?: number[];
  // eslint-disable-next-line @typescript-eslint/naming-convention
  array_b?: boolean[];
  // eslint-disable-next-line @typescript-eslint/naming-convention
  array_dt?: string[];
  // eslint-disable-next-line @typescript-eslint/naming-convention
  array_s?: string[];
  // eslint-disable-next-line @typescript-eslint/naming-convention
  array_bin?: Uint8Array[];
  // eslint-disable-next-line @typescript-eslint/naming-convention
  array_p2d?: Point2d[];
  // eslint-disable-next-line @typescript-eslint/naming-convention
  array_p3d?: Point3d[];
  // eslint-disable-next-line @typescript-eslint/naming-convention
  array_g?: GeometryStreamProps[];
}

interface IPrimitiveArray extends IPrimitiveArrayBase {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  array_st?: ComplexStruct[];
}

interface ComplexStruct extends IPrimitiveArrayBase, IPrimitiveBase { }

interface TestElementProps extends PhysicalElementProps, IPrimitive, IPrimitiveArray {
  directStr?: string;
  directLong?: number;
  directDouble?: number;
  nullProp?: string;
  enumIntProp?: number;
  enumIntPropArr?: number[];
  enumStringProp?: string;
  enumStringPropArr?: string[];
  noCaseString?: string;
}

function createElemProps(className: string, _iModelName: IModelDb, modId: Id64String, catId: Id64String, index: number): TestElementProps {
  // add Geometry
  const geomArray: Arc3d[] = [
    Arc3d.createXY(Point3d.create(0, 0), 5),
    Arc3d.createXY(Point3d.create(5, 5), 2),
    Arc3d.createXY(Point3d.create(-5, -5), 20),
  ];
  const geometryStream: GeometryStreamProps = [];
  for (const geom of geomArray) {
    const arcData = IModelJson.Writer.toIModelJson(geom);
    geometryStream.push(arcData);
  }
  // Create props
  const elementProps: TestElementProps = {
    classFullName: `AllProperties:${className}`,
    model: modId,
    category: catId,
    code: Code.createEmpty(),
    geom: geometryStream,
    i: 100 + index,
    l: 1000 + index,
    d: 0.1 + index,
    s: `str${index}`,
    j: `{"${String.fromCharCode(65 + index)}": ${index}}`,
    dt: index%2 === 0? "2017-01-01T00:00:00.000" : "2010-01-01T11:11:11.000",
    bin: index%2 === 0 ? new Uint8Array([1, 2, 3]) : new Uint8Array([11, 21, 31, 34, 53, 21, 14, 14, 55, 22]),
    p2d: index%2 === 0 ? new Point2d(1.034, 2.034) : new Point2d(1111.11, 2222.22),
    p3d: index%2 === 0 ? new Point3d(-1.0, 2.3, 3.0001) : new Point3d(-111.11, -222.22, -333.33),
    b: true,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    array_b: [true, false, true],
    // eslint-disable-next-line @typescript-eslint/naming-convention
    array_i: [0, 1, 2],
    // eslint-disable-next-line @typescript-eslint/naming-convention
    array_d: [0.0, 1.1, 2.2],
    // eslint-disable-next-line @typescript-eslint/naming-convention
    array_l: [10000, 20000, 30000],
    // eslint-disable-next-line @typescript-eslint/naming-convention
    array_s: ["s0", "s1", "s2"],
    // eslint-disable-next-line @typescript-eslint/naming-convention
    array_dt: ["2017-01-01T00:00:00.000", "2010-01-01T11:11:11.000"],
    // eslint-disable-next-line @typescript-eslint/naming-convention
    array_p2d: [new Point2d(1.034, 2.034) , new Point2d(1111.11, 2222.22)],
    // eslint-disable-next-line @typescript-eslint/naming-convention
    array_p3d: [new Point3d(-1.0, 2.3, 3.0001) , new Point3d(-111.11, -222.22, -333.33)],
    // eslint-disable-next-line @typescript-eslint/naming-convention
    array_bin: [new Uint8Array([1, 2, 3]) , new Uint8Array([11, 21, 31, 34, 53, 21, 14, 14, 55, 22])],
    directStr: `str${index}`,
    directLong: 1000 + index,
    directDouble: 0.1 + index,
    nullProp: (index % 2 === 0) ? undefined : "NotNull",
    noCaseString: (index % 2 === 0) ? "abc" : "ABC",
    enumIntProp: index % 2 === 0 ? 1 : 2,
    enumStringProp: index % 2 === 0 ? "1" : "2",
    enumIntPropArr: [1, 2, 3],
    enumStringPropArr: ["1", "2", "3"]
  };
  return elementProps;
}

interface TestElementAspectProps extends ElementAspectProps, IPrimitive, IPrimitiveArray { }

function createElemAspect(className: string, _iModelName: IModelDb, elementId: Id64String, autoHandledProp: any): TestElementAspectProps {
  // Create props
  const elementProps: ElementAspectProps = {
    classFullName: `AllProperties:${className}`,
    element: { id: elementId },
  };

  if (autoHandledProp)
    Object.assign(elementProps, autoHandledProp);

  return elementProps;
}

interface TestElementWithNavProps extends TestElementProps {
  name: string;
  featureUsesElement: RelatedElementProps;
}

function createElemWithNavProp(className: string, _iModelName: IModelDb, modId: Id64String, catId: Id64String, index: number, elementId: Id64String): TestElementWithNavProps {
  const eProps = createElemProps(className, _iModelName, modId, catId, index);
  return {
    ...eProps,
    name: `Feature${elementId.toString()}`,
    featureUsesElement: {
      id: elementId,
      relClassName: "AllProperties:TestFeatureUsesElement",
    }
  } as TestElementWithNavProps;
}

export class ECSqlDatasets {
  public static async generateFiles(): Promise<void> {
    const fileName = "AllProperties.bim";

    await IModelHost.startup();
    const filePath = IModelTestUtils.prepareOutputFile("ECSqlTests", fileName);
    const iModel = SnapshotDb.createEmpty(filePath, { rootSubject: { name: "AllPropertiesTest" } });
    const testSchemaPath = path.join(KnownTestLocations.assetsDir, "ECSqlTests", "AllProperties.ecschema.xml");
    await iModel.importSchemas([testSchemaPath]);
    const [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(iModel, Code.createEmpty(), true);
    let spatialCategoryId = SpatialCategory.queryCategoryIdByName(iModel, IModel.dictionaryId, "MySpatialCategory");
    if (undefined === spatialCategoryId)
      spatialCategoryId = SpatialCategory.insert(iModel, IModel.dictionaryId, "MySpatialCategory", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));

    let index = 0;
    const elementIds: Id64String[] = [];
    for (index = 0; index < 10; ++index) {
      const elementProps = createElemProps("TestElement", iModel, newModelId, spatialCategoryId, index);
      const testElement = iModel.elements.createElement(elementProps);
      const elementId = iModel.elements.insertElement(testElement.toJSON());
      assert.isTrue(Id64.isValidId64(elementId), "element insert failed");

      if (index % 2 === 0) {
        const aspectId = iModel.elements.insertAspect(createElemAspect("TestElementAspect", iModel, elementId, undefined));
        assert.isTrue(Id64.isValidId64(aspectId), "element aspect insert failed");
      }
      elementIds.push(elementId);
    }

    // Add two instances of feature class instance with a navigation property
    const elementWithNavProp = iModel.elements.createElement(createElemWithNavProp("TestFeature", iModel, newModelId, spatialCategoryId, ++index, elementIds.pop()!));
    assert.isTrue(Id64.isValidId64(iModel.elements.insertElement(elementWithNavProp.toJSON())), "element with nav props insert failed");

    const anotherElementWithNavProp = iModel.elements.createElement(createElemWithNavProp("TestFeature", iModel, newModelId, spatialCategoryId, ++index, elementIds.pop()!));
    assert.isTrue(Id64.isValidId64(iModel.elements.insertElement(anotherElementWithNavProp.toJSON())), "element with nav props insert failed");

    iModel.saveChanges();
    iModel.close();
  }
}