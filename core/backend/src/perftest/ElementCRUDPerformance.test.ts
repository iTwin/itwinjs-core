/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { DbResult, Id64 } from "@bentley/bentleyjs-core";
import { DictionaryModel, SpatialCategory, Element, IModelDb } from "../backend";
import { ECSqlStatement } from "../ECSqlStatement";
import { IModelTestUtils } from "../test/IModelTestUtils";
import { GeometricElementProps, Code, SubCategoryAppearance, ColorDef, IModel, GeometryStreamProps } from "@bentley/imodeljs-common";
import { Point3d, Arc3d } from "@bentley/geometry-core";
import { IModelJson as GeomJson } from "@bentley/geometry-core/lib/serialization/IModelJsonSchema";
import { KnownTestLocations } from "../test/KnownTestLocations";
import { IModelJsFs } from "../IModelJsFs";
import * as fs from "fs";

describe("PerformanceElementsTests", () => {
  let seedIModel: IModelDb;
  const opSizes: any[] = [1000, 2000, 3000];
  const dbSizes: any[] = [10000, 100000, 1000000];
  const classNames: any[] = ["PerfElement", "PerfElementSub1", "PerfElementSub2", "PerfElementSub3"];

  const values: any = {
    baseStr: "PerfElement - InitValue", sub1Str: "PerfElementSub1 - InitValue",
    sub2Str: "PerfElementSub2 - InitValue", sub3Str: "PerfElementSub3 - InitValue",
    baseLong: "0x989680", sub1Long: "0x1312d00", sub2Long: "0x1c9c380", sub3Long: "0x2625a00",
    baseDouble: -3.1416, sub1Double: 2.71828, sub2Double: 1.414121, sub3Double: 1.61803398874,
  };
  const csvPath = path.join(KnownTestLocations.outputDir, "PerformanceResults.csv");

  function createElemProps(className: string, iModelName: IModelDb, modId: Id64, catId: Id64): GeometricElementProps {
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
      classFullName: "PerfTestDomain:" + className,
      iModel: iModelName,
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

  function verifyProps(testElement: Element): boolean {
    let passed: boolean = false;
    switch (testElement.classFullName) {
      case "PerfTestDomain:PerfElement":
        if (testElement.baseStr === values.baseStr && testElement.baseLong === values.baseLong
          && testElement.baseDouble === values.baseDouble) {
          passed = true;
        }
        break;
      case "PerfTestDomain:PerfElementSub1":
        if (testElement.baseStr === values.baseStr && testElement.baseLong === values.baseLong
          && testElement.baseDouble === values.baseDouble && testElement.sub1Str === values.sub1Str
          && testElement.sub1Long === values.sub1Long && testElement.sub1Double === values.sub1Double) {
          passed = true;
        }
        break;
      case "PerfTestDomain:PerfElementSub2":
        if (testElement.baseStr === values.baseStr && testElement.baseLong === values.baseLong
          && testElement.baseDouble === values.baseDouble && testElement.sub1Str === values.sub1Str
          && testElement.sub1Long === values.sub1Long && testElement.sub1Double === values.sub1Double
          && testElement.sub2Str === values.sub2Str && testElement.sub2Long === values.sub2Long
          && testElement.sub2Double === values.sub2Double) {
          passed = true;
        }
        break;
      case "PerfTestDomain:PerfElementSub3":
        if (testElement.baseStr === values.baseStr && testElement.baseLong === values.baseLong
          && testElement.baseDouble === values.baseDouble && testElement.sub1Str === values.sub1Str
          && testElement.sub1Long === values.sub1Long && testElement.sub1Double === values.sub1Double
          && testElement.sub2Str === values.sub2Str && testElement.sub2Long === values.sub2Long
          && testElement.sub2Double === values.sub2Double && testElement.sub3Str === values.sub3Str
          && testElement.sub3Long === values.sub3Long && testElement.sub3Double === values.sub3Double) {
          passed = true;
        }
        break;
      default:
        passed = false;
    }
    return passed;
  }
  before(() => {
    for (const className of classNames) {
      for (const dbSize of dbSizes) {
        const fileName = "Performance_seed_" + className + "_" + dbSize + ".bim";
        const pathname = path.join(KnownTestLocations.outputDir, fileName);
        if (!IModelJsFs.existsSync(pathname)) {
          seedIModel = IModelTestUtils.createStandaloneIModel(fileName, { rootSubject: { name: "PerfTest" } });
          const testSchemaName = path.join(KnownTestLocations.assetsDir, "PerfTestDomain.ecschema.xml");
          seedIModel.importSchema(testSchemaName);
          seedIModel.setAsMaster();
          const dictionary: DictionaryModel = seedIModel.models.getModel(IModel.dictionaryId) as DictionaryModel;
          assert.isDefined(seedIModel.getMetaData("PerfTestDomain:" + className), className + "is present in iModel.");
          const [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(seedIModel, Code.createEmpty(), true);
          let spatialCategoryId = SpatialCategory.queryCategoryIdByName(dictionary.iModel, dictionary.id, "MySpatialCategory");
          if (undefined === spatialCategoryId) {
            spatialCategoryId = IModelTestUtils.createAndInsertSpatialCategory(dictionary, "MySpatialCategory", new SubCategoryAppearance({ color: new ColorDef("rgb(255,0,0)") }));
          }

          for (let m = 0; m < dbSize; ++m) {
            const elementProps = createElemProps(className, seedIModel, newModelId, spatialCategoryId);
            const geomElement = seedIModel.elements.createElement(elementProps);
            const id = seedIModel.elements.insertElement(geomElement);
            assert.isTrue(id.isValid, "insert worked");
          }

          seedIModel.saveChanges();
          IModelTestUtils.closeIModel(seedIModel);
        }
      }
    }
    if (!IModelJsFs.existsSync(csvPath))
      fs.appendFileSync(csvPath, "DateTime,TestCaseName,TestName,ExecutionTime(s),opCount,TestDescription,OpType,InitialCount\n");
  });

  it("ElementsInsert", () => {
    for (const className of classNames) {
      for (const dbSize of dbSizes) {
        const baseSeed = "Performance_seed_" + className + "_" + dbSize + ".bim";
        for (const opCount of opSizes) {
          const testFileName = "ImodelPerformance_Insert_" + className + "_" + opCount + ".bim";
          const perfimodel = IModelTestUtils.openIModelFromOut(baseSeed, { copyFilename: testFileName, enableTransactions: true });
          const dictionary: DictionaryModel = perfimodel.models.getModel(IModel.dictionaryId) as DictionaryModel;
          let newModelId: Id64;
          [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(perfimodel, Code.createEmpty(), true);
          let spatialCategoryId = SpatialCategory.queryCategoryIdByName(dictionary.iModel, dictionary.id, "MySpatialCategory");
          if (undefined === spatialCategoryId) {
            spatialCategoryId = IModelTestUtils.createAndInsertSpatialCategory(dictionary, "MySpatialCategory", new SubCategoryAppearance({ color: new ColorDef("rgb(255,0,0)") }));
          }
          let totalTime = 0.0;
          for (let m = 0; m < opCount; ++m) {
            const elementProps = createElemProps(className, perfimodel, newModelId, spatialCategoryId);
            const geomElement = perfimodel.elements.createElement(elementProps);
            const startTime = new Date().getTime();
            const id = perfimodel.elements.insertElement(geomElement);
            assert.isTrue(id.isValid, "insert worked");
            const endTime = new Date().getTime();
            const elapsedTime = (endTime - startTime) / 1000.0;
            totalTime = totalTime + elapsedTime;
          }
          const recordTime = new Date().toISOString();
          fs.appendFileSync(csvPath, recordTime + ",PerformanceElementsTests,ElementsInsert," + totalTime + "," + opCount +
            ",\"Element API Insert   \'" + className + "\' [Initial count: " + dbSize + "]\",Insert," + dbSize + "\n");
          perfimodel.withPreparedStatement("SELECT count(*) AS [count] FROM PerfTestDomain:" + className, (stmt: ECSqlStatement) => {
            assert.equal(DbResult.BE_SQLITE_ROW, stmt.step());
            const row = stmt.getRow();
            assert.equal(row.count, dbSize + opCount);
          });
          IModelTestUtils.closeIModel(perfimodel);
        }
      }
    }
  });

  it("ElementsDelete", () => {
    for (const className of classNames) {
      for (const dbSize of dbSizes) {
        const baseSeed = "Performance_seed_" + className + "_" + dbSize + ".bim";
        for (const opCount of opSizes) {
          const testFileName = "ImodelPerformance_Delete_" + className + "_" + opCount + ".bim";
          const perfimodel = IModelTestUtils.openIModelFromOut(baseSeed, { copyFilename: testFileName, enableTransactions: true });
          const stat = perfimodel.executeQuery("SELECT MAX(ECInstanceId) maxId, MIN(ECInstanceId) minId FROM bis.PhysicalElement")[0];
          const elementIdIncrement = Math.floor(dbSize / opCount);
          assert.equal((stat.maxId - stat.minId + 1), dbSize);
          const startTime = new Date().getTime();
          for (let i = 0; i < opCount; ++i) {
            try {
              const elId = stat.minId + elementIdIncrement * i;
              perfimodel.elements.deleteElement(new Id64([elId, 0]));
            } catch (err) {
              assert.isTrue(false);
            }
          }
          const endTime = new Date().getTime();
          const elapsedTime = (endTime - startTime) / 1000.0;
          const recordTime = new Date().toISOString();
          fs.appendFileSync(csvPath, recordTime + ",PerformanceElementsTests,ElementsDelete," + elapsedTime + "," + opCount +
            ",\"Element API Delete   \'" + className + "\' [Initial count: " + dbSize + "]\",Delete," + dbSize + "\n");
          perfimodel.withPreparedStatement("SELECT count(*) AS [count] FROM PerfTestDomain:" + className, (stmt: ECSqlStatement) => {
            assert.equal(DbResult.BE_SQLITE_ROW, stmt.step());
            const row = stmt.getRow();
            assert.equal(row.count, dbSize - opCount);
          });
          IModelTestUtils.closeIModel(perfimodel);
        }
      }
    }
  });

  it("ElementsRead", () => {
    for (const className of classNames) {
      for (const dbSize of dbSizes) {
        const baseSeed = "Performance_seed_" + className + "_" + dbSize + ".bim";
        for (const opCount of opSizes) {
          const testFileName = "ImodelPerformance_Read_" + className + "_" + opCount + ".bim";
          const perfimodel = IModelTestUtils.openIModelFromOut(baseSeed, { copyFilename: testFileName, enableTransactions: true });
          const stat = perfimodel.executeQuery("SELECT MAX(ECInstanceId) maxId, MIN(ECInstanceId) minId FROM bis.PhysicalElement")[0];
          const elementIdIncrement = Math.floor(dbSize / opCount);
          assert.equal((stat.maxId - stat.minId + 1), dbSize);
          const startTime = new Date().getTime();
          for (let i = 0; i < opCount; ++i) {
            const elId = stat.minId + elementIdIncrement * i;
            const elemFound: Element = perfimodel.elements.getElement(new Id64([elId, 0]));
            assert.isTrue(verifyProps(elemFound));
          }
          const endTime = new Date().getTime();
          const elapsedTime = (endTime - startTime) / 1000.0;
          const recordTime = new Date().toISOString();
          fs.appendFileSync(csvPath, recordTime + ",PerformanceElementsTests,ElementsRead," + elapsedTime + "," + opCount +
            ",\"Element API Read   \'" + className + "\' [Initial count: " + dbSize + "]\",Read," + dbSize + "\n");
          IModelTestUtils.closeIModel(perfimodel);
        }
      }
    }
  });

  it("ElementsUpdate", () => {
    for (const className of classNames) {
      for (const dbSize of dbSizes) {
        const baseSeed = "Performance_seed_" + className + "_" + dbSize + ".bim";
        for (const opCount of opSizes) {
          const testFileName = "ImodelPerformance_Update_" + className + "_" + opCount + ".bim";
          const perfimodel = IModelTestUtils.openIModelFromOut(baseSeed, { copyFilename: testFileName, enableTransactions: true });
          const stat = perfimodel.executeQuery("SELECT MAX(ECInstanceId) maxId, MIN(ECInstanceId) minId FROM bis.PhysicalElement")[0];
          const elementIdIncrement = Math.floor(dbSize / opCount);
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
            const editElem: Element = perfimodel.elements.getElement(new Id64([elId, 0]));
            editElem.baseStr = "PerfElement - UpdatedValue";
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
            const elemFound: Element = perfimodel.elements.getElement(new Id64([elId, 0]));
            assert.equal(elemFound.baseStr, "PerfElement - UpdatedValue");
          }
          const elapsedTime = (endTime - startTime) / 1000.0;
          const recordTime = new Date().toISOString();
          fs.appendFileSync(csvPath, recordTime + ",PerformanceElementsTests,ElementsUpdate," + elapsedTime + "," + opCount +
            ",\"Element API Update   \'" + className + "\' [Initial count: " + dbSize + "]\",Update," + dbSize + "\n");

          IModelTestUtils.closeIModel(perfimodel);
        }
      }
    }
  });

});
