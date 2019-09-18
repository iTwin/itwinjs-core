/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { SpatialCategory, IModelDb } from "../imodeljs-backend";
import { IModelTestUtils } from "../test/IModelTestUtils";
import { BackendRequestContext } from "../BackendRequestContext";
import { KnownTestLocations } from "../test/KnownTestLocations";
import { IModelJson as GeomJson } from "@bentley/geometry-core/lib/serialization/IModelJsonSchema";
import { assert } from "chai";
import * as path from "path";
import { IModelJsFs } from "../IModelJsFs";
import { Code, IModel, SubCategoryAppearance, ColorDef, GeometricElementProps, GeometryStreamProps } from "@bentley/imodeljs-common";
import { Id64, Id64String, DbResult } from "@bentley/bentleyjs-core";
import { Arc3d, Point3d } from "@bentley/geometry-core";
import { ECSqlStatement } from "../ECSqlStatement";
import { Reporter } from "@bentley/perf-tools/lib/Reporter";

function createElemProps(imodel: IModelDb, modId: Id64String, catId: Id64String, className: string = "TestPropsSchema:PropElement"): GeometricElementProps {
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
    classFullName: className,
    iModel: imodel,
    model: modId,
    category: catId,
    code: Code.createEmpty(),
    geom: geometryStream,
  };
  return elementProps;
}
function getCount(imodel: IModelDb, className: string) {
  let count = 0;
  imodel.withPreparedStatement("SELECT count(*) AS [count] FROM " + className, (stmt: ECSqlStatement) => {
    assert.equal(DbResult.BE_SQLITE_ROW, stmt.step());
    const row = stmt.getRow();
    count = row.count;
  });
  return count;
}
function setPropVals(elem: any, pCount: number, baseName: string = "primProp") {
  for (let j = 0; j < pCount; ++j) {
    const key = baseName + j.toString();
    elem[key] = "Test value";
  }
}

describe("SchemaDesignPerf Impact of Properties", () => {
  const outDir = path.join(KnownTestLocations.outputDir, "PropPerformance");
  let propCounts: number[];
  let opCount = 0;
  let seedCount = 0;
  const reporter = new Reporter();

  function createSchema(propCount: number): string {
    const schemaPath = path.join(outDir, "TestPropsSchema-" + propCount + ".01.00.00.ecschema.xml");
    if (!IModelJsFs.existsSync(schemaPath)) {
      let sxml = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestPropsSchema" alias="tps" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
        <ECEntityClass typeName="PropElement">
            <BaseClass>bis:PhysicalElement</BaseClass>`;
      for (let i = 0; i < propCount; ++i) {
        const propName: string = "PrimProp" + i.toString();
        sxml = sxml + `<ECProperty propertyName="` + propName + `" typeName="string"/>`;
      }
      sxml = sxml + `</ECEntityClass>
        </ECSchema>`;
      IModelJsFs.writeFileSync(schemaPath, sxml);
    }
    return schemaPath;
  }

  before(async () => {
    const configData = require(path.join(__dirname, "SchemaPerfConfig.json"));
    seedCount = configData.props.seedCount;
    opCount = configData.props.operationsCount;
    propCounts = configData.props.propertiesCounts;
    if (!IModelJsFs.existsSync(KnownTestLocations.outputDir))
      IModelJsFs.mkdirSync(KnownTestLocations.outputDir);
    if (!IModelJsFs.existsSync(outDir))
      IModelJsFs.mkdirSync(outDir);
    for (const pCount of propCounts) {
      const st = createSchema(pCount);
      assert(IModelJsFs.existsSync(st));
      const seedName = path.join(outDir, "props_" + pCount + ".bim");
      if (!IModelJsFs.existsSync(seedName)) {
        const seedIModel = IModelDb.createSnapshot(IModelTestUtils.prepareOutputFile("PropPerformance", "props_" + pCount + ".bim"), { rootSubject: { name: "PerfTest" } });
        await seedIModel.importSchemas(new BackendRequestContext(), [st]);
        seedIModel.setAsMaster();
        assert.isDefined(seedIModel.getMetaData("TestPropsSchema:PropElement"), "PropsClass is present in iModel.");
        const [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(seedIModel, Code.createEmpty(), true);
        let spatialCategoryId = SpatialCategory.queryCategoryIdByName(seedIModel, IModel.dictionaryId, "MySpatialCategory");
        if (undefined === spatialCategoryId)
          spatialCategoryId = SpatialCategory.insert(seedIModel, IModel.dictionaryId, "MySpatialCategory", new SubCategoryAppearance({ color: new ColorDef("rgb(255,0,0)") }));
        // create elements that can be used in tests
        for (let i = 0; i < seedCount; ++i) {
          const elementProps = createElemProps(seedIModel, newModelId, spatialCategoryId);
          const geomElement = seedIModel.elements.createElement(elementProps);
          setPropVals(geomElement, pCount);
          const id = seedIModel.elements.insertElement(geomElement);
          assert.isTrue(Id64.isValidId64(id), "insert failed");
        }
        seedIModel.saveChanges();
        assert.equal(getCount(seedIModel, "TestPropsSchema:PropElement"), seedCount);
        seedIModel.saveChanges();
        seedIModel.closeSnapshot();
      }
    }
  });

  after(() => {
    const csvPath = path.join(outDir, "PerformanceResults.csv");
    reporter.exportCSV(csvPath);
  });

  it("Insert", async () => {
    for (const propCount of propCounts) {
      let totalTime = 0.0;
      const seedFileName = path.join(outDir, "props_" + propCount + ".bim");
      const testFileName = IModelTestUtils.prepareOutputFile("PropPerformance", "PropsPerf_Insert_" + propCount + ".bim");
      const perfimodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
      const [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(perfimodel, Code.createEmpty(), true);
      let spatialCategoryId = SpatialCategory.queryCategoryIdByName(perfimodel, IModel.dictionaryId, "MySpatialCategory");
      if (undefined === spatialCategoryId)
        spatialCategoryId = SpatialCategory.insert(perfimodel, IModel.dictionaryId, "MySpatialCategory", new SubCategoryAppearance({ color: new ColorDef("rgb(255,0,0)") }));

      for (let i = 0; i < opCount; ++i) {
        const elementProps = createElemProps(perfimodel, newModelId, spatialCategoryId);
        const geomElement = perfimodel.elements.createElement(elementProps);
        setPropVals(geomElement, propCount);
        const startTime = new Date().getTime();
        const id = perfimodel.elements.insertElement(geomElement);
        const endTime = new Date().getTime();
        assert.isTrue(Id64.isValidId64(id), "insert failed");
        const elapsedTime = (endTime - startTime) / 1000.0;
        totalTime = totalTime + elapsedTime;
      }
      perfimodel.saveChanges();
      assert.equal(getCount(perfimodel, "TestPropsSchema:PropElement"), opCount + seedCount);
      perfimodel.closeStandalone();

      reporter.addEntry("PropPerfTest", "ElementsInsert", "Execution time(s)", totalTime, { count: opCount, properties: propCount });
    }
  });
  it("Delete", async () => {
    for (const propCount of propCounts) {
      const seedFileName = path.join(outDir, "props_" + propCount + ".bim");
      const testFileName = IModelTestUtils.prepareOutputFile("PropPerformance", "PropsPerf_Delete_" + propCount + ".bim");
      const perfimodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);

      const stat = perfimodel.executeQuery("SELECT MAX(ECInstanceId) maxId, MIN(ECInstanceId) minId FROM bis.PhysicalElement")[0];
      const elementIdIncrement = Math.floor(seedCount / opCount);
      assert.equal((stat.maxId - stat.minId + 1), seedCount);
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
      assert.equal(getCount(perfimodel, "TestPropsSchema:PropElement"), seedCount - opCount);
      perfimodel.closeStandalone();

      reporter.addEntry("PropPerfTest", "ElementsDelete", "Execution time(s)", elapsedTime, { count: opCount, properties: propCount });
    }

  });
  it("Read", async () => {
    for (const propCount of propCounts) {
      const seedFileName = path.join(outDir, "props_" + propCount + ".bim");
      const testFileName = IModelTestUtils.prepareOutputFile("PropPerformance", "PropsPerf_Read_" + propCount + ".bim");
      const perfimodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);

      const stat = perfimodel.executeQuery("SELECT MAX(ECInstanceId) maxId, MIN(ECInstanceId) minId FROM bis.PhysicalElement")[0];
      const elementIdIncrement = Math.floor(seedCount / opCount);
      assert.equal((stat.maxId - stat.minId + 1), seedCount);
      const startTime = new Date().getTime();
      for (let i = 0; i < opCount; ++i) {
        const elId = stat.minId + elementIdIncrement * i;
        assert.exists(perfimodel.elements.getElement(Id64.fromLocalAndBriefcaseIds(elId, 0)));
      }
      const endTime = new Date().getTime();
      const elapsedTime = (endTime - startTime) / 1000.0;

      for (let j = 0; j < opCount; ++j) {
        const elId = stat.minId + elementIdIncrement * j;
        const elemFound: any = perfimodel.elements.getElement(Id64.fromLocalAndBriefcaseIds(elId, 0));
        assert.exists(elemFound);
        for (let k = 0; k < propCount; ++k) {
          const key = "primProp" + k.toString();
          assert.equal(elemFound[key], "Test value");
        }
      }
      perfimodel.closeStandalone();
      reporter.addEntry("PropPerfTest", "ElementsRead", "Execution time(s)", elapsedTime, { count: opCount, properties: propCount });
    }
  });
  it("Update", async () => {
    for (const propCount of propCounts) {
      const seedFileName = path.join(outDir, "props_" + propCount + ".bim");
      const testFileName = IModelTestUtils.prepareOutputFile("PropPerformance", "PropsPerf_Update_" + propCount + ".bim");
      const perfimodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);

      const stat = perfimodel.executeQuery("SELECT MAX(ECInstanceId) maxId, MIN(ECInstanceId) minId FROM bis.PhysicalElement")[0];
      const elementIdIncrement = Math.floor(seedCount / opCount);
      assert.equal((stat.maxId - stat.minId + 1), seedCount);

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
        const editElem: any = perfimodel.elements.getElement(Id64.fromLocalAndBriefcaseIds(elId, 0));
        editElem.primProp2 = "Updated Value";
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
        const elemFound: any = perfimodel.elements.getElement(Id64.fromLocalAndBriefcaseIds(elId, 0));
        assert.equal(elemFound.primProp2, "Updated Value");
      }

      const elapsedTime = (endTime - startTime) / 1000.0;
      perfimodel.closeStandalone();
      reporter.addEntry("PropPerfTest", "ElementsUpdate", "Execution time(s)", elapsedTime, { count: opCount, properties: propCount });
    }

  });
});
