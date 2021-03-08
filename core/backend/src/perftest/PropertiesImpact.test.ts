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
import { BackendRequestContext, ECSqlStatement, IModelDb, IModelJsFs, SnapshotDb, SpatialCategory } from "../imodeljs-backend";
import { IModelTestUtils } from "../test/IModelTestUtils";
import { KnownTestLocations } from "../test/KnownTestLocations";
import { PerfTestUtility } from "./PerfTestUtils";

function createElemProps(_imodel: IModelDb, modId: Id64String, catId: Id64String, className: string = "TestPropsSchema:PropElement"): GeometricElementProps {
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
    model: modId,
    category: catId,
    code: Code.createEmpty(),
    geom: geometryStream,
  };
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
function setPropVals(elem: any, pCount: number, baseName: string = "primProp") {
  for (let j = 0; j < pCount; ++j) {
    const key = baseName + j.toString();
    elem[key] = "Test value";
  }
}

describe("SchemaDesignPerf Impact of Properties", () => {
  const outDir = path.join(KnownTestLocations.outputDir, "PropPerformance");
  const propCounts: number[] = [];
  let opCount = 0;
  let seedCount = 0;
  const reporter = new Reporter();

  function createSchema(propCount: number): string {
    const schemaPath = path.join(outDir, `TestPropsSchema-${propCount}.01.00.00.ecschema.xml`);
    if (!IModelJsFs.existsSync(schemaPath)) {
      let sxml = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestPropsSchema" alias="tps" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
        <ECEntityClass typeName="PropElement">
            <BaseClass>bis:PhysicalElement</BaseClass>`;
      for (let i = 0; i < propCount; ++i) {
        const propName: string = `PrimProp${i.toString()}`;
        sxml = `${sxml}<ECProperty propertyName="${propName}" typeName="string"/>`;
      }
      sxml = `${sxml}</ECEntityClass>
        </ECSchema>`;
      IModelJsFs.writeFileSync(schemaPath, sxml);
    }
    return schemaPath;
  }

  before(async () => {
    const configData = require(path.join(__dirname, "SchemaPerfConfig.json")); // eslint-disable-line @typescript-eslint/no-var-requires
    seedCount = configData.props.seedCount;
    opCount = configData.props.operationsCount;
    const pConfig = configData.props.propertiesCounts;
    for (let i = pConfig.start; i <= pConfig.end; i = i + pConfig.increment)
      propCounts.push(i);
    if (!IModelJsFs.existsSync(KnownTestLocations.outputDir))
      IModelJsFs.mkdirSync(KnownTestLocations.outputDir);
    if (!IModelJsFs.existsSync(outDir))
      IModelJsFs.mkdirSync(outDir);
    for (const pCount of propCounts) {
      const st = createSchema(pCount);
      assert(IModelJsFs.existsSync(st));
      const seedName = path.join(outDir, `props_${pCount}.bim`);
      if (!IModelJsFs.existsSync(seedName)) {
        const seedIModel = SnapshotDb.createEmpty(IModelTestUtils.prepareOutputFile("PropPerformance", `props_${pCount}.bim`), { rootSubject: { name: "PerfTest" } });
        await seedIModel.importSchemas(new BackendRequestContext(), [st]);
        const result: DbResult = seedIModel.nativeDb.resetBriefcaseId(BriefcaseIdValue.Standalone);
        assert.equal(DbResult.BE_SQLITE_OK, result);
        assert.isDefined(seedIModel.getMetaData("TestPropsSchema:PropElement"), "PropsClass is present in iModel.");
        const [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(seedIModel, Code.createEmpty(), true);
        let spatialCategoryId = SpatialCategory.queryCategoryIdByName(seedIModel, IModel.dictionaryId, "MySpatialCategory");
        if (undefined === spatialCategoryId)
          spatialCategoryId = SpatialCategory.insert(seedIModel, IModel.dictionaryId, "MySpatialCategory", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));
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
        seedIModel.close();
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
      const seedFileName = path.join(outDir, `props_${propCount}.bim`);
      const testFileName = IModelTestUtils.prepareOutputFile("PropPerformance", `PropsPerf_Insert_${propCount}.bim`);
      const perfimodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
      const [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(perfimodel, Code.createEmpty(), true);
      let spatialCategoryId = SpatialCategory.queryCategoryIdByName(perfimodel, IModel.dictionaryId, "MySpatialCategory");
      if (undefined === spatialCategoryId)
        spatialCategoryId = SpatialCategory.insert(perfimodel, IModel.dictionaryId, "MySpatialCategory", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));

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
      perfimodel.close();

      reporter.addEntry("PropPerfTest", "ElementsInsert", "Execution time(s)", totalTime, { count: opCount, properties: propCount });
    }
  });
  it("Delete", async () => {
    for (const propCount of propCounts) {
      const seedFileName = path.join(outDir, `props_${propCount}.bim`);
      const testFileName = IModelTestUtils.prepareOutputFile("PropPerformance", `PropsPerf_Delete_${propCount}.bim`);
      const perfimodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);

      const minId: number = PerfTestUtility.getMinId(perfimodel, "bis.PhysicalElement");
      const elementIdIncrement = Math.floor(seedCount / opCount);

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
      assert.equal(getCount(perfimodel, "TestPropsSchema:PropElement"), seedCount - opCount);
      perfimodel.close();

      reporter.addEntry("PropPerfTest", "ElementsDelete", "Execution time(s)", elapsedTime, { count: opCount, properties: propCount });
    }

  });
  it("Read", async () => {
    for (const propCount of propCounts) {
      const seedFileName = path.join(outDir, `props_${propCount}.bim`);
      const testFileName = IModelTestUtils.prepareOutputFile("PropPerformance", `PropsPerf_Read_${propCount}.bim`);
      const perfimodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);

      const minId: number = PerfTestUtility.getMinId(perfimodel, "bis.PhysicalElement");
      const elementIdIncrement = Math.floor(seedCount / opCount);

      const startTime = new Date().getTime();
      for (let i = 0; i < opCount; ++i) {
        const elId = minId + elementIdIncrement * i;
        assert.exists(perfimodel.elements.getElement(Id64.fromLocalAndBriefcaseIds(elId, 0)));
      }
      const endTime = new Date().getTime();
      const elapsedTime = (endTime - startTime) / 1000.0;

      for (let j = 0; j < opCount; ++j) {
        const elId = minId + elementIdIncrement * j;
        const elemFound: any = perfimodel.elements.getElement(Id64.fromLocalAndBriefcaseIds(elId, 0));
        assert.exists(elemFound);
        for (let k = 0; k < propCount; ++k) {
          const key = `primProp${k.toString()}`;
          assert.equal(elemFound[key], "Test value");
        }
      }
      perfimodel.close();
      reporter.addEntry("PropPerfTest", "ElementsRead", "Execution time(s)", elapsedTime, { count: opCount, properties: propCount });
    }
  });
  it("Update", async () => {
    for (const propCount of propCounts) {
      const seedFileName = path.join(outDir, `props_${propCount}.bim`);
      const testFileName = IModelTestUtils.prepareOutputFile("PropPerformance", `PropsPerf_Update_${propCount}.bim`);
      const perfimodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);

      const minId: number = PerfTestUtility.getMinId(perfimodel, "bis.PhysicalElement");
      const elementIdIncrement = Math.floor(seedCount / opCount);

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
        const elId = minId + elementIdIncrement * i;
        const elemFound: any = perfimodel.elements.getElement(Id64.fromLocalAndBriefcaseIds(elId, 0));
        assert.equal(elemFound.primProp2, "Updated Value");
      }

      const elapsedTime = (endTime - startTime) / 1000.0;
      perfimodel.close();
      reporter.addEntry("PropPerfTest", "ElementsUpdate", "Execution time(s)", elapsedTime, { count: opCount, properties: propCount });
    }

  });
});
describe("SchemaDesignPerf Number of Indices", () => {
  const outDir = path.join(KnownTestLocations.outputDir, "IndexPerformance");
  let indexCounts: number[];
  let opCount = 0;
  let propCounts = 0;
  let seedCount = 0;
  const reporter = new Reporter();

  function createSchema(indexCount: number, perClass: boolean = false): string {
    let schemaPath = "";
    if (perClass)
      schemaPath = path.join(outDir, `TestIndexSchema-PerClass${indexCount}.01.00.00.ecschema.xml`);
    else
      schemaPath = path.join(outDir, `TestIndexSchema-${indexCount}.01.00.00.ecschema.xml`);
    if (!IModelJsFs.existsSync(schemaPath)) {
      let sxml = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestIndexSchema" alias="tps" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>`;
      if (perClass) {
        for (let i = 0; i < indexCount; ++i) {
          const className: string = `PropElement${i.toString()}`;
          const indexName: string = `ix_pe_prop${i.toString()}`;
          const propName: string = `PrimProp${i.toString()}`;
          sxml = `${sxml}<ECEntityClass typeName="${className}">
            <BaseClass>bis:PhysicalElement</BaseClass>
            <ECCustomAttributes>
              <DbIndexList xmlns="ECDbMap.02.00">
                  <Indexes>`;
          sxml = `${sxml}<DbIndex>
                          <Name>${indexName}</Name>
                          <Properties>
                              <string>${propName}</string>
                          </Properties>
                      </DbIndex>`;
          sxml = `${sxml}</Indexes>
              </DbIndexList>
            </ECCustomAttributes>`;
          for (let j = 0; j < propCounts; ++j) {
            const propName1: string = `PrimProp${j.toString()}`;
            sxml = `${sxml}<ECProperty propertyName="${propName1}" typeName="string"/>`;
          }
          sxml = `${sxml}</ECEntityClass>`;
        }
      } else {
        sxml = `${sxml}<ECEntityClass typeName="PropElement">
            <BaseClass>bis:PhysicalElement</BaseClass>
            <ECCustomAttributes>
              <DbIndexList xmlns="ECDbMap.02.00">
                  <Indexes>`;
        for (let i = 0; i < indexCount; ++i) {
          const indexName: string = `ix_pe_prop${i.toString()}`;
          const propName: string = `PrimProp${i.toString()}`;
          sxml = `${sxml}<DbIndex>
                          <Name>${indexName}</Name>
                          <Properties>
                              <string>${propName}</string>
                          </Properties>
                      </DbIndex>`;
        }
        sxml = `${sxml}</Indexes>
              </DbIndexList>
            </ECCustomAttributes>`;
        for (let j = 0; j < propCounts; ++j) {
          const propName: string = `PrimProp${j.toString()}`;
          sxml = `${sxml}<ECProperty propertyName="${propName}" typeName="string"/>`;
        }
        sxml = `${sxml}</ECEntityClass>`;
      }
      sxml = `${sxml}</ECSchema>`;

      IModelJsFs.writeFileSync(schemaPath, sxml);
    }
    return schemaPath;
  }
  before(async () => {
    const configData = require(path.join(__dirname, "SchemaPerfConfig.json")); // eslint-disable-line @typescript-eslint/no-var-requires
    seedCount = configData.index.seedCount;
    opCount = configData.index.operationsCount;
    indexCounts = configData.index.indexCounts;
    propCounts = configData.index.propCount;
    if (!IModelJsFs.existsSync(KnownTestLocations.outputDir))
      IModelJsFs.mkdirSync(KnownTestLocations.outputDir);
    if (!IModelJsFs.existsSync(outDir))
      IModelJsFs.mkdirSync(outDir);
    for (const iCount of indexCounts) {
      const st = createSchema(iCount);
      assert(IModelJsFs.existsSync(st));
      const seedName = path.join(outDir, `index_${iCount}.bim`);
      if (!IModelJsFs.existsSync(seedName)) {
        const seedIModel = SnapshotDb.createEmpty(IModelTestUtils.prepareOutputFile("IndexPerformance", `index_${iCount}.bim`), { rootSubject: { name: "PerfTest" } });
        await seedIModel.importSchemas(new BackendRequestContext(), [st]);
        const result: DbResult = seedIModel.nativeDb.resetBriefcaseId(BriefcaseIdValue.Standalone);
        assert.equal(DbResult.BE_SQLITE_OK, result);
        assert.isDefined(seedIModel.getMetaData("TestIndexSchema:PropElement"), "PropsClass is present in iModel.");
        const [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(seedIModel, Code.createEmpty(), true);
        let spatialCategoryId = SpatialCategory.queryCategoryIdByName(seedIModel, IModel.dictionaryId, "MySpatialCategory");
        if (undefined === spatialCategoryId)
          spatialCategoryId = SpatialCategory.insert(seedIModel, IModel.dictionaryId, "MySpatialCategory", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));
        // create elements that can be used in tests
        for (let i = 0; i < seedCount; ++i) {
          const elementProps = createElemProps(seedIModel, newModelId, spatialCategoryId, "TestIndexSchema:PropElement");
          const geomElement = seedIModel.elements.createElement(elementProps);
          setPropVals(geomElement, propCounts);
          const id = seedIModel.elements.insertElement(geomElement);
          assert.isTrue(Id64.isValidId64(id), "insert failed");
        }
        seedIModel.saveChanges();
        assert.equal(getCount(seedIModel, "TestIndexSchema:PropElement"), seedCount);
        seedIModel.close();
      }
    }
    // second round for Index per class seed files
    for (const iCount of indexCounts) {
      const st = createSchema(iCount, true);
      assert(IModelJsFs.existsSync(st));
      const seedName = path.join(outDir, `index_perclass_${iCount}.bim`);
      if (!IModelJsFs.existsSync(seedName)) {
        const seedIModel = SnapshotDb.createEmpty(IModelTestUtils.prepareOutputFile("IndexPerformance", `index_perclass_${iCount}.bim`), { rootSubject: { name: "PerfTest" } });
        await seedIModel.importSchemas(new BackendRequestContext(), [st]);
        const result: DbResult = seedIModel.nativeDb.resetBriefcaseId(BriefcaseIdValue.Standalone);
        assert.equal(DbResult.BE_SQLITE_OK, result);
        assert.isDefined(seedIModel.getMetaData("TestIndexSchema:PropElement0"), "PropsClass is present in iModel.");
        const [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(seedIModel, Code.createEmpty(), true);
        let spatialCategoryId = SpatialCategory.queryCategoryIdByName(seedIModel, IModel.dictionaryId, "MySpatialCategory");
        if (undefined === spatialCategoryId)
          spatialCategoryId = SpatialCategory.insert(seedIModel, IModel.dictionaryId, "MySpatialCategory", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));
        // create elements that can be used in tests
        for (let i = 0; i < seedCount; ++i) {
          const elementProps = createElemProps(seedIModel, newModelId, spatialCategoryId, "TestIndexSchema:PropElement0");
          const geomElement = seedIModel.elements.createElement(elementProps);
          setPropVals(geomElement, propCounts);
          const id = seedIModel.elements.insertElement(geomElement);
          assert.isTrue(Id64.isValidId64(id), "insert failed");
        }
        seedIModel.saveChanges();
        assert.equal(getCount(seedIModel, "TestIndexSchema:PropElement0"), seedCount);

        seedIModel.saveChanges();
        seedIModel.close();
      }
    }

  });

  after(() => {
    const csvPath = path.join(outDir, "PerformanceResults.csv");
    reporter.exportCSV(csvPath);
  });

  it("Insert", async () => {
    for (const indexCount of indexCounts) {
      let totalTime = 0.0;
      const seedFileName = path.join(outDir, `index_${indexCount}.bim`);
      const testFileName = IModelTestUtils.prepareOutputFile("IndexPerformance", `IndexPerf_Insert_${indexCount}.bim`);
      const perfimodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
      const [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(perfimodel, Code.createEmpty(), true);
      let spatialCategoryId = SpatialCategory.queryCategoryIdByName(perfimodel, IModel.dictionaryId, "MySpatialCategory");
      if (undefined === spatialCategoryId)
        spatialCategoryId = SpatialCategory.insert(perfimodel, IModel.dictionaryId, "MySpatialCategory", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));

      for (let i = 0; i < opCount; ++i) {
        const elementProps = createElemProps(perfimodel, newModelId, spatialCategoryId, "TestIndexSchema:PropElement");
        const geomElement = perfimodel.elements.createElement(elementProps);
        setPropVals(geomElement, propCounts);
        const startTime = new Date().getTime();
        const id = perfimodel.elements.insertElement(geomElement);
        const endTime = new Date().getTime();
        assert.isTrue(Id64.isValidId64(id), "insert failed");
        const elapsedTime = (endTime - startTime) / 1000.0;
        totalTime = totalTime + elapsedTime;
      }
      perfimodel.saveChanges();
      assert.equal(getCount(perfimodel, "TestIndexSchema:PropElement"), opCount + seedCount);
      perfimodel.close();

      reporter.addEntry("IndexPerfTest", "ElementsInsert", "Execution time(s)", totalTime, { count: opCount, indices: indexCount, perClass: "No" });
    }
    // second round for per Class Index
    for (const indexCount of indexCounts) {
      let totalTime = 0.0;
      const seedFileName = path.join(outDir, `index_perclass_${indexCount}.bim`);
      const testFileName = IModelTestUtils.prepareOutputFile("IndexPerformance", `IndexPerf_PerClass_Insert_${indexCount}.bim`);
      const perfimodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
      const [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(perfimodel, Code.createEmpty(), true);
      let spatialCategoryId = SpatialCategory.queryCategoryIdByName(perfimodel, IModel.dictionaryId, "MySpatialCategory");
      if (undefined === spatialCategoryId)
        spatialCategoryId = SpatialCategory.insert(perfimodel, IModel.dictionaryId, "MySpatialCategory", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));

      for (let i = 0; i < opCount; ++i) {
        const elementProps = createElemProps(perfimodel, newModelId, spatialCategoryId, "TestIndexSchema:PropElement0");
        const geomElement = perfimodel.elements.createElement(elementProps);
        setPropVals(geomElement, propCounts);
        const startTime = new Date().getTime();
        const id = perfimodel.elements.insertElement(geomElement);
        const endTime = new Date().getTime();
        assert.isTrue(Id64.isValidId64(id), "insert failed");
        const elapsedTime = (endTime - startTime) / 1000.0;
        totalTime = totalTime + elapsedTime;
      }
      perfimodel.saveChanges();
      assert.equal(getCount(perfimodel, "TestIndexSchema:PropElement0"), opCount + seedCount);
      perfimodel.close();

      reporter.addEntry("IndexPerfTest", "ElementsInsert", "Execution time(s)", totalTime, { count: opCount, indices: indexCount, perClass: "Yes" });
    }
  });
  it("Delete", async () => {
    for (const indexCount of indexCounts) {
      const seedFileName = path.join(outDir, `index_${indexCount}.bim`);
      const testFileName = IModelTestUtils.prepareOutputFile("IndexPerformance", `IndexPerf_Delete_${indexCount}.bim`);
      const perfimodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);

      const minId: number = PerfTestUtility.getMinId(perfimodel, "bis.PhysicalElement");
      const elementIdIncrement = Math.floor(seedCount / opCount);
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
      assert.equal(getCount(perfimodel, "TestIndexSchema:PropElement"), seedCount - opCount);

      perfimodel.close();

      reporter.addEntry("IndexPerfTest", "ElementsDelete", "Execution time(s)", elapsedTime, { count: opCount, indices: indexCount, perClass: "No" });
    }
    // second round for per class Index
    for (const indexCount of indexCounts) {
      const seedFileName = path.join(outDir, `index_perclass_${indexCount}.bim`);
      const testFileName = IModelTestUtils.prepareOutputFile("IndexPerformance", `IndexPerf_PerClass_Delete_${indexCount}.bim`);
      const perfimodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);

      const minId: number = PerfTestUtility.getMinId(perfimodel, "TestIndexSchema:PropElement0");
      const elementIdIncrement = Math.floor(seedCount / opCount);
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
      assert.equal(getCount(perfimodel, "TestIndexSchema:PropElement0"), seedCount - opCount);

      perfimodel.close();

      reporter.addEntry("IndexPerfTest", "ElementsDelete", "Execution time(s)", elapsedTime, { count: opCount, indices: indexCount, perClass: "Yes" });
    }
  });
  it("Read", async () => {
    for (const indexCount of indexCounts) {
      const seedFileName = path.join(outDir, `index_${indexCount}.bim`);
      const testFileName = IModelTestUtils.prepareOutputFile("IndexPerformance", `IndexPerf_Read_${indexCount}.bim`);
      const perfimodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);

      const minId: number = PerfTestUtility.getMinId(perfimodel, "bis.PhysicalElement");
      const elementIdIncrement = Math.floor(seedCount / opCount);
      const startTime = new Date().getTime();
      for (let i = 0; i < opCount; ++i) {
        const elId = minId + elementIdIncrement * i;
        assert.exists(perfimodel.elements.getElement(Id64.fromLocalAndBriefcaseIds(elId, 0)));
      }
      const endTime = new Date().getTime();
      const elapsedTime = (endTime - startTime) / 1000.0;

      for (let j = 0; j < opCount; ++j) {
        const elId = minId + elementIdIncrement * j;
        const elemFound: any = perfimodel.elements.getElement(Id64.fromLocalAndBriefcaseIds(elId, 0));
        assert.exists(elemFound);
        for (let k = 0; k < propCounts; ++k) {
          const key = `primProp${k.toString()}`;
          assert.equal(elemFound[key], "Test value");
        }
      }
      perfimodel.close();
      reporter.addEntry("IndexPerfTest", "ElementsRead", "Execution time(s)", elapsedTime, { count: opCount, indices: indexCount, perClass: "No" });
    }
    // second round for per class
    for (const indexCount of indexCounts) {
      const seedFileName = path.join(outDir, `index_perclass_${indexCount}.bim`);
      const testFileName = IModelTestUtils.prepareOutputFile("IndexPerformance", `IndexPerf_PerClass_Read_${indexCount}.bim`);
      const perfimodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);

      const minId: number = PerfTestUtility.getMinId(perfimodel, "TestIndexSchema:PropElement0");
      const elementIdIncrement = Math.floor(seedCount / opCount);
      const startTime = new Date().getTime();
      for (let i = 0; i < opCount; ++i) {
        const elId = minId + elementIdIncrement * i;
        assert.exists(perfimodel.elements.getElement(Id64.fromLocalAndBriefcaseIds(elId, 0)));
      }
      const endTime = new Date().getTime();
      const elapsedTime = (endTime - startTime) / 1000.0;

      for (let j = 0; j < opCount; ++j) {
        const elId = minId + elementIdIncrement * j;
        const elemFound: any = perfimodel.elements.getElement(Id64.fromLocalAndBriefcaseIds(elId, 0));
        assert.exists(elemFound);
        for (let k = 0; k < propCounts; ++k) {
          const key = `primProp${k.toString()}`;
          assert.equal(elemFound[key], "Test value");
        }
      }
      perfimodel.close();
      reporter.addEntry("IndexPerfTest", "ElementsRead", "Execution time(s)", elapsedTime, { count: opCount, indices: indexCount, perClass: "Yes" });
    }
  });
  it("Update", async () => {
    for (const indexCount of indexCounts) {
      const seedFileName = path.join(outDir, `index_${indexCount}.bim`);
      const testFileName = IModelTestUtils.prepareOutputFile("IndexPerformance", `PropsPerf_Update_${indexCount}.bim`);
      const perfimodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);

      const minId: number = PerfTestUtility.getMinId(perfimodel, "bis.PhysicalElement");
      const elementIdIncrement = Math.floor(seedCount / opCount);
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
        const editElem: any = perfimodel.elements.getElement(Id64.fromLocalAndBriefcaseIds(elId, 0));
        editElem.primProp1 = "Updated Value";
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
        const elemFound: any = perfimodel.elements.getElement(Id64.fromLocalAndBriefcaseIds(elId, 0));
        assert.equal(elemFound.primProp1, "Updated Value");
      }
      const elapsedTime = (endTime - startTime) / 1000.0;
      perfimodel.close();
      reporter.addEntry("IndexPerfTest", "ElementsUpdate", "Execution time(s)", elapsedTime, { count: opCount, indices: indexCount, perClass: "No" });
    }
    // second round for per class
    for (const indexCount of indexCounts) {
      const seedFileName = path.join(outDir, `index_perclass_${indexCount}.bim`);
      const testFileName = IModelTestUtils.prepareOutputFile("IndexPerformance", `PropsPerf_PerClassUpdate_${indexCount}.bim`);
      const perfimodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);

      const minId: number = PerfTestUtility.getMinId(perfimodel, "TestIndexSchema:PropElement0");
      const elementIdIncrement = Math.floor(seedCount / opCount);
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
        const editElem: any = perfimodel.elements.getElement(Id64.fromLocalAndBriefcaseIds(elId, 0));
        editElem.primProp1 = "Updated Value";
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
        const elemFound: any = perfimodel.elements.getElement(Id64.fromLocalAndBriefcaseIds(elId, 0));
        assert.equal(elemFound.primProp1, "Updated Value");
      }
      const elapsedTime = (endTime - startTime) / 1000.0;
      perfimodel.close();
      reporter.addEntry("IndexPerfTest", "ElementsUpdate", "Execution time(s)", elapsedTime, { count: opCount, indices: indexCount, perClass: "Yes" });
    }
  });
});
