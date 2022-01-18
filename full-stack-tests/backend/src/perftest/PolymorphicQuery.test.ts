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
import { ECSqlStatement, IModelDb, IModelJsFs, SnapshotDb, SpatialCategory } from "@itwin/core-backend";
import { IModelTestUtils, KnownTestLocations } from "@itwin/core-backend/lib/cjs/test/index";

describe("SchemaDesignPerf Polymorphic query", () => {
  const outDir: string = path.join(KnownTestLocations.outputDir, "PolymorphicPerformance");
  let multiHierarchyCount = 0;
  let multiSeedCount = 0;
  let multiOpCount = 0;
  let flatSeedCount = 0;
  let flatHierarchyCounts: never[] = [];
  const reporter = new Reporter();

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
  function setPropVal(elem: any, baseName: string = "primProp", val: string = "Test Value") {
    const key = baseName;
    elem[key] = val;
  }
  function setPropVals(elem: any, pCount: number, baseName: string = "primProp") {
    for (let j = 0; j < pCount; ++j) {
      const key = baseName + j.toString();
      elem[key] = "Test value";
    }
  }
  function createSchema(count: number, multi: boolean): string {
    let schemaPath = "";
    if (multi)
      schemaPath = path.join(outDir, `TestPolymorphicSchema_Multi_${count.toString()}.01.00.00.ecschema.xml`);
    else
      schemaPath = path.join(outDir, `TestPolymorphicSchema_Flat_${count.toString()}.01.00.00.ecschema.xml`);
    if (!IModelJsFs.existsSync(schemaPath)) {
      if (multi) {
        let sxml = `<?xml version="1.0" encoding="UTF-8"?>
      <ECSchema schemaName="TestPolySchema" alias="tps" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
          <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
          <ECEntityClass typeName="TestElement">
              <BaseClass>bis:PhysicalElement</BaseClass>
              <ECProperty propertyName="PropBase" typeName="string" />
          </ECEntityClass>`;
        let baseClassName = "";
        for (let i = 0; i < count; ++i) {
          if (i === 0)
            baseClassName = "TestElement";
          else
            baseClassName = `Child${(i - 1).toString()}`;
          sxml = `${sxml}<ECEntityClass typeName="Child${i.toString()}" >
        <BaseClass>${baseClassName}</BaseClass>
              <ECProperty propertyName = "PropChild${i.toString()}" typeName = "string" />
        </ECEntityClass>`;
        }

        sxml = `${sxml}</ECSchema>`;
        IModelJsFs.writeFileSync(schemaPath, sxml);
      } else {
        let sxml = `<?xml version="1.0" encoding="UTF-8"?>
      <ECSchema schemaName="TestPolySchema" alias="tps" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
          <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
          <ECEntityClass typeName="TestElement">
              <BaseClass>bis:PhysicalElement</BaseClass>
              <ECProperty propertyName="PropBase" typeName="string" />
          </ECEntityClass>`;
        for (let i = 0; i < count; ++i) {
          sxml = `${sxml}<ECEntityClass typeName="Child${i.toString()}" >
        <BaseClass>TestElement</BaseClass>
              <ECProperty propertyName = "PropChild" typeName = "string" />
        </ECEntityClass>`;
        }
        sxml = `${sxml}</ECSchema>`;
        IModelJsFs.writeFileSync(schemaPath, sxml);
      }
    }
    return schemaPath;
  }
  before(async () => {
    const configData = require(path.join(__dirname, "SchemaPerfConfig.json")); // eslint-disable-line @typescript-eslint/no-var-requires
    multiHierarchyCount = configData.polymorphic.multi.hierarchyCount;
    multiSeedCount = configData.polymorphic.multi.seedCount;
    multiOpCount = configData.polymorphic.multi.opCount;
    flatSeedCount = configData.polymorphic.flat.seedCount;
    flatHierarchyCounts = configData.polymorphic.flat.hierarchyCounts;
    if (!IModelJsFs.existsSync(KnownTestLocations.outputDir))
      IModelJsFs.mkdirSync(KnownTestLocations.outputDir);
    if (!IModelJsFs.existsSync(outDir))
      IModelJsFs.mkdirSync(outDir);
    // first create required flatHierarchy schema based iModels.
    for (const hCount of flatHierarchyCounts) {
      const st = createSchema(hCount, false);
      assert(IModelJsFs.existsSync(st));
      const seedName = path.join(outDir, `poly_flat_${hCount}.bim`);
      if (!IModelJsFs.existsSync(seedName)) {
        const seedIModel = SnapshotDb.createEmpty(IModelTestUtils.prepareOutputFile("PolymorphicPerformance", `poly_flat_${hCount}.bim`), { rootSubject: { name: "PerfTest" } });
        await seedIModel.importSchemas([st]);
        // first create Elements and then Relationship
        const [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(seedIModel, Code.createEmpty(), true);
        let spatialCategoryId = SpatialCategory.queryCategoryIdByName(seedIModel, IModel.dictionaryId, "MySpatialCategory");
        if (undefined === spatialCategoryId)
          spatialCategoryId = SpatialCategory.insert(seedIModel, IModel.dictionaryId, "MySpatialCategory", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));
        seedIModel.nativeDb.resetBriefcaseId(BriefcaseIdValue.Unassigned);
        assert.isDefined(seedIModel.getMetaData("TestPolySchema:TestElement"), "Base Class is not present in iModel.");
        // create base class elements
        for (let i = 0; i < flatSeedCount; ++i) {
          let elementProps = createElemProps(seedIModel, newModelId, spatialCategoryId, "TestPolySchema:testElement");
          let geomElement = seedIModel.elements.createElement(elementProps);
          setPropVal(geomElement, "propBase", "Base Value");
          let id = seedIModel.elements.insertElement(geomElement);
          assert.isTrue(Id64.isValidId64(id), "insert failed");
          // create elements of Child up to required level
          for (let j = 0; j < hCount; ++j) {
            const className: string = `child${j.toString()}`;
            elementProps = createElemProps(seedIModel, newModelId, spatialCategoryId, `TestPolySchema:${className}`);
            geomElement = seedIModel.elements.createElement(elementProps);
            setPropVal(geomElement, "propBase", "Base Value");
            setPropVal(geomElement, "propChild", "Child Value");
            id = seedIModel.elements.insertElement(geomElement);
            assert.isTrue(Id64.isValidId64(id), "insert failed");
          }
        }
        assert.equal(getCount(seedIModel, "TestPolySchema:TestElement"), ((hCount + 1) * flatSeedCount));
        seedIModel.saveChanges();
        seedIModel.close();
      }
    }
    // now create single multiHierarchy based schema and iModel
    const st2 = createSchema(multiHierarchyCount, true);
    assert(IModelJsFs.existsSync(st2));
    const seedName2 = path.join(outDir, `poly_multi_${multiHierarchyCount.toString()}.bim`);
    if (!IModelJsFs.existsSync(seedName2)) {
      const seedIModel2 = SnapshotDb.createEmpty(IModelTestUtils.prepareOutputFile("PolymorphicPerformance", `poly_multi_${multiHierarchyCount.toString()}.bim`), { rootSubject: { name: "PerfTest" } });
      await seedIModel2.importSchemas([st2]);
      // first create Elements and then Relationship
      const [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(seedIModel2, Code.createEmpty(), true);
      let spatialCategoryId = SpatialCategory.queryCategoryIdByName(seedIModel2, IModel.dictionaryId, "MySpatialCategory");
      if (undefined === spatialCategoryId)
        spatialCategoryId = SpatialCategory.insert(seedIModel2, IModel.dictionaryId, "MySpatialCategory", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));
      seedIModel2.nativeDb.resetBriefcaseId(BriefcaseIdValue.Unassigned);
      assert.isDefined(seedIModel2.getMetaData("TestPolySchema:TestElement"), "Base Class is not present in iModel.");
      // create base class elements
      for (let i = 0; i < multiSeedCount; ++i) {
        let elementProps = createElemProps(seedIModel2, newModelId, spatialCategoryId, "TestPolySchema:testElement");
        let geomElement = seedIModel2.elements.createElement(elementProps);
        setPropVal(geomElement, "propBase", "Base Value");
        let id = seedIModel2.elements.insertElement(geomElement);
        assert.isTrue(Id64.isValidId64(id), "insert failed");
        // create elements of Child up to required level
        for (let j = 0; j < multiHierarchyCount; ++j) {
          const className: string = `child${j.toString()}`;
          elementProps = createElemProps(seedIModel2, newModelId, spatialCategoryId, `TestPolySchema:${className}`);
          geomElement = seedIModel2.elements.createElement(elementProps);
          setPropVal(geomElement, "propBase", "Base Value");
          setPropVals(geomElement, j + 1, "propChild");
          id = seedIModel2.elements.insertElement(geomElement);
          assert.isTrue(Id64.isValidId64(id), "insert failed");
        }
      }
      assert.equal(getCount(seedIModel2, "TestPolySchema:TestElement"), ((multiHierarchyCount + 1) * multiSeedCount));
      seedIModel2.saveChanges();
      seedIModel2.close();
    }
  });
  after(() => {
    const csvPath = path.join(outDir, "PerformanceResults.csv");
    reporter.exportCSV(csvPath);
  });
  it("Flat Read", async () => {
    for (const fhCount of flatHierarchyCounts) {
      const seedFileName = path.join(outDir, `poly_flat_${fhCount}.bim`);
      const testFileName = IModelTestUtils.prepareOutputFile("PolymorphicPerformance", `poly_flat_Read_${fhCount}.bim`);

      const perfimodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
      let totalTime = 0.0;
      for (let i = 0; i < fhCount; ++i) {
        const startTime = new Date().getTime();
        try {
          let sql = "SELECT * from ";
          sql = `${sql}tps.Child${i.toString()}`;
          perfimodel.withPreparedStatement(sql, (stmt: ECSqlStatement) => {
            while (stmt.step() === DbResult.BE_SQLITE_ROW) {
              const row = stmt.getRow();
              assert.equal(row.propBase, "Base Value");
            }
          });
          const endTime = new Date().getTime();
          const elapsedTime = (endTime - startTime) / 1000.0;
          totalTime = totalTime + elapsedTime;
        } catch (err) {
          assert.isTrue(false);
        }
      }
      reporter.addEntry("PolyPerfTest", "PolymorphicFlatRead", "Execution time(s)", totalTime / fhCount, { sCount: flatSeedCount, hCount: fhCount });

      perfimodel.saveChanges();
      perfimodel.close();
    }
  });
  it("Multi Read", async () => {
    const seedFileName = path.join(outDir, `poly_multi_${multiHierarchyCount}.bim`);
    const testFileName = IModelTestUtils.prepareOutputFile("PolymorphicPerformance", `poly_multi_Read_${multiHierarchyCount}.bim`);

    const perfimodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
    let totalTime = 0.0;
    let parentTime = 0.0;
    for (let i = 0; i < multiOpCount; ++i) {
      const startTime = new Date().getTime();
      try {
        let sql = "SELECT * from ";
        if (i === 0)
          sql = `${sql}ONLY `;
        sql = `${sql}tps.TestElement`;
        perfimodel.withPreparedStatement(sql, (stmt: ECSqlStatement) => {
          while (stmt.step() === DbResult.BE_SQLITE_ROW) {
            const row = stmt.getRow();
            assert.equal(row.propBase, "Base Value");
          }
        });
        const endTime = new Date().getTime();
        const elapsedTime = (endTime - startTime) / 1000.0;
        if (i === 0)
          parentTime = elapsedTime;
        else
          totalTime = totalTime + elapsedTime;
      } catch (err) {
        assert.isTrue(false);
      }
    }
    reporter.addEntry("PolyPerfTest", "PolymorphicMultiRead", "Execution time(s)", totalTime / (multiHierarchyCount - 1), { sCount: multiSeedCount, hCount: multiHierarchyCount, level: "Child" });
    reporter.addEntry("PolyPerfTest", "PolymorphicMultiRead", "Execution time(s)", parentTime, { sCount: multiSeedCount, hCount: multiHierarchyCount, level: "Base" });

    perfimodel.saveChanges();
    perfimodel.close();
  });

});
