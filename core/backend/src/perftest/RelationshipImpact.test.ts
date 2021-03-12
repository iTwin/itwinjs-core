/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { DbResult, Id64, Id64String } from "@bentley/bentleyjs-core";
import { Arc3d, IModelJson as GeomJson, Point3d } from "@bentley/geometry-core";
import {
  BriefcaseIdValue, Code, ColorDef, GeometricElementProps, GeometryStreamProps, IModel, RelatedElement, RelationshipProps, SubCategoryAppearance,
} from "@bentley/imodeljs-common";
import { Reporter } from "@bentley/perf-tools/lib/Reporter";
import { BackendRequestContext } from "../BackendRequestContext";
import { SpatialCategory } from "../Category";
import { ECSqlStatement } from "../ECSqlStatement";
import { IModelDb, SnapshotDb } from "../IModelDb";
import { IModelJsFs } from "../IModelJsFs";
import { IModelTestUtils } from "../test/IModelTestUtils";
import { KnownTestLocations } from "../test/KnownTestLocations";
import { PerfTestUtility } from "./PerfTestUtils";

describe("SchemaDesignPerf Relationship Comparison", () => {
  const outDir: string = path.join(KnownTestLocations.outputDir, "RelationshipPerformance");
  let seedCount = 0;
  let opCount = 0;
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
    imodel.withPreparedStatement(`SELECT COUNT(*) AS [count] FROM ${className}`, (stmt: ECSqlStatement) => {
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
  function createSchema(): string {
    const schemaPath = path.join(outDir, "TestRelationshipSchema.01.00.00.ecschema.xml");
    if (!IModelJsFs.existsSync(schemaPath)) {
      const schemaXml = `<?xml version="1.0" encoding="UTF-8"?>
      <ECSchema schemaName="TestRelationSchema" alias="trs" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.1">
          <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
          <ECEntityClass typeName="TestElement">
              <BaseClass>bis:PhysicalElement</BaseClass>
              <ECProperty propertyName="PropBase" typeName="string" />
          </ECEntityClass>
          <ECRelationshipClass typeName="ADrivesB" strengthDirection="Backward" strength="referencing" modifier="Sealed">
              <Source multiplicity="(0..*)" polymorphic="true" roleLabel="drives">
                  <Class class="ChildA"/>
              </Source>
              <Target multiplicity="(0..1)" polymorphic="true" roleLabel="is driven by">
                  <Class class="ChildB"/>
              </Target>
          </ECRelationshipClass>
          <ECEntityClass typeName="ChildA" >
            <BaseClass>TestElement</BaseClass>
            <ECProperty propertyName="PropChildA" typeName="string" />
            <ECNavigationProperty propertyName="ChildB" relationshipName="ADrivesB" direction="Forward" readOnly="True">
            </ECNavigationProperty>
          </ECEntityClass>
          <ECEntityClass typeName="ChildB" >
              <BaseClass>TestElement</BaseClass>
              <ECProperty propertyName="PropChildB" typeName="string" />
          </ECEntityClass>
          <ECEntityClass typeName="ChildC">
              <BaseClass>TestElement</BaseClass>
              <ECProperty propertyName="PropChildC" typeName="string" />
          </ECEntityClass>
          <ECEntityClass typeName="ChildD">
              <BaseClass>TestElement</BaseClass>
              <ECProperty propertyName="PropChildD" typeName="string" />
          </ECEntityClass>
          <ECRelationshipClass typeName="CIsRelatedToD" strength="referencing" modifier="Sealed">
            <BaseClass>bis:ElementRefersToElements</BaseClass>
            <ECProperty propertyName="PropRel" typeName="string"/>
            <Source multiplicity="(0..*)" roleLabel="IsRelatedTo" polymorphic="true">
                <Class class="ChildC"/>
            </Source>
            <Target multiplicity="(0..*)" roleLabel="IsRelatedTo (Reversed)" polymorphic="true">
                <Class class="ChildD"/>
            </Target>
          </ECRelationshipClass>
        </ECSchema>`;
      IModelJsFs.writeFileSync(schemaPath, schemaXml);
    }
    return schemaPath;
  }
  function insertElement(imodel: IModelDb, mId: Id64String, cId: Id64String, cName: string): Id64String {
    const elementProps = createElemProps(imodel, mId, cId, cName);
    const geomElement = imodel.elements.createElement(elementProps);
    setPropVal(geomElement, "propBase", "Test Value");
    const cType: string = cName.substring(cName.length - 1);
    setPropVal(geomElement, `propChild${cType}`, `${cType} Value`);
    const id = imodel.elements.insertElement(geomElement);
    assert.isTrue(Id64.isValidId64(id), "insert failed");
    return id;
  }
  function verifyCounts(imodel: IModelDb, count: number) {
    assert.equal(getCount(imodel, "TestRelationSchema:ChildA"), count);
    assert.equal(getCount(imodel, "TestRelationSchema:ChildB"), count);
    assert.equal(getCount(imodel, "TestRelationSchema:ChildC"), count);
    assert.equal(getCount(imodel, "TestRelationSchema:ChildD"), count);
    assert.equal(getCount(imodel, "TestRelationSchema:CIsRelatedToD"), count);
    assert.equal(getCount(imodel, "TestRelationSchema:ADrivesB"), count);
  }
  function validateRel(imodel: IModelDb, sId: Id64String, tId: Id64String) {
    const rel1 = imodel.relationships.getInstance("TestRelationSchema:CIsRelatedToD", { sourceId: sId, targetId: tId });
    assert.isTrue(Id64.isValidId64(rel1.sourceId), "Relationship does not exist");
    assert.isTrue(Id64.isValidId64(rel1.targetId), "Relationship does not exist");

    imodel.withPreparedStatement("SELECT * from TestRelationSchema.ADrivesB", (stmt: ECSqlStatement) => {
      assert.equal(DbResult.BE_SQLITE_ROW, stmt.step());
      const row = stmt.getRow();
      assert.isTrue(Id64.isValidId64(row.sourceId), "Relationship does not exist");
      assert.isTrue(Id64.isValidId64(row.targetId), "Relationship does not exist");
    });
  }
  before(async () => {
    const configData = require(path.join(__dirname, "SchemaPerfConfig.json")); // eslint-disable-line @typescript-eslint/no-var-requires
    seedCount = configData.relation.seedCount;
    opCount = configData.relation.operationsCount;
    if (!IModelJsFs.existsSync(KnownTestLocations.outputDir))
      IModelJsFs.mkdirSync(KnownTestLocations.outputDir);
    if (!IModelJsFs.existsSync(outDir))
      IModelJsFs.mkdirSync(outDir);
    const st = createSchema();
    assert(IModelJsFs.existsSync(st));
    const seedName = path.join(outDir, "relationship.bim");
    if (!IModelJsFs.existsSync(seedName)) {
      const seedIModel = SnapshotDb.createEmpty(IModelTestUtils.prepareOutputFile("RelationshipPerformance", "relationship.bim"), { rootSubject: { name: "PerfTest" } });
      await seedIModel.importSchemas(new BackendRequestContext(), [st]);
      const result: DbResult = seedIModel.nativeDb.resetBriefcaseId(BriefcaseIdValue.Standalone);
      assert.equal(DbResult.BE_SQLITE_OK, result);
      // first create Elements and then Relationship
      const [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(seedIModel, Code.createEmpty(), true);
      let spatialCategoryId = SpatialCategory.queryCategoryIdByName(seedIModel, IModel.dictionaryId, "MySpatialCategory");
      if (undefined === spatialCategoryId)
        spatialCategoryId = SpatialCategory.insert(seedIModel, IModel.dictionaryId, "MySpatialCategory", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));

      for (let i = 0; i < seedCount; ++i) {
        const idC = insertElement(seedIModel, newModelId, spatialCategoryId, "TestRelationSchema:ChildC");
        const idD = insertElement(seedIModel, newModelId, spatialCategoryId, "TestRelationSchema:ChildD");
        // Link Table Relationship
        const props: RelationshipProps = {
          classFullName: "TestRelationSchema:CIsRelatedToD",
          sourceId: idC,
          targetId: idD,
        };
        (props as any).propRel = "Relationship Value";
        const relId = seedIModel.relationships.insertInstance(props);
        assert.isTrue(Id64.isValidId64(relId), "relationship insert failed");

        // NavProp Elements
        const idB = insertElement(seedIModel, newModelId, spatialCategoryId, "TestRelationSchema:ChildB");
        const elementProps = createElemProps(seedIModel, newModelId, spatialCategoryId, "TestRelationSchema:ChildA");
        const elemRef = new RelatedElement({ id: idB, relClassName: "TestRelationSchema:ADrivesB" });
        (elementProps as any).childB = elemRef;
        const geomElement = seedIModel.elements.createElement(elementProps);
        setPropVal(geomElement, "propBase", "Test Value");
        setPropVal(geomElement, "propChildA", "A Value");
        const id3 = seedIModel.elements.insertElement(geomElement);
        assert.isTrue(Id64.isValidId64(id3), "insert failed");

        validateRel(seedIModel, idC, idD);
      }
      verifyCounts(seedIModel, seedCount);
      seedIModel.saveChanges();
      seedIModel.close();
    }
  });
  after(() => {
    const csvPath = path.join(outDir, "PerformanceResults.csv");
    reporter.exportCSV(csvPath);
  });
  it("Insert", async () => {
    let totalTimeLink = 0.0;
    let totalTimeNav = 0.0;
    const seedFileName = path.join(outDir, "relationship.bim");
    const testFileName = IModelTestUtils.prepareOutputFile("RelationshipPerformance", "relationship_Insert.bim");
    const perfimodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
    const [, newModelId] = IModelTestUtils.createAndInsertPhysicalPartitionAndModel(perfimodel, Code.createEmpty(), true);
    let spatialCategoryId = SpatialCategory.queryCategoryIdByName(perfimodel, IModel.dictionaryId, "MySpatialCategory");
    if (undefined === spatialCategoryId)
      spatialCategoryId = SpatialCategory.insert(perfimodel, IModel.dictionaryId, "MySpatialCategory", new SubCategoryAppearance({ color: ColorDef.fromString("rgb(255,0,0)").toJSON() }));

    for (let i = 0; i < opCount; ++i) {
      // LinkTable
      const idC = insertElement(perfimodel, newModelId, spatialCategoryId, "TestRelationSchema:ChildC");
      const startTime = new Date().getTime();
      const idD = insertElement(perfimodel, newModelId, spatialCategoryId, "TestRelationSchema:ChildD");
      const props: RelationshipProps = {
        classFullName: "TestRelationSchema:CIsRelatedToD",
        sourceId: idC,
        targetId: idD,
      };
      (props as any).propRel = "Relationship Value";
      const relId = perfimodel.relationships.insertInstance(props);
      assert.isTrue(Id64.isValidId64(relId), "relationship insert failed");
      const endTime = new Date().getTime();
      totalTimeLink = totalTimeLink + ((endTime - startTime) / 1000.0);

      // NavProp
      const idB = insertElement(perfimodel, newModelId, spatialCategoryId, "TestRelationSchema:ChildB");
      const startTime1 = new Date().getTime();
      const elementProps = createElemProps(perfimodel, newModelId, spatialCategoryId, "TestRelationSchema:ChildA");
      const elemRef = new RelatedElement({ id: idB, relClassName: "TestRelationSchema:ADrivesB" });
      (elementProps as any).childB = elemRef;
      const geomElement = perfimodel.elements.createElement(elementProps);
      setPropVal(geomElement, "propBase", "Test Value");
      setPropVal(geomElement, "propChildA", "A Value");
      const idA = perfimodel.elements.insertElement(geomElement);
      assert.isTrue(Id64.isValidId64(idA), "insert failed");
      const endTime1 = new Date().getTime();
      totalTimeNav = totalTimeNav + ((endTime1 - startTime1) / 1000.0);

      // Validation
      validateRel(perfimodel, idC, idD);
    }
    perfimodel.saveChanges();
    verifyCounts(perfimodel, seedCount + opCount);
    perfimodel.close();

    reporter.addEntry("RelPerfTest", "RelationshipInsert", "Execution time(s)", totalTimeLink, { count: opCount, sCount: seedCount, relType: "LinkTable" });
    reporter.addEntry("RelPerfTest", "RelationshipInsert", "Execution time(s)", totalTimeNav, { count: opCount, sCount: seedCount, relType: "NavProp" });
  });
  it("Read", async () => {
    const seedFileName = path.join(outDir, "relationship.bim");
    const testFileName = IModelTestUtils.prepareOutputFile("RelationshipPerformance", "relationship_Read.bim");

    const perfimodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
    let minId: number = PerfTestUtility.getMinId(perfimodel, "TestRelationSchema:ChildD");

    const elementIdIncrement = 4; // we add 4 elements each time
    const startTime = new Date().getTime();
    for (let i = 0; i < opCount; ++i) {
      try {
        const tId: Id64String = Id64.fromLocalAndBriefcaseIds((minId + elementIdIncrement * i), 0);
        const query = IModelTestUtils.executeQuery(perfimodel, `SELECT SourceECInstanceId FROM TestRelationSchema.CIsRelatedToD WHERE TargetECInstanceId=${tId}`)[0];
        assert.isTrue(Id64.isValidId64(query.sourceId));
      } catch (err) {
        assert.isTrue(false);
      }
    }
    const endTime = new Date().getTime();
    const elapsedTimeLink = (endTime - startTime) / 1000.0;

    // NavProp element
    minId = PerfTestUtility.getMinId(perfimodel, "TestRelationSchema:ChildB");
    const startTime1 = new Date().getTime();
    for (let i = 0; i < opCount; ++i) {
      try {
        const tId: Id64String = Id64.fromLocalAndBriefcaseIds((minId + elementIdIncrement * i), 0);
        const query = IModelTestUtils.executeQuery(perfimodel, `SELECT SourceECInstanceId FROM TestRelationSchema.ADrivesB WHERE TargetECInstanceId=${tId}`)[0];
        assert.isTrue(Id64.isValidId64(query.sourceId));
      } catch (err) {
        assert.isTrue(false);
      }
    }
    const endTime1 = new Date().getTime();
    const elapsedTimeNav = (endTime1 - startTime1) / 1000.0;

    perfimodel.saveChanges();
    perfimodel.close();

    reporter.addEntry("RelPerfTest", "RelationshipRead", "Execution time(s)", elapsedTimeLink, { count: opCount, sCount: seedCount, relType: "LinkTable" });
    reporter.addEntry("RelPerfTest", "RelationshipRead", "Execution time(s)", elapsedTimeNav, { count: opCount, sCount: seedCount, relType: "NavProp" });

  });
  it("Delete", async () => {
    const seedFileName = path.join(outDir, "relationship.bim");
    const testFileName = IModelTestUtils.prepareOutputFile("RelationshipPerformance", "relationship_Delete.bim");

    const perfimodel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);

    let minId: number = PerfTestUtility.getMinId(perfimodel, "TestRelationSchema:ChildC");
    const elementIdIncrement = 4; // we add 4 elements each time
    const startTime = new Date().getTime();
    for (let i = 0; i < opCount; ++i) {
      try {
        const sId: Id64String = Id64.fromLocalAndBriefcaseIds((minId + elementIdIncrement * i), 0);
        // Need improvement. Currently assuming that they were added one after another so have next Id.
        const tId: Id64String = Id64.fromLocalAndBriefcaseIds(((minId + elementIdIncrement * i) + 1), 0);
        const rel = perfimodel.relationships.getInstance("TestRelationSchema:CIsRelatedToD", { sourceId: sId, targetId: tId });
        rel.delete();
      } catch (err) {
        assert.isTrue(false);
      }
    }
    const endTime = new Date().getTime();
    const elapsedTimeLink = (endTime - startTime) / 1000.0;
    assert.equal(getCount(perfimodel, "TestRelationSchema:CIsRelatedToD"), seedCount - opCount);

    // NavProp element. Set NavProp to null and update.
    minId = PerfTestUtility.getMinId(perfimodel, "TestRelationSchema:ChildA");
    const startTime1 = new Date().getTime();
    for (let i = 0; i < opCount; ++i) {
      try {
        const elId: Id64String = Id64.fromLocalAndBriefcaseIds((minId + elementIdIncrement * i), 0);
        const editElem: any = perfimodel.elements.getElement(elId);
        editElem.childB = null;
        perfimodel.elements.updateElement(editElem);
      } catch (err) {
        assert.isTrue(false);
      }
    }
    const endTime1 = new Date().getTime();
    const elapsedTimeNav = (endTime1 - startTime1) / 1000.0;
    // assert.equal(getCount(perfimodel, "TestRelationSchema:ADrivesB"), seedCount - opCount);

    perfimodel.saveChanges();
    perfimodel.close();

    reporter.addEntry("RelPerfTest", "RelationshipDelete", "Execution time(s)", elapsedTimeLink, { count: opCount, sCount: seedCount, relType: "LinkTable" });
    reporter.addEntry("RelPerfTest", "RelationshipDelete", "Execution time(s)", elapsedTimeNav, { count: opCount, sCount: seedCount, relType: "NavProp" });
  });
});
