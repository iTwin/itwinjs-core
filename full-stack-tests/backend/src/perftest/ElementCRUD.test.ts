/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { DbResult, Id64, Id64String } from "@itwin/core-bentley";
import { Arc3d, IModelJson as GeomJson, Point3d } from "@itwin/core-geometry";
import {
  BriefcaseIdValue, Code, ColorDef, ElementProps, GeometricElementProps, GeometryStreamProps, IModel, SubCategoryAppearance,
} from "@itwin/core-common";
import { Reporter } from "@itwin/perf-tools";
import { _nativeDb, DrawingCategory, ECSqlStatement, Element, IModelDb, IModelHost, IModelJsFs, SnapshotDb, SpatialCategory } from "@itwin/core-backend";
import { IModelTestUtils, KnownTestLocations } from "@itwin/core-backend/lib/cjs/test/index";
import { PerfTestUtility } from "./PerfTestUtils";

// @ts-expect-error package.json will resolve from the lib/{cjs,esm} dir without copying it into the build output we deliver
// eslint-disable-next-line @itwin/import-within-package
import { version } from "../../../../../core/backend/package.json";
/** @public */
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

function verifyProps(testElement: TestElementProps) {
  assert.equal(testElement.baseStr, values.baseStr, `${testElement.classFullName}`);
  assert.equal(testElement.baseLong, values.baseLong, `${testElement.classFullName}`);
  assert.equal(testElement.baseDouble, values.baseDouble, `${testElement.classFullName}`);

  if (testElement.classFullName.includes("Sub")) {
    assert.equal(testElement.sub1Str, values.sub1Str, `${testElement.classFullName}`);
    assert.equal(testElement.sub1Long, values.sub1Long, `${testElement.classFullName}`);
    assert.equal(testElement.sub1Double, values.sub1Double, `${testElement.classFullName}`);

    if (testElement.classFullName.includes("Sub2") || testElement.classFullName.includes("Sub3")) {
      assert.equal(testElement.sub2Str, values.sub2Str, `${testElement.classFullName}`);
      assert.equal(testElement.sub2Long, values.sub2Long, `${testElement.classFullName}`);
      assert.equal(testElement.sub2Double, values.sub2Double, `${testElement.classFullName}`);
    }

    if (testElement.classFullName.includes("Sub3")) {
      assert.equal(testElement.sub3Str, values.sub3Str, `${testElement.classFullName}`);
      assert.equal(testElement.sub3Long, values.sub3Long, `${testElement.classFullName}`);
      assert.equal(testElement.sub3Double, values.sub3Double, `${testElement.classFullName}`);
    }
  }
}

function getCount(imodel: IModelDb, className: string) {
  let count = 0;
    // eslint-disable-next-line @typescript-eslint/no-deprecated
  imodel.withPreparedStatement(`SELECT count(*) AS [count] FROM ${className}`, (stmt: ECSqlStatement) => {
    assert.equal(DbResult.BE_SQLITE_ROW, stmt.step());
    const row = stmt.getRow();
    count = row.count;
  });
  return count;
}

describe("PerformanceElementsTests", () => {
  const reporter = new Reporter();
  const crudConfig = require(path.join(__dirname, "CRUDConfig.json")).test3d; // eslint-disable-line @typescript-eslint/no-require-imports

  before(async () => {
    // Create all of the seed iModels
    for (const name of crudConfig.classNames) {
      for (const size of crudConfig.dbSizes) {
        const fileName = `Performance_seed_${name}_${size}.bim`;
        const pathname = path.join(KnownTestLocations.outputDir, "ElementCRUDPerformance", fileName);

        if (IModelJsFs.existsSync(pathname))
          return;

        await IModelHost.startup();

        const seedIModel = SnapshotDb.createEmpty(IModelTestUtils.prepareOutputFile("ElementCRUDPerformance", fileName), { rootSubject: { name: "PerfTest" } });
        const testSchemaName = path.join(KnownTestLocations.assetsDir, "PerfTestDomain.ecschema.xml");
        await seedIModel.importSchemas([testSchemaName]);
        seedIModel[_nativeDb].resetBriefcaseId(BriefcaseIdValue.Unassigned);
        // eslint-disable-next-line @typescript-eslint/no-deprecated
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
    const csvPath = path.join(KnownTestLocations.outputDir, "PerformanceResults.csv");
    reporter.exportCSV(csvPath);
    await IModelHost.shutdown();
  });

  it("ElementsInsert", async () => {
    for (const name of crudConfig.classNames) {
      for (const size of crudConfig.dbSizes) {
        const seedFileName = path.join(KnownTestLocations.outputDir, "ElementCRUDPerformance", `Performance_seed_${name}_${size}.bim`);
        for (const opCount of crudConfig.opSizes) {
          // eslint-disable-next-line no-console
          console.log(`Executing Element Insert for the class ${name} on an iModel with ${size} elements ${opCount} times`);

          const testFileName = IModelTestUtils.prepareOutputFile("ElementCRUDPerformance", `IModelPerformance_Insert_${name}_${opCount}.bim`);
          const perfimodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
          const [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(perfimodel, Code.createEmpty(), true);
          let spatialCategoryId = SpatialCategory.queryCategoryIdByName(perfimodel, IModel.dictionaryId, "MySpatialCategory");
          if (undefined === spatialCategoryId)
            spatialCategoryId = SpatialCategory.insert(perfimodel, IModel.dictionaryId, "MySpatialCategory", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));

          let totalTime = 0.0;
          for (let m = 0; m < opCount; ++m) {
            const elementProps = createElemProps(name, perfimodel, newModelId, spatialCategoryId);
            const geomElement = perfimodel.elements.createElement(elementProps);
            const startTime = new Date().getTime();
            const id = perfimodel.elements.insertElement(geomElement.toJSON());
            const endTime = new Date().getTime();
            assert.isTrue(Id64.isValidId64(id), "insert worked");
            const elapsedTime = (endTime - startTime) / 1000.0;
            totalTime = totalTime + elapsedTime;
          }

          reporter.addEntry("PerformanceElementsTests", "ElementsInsert", "Execution time(s)", totalTime, { ElementClassName: name, InitialCount: size, opCount, CoreVersion: CORE_MAJ_MIN });
          assert.equal(getCount(perfimodel, `PerfTestDomain:${name}`), size + opCount);
          perfimodel.close();
        }
      }
    }
  });

  it("ElementsDelete", async () => {
    for (const name of crudConfig.classNames) {
      for (const size of crudConfig.dbSizes) {
        const seedFileName = path.join(KnownTestLocations.outputDir, "ElementCRUDPerformance", `Performance_seed_${name}_${size}.bim`);
        for (const opCount of crudConfig.opSizes) {
          // eslint-disable-next-line no-console
          console.log(`Executing Element Delete for the class ${name} on an iModel with ${size} elements ${opCount} times`);

          const testFileName = IModelTestUtils.prepareOutputFile("ElementCRUDPerformance", `IModelPerformance_Delete_${name}_${opCount}.bim`);
          const perfimodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
          const minId: number = PerfTestUtility.getMinId(perfimodel, "bis.PhysicalElement");
          const elementIdIncrement = Math.floor(size / opCount);

          const startTime = new Date().getTime();
          for (let i = 0; i < opCount; ++i) {
            try {
              const elId = minId + elementIdIncrement * i;
              perfimodel.elements.deleteElement(Id64.fromLocalAndBriefcaseIds(elId, 0));
            } catch {
              assert.isTrue(false);
            }
          }
          const endTime = new Date().getTime();
          const elapsedTime = (endTime - startTime) / 1000.0;
          reporter.addEntry("PerformanceElementsTests", "ElementsDelete", "Execution time(s)", elapsedTime, { ElementClassName: name, InitialCount: size, opCount, CoreVersion: CORE_MAJ_MIN });
          assert.equal(getCount(perfimodel, `PerfTestDomain:${name}`), size - opCount);
          perfimodel.close();
        }
      }
    }
  });

  it("ElementsRead", async () => {
    for (const name of crudConfig.classNames) {
      for (const size of crudConfig.dbSizes) {
        const seedFileName = path.join(KnownTestLocations.outputDir, "ElementCRUDPerformance", `Performance_seed_${name}_${size}.bim`);
        for (const opCount of crudConfig.opSizes) {
          // eslint-disable-next-line no-console
          console.log(`Executing Element Read for the class ${name} on an iModel with ${size} elements ${opCount} times`);

          const testFileName = IModelTestUtils.prepareOutputFile("ElementCRUDPerformance", `IModelPerformance_Read_${name}_${opCount}.bim`);
          const perfimodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
          const minId: number = PerfTestUtility.getMinId(perfimodel, "bis.PhysicalElement");
          const elementIdIncrement = Math.floor(size / opCount);

          const startTime = new Date().getTime();
          for (let i = 0; i < opCount; ++i) {
            const elId = minId + elementIdIncrement * i;
            perfimodel.elements.getElement(Id64.fromLocalAndBriefcaseIds(elId, 0));
          }
          const endTime = new Date().getTime();

          // Verify values after the timing portion to ensure everything is loaded correctly.
          // This is performed afterwards to avoid including the extra noise in the perf numbers.
          for (let i = 0; i < opCount; ++i) {
            const elId = minId + elementIdIncrement * i;
            const elemFound: Element = perfimodel.elements.getElement(Id64.fromLocalAndBriefcaseIds(elId, 0));
            verifyProps(elemFound as any);
          }

          const elapsedTime = (endTime - startTime) / 1000.0;
          reporter.addEntry("PerformanceElementsTests", "ElementsRead", "Execution time(s)", elapsedTime, { ElementClassName: name, InitialCount: size, opCount, CoreVersion: CORE_MAJ_MIN });
          perfimodel.close();
        }
      }
    }
  });

  it("ElementsUpdate", async () => {
    for (const name of crudConfig.classNames) {
      for (const size of crudConfig.dbSizes) {
        const seedFileName = path.join(KnownTestLocations.outputDir, "ElementCRUDPerformance", `Performance_seed_${name}_${size}.bim`);
        for (const opCount of crudConfig.opSizes) {
          // eslint-disable-next-line no-console
          console.log(`Executing Element Update for the class ${name} on an iModel with ${size} elements ${opCount} times`);

          const testFileName = IModelTestUtils.prepareOutputFile("ElementCRUDPerformance", `IModelPerformance_Update_${name}_${opCount}.bim`);
          const perfimodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
          const minId: number = PerfTestUtility.getMinId(perfimodel, "bis.PhysicalElement");
          const elementIdIncrement = Math.floor(size / opCount);

          // first construct modified elements
          // now lets update and record time
          // add Geometry
          const geomArray: Arc3d[] = [
            Arc3d.createXY(Point3d.create(0, 0), 2),
            Arc3d.createXY(Point3d.create(5, 5), 5),
            Arc3d.createXY(Point3d.create(-5, -5), 10),
          ];

          const geometryStream: GeometryStreamProps = [];
          for (const geom of geomArray) {
            const arcData = GeomJson.Writer.toIModelJson(geom);
            geometryStream.push(arcData);
          }
          const startTime = new Date().getTime();
          for (let i = 0; i < opCount; ++i) {
            const elId = minId + elementIdIncrement * i;
            const editElem: Element = perfimodel.elements.getElement(Id64.fromLocalAndBriefcaseIds(elId, 0));
            (editElem as any).baseStr = "PerfElement - UpdatedValue";
            editElem.setUserProperties("geom", geometryStream);
            try {
              perfimodel.elements.updateElement(editElem.toJSON());
            } catch {
              assert.fail("Element.update failed");
            }
          }
          const endTime = new Date().getTime();

          // verify value is updated
          for (let i = 0; i < opCount; ++i) {
            const elId = minId + elementIdIncrement * i;
            const elemFound: Element = perfimodel.elements.getElement(Id64.fromLocalAndBriefcaseIds(elId, 0));
            assert.equal((elemFound as any).baseStr, "PerfElement - UpdatedValue");
          }
          const elapsedTime = (endTime - startTime) / 1000.0;
          reporter.addEntry("PerformanceElementsTests", "ElementsUpdate", "Execution time(s)", elapsedTime, { ElementClassName: name, InitialCount: size, opCount, CoreVersion: CORE_MAJ_MIN });
          perfimodel.close();
        }
      }
    }
  });
});

describe("PerformanceElementsTests2d", () => {
  const outDir: string = path.join(KnownTestLocations.outputDir, "ElementCRUDPerformance2d");
  const reporter = new Reporter();
  const crudConfig = require(path.join(__dirname, "CRUDConfig.json")).test2d; // eslint-disable-line @typescript-eslint/no-require-imports

  before(async () => {
    if (!IModelJsFs.existsSync(KnownTestLocations.outputDir))
      IModelJsFs.mkdirSync(KnownTestLocations.outputDir);
    if (!IModelJsFs.existsSync(outDir))
      IModelJsFs.mkdirSync(outDir);

    // Create all of the seed iModels
    for (const name of crudConfig.classNames) {
      for (const size of crudConfig.dbSizes) {
        const fileName = `Performance2d_seed_${name}_${size}.bim`;
        const pathname = path.join(outDir, fileName);

        if (IModelJsFs.existsSync(pathname))
          return;

        await IModelHost.startup();

        const seedIModel = SnapshotDb.createEmpty(IModelTestUtils.prepareOutputFile("ElementCRUDPerformance2d", fileName), { rootSubject: { name: "PerfTest" } });
        const testSchemaName = path.join(KnownTestLocations.assetsDir, "PerfTestDomain.ecschema.xml");
        await seedIModel.importSchemas([testSchemaName]);
        seedIModel[_nativeDb].resetBriefcaseId(BriefcaseIdValue.Unassigned);
        // eslint-disable-next-line @typescript-eslint/no-deprecated
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
    const csvPath = path.join(KnownTestLocations.outputDir, "PerformanceResults.csv");
    reporter.exportCSV(csvPath);

    await IModelHost.shutdown();
  });

  it("ElementsInsert2d", async () => {
    for (const name of crudConfig.classNames) {
      for (const size of crudConfig.dbSizes) {
        const seedFileName = path.join(KnownTestLocations.outputDir, "ElementCRUDPerformance2d", `Performance2d_seed_${name}_${size}.bim`);
        for (const opCount of crudConfig.opSizes) {
          // eslint-disable-next-line no-console
          console.log(`Executing Element Insert for the class ${name} on an iModel with ${size} elements ${opCount} times`);

          const testFileName = IModelTestUtils.prepareOutputFile("ElementCRUDPerformance2d", `IModelPerformance2d_Insert_${name}_${opCount}.bim`);
          const perfimodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);

          const codeProps = Code.createEmpty();
          codeProps.value = "DrawingModel1";
          const [, newModelId] = IModelTestUtils.createAndInsertDrawingPartitionAndModel(perfimodel, codeProps, true);
          let drawingCategoryId = DrawingCategory.queryCategoryIdByName(perfimodel, IModel.dictionaryId, "MyDrawingCategory");
          if (undefined === drawingCategoryId)
            drawingCategoryId = DrawingCategory.insert(perfimodel, IModel.dictionaryId, "MyDrawingCategory", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));
          let totalTime = 0.0;
          for (let m = 0; m < opCount; ++m) {
            const elementProps = createElemProps(name, perfimodel, newModelId, drawingCategoryId);
            const geomElement = perfimodel.elements.createElement(elementProps);
            const startTime = new Date().getTime();
            const id = perfimodel.elements.insertElement(geomElement.toJSON());
            const endTime = new Date().getTime();
            assert.isTrue(Id64.isValidId64(id), "insert worked");
            const elapsedTime = (endTime - startTime) / 1000.0;
            totalTime = totalTime + elapsedTime;
          }

          reporter.addEntry("PerformanceElementsTests2d", "ElementsInsert2d", "Execution time(s)", totalTime, { ElementClassName: name, InitialCount: size, opCount, CoreVersion: CORE_MAJ_MIN });
          assert.equal(getCount(perfimodel, `PerfTestDomain:${name}`), size + opCount);
          perfimodel.close();
        }
      }
    }
  });

  it("ElementsDelete2d", async () => {
    for (const name of crudConfig.classNames) {
      for (const size of crudConfig.dbSizes) {
        const seedFileName = path.join(KnownTestLocations.outputDir, "ElementCRUDPerformance2d", `Performance2d_seed_${name}_${size}.bim`);
        for (const opCount of crudConfig.opSizes) {
          // eslint-disable-next-line no-console
          console.log(`Executing Element Delete for the class ${name} on an iModel with ${size} elements ${opCount} times`);

          const testFileName = IModelTestUtils.prepareOutputFile("ElementCRUDPerformance2d", `IModelPerformance2d_Delete_${name}_${opCount}.bim`);
          const perfimodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
          const minId: number = PerfTestUtility.getMinId(perfimodel, "bis.GraphicalElement2d");
          const elementIdIncrement = Math.floor(size / opCount);

          const startTime = new Date().getTime();
          for (let i = 0; i < opCount; ++i) {
            try {
              const elId = minId + elementIdIncrement * i;
              perfimodel.elements.deleteElement(Id64.fromLocalAndBriefcaseIds(elId, 0));
            } catch {
              assert.isTrue(false);
            }
          }
          const endTime = new Date().getTime();
          const elapsedTime = (endTime - startTime) / 1000.0;
          reporter.addEntry("PerformanceElementsTests2d", "ElementsDelete2d", "Execution time(s)", elapsedTime, { ElementClassName: name, InitialCount: size, opCount, CoreVersion: CORE_MAJ_MIN });
          assert.equal(getCount(perfimodel, `PerfTestDomain:${name}`), size - opCount);
          perfimodel.close();
        }
      }
    }
  });

  it("ElementsRead2d", async () => {
    for (const name of crudConfig.classNames) {
      for (const size of crudConfig.dbSizes) {
        const seedFileName = path.join(KnownTestLocations.outputDir, "ElementCRUDPerformance2d", `Performance2d_seed_${name}_${size}.bim`);
        for (const opCount of crudConfig.opSizes) {
          // eslint-disable-next-line no-console
          console.log(`Executing Element Read for the class ${name} on an iModel with ${size} elements ${opCount} times`);

          const testFileName = IModelTestUtils.prepareOutputFile("ElementCRUDPerformance2d", `IModelPerformance2d_Read_${name}_${opCount}.bim`);
          const perfimodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
          const minId: number = PerfTestUtility.getMinId(perfimodel, "bis.GraphicalElement2d");
          const elementIdIncrement = Math.floor(size / opCount);

          const startTime = new Date().getTime();
          for (let i = 0; i < opCount; ++i) {
            const elId = minId + elementIdIncrement * i;
            perfimodel.elements.getElement(Id64.fromLocalAndBriefcaseIds(elId, 0));
          }
          const endTime = new Date().getTime();

          // Verify values after the timing portion to ensure everything is loaded correctly.
          // This is performed afterwards to avoid including the extra noise in the perf numbers.
          for (let i = 0; i < opCount; ++i) {
            const elId = minId + elementIdIncrement * i;
            const elemFound: Element = perfimodel.elements.getElement(Id64.fromLocalAndBriefcaseIds(elId, 0));
            verifyProps(elemFound as any);
          }

          const elapsedTime = (endTime - startTime) / 1000.0;
          reporter.addEntry("PerformanceElementsTests2d", "ElementsRead2d", "Execution time(s)", elapsedTime, { ElementClassName: name, InitialCount: size, opCount, CoreVersion: CORE_MAJ_MIN });
          perfimodel.close();
        }
      }
    }
  });

  it("ElementsUpdate2d", async () => {
    for (const name of crudConfig.classNames) {
      for (const size of crudConfig.dbSizes) {
        const seedFileName = path.join(KnownTestLocations.outputDir, "ElementCRUDPerformance2d", `Performance2d_seed_${name}_${size}.bim`);
        for (const opCount of crudConfig.opSizes) {
          // eslint-disable-next-line no-console
          console.log(`Executing Element Update for the class ${name} on an iModel with ${size} elements ${opCount} times`);

          const testFileName = IModelTestUtils.prepareOutputFile("ElementCRUDPerformance2d", `IModelPerformance2d_Update_${name}_${opCount}.bim`);
          const perfimodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
          const minId: number = PerfTestUtility.getMinId(perfimodel, "bis.GraphicalElement2d");
          const elementIdIncrement = Math.floor(size / opCount);

          // first construct modified elements
          const geomArray: Arc3d[] = [
            Arc3d.createXY(Point3d.create(0, 0), 2),
            Arc3d.createXY(Point3d.create(5, 5), 5),
            Arc3d.createXY(Point3d.create(-5, -5), 10),
          ];

          const geometryStream: GeometryStreamProps = [];
          for (const geom of geomArray) {
            const arcData = GeomJson.Writer.toIModelJson(geom);
            geometryStream.push(arcData);
          }
          // now lets update and record time
          const startTime = new Date().getTime();
          for (let i = 0; i < opCount; ++i) {
            const elId = minId + elementIdIncrement * i;
            const editElem: Element = perfimodel.elements.getElement(Id64.fromLocalAndBriefcaseIds(elId, 0));
            (editElem as any).baseStr = "PerfElement - UpdatedValue";
            editElem.setUserProperties("geom", geometryStream);
            try {
              perfimodel.elements.updateElement(editElem.toJSON());
            } catch {
              assert.fail("Element.update failed");
            }
          }
          const endTime = new Date().getTime();

          // verify value is updated
          for (let i = 0; i < opCount; ++i) {
            const elId = minId + elementIdIncrement * i;
            const elemFound: Element = perfimodel.elements.getElement(Id64.fromLocalAndBriefcaseIds(elId, 0));
            assert.equal((elemFound as any).baseStr, "PerfElement - UpdatedValue");
          }
          const elapsedTime = (endTime - startTime) / 1000.0;
          reporter.addEntry("PerformanceElementsTests2d", "ElementsUpdate2d", "Execution time(s)", elapsedTime, { ElementClassName: name, InitialCount: size, opCount, CoreVersion: CORE_MAJ_MIN });
          perfimodel.close();
        }
      }
    }
  });
});

describe("PerformanceElementGetMetadata", () => {
  let imodel: SnapshotDb;
  const idSet: string[] = [];
  const reporter = new Reporter();
  const classNamesList: string[] = [];
  const crudConfig = require(path.join(__dirname, "CRUDConfig.json")).metaDataPerf; // eslint-disable-line @typescript-eslint/no-require-imports

  before(async () => {
    await IModelHost.startup();

    const testFileName = IModelTestUtils.prepareOutputFile("PerformanceElementGetMetadata", "PerformanceElementGetMetadata.bim");

    if (IModelJsFs.existsSync(testFileName))
      IModelJsFs.removeSync(testFileName);

    imodel = IModelTestUtils.createSnapshotFromSeed(testFileName, IModelTestUtils.resolveAssetFile("test.bim"));
    assert.exists(imodel);
  });

  after(async () => {
    const csvPath = path.join(KnownTestLocations.outputDir, "PerformanceResultsGetMetadata.csv");
    // eslint-disable-next-line no-console
    console.log(`Performance results are stored in ${csvPath}`);
    reporter.exportCSV(csvPath);

    imodel.abandonChanges();
    imodel.close();

    await IModelHost.shutdown();
  });

  function generateClasses(numClasses: number, currentClass: number = 1): string {
    if (currentClass > numClasses)
      return "";

    const className = `PerfTestElementClass${currentClass}`;
    classNamesList.push(className);

    const classDefinition = `
      <ECEntityClass typeName="${className}">
        <BaseClass>bis:PhysicalElement</BaseClass>
        <ECProperty propertyName="StrProp${currentClass}" typeName="string"/>
        <ECProperty propertyName="LongProp${currentClass}" typeName="long"/>
        <ECProperty propertyName="DoubleProp${currentClass}" typeName="double"/>
      </ECEntityClass>`;

    return classDefinition + generateClasses(numClasses, currentClass + 1);
  }

  async function setupElementsForTests() {
    // Data Setup
    const perfSchemaTemplate = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="PerfTestElementMetaData" alias="ts" version="01.00.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00.00" alias="bis"/>
        <ECEntityClass typeName="PerfTestElementBaseClass">
          <BaseClass>bis:PhysicalElement</BaseClass>
          <ECProperty propertyName="BaseStr" typeName="string"/>
          <ECProperty propertyName="BaseLong" typeName="long"/>
          <ECProperty propertyName="BaseDouble" typeName="double"/>
        </ECEntityClass>
        %s
    </ECSchema>`;
    try {
      await imodel.importSchemaStrings([perfSchemaTemplate.replace("%s", generateClasses(crudConfig.numberOfClasses))]);
    } catch (error: any) {
      assert.fail(`Error importing schema for PerformanceElementGetMetadata: ${error.message}`);
    }

    const [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(imodel, Code.createEmpty(), true);
    let spatialCategoryId = SpatialCategory.queryCategoryIdByName(imodel, IModel.dictionaryId, "TestCategory");
    if (undefined === spatialCategoryId)
      spatialCategoryId = SpatialCategory.insert(imodel, IModel.dictionaryId, "TestCategory", new SubCategoryAppearance());

    const propsTemplate = {
      model: newModelId,
      code: Code.createEmpty(),
      category: spatialCategoryId,
    };

    for (const className of classNamesList) {
      const element = imodel.elements.createElement({
          classFullName: `PerfTestElementMetaData:${className}`,
          userLabel: `PerfTestElementMetaData:${className}`,
          ...propsTemplate,
        } as ElementProps);
      const id = imodel.elements.insertElement(element.toJSON());
      assert.isTrue(Id64.isValidId64(id), "insert successful");
      idSet.push(id);
    }
  }

  async function testGetMetadataPerformance(elementIds: string[], className: string, testRepeatCallsWithSingleElement: boolean = false) {
    const perfMeasure: number[] = [];
    const repeats: number = testRepeatCallsWithSingleElement ? crudConfig.repeats : 1;

    for (const elementId of elementIds) {
      const element = imodel.elements.getElement(elementId);
      assert.exists(element);

      for (let i = 0; i < repeats; i++) {
        const start = performance.now();
        const metaData = await element.getMetaData()
        const end = performance.now() - start;
        assert.exists(metaData);
        perfMeasure.push(parseFloat(end.toFixed(5)));
      }
      if (testRepeatCallsWithSingleElement)
        break;
    }

    reportGetMetadataPerformance(perfMeasure, elementIds, className, testRepeatCallsWithSingleElement);
  }

  function reportGetMetadataPerformance(perfMeasure: number[], elementIds: string[], className: string, testRepeatCallsWithSingleElement: boolean) {
    /*eslint-disable no-console*/
    const averageTime = (perfMeasure.slice(1).reduce((acc, val) => acc + val, 0)) / (perfMeasure.length - 1);

    assert.isTrue(averageTime < perfMeasure[0], "Average time for subsequent calls should always be less than the first call");

    if (testRepeatCallsWithSingleElement) {
      console.log(`Performance Test: Executing getMetaData ${crudConfig.repeats} times for ${className} element with Id ${elementIds[0]}`);
      reporter.addEntry("PerformanceElementGetMetadata", `test repeated ${className} metadata retrieval performance`, "Execution time(s) for first call", perfMeasure[0]);
      reporter.addEntry("PerformanceElementGetMetadata", `test repeated ${className} metadata retrieval performance`, "Average Execution time(s) for subsequent calls", averageTime);
    } else {
      console.log(`Performance Test: Executing getMetaData for ${elementIds.length} elements from different classes.`);
      reporter.addEntry("PerformanceElementGetMetadata", `test metadata retrieval performance for different classes`, "Execution time(s) for first call", perfMeasure[0]);
      reporter.addEntry("PerformanceElementGetMetadata", `test metadata retrieval performance for different classes`, "Average Execution time(s) for subsequent calls", averageTime);
    }

    console.log(`First call took: ${perfMeasure[0]} milliseconds`); // The first call is expected to be slower as the schema needs to be loaded
    console.log(`Average time for subsequent calls: ${averageTime} milliseconds`); // The subsequent calls should be faster as the schema is already loaded
    /*eslint-enable no-console*/
  }

  it("test EntityClass metadata retrieval performance", async () => {
    await setupElementsForTests();

    const sqltemplate = `select min(e.ECInstanceId), max(e.ECInstanceId) from bis.Element e join meta.ECClassDef c on e.ECClassId = c.ECInstanceId join meta.ECSchemaDef s on c.Schema.Id = s.ECInstanceId where s.Name=`;

    const bisCoreElements: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    imodel.withPreparedStatement(`${sqltemplate}'BisCore'`, (stmt: ECSqlStatement) => {
      assert.equal(DbResult.BE_SQLITE_ROW, stmt.step());
      bisCoreElements.push(stmt.getValue(0).getId());
      bisCoreElements.push(stmt.getValue(1).getId());
    });

    const genericElements: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    imodel.withPreparedStatement(`${sqltemplate}'Generic'`, (stmt: ECSqlStatement) => {
      assert.equal(DbResult.BE_SQLITE_ROW, stmt.step());
      genericElements.push(stmt.getValue(0).getId());
      genericElements.push(stmt.getValue(1).getId());
    });

    const idSetForRepeatCalls = [...idSet];

    // Check the performance in milliseconds for elements from all different classes of PerfTestElementMetaData schema
    await testGetMetadataPerformance(idSet, "");

    // Check the performance in milliseconds for different elements of the same BisCore schema
    await testGetMetadataPerformance(bisCoreElements, "BisCore");

    // Check the performance in milliseconds for different elements of the same Generic schema
    await testGetMetadataPerformance(genericElements, "Generic");

    // Test the performance of repeated calls to the same element already cached
    await testGetMetadataPerformance([idSetForRepeatCalls[0]], "PerfElement", true);

    await testGetMetadataPerformance([bisCoreElements[0]], "BisCore", true);

    await testGetMetadataPerformance([genericElements[0]], "Generic", true);
  });
});