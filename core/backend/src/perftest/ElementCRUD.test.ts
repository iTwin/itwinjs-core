/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { DbResult, Id64String, Id64 } from "@bentley/bentleyjs-core";
import { SpatialCategory, Element, IModelDb } from "../imodeljs-backend";
import { ECSqlStatement } from "../ECSqlStatement";
import { IModelTestUtils } from "../test/IModelTestUtils";
import { GeometricElementProps, Code, SubCategoryAppearance, ColorDef, IModel, GeometryStreamProps } from "@bentley/imodeljs-common";
import { Point3d, Arc3d } from "@bentley/geometry-core";
import { IModelJson as GeomJson } from "@bentley/geometry-core/lib/serialization/IModelJsonSchema";
import { KnownTestLocations } from "../test/KnownTestLocations";
import { IModelJsFs } from "../IModelJsFs";
import { BackendRequestContext } from "../BackendRequestContext";
import { Reporter } from "@bentley/perf-tools/lib/Reporter";

describe("PerformanceElementsTests", () => {
  const reporter = new Reporter();
  const opSizes: number[] = [1000, 2000, 3000];
  const dbSizes: number[] = [10000, 100000, 1000000];
  const classNames: string[] = ["PerfElement", "PerfElementSub1", "PerfElementSub2", "PerfElementSub3"];

  const values: any = {
    baseStr: "PerfElement - InitValue", sub1Str: "PerfElementSub1 - InitValue",
    sub2Str: "PerfElementSub2 - InitValue", sub3Str: "PerfElementSub3 - InitValue",
    baseLong: "0x989680", sub1Long: "0x1312d00", sub2Long: "0x1c9c380", sub3Long: "0x2625a00",
    baseDouble: -3.1416, sub1Double: 2.71828, sub2Double: 1.414121, sub3Double: 1.61803398874,
  };

  interface TestElementProps extends GeometricElementProps {
    baseStr?: string;
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
      classFullName: "PerfTestDomain:" + className,
      model: modId,
      category: catId,
      code: Code.createEmpty(),
      geom: geometryStream,
    };
    if (className === "PerfElementSub3") {
      elementProps.sub3Str = values.sub3Str;
      elementProps.sub3Long = values.sub3Long;
      elementProps.sub3Double = values.sub3Double;
    }
    if (className === "PerfElementSub3" || className === "PerfElementSub2") {
      elementProps.sub2Str = values.sub2Str;
      elementProps.sub2Long = values.sub2Long;
      elementProps.sub2Double = values.sub2Double;
    }
    if (className === "PerfElementSub3" || className === "PerfElementSub2" || className === "PerfElementSub1") {
      elementProps.sub1Str = values.sub1Str;
      elementProps.sub1Long = values.sub1Long;
      elementProps.sub1Double = values.sub1Double;
    }
    elementProps.baseStr = values.baseStr;
    elementProps.baseLong = values.baseLong;
    elementProps.baseDouble = values.baseDouble;
    return elementProps;
  }

  function verifyProps(testElement: TestElementProps) {
    assert.equal(testElement.baseStr, values.baseStr, `${testElement.classFullName}`);
    assert.equal(testElement.baseLong, values.baseLong, `${testElement.classFullName}`);
    assert.equal(testElement.baseDouble, values.baseDouble, `${testElement.classFullName}`);

    if (testElement.classFullName.startsWith("PerfTestDomain:PerfElementSub")) {
      assert.equal(testElement.sub1Str, values.sub1Str, `${testElement.classFullName}`);
      assert.equal(testElement.sub1Long, values.sub1Long, `${testElement.classFullName}`);
      assert.equal(testElement.sub1Double, values.sub1Double, `${testElement.classFullName}`);

      if (testElement.classFullName === "PerfTestDomain:PerfElementSub2" || testElement.classFullName === "PerfTestDomain:PerfElementSub3") {
        assert.equal(testElement.sub2Str, values.sub2Str, `${testElement.classFullName}`);
        assert.equal(testElement.sub2Long, values.sub2Long, `${testElement.classFullName}`);
        assert.equal(testElement.sub2Double, values.sub2Double, `${testElement.classFullName}`);
      }

      if (testElement.classFullName === "PerfTestDomain:PerfElementSub3") {
        assert.equal(testElement.sub3Str, values.sub3Str, `${testElement.classFullName}`);
        assert.equal(testElement.sub3Long, values.sub3Long, `${testElement.classFullName}`);
        assert.equal(testElement.sub3Double, values.sub3Double, `${testElement.classFullName}`);
      }
    }
  }

  before(async () => {
    // Create all of the seed iModels
    for (const name of classNames) {
      for (const size of dbSizes) {
        const fileName = "Performance_seed_" + name + "_" + size + ".bim";
        const pathname = path.join(KnownTestLocations.outputDir, "ElementCRUDPerformance", fileName);

        if (IModelJsFs.existsSync(pathname))
          return;

        const seedIModel = IModelDb.createSnapshot(IModelTestUtils.prepareOutputFile("ElementCRUDPerformance", fileName), { rootSubject: { name: "PerfTest" } });
        const testSchemaName = path.join(KnownTestLocations.assetsDir, "PerfTestDomain.ecschema.xml");
        await seedIModel.importSchemas(new BackendRequestContext(), [testSchemaName]);
        seedIModel.setAsMaster();
        assert.isDefined(seedIModel.getMetaData("PerfTestDomain:" + name), name + "is present in iModel.");
        const [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(seedIModel, Code.createEmpty(), true);
        let spatialCategoryId = SpatialCategory.queryCategoryIdByName(seedIModel, IModel.dictionaryId, "MySpatialCategory");
        if (undefined === spatialCategoryId)
          spatialCategoryId = SpatialCategory.insert(seedIModel, IModel.dictionaryId, "MySpatialCategory", new SubCategoryAppearance({ color: new ColorDef("rgb(255,0,0)") }));

        for (let m = 0; m < size; ++m) {
          const elementProps = createElemProps(name, seedIModel, newModelId, spatialCategoryId);
          const geomElement = seedIModel.elements.createElement(elementProps);
          const id = seedIModel.elements.insertElement(geomElement);
          assert.isTrue(Id64.isValidId64(id), "insert worked");
        }

        seedIModel.saveChanges();
        seedIModel.closeSnapshot();
      }
    }
  });
  after(() => {
    const csvPath = path.join(KnownTestLocations.outputDir, "PerformanceResults.csv");
    reporter.exportCSV(csvPath);
  });

  it("ElementsInsert", async () => {
    for (const name of classNames) {
      for (const size of dbSizes) {
        const seedFileName = path.join(KnownTestLocations.outputDir, "ElementCRUDPerformance", "Performance_seed_" + name + "_" + size + ".bim");
        for (const opCount of opSizes) {
          // tslint:disable-next-line:no-console
          console.log(`Executing Element Insert for the class ${name} on an iModel with ${size} elements ${opCount} times`);

          const testFileName = IModelTestUtils.prepareOutputFile("ElementCRUDPerformance", "IModelPerformance_Insert_" + name + "_" + opCount + ".bim");
          const perfimodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
          const [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(perfimodel, Code.createEmpty(), true);
          let spatialCategoryId = SpatialCategory.queryCategoryIdByName(perfimodel, IModel.dictionaryId, "MySpatialCategory");
          if (undefined === spatialCategoryId)
            spatialCategoryId = SpatialCategory.insert(perfimodel, IModel.dictionaryId, "MySpatialCategory", new SubCategoryAppearance({ color: new ColorDef("rgb(255,0,0)") }));

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
          perfimodel.withPreparedStatement("SELECT count(*) AS [count] FROM PerfTestDomain:" + name, (stmt: ECSqlStatement) => {
            assert.equal(DbResult.BE_SQLITE_ROW, stmt.step());
            const row = stmt.getRow();
            assert.equal(row.count, size + opCount);
          });
          perfimodel.closeSnapshot();
        }
      }
    }
  });

  it("ElementsDelete", async () => {
    for (const name of classNames) {
      for (const size of dbSizes) {
        const seedFileName = path.join(KnownTestLocations.outputDir, "ElementCRUDPerformance", "Performance_seed_" + name + "_" + size + ".bim");
        for (const opCount of opSizes) {
          // tslint:disable-next-line:no-console
          console.log(`Executing Element Delete for the class ${name} on an iModel with ${size} elements ${opCount} times`);

          const testFileName = IModelTestUtils.prepareOutputFile("ElementCRUDPerformance", "IModelPerformance_Delete_" + name + "_" + opCount + ".bim");
          const perfimodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
          const stat = IModelTestUtils.executeQuery(perfimodel, "SELECT MAX(ECInstanceId) maxId, MIN(ECInstanceId) minId FROM bis.PhysicalElement")[0];
          const elementIdIncrement = Math.floor(size / opCount);
          assert.equal((stat.maxId - stat.minId + 1), size);
          const startTime = new Date().getTime();
          for (let i = 0; i < opCount; ++i) {
            try {
              const elId = stat.minId + elementIdIncrement * i;
              perfimodel.elements.deleteElement(Id64.fromLocalAndBriefcaseIds(elId, 0));
            } catch (err) {
              assert.isTrue(false);
            }
          }
          const endTime = new Date().getTime();
          const elapsedTime = (endTime - startTime) / 1000.0;
          reporter.addEntry("PerformanceElementsTests", "ElementsDelete", "Execution time(s)", elapsedTime, { ElementClassName: name, InitialCount: size, opCount });
          perfimodel.withPreparedStatement("SELECT count(*) AS [count] FROM PerfTestDomain:" + name, (stmt: ECSqlStatement) => {
            assert.equal(DbResult.BE_SQLITE_ROW, stmt.step());
            const row = stmt.getRow();
            assert.equal(row.count, size - opCount);
          });
          perfimodel.closeSnapshot();
        }
      }
    }
  });

  it("ElementsRead", async () => {
    for (const name of classNames) {
      for (const size of dbSizes) {
        const seedFileName = path.join(KnownTestLocations.outputDir, "ElementCRUDPerformance", "Performance_seed_" + name + "_" + size + ".bim");
        for (const opCount of opSizes) {
          // tslint:disable-next-line:no-console
          console.log(`Executing Element Delete for the class ${name} on an iModel with ${size} elements ${opCount} times`);

          const testFileName = IModelTestUtils.prepareOutputFile("ElementCRUDPerformance", "IModelPerformance_Read_" + name + "_" + opCount + ".bim");
          const perfimodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
          const stat = IModelTestUtils.executeQuery(perfimodel, "SELECT MAX(ECInstanceId) maxId, MIN(ECInstanceId) minId FROM bis.PhysicalElement")[0];
          const elementIdIncrement = Math.floor(size / opCount);
          assert.equal((stat.maxId - stat.minId + 1), size);

          const startTime = new Date().getTime();
          for (let i = 0; i < opCount; ++i) {
            const elId = stat.minId + elementIdIncrement * i;
            perfimodel.elements.getElement(Id64.fromLocalAndBriefcaseIds(elId, 0));
          }
          const endTime = new Date().getTime();

          // Verify values after the timing portion to ensure everything is loaded correctly.
          // This is performed afterwards to avoid including the extra noise in the perf numbers.
          for (let i = 0; i < opCount; ++i) {
            const elId = stat.minId + elementIdIncrement * i;
            const elemFound: Element = perfimodel.elements.getElement(Id64.fromLocalAndBriefcaseIds(elId, 0));
            verifyProps(elemFound as any);
          }

          const elapsedTime = (endTime - startTime) / 1000.0;
          reporter.addEntry("PerformanceElementsTests", "ElementsRead", "Execution time(s)", elapsedTime, { ElementClassName: name, InitialCount: size, opCount });
          perfimodel.closeSnapshot();
        }
      }
    }
  });

  it("ElementsUpdate", async () => {
    for (const name of classNames) {
      for (const size of dbSizes) {
        const seedFileName = path.join(KnownTestLocations.outputDir, "ElementCRUDPerformance", "Performance_seed_" + name + "_" + size + ".bim");
        for (const opCount of opSizes) {
          // tslint:disable-next-line:no-console
          console.log(`Executing Element Update for the class ${name} on an iModel with ${size} elements ${opCount} times`);

          const testFileName = IModelTestUtils.prepareOutputFile("ElementCRUDPerformance", "IModelPerformance_Update_" + name + "_" + opCount + ".bim");
          const perfimodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
          const stat = IModelTestUtils.executeQuery(perfimodel, "SELECT MAX(ECInstanceId) maxId, MIN(ECInstanceId) minId FROM bis.PhysicalElement")[0];
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
            const elId = stat.minId + elementIdIncrement * i;
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
            const elId = stat.minId + elementIdIncrement * i;
            const elemFound: Element = perfimodel.elements.getElement(Id64.fromLocalAndBriefcaseIds(elId, 0));
            assert.equal((elemFound as any).baseStr, "PerfElement - UpdatedValue");
          }
          const elapsedTime = (endTime - startTime) / 1000.0;
          reporter.addEntry("PerformanceElementsTests", "ElementsUpdate", "Execution time(s)", elapsedTime, { ElementClassName: name, InitialCount: size, opCount });
          perfimodel.closeSnapshot();
        }
      }
    }
  });
});
