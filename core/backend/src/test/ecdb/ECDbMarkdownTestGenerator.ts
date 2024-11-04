/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { Id64, Id64String } from "@itwin/core-bentley";
import { IModelDb, IModelHost, SnapshotDb, SpatialCategory } from "../../core-backend";
import { KnownTestLocations } from "../KnownTestLocations";
import { IModelTestUtils } from "../IModelTestUtils";
import { Code, ColorDef, GeometricElementProps, GeometryStreamProps, IModel, SubCategoryAppearance } from "@itwin/core-common";
import { Arc3d, IModelJson, Point3d } from "@itwin/core-geometry";

interface TestElementProps extends GeometricElementProps {
  baseStr?: string;
  baseStr2?: string;
  baseLong?: number;
  baseDouble?: number;
  sub1Str?: string;
  sub2Str?: string;
  sub3Str?: string;
  sub1Long?: number;
  sub2Long?: number;
  sub3Long?: number;
  sub1Double?: number;
  sub2Double?: number;
  sub3Double?: number;
}

const values: any = {
  baseStr: "PerfElement - InitValue", baseStr2: "PerfElement - InitValue2", sub1Str: "PerfElementSub1 - InitValue",
  sub2Str: "PerfElementSub2 - InitValue", sub3Str: "PerfElementSub3 - InitValue",
  baseLong: "0x989680", sub1Long: "0x1312d00", sub2Long: "0x1c9c380", sub3Long: "0x2625a00",
  baseDouble: -3.1416, sub1Double: 2.71828, sub2Double: 1.414121, sub3Double: 1.61803398874,
};

function createElemProps(className: string, _iModelName: IModelDb, modId: Id64String, catId: Id64String): TestElementProps {
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
    classFullName: `PerfTestDomain:${className}`,
    model: modId,
    category: catId,
    code: Code.createEmpty(),
    geom: geometryStream,
  };
  if (className.includes("Sub3")) {
    elementProps.sub3Str = values.sub3Str;
    elementProps.sub3Long = values.sub3Long;
    elementProps.sub3Double = values.sub3Double;
  }
  if (className.includes("Sub3") || className.includes("Sub2")) {
    elementProps.sub2Str = values.sub2Str;
    elementProps.sub2Long = values.sub2Long;
    elementProps.sub2Double = values.sub2Double;
  }
  if (className.includes("Sub")) {
    elementProps.sub1Str = values.sub1Str;
    elementProps.sub1Long = values.sub1Long;
    elementProps.sub1Double = values.sub1Double;
  }
  if (className.includes("PerfElement2d"))
    elementProps.baseStr2 = values.baseStr2;
  elementProps.baseStr = values.baseStr;
  elementProps.baseLong = values.baseLong;
  elementProps.baseDouble = values.baseDouble;
  return elementProps;
}


export class ECDbMarkdownTestGenerator {
  public static async generateFiles(): Promise<void> {
    const fileName = "AllProperties.bim";

    await IModelHost.startup();

    const seedIModel = SnapshotDb.createEmpty(IModelTestUtils.prepareOutputFile("ECDbTests", fileName), { rootSubject: { name: "AllPropertiesTest" } });
    const testSchemaName = path.join(KnownTestLocations.assetsDir, "PerfTestDomain.ecschema.xml");
    await seedIModel.importSchemas([testSchemaName]);
    const [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(seedIModel, Code.createEmpty(), true);
    let spatialCategoryId = SpatialCategory.queryCategoryIdByName(seedIModel, IModel.dictionaryId, "MySpatialCategory");
    if (undefined === spatialCategoryId)
      spatialCategoryId = SpatialCategory.insert(seedIModel, IModel.dictionaryId, "MySpatialCategory", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));

    for (let m = 0; m < 100; ++m) {
      const elementProps = createElemProps("PerfElement", seedIModel, newModelId, spatialCategoryId);
      const geomElement = seedIModel.elements.createElement(elementProps);
      const id = seedIModel.elements.insertElement(geomElement.toJSON());
      assert.isTrue(Id64.isValidId64(id), "insert worked");
    }

    seedIModel.saveChanges();
    seedIModel.close();
  }
}
