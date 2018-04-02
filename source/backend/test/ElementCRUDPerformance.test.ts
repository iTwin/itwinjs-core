/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { DbResult } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { DictionaryModel } from "../Model";
import { SpatialCategory } from "../Category";
import { ECSqlStatement } from "../ECSqlStatement";
import { Element } from "../Element";
import { IModelDb } from "../IModelDb";
import { IModelTestUtils } from "./IModelTestUtils";
import {
  GeometricElementProps, Code, Appearance, ColorDef, IModel, GeometryStreamBuilder,
} from "@bentley/imodeljs-common";
import { Point3d, Arc3d, Vector3d, AngleSweep,
} from "@bentley/geometry-core";
import { KnownTestLocations } from "./KnownTestLocations";
import { IModelJsFs } from "../IModelJsFs";
import * as fs from "fs";

describe.skip("PerformanceElementsTests", () => {
  let seedIModel: IModelDb;
  let newModelId: Id64;
  let spatialCategoryId1: Id64;
  let ellipse: Arc3d;
  const opSizes: any[] = [1000, 2000, 3000];
  const dbSizes: any[] = [10000, 100000, 1000000];
  const classNames: any[] = ["PerfElement", "PerfElementSub1", "PerfElementSub2", "PerfElementSub3"];
  const perfElemIdlist: any = [];
  for (const i of classNames) {
    perfElemIdlist.push({
        key: classNames[i],
        value: [],
    });
  }
  const values: any = {baseStr: "PerfElement - InitValue", sub1Str: "PerfElementSub1 - InitValue",
                      sub2Str: "PerfElementSub2 - InitValue", sub3Str: "PerfElementSub3 - InitValue",
                      baseLong: "0x989680", sub1Long: "0x1312d00", sub2Long: "0x1c9c380", sub3Long: "0x2625a00",
                      baseDouble: -3.1416, sub1Double: 2.71828, sub2Double: 1.414121, sub3Double: 1.61803398874};
  const csvPath = path.join(KnownTestLocations.outputDir, "PerformanceResults.csv");

  function createElems(className: string, count: number, iModelName: IModelDb, modId: Id64, catId: Id64): any[] {
    const elementColl: Element[] = [];
    for (let m = 0; m < count; ++m) {
      // Create props
      const elementProps: GeometricElementProps = {
        classFullName: "PerfTestDomain:" + className,
        iModel: iModelName,
        model: modId,
        category: catId,
        code: Code.createEmpty(),
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
      const geomElement = seedIModel.elements.createElement(elementProps);
      // add Geometry
      const builder = GeometryStreamBuilder.fromCategoryIdAndOrigin3d(catId, Point3d.create(0, 0, 0));
      assert.isDefined(builder, "Builder is successfully created");
      if (!builder)
        assert.isTrue(false, "Geometric Builder not constructed");
      ellipse = Arc3d.create(Point3d.create(1, 2, 3), Vector3d.create(0, 0, 2), Vector3d.create(0, 3, 0), AngleSweep.createStartEndRadians(0, 2 * Math.PI))!;
      assert.isTrue(builder.appendCurvePrimitive(ellipse), "Successfully appended CurvePrimitive using builder");
      assert.isTrue(geomElement.updateFromGeometryStreamBuilder(builder), "Successfully updated element given a builder");
      elementColl.push(geomElement);
    }
    return elementColl;
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
          if (testElement.baseStr === values.baseStr  && testElement.baseLong === values.baseLong
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
        seedIModel = IModelTestUtils.openIModel("DgnPlatformSeedManager_OneSpatialModel10.bim", { copyFilename: fileName, enableTransactions: true });
        const dictionary: DictionaryModel = seedIModel.models.getModel(IModel.getDictionaryId()) as DictionaryModel;
        const testSchemaName = path.join(KnownTestLocations.assetsDir, "PerfTestDomain.ecschema.xml");
        seedIModel.importSchema(testSchemaName);
        assert.isDefined(seedIModel.getMetaData("PerfTestDomain:" + className), className + "is present in iModel.");
        [, newModelId] = IModelTestUtils.createAndInsertPhysicalModel(seedIModel, Code.createEmpty(), true);
        const defaultCategoryId: Id64 | undefined = SpatialCategory.queryCategoryIdByName(dictionary, "DefaultCategory");
        assert.isFalse(undefined === defaultCategoryId);
        let spatialCategoryId = SpatialCategory.queryCategoryIdByName(dictionary, "MySpatialCategory");
        if (undefined === spatialCategoryId) {
          spatialCategoryId = IModelTestUtils.createAndInsertSpatialCategory(dictionary, "MySpatialCategory", new Appearance({ color: new ColorDef("rgb(255,0,0)") }));
        }
        spatialCategoryId1 = spatialCategoryId;
        const elementColl = createElems(className, dbSize, seedIModel, newModelId, spatialCategoryId);
        for (let m = 0; m < dbSize; ++m) {
          const id = seedIModel.elements.insertElement(elementColl[m]);
          assert.isTrue(id.isValid(), "insert worked");
          (perfElemIdlist[className] || (perfElemIdlist[className] = [])).push(id);
        }
        seedIModel.saveChanges();
        seedIModel.withPreparedStatement("select count(*) as [count] from PerfTestDomain:" + className, (stmt: ECSqlStatement) => {
          assert.equal(DbResult.BE_SQLITE_ROW, stmt.step());
          const row = stmt.getRow();
          assert.equal(row.count, dbSize);
        });
        IModelTestUtils.closeIModel(seedIModel);
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
          const elementColl = createElems(className, opCount, perfimodel, newModelId, spatialCategoryId1);
          const startTime = new Date().getTime();
          for (let j = 0; j < opCount; ++j) {
            const id = perfimodel.elements.insertElement(elementColl[j]);
            assert.isTrue(id.isValid(), "insert worked");
            }
          const endTime = new Date().getTime();
          const elapsedTime = (endTime - startTime) / 1000.0;
          const recordTime = new Date().toISOString();
          fs.appendFileSync(csvPath, recordTime + ",PerformanceElementsTests,ElementsInsert," + elapsedTime + "," + opCount +
                            ",\"Element API Insert   \'" + className + "\' [Initial count: " + dbSize + "]\",Insert," + dbSize + "\n");
          perfimodel.withPreparedStatement("select count(*) as [count] from PerfTestDomain:PerfElement", (stmt: ECSqlStatement) => {
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
          const startTime = new Date().getTime();
          for (let i = 0; i < opCount; ++i) {
            try {
              perfimodel.elements.deleteElement(perfElemIdlist[className][i]);
            } catch (err) {
              assert.isTrue(false);
            }
          }
          const endTime = new Date().getTime();
          const elapsedTime = (endTime - startTime) / 1000.0;
          const recordTime = new Date().toISOString();
          fs.appendFileSync(csvPath, recordTime + ",PerformanceElementsTests,ElementsDelete," + elapsedTime + "," + opCount +
                        ",\"Element API Delete   \'" + className + "\' [Initial count: " + dbSize + "]\",Delete," + dbSize + "\n");
          perfimodel.withPreparedStatement("select count(*) as [count] from PerfTestDomain:PerfElement", (stmt: ECSqlStatement) => {
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
          const startTime = new Date().getTime();
          for (let i = 0; i < opCount; ++i) {
            const elemFound: Element = perfimodel.elements.getElement(perfElemIdlist[className][i]);
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
          // first construct modified elements
          const elementColl: any = [];
          for (let i = 0; i < opCount; ++i) {
            const elemFound: Element = perfimodel.elements.getElement(perfElemIdlist[className][i]);
            const editElem = elemFound.copyForEdit<Element>();
            editElem.baseStr = "PerfElement - UpdatedValue";
            // add Geometry
            const builder = GeometryStreamBuilder.fromCategoryIdAndOrigin3d(spatialCategoryId1, Point3d.create(0, 0, 0));
            assert.isDefined(builder, "Builder is successfully created");
            if (!builder)
              assert.isTrue(false, "Geometric Builder not constructed");
            ellipse = Arc3d.create(Point3d.create(3, 2, 1), Vector3d.create(0, 0, 2), Vector3d.create(0, 3, 0), AngleSweep.createStartEndRadians(0, 2 * Math.PI))!;
            assert.isTrue(builder.appendCurvePrimitive(ellipse), "Successfully appended CurvePrimitive using builder");
            assert.isTrue(editElem.updateFromGeometryStreamBuilder(builder), "Successfully updated element given a builder");
            elementColl.push(editElem);
          }
          // now lets update and record time
          const startTime = new Date().getTime();
          for (let m = 0; m < opCount; ++m) {
            try {
              perfimodel.elements.updateElement(elementColl[m]);
            } catch (_err) {
              assert.fail("Element.update failed");
            }
          }
          const endTime = new Date().getTime();
          // verify value is updated
          for (let i = 0; i < opCount; ++i) {
            const elemFound: Element = perfimodel.elements.getElement(perfElemIdlist[className][i]);
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
