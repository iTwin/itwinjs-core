/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { DbResult, Id64, Id64String } from "@bentley/bentleyjs-core";
import { Arc3d, IModelJson as GeomJson, Point3d } from "@bentley/geometry-core";
import { BriefcaseIdValue, Code, ColorDef, GeometricElementProps, GeometryStreamProps, IModel, SubCategoryAppearance } from "@bentley/imodeljs-common";
import { Reporter } from "@bentley/perf-tools/lib/Reporter";
import {
  BackendRequestContext, DrawingCategory, ECSqlStatement, Element, IModelDb, IModelJsFs, SnapshotDb, SpatialCategory,
} from "../imodeljs-backend";
import { IModelTestUtils } from "../test/IModelTestUtils";
import { KnownTestLocations } from "../test/KnownTestLocations";
import { PerfTestUtility } from "./PerfTestUtils";

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
  imodel.withPreparedStatement(`SELECT count(*) AS [count] FROM ${className}`, (stmt: ECSqlStatement) => {
    assert.equal(DbResult.BE_SQLITE_ROW, stmt.step());
    const row = stmt.getRow();
    count = row.count;
  });
  return count;
}

describe("PerformanceElementsTests", () => {
  const reporter = new Reporter();
  const crudConfig = require(path.join(__dirname, "CRUDConfig.json")).test3d; // eslint-disable-line @typescript-eslint/no-var-requires

  before(async () => {
    // Create all of the seed iModels
    for (const name of crudConfig.classNames) {
      for (const size of crudConfig.dbSizes) {
        const fileName = `Performance_seed_${name}_${size}.bim`;
        const pathname = path.join(KnownTestLocations.outputDir, "ElementCRUDPerformance", fileName);

        if (IModelJsFs.existsSync(pathname))
          return;

        const seedIModel = SnapshotDb.createEmpty(IModelTestUtils.prepareOutputFile("ElementCRUDPerformance", fileName), { rootSubject: { name: "PerfTest" } });
        const testSchemaName = path.join(KnownTestLocations.assetsDir, "PerfTestDomain.ecschema.xml");
        await seedIModel.importSchemas(new BackendRequestContext(), [testSchemaName]);
        seedIModel.nativeDb.resetBriefcaseId(BriefcaseIdValue.Unassigned);
        assert.isDefined(seedIModel.getMetaData(`PerfTestDomain:${name}`), `${name}is present in iModel.`);
        const [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(seedIModel, Code.createEmpty(), true);
        let spatialCategoryId = SpatialCategory.queryCategoryIdByName(seedIModel, IModel.dictionaryId, "MySpatialCategory");
        if (undefined === spatialCategoryId)
          spatialCategoryId = SpatialCategory.insert(seedIModel, IModel.dictionaryId, "MySpatialCategory", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));

        for (let m = 0; m < size; ++m) {
          const elementProps = createElemProps(name, seedIModel, newModelId, spatialCategoryId);
          const geomElement = seedIModel.elements.createElement(elementProps);
          const id = seedIModel.elements.insertElement(geomElement);
          assert.isTrue(Id64.isValidId64(id), "insert worked");
        }

        assert.equal(getCount(seedIModel, `PerfTestDomain:${name}`), size);
        seedIModel.saveChanges();
        seedIModel.close();
      }
    }
  });
  after(() => {
    const csvPath = path.join(KnownTestLocations.outputDir, "PerformanceResults.csv");
    reporter.exportCSV(csvPath);
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
            const id = perfimodel.elements.insertElement(geomElement);
            const endTime = new Date().getTime();
            assert.isTrue(Id64.isValidId64(id), "insert worked");
            const elapsedTime = (endTime - startTime) / 1000.0;
            totalTime = totalTime + elapsedTime;
          }

          reporter.addEntry("PerformanceElementsTests", "ElementsInsert", "Execution time(s)", totalTime, { ElementClassName: name, InitialCount: size, opCount });
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
            } catch (err) {
              assert.isTrue(false);
            }
          }
          const endTime = new Date().getTime();
          const elapsedTime = (endTime - startTime) / 1000.0;
          reporter.addEntry("PerformanceElementsTests", "ElementsDelete", "Execution time(s)", elapsedTime, { ElementClassName: name, InitialCount: size, opCount });
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
          reporter.addEntry("PerformanceElementsTests", "ElementsRead", "Execution time(s)", elapsedTime, { ElementClassName: name, InitialCount: size, opCount });
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
              perfimodel.elements.updateElement(editElem);
            } catch (_err) {
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
          reporter.addEntry("PerformanceElementsTests", "ElementsUpdate", "Execution time(s)", elapsedTime, { ElementClassName: name, InitialCount: size, opCount });
          perfimodel.close();
        }
      }
    }
  });
});

describe("PerformanceElementsTests2d", () => {
  const outDir: string = path.join(KnownTestLocations.outputDir, "ElementCRUDPerformance2d");
  const reporter = new Reporter();
  const crudConfig = require(path.join(__dirname, "CRUDConfig.json")).test2d; // eslint-disable-line @typescript-eslint/no-var-requires

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

        const seedIModel = SnapshotDb.createEmpty(IModelTestUtils.prepareOutputFile("ElementCRUDPerformance2d", fileName), { rootSubject: { name: "PerfTest" } });
        const testSchemaName = path.join(KnownTestLocations.assetsDir, "PerfTestDomain.ecschema.xml");
        await seedIModel.importSchemas(new BackendRequestContext(), [testSchemaName]);
        seedIModel.nativeDb.resetBriefcaseId(BriefcaseIdValue.Unassigned);
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
          const id = seedIModel.elements.insertElement(geomElement);
          assert.isTrue(Id64.isValidId64(id), "insert worked");
        }

        seedIModel.saveChanges();
        assert.equal(getCount(seedIModel, `PerfTestDomain:${name}`), size);
        seedIModel.close();
      }
    }
  });
  after(() => {
    const csvPath = path.join(KnownTestLocations.outputDir, "PerformanceResults.csv");
    reporter.exportCSV(csvPath);
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
            const id = perfimodel.elements.insertElement(geomElement);
            const endTime = new Date().getTime();
            assert.isTrue(Id64.isValidId64(id), "insert worked");
            const elapsedTime = (endTime - startTime) / 1000.0;
            totalTime = totalTime + elapsedTime;
          }

          reporter.addEntry("PerformanceElementsTests2d", "ElementsInsert2d", "Execution time(s)", totalTime, { ElementClassName: name, InitialCount: size, opCount });
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
            } catch (err) {
              assert.isTrue(false);
            }
          }
          const endTime = new Date().getTime();
          const elapsedTime = (endTime - startTime) / 1000.0;
          reporter.addEntry("PerformanceElementsTests2d", "ElementsDelete2d", "Execution time(s)", elapsedTime, { ElementClassName: name, InitialCount: size, opCount });
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
          reporter.addEntry("PerformanceElementsTests2d", "ElementsRead2d", "Execution time(s)", elapsedTime, { ElementClassName: name, InitialCount: size, opCount });
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
              perfimodel.elements.updateElement(editElem);
            } catch (_err) {
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
          reporter.addEntry("PerformanceElementsTests2d", "ElementsUpdate2d", "Execution time(s)", elapsedTime, { ElementClassName: name, InitialCount: size, opCount });
          perfimodel.close();
        }
      }
    }
  });
});
