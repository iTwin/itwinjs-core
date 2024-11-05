/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as fs from "fs";
import * as path from "path";
import { Id64, Id64String } from "@itwin/core-bentley";
import { IModelDb, IModelHost, SnapshotDb, SpatialCategory } from "../../core-backend";
import { KnownTestLocations } from "../KnownTestLocations";
import { IModelTestUtils } from "../IModelTestUtils";
import { Code, ColorDef, GeometryStreamProps, IModel, PhysicalElementProps, SubCategoryAppearance } from "@itwin/core-common";
import { Arc3d, IModelJson, Point3d } from "@itwin/core-geometry";

interface TestElementProps extends PhysicalElementProps {
  s?: string;
  directStr?: string;
  directLong?: number;
  directDouble?: number;
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
  };

  elementProps.directStr = `str${index}`;
  elementProps.directLong = 1000 + index;
  elementProps.directDouble = 0.1 + index;
  return elementProps;
}

export interface AllPropertiesProps {
  physicalModelId: string,
  mySpatialCategoryId: string,
  testElementClassId: string,
}


export class ECDbMarkdownTestGenerator {
  public static async generateFiles(): Promise<void> {
    const fileName = "AllProperties.bim";

    await IModelHost.startup();
    const props: Partial<AllPropertiesProps> = {};
    const filePath = IModelTestUtils.prepareOutputFile("ECDbTests", fileName);
    const iModel = SnapshotDb.createEmpty(filePath, { rootSubject: { name: "AllPropertiesTest" } });
    const testSchemaPath = path.join(KnownTestLocations.assetsDir, "ECDbTests", "AllProperties.ecschema.xml");
    await iModel.importSchemas([testSchemaPath]);
    const [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(iModel, Code.createEmpty(), true);
    props.physicalModelId = newModelId;
    let spatialCategoryId = SpatialCategory.queryCategoryIdByName(iModel, IModel.dictionaryId, "MySpatialCategory");
    if (undefined === spatialCategoryId)
      spatialCategoryId = SpatialCategory.insert(iModel, IModel.dictionaryId, "MySpatialCategory", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));

    props.mySpatialCategoryId = spatialCategoryId;
    props.testElementClassId = "0x152"; // TODO: is there a convenient way to get and store the id here?

    for (let m = 0; m < 10; ++m) {
      const elementProps = createElemProps("TestElement", iModel, newModelId, spatialCategoryId, m);
      const testElement = iModel.elements.createElement(elementProps);
      const id = iModel.elements.insertElement(testElement.toJSON());
      assert.isTrue(Id64.isValidId64(id), "insert worked");
    }

    iModel.saveChanges();
    iModel.close();
    //serialize props to a file
    const propsFilePath = IModelTestUtils.prepareOutputFile("ECDbTests", `${fileName}.props`);
    fs.writeFileSync(propsFilePath, JSON.stringify(props, null, 2), "utf-8");
  }
}
