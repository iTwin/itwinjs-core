/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { DbResult, Id64 } from "@itwin/core-bentley";
import { BriefcaseIdValue, Code, ColorDef, ECSqlReader, GeometryStreamProps, IModel, SubCategoryAppearance } from "@itwin/core-common";
import { Reporter } from "@itwin/perf-tools";
import { _nativeDb, ECSqlStatement, IModelDb, IModelHost, IModelJsFs, SnapshotDb, SpatialCategory } from "@itwin/core-backend";
import { IModelTestUtils, KnownTestLocations } from "@itwin/core-backend/lib/cjs/test/index";
import { Arc3d, IModelJson as GeomJson, Point3d } from "@itwin/core-geometry";

// @ts-expect-error package.json will resolve from the lib/{cjs,esm} dir without copying it into the build output we deliver
// eslint-disable-next-line @itwin/import-within-package
import { version } from "../../../../../core/backend/package.json";

const ITWINJS_CORE_VERSION = version as string;
const CORE_MAJ_MIN = `${ITWINJS_CORE_VERSION.split(".")[0]}.${ITWINJS_CORE_VERSION.split(".")[1]}.x`;

/* eslint-disable @typescript-eslint/naming-convention */

const values: any = {
  baseStr: "PerfElement - InitValue", sub1Str: "PerfElementSub1 - InitValue",
  sub2Str: "PerfElementSub2 - InitValue", sub3Str: "PerfElementSub3 - InitValue",
  baseLong: "0x989680", sub1Long: "0x1312d00", sub2Long: "0x1c9c380", sub3Long: "0x2625a00",
  baseDouble: -3.1416, sub1Double: 2.71828, sub2Double: 1.414121, sub3Double: 1.61803398874,
};

interface TestElementProps {
  classFullName: string;
  model: string;
  category: string;
  code: any;
  geom: GeometryStreamProps;
  baseStr?: string;
  baseLong?: string;
  baseDouble?: number;
  sub1Str?: string;
  sub2Str?: string;
  sub3Str?: string;
  sub1Long?: string;
  sub2Long?: string;
  sub3Long?: string;
  sub1Double?: number;
  sub2Double?: number;
  sub3Double?: number;
}

function createElemProps(className: string, _iModelName: IModelDb, modId: string, catId: string): TestElementProps {
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
  elementProps.baseStr = values.baseStr;
  elementProps.baseLong = values.baseLong;
  elementProps.baseDouble = values.baseDouble;
  return elementProps;
}

function getCount(imodel: IModelDb, className: string): number {
  let count = 0;
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  imodel.withPreparedStatement(`SELECT count(*) AS [count] FROM ${className}`, (stmt: ECSqlStatement) => {
    assert.equal(DbResult.BE_SQLITE_ROW, stmt.step());
    const row = stmt.getRow();
    count = row.count;
  });
  return count;
}

function ensureDirectoryExists(dir: string) {
  if (!IModelJsFs.existsSync(dir)) {
    IModelJsFs.mkdirSync(dir);
  }
}

describe("CreateQueryReaderVsCreateSynchronousQueryReaderVsWithPreparedStatementPerformanceTests", () => {
  const outDir: string = path.join(KnownTestLocations.outputDir, "CreateQueryReaderVsCreateSynchronousQueryReaderVsWithPreparedStatementPerformance");
  const reporter = new Reporter();
  const readerConfig = require(path.join(__dirname, "ReadQueryPerfConfig.json")); // eslint-disable-line @typescript-eslint/no-require-imports

  async function measureStepTime(reader: ECSqlReader, size: number): Promise<number> {
    let rowCount = 0;
    const startTime = new Date().getTime();
    while (await reader.step()) {
      reader.current.toRow();
      rowCount++;
    }
    const endTime = new Date().getTime();
    const totalTime = endTime - startTime;

    assert.equal(rowCount, size);
    return totalTime;
  }

  async function measureECSqlStatementStepTime(imodel: IModelDb, size: number, ecsql: string): Promise<number> {
    let rowCount = 0;
    const startTime = new Date().getTime();
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    imodel.withPreparedStatement(ecsql, (stmt: ECSqlStatement) => {
      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        stmt.getRow();
        rowCount++;
      }
    });
    const endTime = new Date().getTime();
    const totalTime = endTime - startTime;

    assert.equal(rowCount, size);
    return totalTime;
  }

  before(async () => {
    ensureDirectoryExists(KnownTestLocations.outputDir);
    ensureDirectoryExists(outDir);

    await IModelHost.startup();

    // Create seed iModels for each class and db size
    for (const name of readerConfig.classNames) {
      for (const size of readerConfig.dbSizes) {
        const fileName = `ReaderPerf_seed_${name}_${size}.bim`;
        const pathname = path.join(outDir, fileName);

        if (IModelJsFs.existsSync(pathname))
          continue;

        const seedIModel = SnapshotDb.createEmpty(IModelTestUtils.prepareOutputFile("CreateQueryReaderVsCreateSynchronousQueryReaderVsWithPreparedStatementPerformance", fileName), { rootSubject: { name: "ReaderPerfTest" } });
        const testSchemaName = path.join(KnownTestLocations.assetsDir, "PerfTestDomain.ecschema.xml");
        await seedIModel.importSchemas([testSchemaName]);
        seedIModel[_nativeDb].resetBriefcaseId(BriefcaseIdValue.Unassigned);
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        assert.isDefined(seedIModel.getMetaData(`PerfTestDomain:${name}`), `${name} is present in iModel.`);

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
    const csvPath = path.join(outDir, "CreateQueryReaderVsCreateSynchronousQueryReaderVsWithPreparedStatementPerformanceResults.csv");
    reporter.exportCSV(csvPath);
    await IModelHost.shutdown();
  });

  it("createQueryReader - SELECT *", async () => {
    for (const name of readerConfig.classNames) {
      for (const size of readerConfig.dbSizes) {
        const seedFileName = path.join(outDir, `ReaderPerf_seed_${name}_${size}.bim`);
        const testFileName = IModelTestUtils.prepareOutputFile("CreateQueryReaderVsCreateSynchronousQueryReaderVsWithPreparedStatementPerformance", `ReaderPerf_QueryReader_${name}_${size}.bim`);
        const perfimodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);

        const ecsql = `SELECT * FROM PerfTestDomain:${name}`;
        const reader = perfimodel.createQueryReader(ecsql, undefined, { usePrimaryConn: true });
        const statementTime = await measureECSqlStatementStepTime(perfimodel, size, ecsql);
        const readerTime = await measureStepTime(reader, size);

        const rowReaderTime = await perfimodel.withSynchronousQueryReader(ecsql, async (rowReader) => {
          return measureStepTime(rowReader, size);
        });

        // eslint-disable-next-line no-console
        console.log(`ECSqlStatement SELECT * | ${name} | ${size} elements | totalTime: ${statementTime}ms`);

        // eslint-disable-next-line no-console
        console.log(`createQueryReader SELECT * | ${name} | ${size} elements | totalTime: ${readerTime}ms`);
        // eslint-disable-next-line no-console
        console.log(`withSynchronousQueryReader  SELECT * | ${name} | ${size} elements | totalTime: ${rowReaderTime}ms`);

        reporter.addEntry("ECSqlReaderPerformanceTests", "ECSqlStatement - SELECT *", "Total time (ms)", statementTime, {
          ElementClassName: name, InitialCount: size, CoreVersion: CORE_MAJ_MIN
        });

        reporter.addEntry("ECSqlReaderPerformanceTests", "createQueryReader - SELECT *", "Total time (ms)", readerTime, {
          ElementClassName: name, InitialCount: size, CoreVersion: CORE_MAJ_MIN
        });

        reporter.addEntry("ECSqlReaderPerformanceTests", "withSynchronousQueryReader  - SELECT *", "Total time (ms)", rowReaderTime, {
          ElementClassName: name, InitialCount: size, CoreVersion: CORE_MAJ_MIN
        });

        perfimodel.close();
      }
    }
  });
});
