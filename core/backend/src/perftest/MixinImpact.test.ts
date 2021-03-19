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

describe("SchemaDesignPerf Impact of Mixins", () => {
  const outDir: string = path.join(KnownTestLocations.outputDir, "MixinPerformance");
  let hierarchyCounts: number[];
  let seedCount = 0;
  let propCount = 0;
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
  function setPropVals(elem: any, pCount: number, baseName: string = "primProp", val: string = "Test Value") {
    for (let j = 0; j < pCount; ++j) {
      const key = baseName + j.toString();
      elem[key] = val;
    }
  }
  function setPropVal(elem: any, baseName: string = "primProp", val: string = "Test Value") {
    const key = baseName;
    elem[key] = val;
  }
  function createSchema(hierarchyCount: number): string {
    const schemaPath = path.join(outDir, `TestMixinSchema-${hierarchyCount}.01.00.00.ecschema.xml`);
    if (!IModelJsFs.existsSync(schemaPath)) {
      let sxml = `<?xml version="1.0" encoding="UTF-8"?>
    <ECSchema schemaName="TestMixinSchema" alias="tps" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
        <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
        <ECEntityClass typeName="MixinElement" modifier="Abstract">
          <ECCustomAttributes>
              <IsMixin xmlns="CoreCustomAttributes.01.00.00">
                  <AppliesToEntityClass>bis:Element</AppliesToEntityClass>
              </IsMixin>
          </ECCustomAttributes>`;
      for (let j = 0; j < propCount; ++j) {
        const pName: string = `MixinProp${j.toString()}`;
        sxml = `${sxml}<ECProperty propertyName="${pName}" typeName="string" />\n\t\t\t`;
      }
      sxml = `${sxml}</ECEntityClass>\n\t\t`;
      sxml = `${sxml}<ECEntityClass typeName="PropElement">
      <BaseClass>bis:PhysicalElement</BaseClass>`;
      for (let i = 0; i < propCount; ++i) {
        const propName: string = `PrimProp${i.toString()}`;
        sxml = `${sxml}<ECProperty propertyName="${propName}" typeName="string"/>\n\t\t\t`;
      }
      sxml = `${sxml}</ECEntityClass>\n\t\t`;

      // number of levels, each A has PropElement as base, each B has Mixin as base
      for (let i = 0; i < hierarchyCount; ++i) {
        const className: string = `Child${i.toString()}`;
        let baseClassName: string = "";
        if (i === 0)
          baseClassName = "PropElement";
        else
          baseClassName = `Child${(i - 1).toString()}A`;

        sxml = `${sxml}<ECEntityClass typeName = "${className}A" >\n\t\t`;
        sxml = `${sxml}<BaseClass>${baseClassName}</BaseClass>`;
        sxml = `${sxml}<ECProperty propertyName="${className}APrimProp` + `" typeName="string" />\n\t\t\t`;
        sxml = `${sxml}</ECEntityClass>\n\t\t`;

        sxml = `${sxml}<ECEntityClass typeName = "${className}B" >\n\t\t`;
        sxml = `${sxml}<BaseClass>${baseClassName}</BaseClass>\n\t\t`;
        sxml = `${sxml}<BaseClass>MixinElement</BaseClass>`;
        sxml = `${sxml}<ECProperty propertyName="${className}BPrimProp` + `" typeName="string" />\n\t\t\t`;
        sxml = `${sxml}</ECEntityClass>\n\t\t`;
      }
      sxml = `${sxml}</ECSchema>`;
      IModelJsFs.writeFileSync(schemaPath, sxml);
    }
    return schemaPath;
  }

  before(async () => {
    const configData = require(path.join(__dirname, "SchemaPerfConfig.json")); // eslint-disable-line @typescript-eslint/no-var-requires
    seedCount = configData.mixin.seedCount;
    propCount = configData.mixin.propCount;
    hierarchyCounts = configData.mixin.mixinLevels;
    if (!IModelJsFs.existsSync(KnownTestLocations.outputDir))
      IModelJsFs.mkdirSync(KnownTestLocations.outputDir);
    if (!IModelJsFs.existsSync(outDir))
      IModelJsFs.mkdirSync(outDir);
    for (const hCount of hierarchyCounts) {
      const st = createSchema(hCount);
      assert(IModelJsFs.existsSync(st));
      const seedName = path.join(outDir, `mixin_${hCount}.bim`);
      if (!IModelJsFs.existsSync(seedName)) {
        const seedIModel = SnapshotDb.createEmpty(IModelTestUtils.prepareOutputFile("MixinPerformance", `mixin_${hCount}.bim`), { rootSubject: { name: "PerfTest" } });
        await seedIModel.importSchemas(new BackendRequestContext(), [st]);
        const result: DbResult = seedIModel.nativeDb.resetBriefcaseId(BriefcaseIdValue.Standalone);
        assert.equal(DbResult.BE_SQLITE_OK, result);
        assert.isDefined(seedIModel.getMetaData("TestMixinSchema:MixinElement"), "Mixin Class is not present in iModel.");
        const [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(seedIModel, Code.createEmpty(), true);
        let spatialCategoryId = SpatialCategory.queryCategoryIdByName(seedIModel, IModel.dictionaryId, "MySpatialCategory");
        if (undefined === spatialCategoryId)
          spatialCategoryId = SpatialCategory.insert(seedIModel, IModel.dictionaryId, "MySpatialCategory", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));
        // create base class elements
        for (let i = 0; i < seedCount; ++i) {
          let elementProps = createElemProps(seedIModel, newModelId, spatialCategoryId, "TestMixinSchema:propElement");
          let geomElement = seedIModel.elements.createElement(elementProps);
          setPropVals(geomElement, propCount);
          let id = seedIModel.elements.insertElement(geomElement);
          assert.isTrue(Id64.isValidId64(id), "insert failed");
          // create elements of base upto required level
          for (let j = 0; j < hCount; ++j) {
            const className: string = `child${j.toString()}A`;
            elementProps = createElemProps(seedIModel, newModelId, spatialCategoryId, `TestMixinSchema:${className}`);
            geomElement = seedIModel.elements.createElement(elementProps);
            setPropVal(geomElement, `${className}PrimProp`, "AChild Value");
            id = seedIModel.elements.insertElement(geomElement);
            assert.isTrue(Id64.isValidId64(id), "insert failed");
          }
          for (let j = 0; j < hCount; ++j) {
            const className: string = `child${j.toString()}B`;
            elementProps = createElemProps(seedIModel, newModelId, spatialCategoryId, `TestMixinSchema:${className}`);
            geomElement = seedIModel.elements.createElement(elementProps);
            setPropVal(geomElement, `${className}PrimProp`, "BChild Value");
            setPropVals(geomElement, propCount, "mixinProp", "Mixin Value");
            id = seedIModel.elements.insertElement(geomElement);
            assert.isTrue(Id64.isValidId64(id), "insert failed");
          }
        }
        seedIModel.saveChanges();
        assert.equal(getCount(seedIModel, "TestMixinSchema:PropElement"), ((2 * seedCount * hCount) + seedCount));
        seedIModel.close();
      }
    }
  });
  after(() => {
    const csvPath = path.join(outDir, "PerformanceResults.csv");
    reporter.exportCSV(csvPath);
  });
  it("Read", async () => {
    for (const hCount of hierarchyCounts) {
      const seedFileName = path.join(outDir, `mixin_${hCount}.bim`);
      const testFileName = IModelTestUtils.prepareOutputFile("MixinPerformance", `MixinPerf_Read_${hCount}.bim`);
      const perfimodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);

      const startTime = new Date().getTime();
      perfimodel.withPreparedStatement("SELECT * FROM tps.MixinElement", (stmt: ECSqlStatement) => {
        assert.equal(DbResult.BE_SQLITE_ROW, stmt.step());
        const row = stmt.getRow();
        assert.equal(row.mixinProp0, "Mixin Value");
        assert.equal(row.mixinProp4, "Mixin Value");
        assert.equal(row.mixinProp9, "Mixin Value");
      });
      const endTime = new Date().getTime();
      const elapsedTime = (endTime - startTime) / 1000.0;
      perfimodel.close();
      reporter.addEntry("MixinPerfTest", "ElementsRead", "Execution time(s)", elapsedTime, { hierarchy: hCount, sCount: seedCount });
    }
  });
});
