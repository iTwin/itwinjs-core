/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { DbResult, Id64, Id64String } from "@itwin/core-bentley";
import { Arc3d, IModelJson as GeomJson, Point3d } from "@itwin/core-geometry";
import {
  BriefcaseIdValue, Code, ColorDef, GeometricElementProps, GeometryStreamProps, IModel, SubCategoryAppearance,
} from "@itwin/core-common";
import { Reporter } from "@itwin/perf-tools";
import { _nativeDb, DrawingCategory, ECSqlStatement, IModelDb, IModelHost, IModelJsFs, SnapshotDb, SpatialCategory } from "@itwin/core-backend";
import { IModelTestUtils, KnownTestLocations } from "@itwin/core-backend/lib/cjs/test/index";

// @ts-expect-error package.json will resolve from the lib/{cjs,esm} dir without copying it into the build output we deliver
// eslint-disable-next-line @itwin/import-within-package
import { version } from "../../../../../core/backend/package.json";
/** @public */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ITWINJS_CORE_VERSION = version as string;
const CORE_MAJ_MIN = `${ITWINJS_CORE_VERSION.split(".")[0]}.${ITWINJS_CORE_VERSION.split(".")[1]}.x`;

/* eslint-disable @typescript-eslint/naming-convention */

const values: any = {
  baseStr: "PerfElement - InitValue", baseStr2: "PerfElement - InitValue2", sub1Str: "PerfElementSub1 - InitValue",
  sub2Str: "PerfElementSub2 - InitValue", sub3Str: "PerfElementSub3 - InitValue",
  baseLong: "0x989680", sub1Long: "0x1312d00", sub2Long: "0x1c9c380", sub3Long: "0x2625a00",
  baseDouble: -3.1416, sub1Double: 2.71828, sub2Double: 1.414121, sub3Double: 1.61803398874,
};

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

function createElemProps(className: string, _iModelName: IModelDb, modId: Id64String, catId: Id64String): TestElementProps {
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

function getCount(imodel: IModelDb, className: string) {
  let count = 0;
  imodel.withPreparedStatement(`SELECT count(*) AS [count] FROM ${className}`, (stmt: ECSqlStatement) => {
    assert.equal(DbResult.BE_SQLITE_ROW, stmt.step());
    const row = stmt.getRow();
    count = row.count;
  });
  return count;
}

function measureGetRowTime(imodel: IModelDb, className: string): number {
  let totalTime = 0.0;
  imodel.withPreparedStatement(`SELECT * FROM ${className}`, (stmt: ECSqlStatement) => {
    while (stmt.step() === DbResult.BE_SQLITE_ROW) {
      const startTime = new Date().getTime();
      stmt.getRow();
      const endTime = new Date().getTime();
      const elapsedTime = (endTime - startTime) / 1000.0;
      totalTime = totalTime + elapsedTime;
    }
  });
  return totalTime;
}

function ensureDirectoryExists(dir: string) {
  if (!IModelJsFs.existsSync(dir)) {
    IModelJsFs.mkdirSync(dir);
  }
}

describe("ECSqlRowPerformanceTests", () => {
  const outDir: string = path.join(KnownTestLocations.outputDir, "ECSqlRowPerformance");
  const reporter = new Reporter();
  const eCSqlRowConfig = require(path.join(__dirname, "ECSqlRowConfig.json")).test3d; // eslint-disable-line @typescript-eslint/no-var-requires

  before(async () => {
    ensureDirectoryExists(KnownTestLocations.outputDir);
    ensureDirectoryExists(outDir);

    // Create all of the seed iModels
    for (const name of eCSqlRowConfig.classNames) {
      for (const size of eCSqlRowConfig.dbSizes) {
        const fileName = `Performance_seed_${name}_${size}.bim`;
        const pathname = path.join(outDir, fileName);

        await IModelHost.startup();

        if (IModelJsFs.existsSync(pathname))
          continue;

        const seedIModel = SnapshotDb.createEmpty(IModelTestUtils.prepareOutputFile("ECSqlRowPerformance", fileName), { rootSubject: { name: "PerfTest" } });
        const testSchemaName = path.join(KnownTestLocations.assetsDir, "PerfTestDomain.ecschema.xml");
        await seedIModel.importSchemas([testSchemaName]);
        seedIModel[_nativeDb].resetBriefcaseId(BriefcaseIdValue.Unassigned);
        assert.isDefined(seedIModel.getMetaData(`PerfTestDomain:${name}`), `${name}is present in iModel.`);

        const [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(seedIModel, Code.createEmpty(), true);
        let spatialCategoryId = SpatialCategory.queryCategoryIdByName(seedIModel, IModel.dictionaryId, "MySpatialCategory");
        if (undefined === spatialCategoryId)
          spatialCategoryId = SpatialCategory.insert(seedIModel, IModel.dictionaryId, "MySpatialCategory", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));

        for (let m = 0; m < size; ++m) {
          const elementProps = createElemProps(name, seedIModel, newModelId, spatialCategoryId);
          const geomElement = seedIModel.elements.createElement(elementProps);
          const id = seedIModel.elements.insertElement(geomElement.toJSON());
          assert.isTrue(Id64.isValidId64(id), "insert worked");
        }

        assert.equal(getCount(seedIModel, `PerfTestDomain:${name}`), size);
        seedIModel.saveChanges();
        seedIModel.close();
      }
    }
  });

  after(async () => {
    const csvPath = path.join(outDir, "PerformanceResults.csv");
    reporter.exportCSV(csvPath);

    await IModelHost.shutdown();
  });

  it("GetElements", async () => {
    for (const name of eCSqlRowConfig.classNames) {
      for (const size of eCSqlRowConfig.dbSizes) {
        const seedFileName = path.join(outDir, `Performance_seed_${name}_${size}.bim`);
        // eslint-disable-next-line no-console
        console.log(`Executing Element Read for the class ${name} on an iModel with ${size} elements`);

        const testFileName = IModelTestUtils.prepareOutputFile("ECSqlRowPerformance", `IModelPerformance_Read_${name}.bim`);
        const perfimodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);

        const elapsedTime = measureGetRowTime(perfimodel, `PerfTestDomain:${name}`);
        reporter.addEntry("ECSqlRowPerformanceTests", "GetElements", "Execution time(s)", elapsedTime, { ElementClassName: name, InitialCount: size, CoreVersion: CORE_MAJ_MIN });
        perfimodel.close();
      }
    }
  });
});

describe("ECSqlRowPerformanceTests2d", () => {
  const outDir: string = path.join(KnownTestLocations.outputDir, "ECSqlRowPerformance2d");
  const reporter = new Reporter();
  const eCSqlRowConfig = require(path.join(__dirname, "ECSqlRowConfig.json")).test2d; // eslint-disable-line @typescript-eslint/no-var-requires

  before(async () => {
    ensureDirectoryExists(KnownTestLocations.outputDir);
    ensureDirectoryExists(outDir);

    // Create all of the seed iModels
    for (const name of eCSqlRowConfig.classNames) {
      for (const size of eCSqlRowConfig.dbSizes) {
        const fileName = `Performance2d_seed_${name}_${size}.bim`;
        const pathname = path.join(outDir, fileName);

        await IModelHost.startup();

        if (IModelJsFs.existsSync(pathname))
          continue;

        const seedIModel = SnapshotDb.createEmpty(IModelTestUtils.prepareOutputFile("ECSqlRowPerformance2d", fileName), { rootSubject: { name: "PerfTest" } });
        const testSchemaName = path.join(KnownTestLocations.assetsDir, "PerfTestDomain.ecschema.xml");
        await seedIModel.importSchemas([testSchemaName]);
        seedIModel[_nativeDb].resetBriefcaseId(BriefcaseIdValue.Unassigned);
        assert.isDefined(seedIModel.getMetaData(`PerfTestDomain:${name}`), `${name}is present in iModel.`);

        const codeProps = Code.createEmpty();
        codeProps.value = "DrawingModel";
        const [, newModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(seedIModel, codeProps, true);
        let drawingCategoryId = DrawingCategory.queryCategoryIdByName(seedIModel, IModel.dictionaryId, "MyDrawingCategory");
        if (undefined === drawingCategoryId)
          drawingCategoryId = DrawingCategory.insert(seedIModel, IModel.dictionaryId, "MyDrawingCategory", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));

        for (let m = 0; m < size; ++m) {
          const elementProps = createElemProps(name, seedIModel, newModelId, drawingCategoryId);
          const geomElement = seedIModel.elements.createElement(elementProps);
          const id = seedIModel.elements.insertElement(geomElement.toJSON());
          assert.isTrue(Id64.isValidId64(id), "insert worked");
        }

        seedIModel.saveChanges();
        assert.equal(getCount(seedIModel, `PerfTestDomain:${name}`), size);
        seedIModel.close();
      }
    }
  });

  after(async () => {
    const csvPath = path.join(outDir, "PerformanceResults.csv");
    reporter.exportCSV(csvPath);

    await IModelHost.shutdown();
  });

  it("GetElements2d", async () => {
    for (const name of eCSqlRowConfig.classNames) {
      for (const size of eCSqlRowConfig.dbSizes) {
        const seedFileName = path.join(outDir, `Performance2d_seed_${name}_${size}.bim`);
        // eslint-disable-next-line no-console
        console.log(`Executing Element Read for the class ${name} on an iModel with ${size} elements`);

        const testFileName = IModelTestUtils.prepareOutputFile("ECSqlRowPerformance2d", `IModelPerformance2d_Read_${name}.bim`);
        const perfimodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);

        const elapsedTime = measureGetRowTime(perfimodel, `PerfTestDomain:${name}`);
        reporter.addEntry("ECSqlRowPerformanceTests2d", "GetElements2d", "Execution time(s)", elapsedTime, { ElementClassName: name, InitialCount: size, CoreVersion: CORE_MAJ_MIN });
        perfimodel.close();
      }
    }
  });
});
