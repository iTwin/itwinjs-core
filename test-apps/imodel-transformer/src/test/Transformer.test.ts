/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import * as path from "path";
import { DbResult, Logger, LogLevel } from "@bentley/bentleyjs-core";
import {
  BackendLoggerCategory, BackendRequestContext, Category, ECSqlStatement, Element, GeometricElement2d, GeometricElement3d, IModelDb, IModelHost, IModelJsFs,
  PhysicalPartition, SnapshotDb, SpatialElement,
} from "@bentley/imodeljs-backend";
import { progressLoggerCategory, Transformer } from "../Transformer";

describe("imodel-transformer", () => {
  const sourceDbFileName = "../../core/backend/src/test/assets/CompatibilityTestSeed.bim";
  let sourceDb: IModelDb;

  before(async () => {
    await IModelHost.startup();

    if (false) { // set to true to enable logging
      Logger.initializeToConsole();
      Logger.setLevelDefault(LogLevel.Error);
      Logger.setLevel(progressLoggerCategory, LogLevel.Info);
      Logger.setLevel(BackendLoggerCategory.IModelExporter, LogLevel.Trace);
      Logger.setLevel(BackendLoggerCategory.IModelImporter, LogLevel.Trace);
      Logger.setLevel(BackendLoggerCategory.IModelTransformer, LogLevel.Trace);
    }

    assert.isTrue(IModelJsFs.existsSync(sourceDbFileName));
    sourceDb = SnapshotDb.openFile(sourceDbFileName);
  });

  after(async () => {
    sourceDb.close();
    await IModelHost.shutdown();
  });

  function initOutputFile(fileBaseName: string) {
    const outputDirName = path.join(__dirname, "output");
    if (!IModelJsFs.existsSync(outputDirName)) {
      IModelJsFs.mkdirSync(outputDirName);
    }
    const outputFileName = path.join(outputDirName, fileBaseName);
    if (IModelJsFs.existsSync(outputFileName)) {
      IModelJsFs.removeSync(outputFileName);
    }
    return outputFileName;
  }

  function count(iModelDb: IModelDb, classFullName: string): number {
    return iModelDb.withPreparedStatement(`SELECT COUNT(*) FROM ${classFullName}`, (statement: ECSqlStatement): number => {
      return DbResult.BE_SQLITE_ROW === statement.step() ? statement.getValue(0).getInteger() : 0;
    });
  }

  it("should should simplify Element geometry in the target iModel", async () => {
    const targetDbFileName = initOutputFile("CompatibilityTestSeed-Simplified.bim");
    const targetDb = SnapshotDb.createEmpty(targetDbFileName, {
      rootSubject: { name: `${sourceDb.rootSubject.name}-Simplified` },
      ecefLocation: sourceDb.ecefLocation,
    });

    await Transformer.transformAll(new BackendRequestContext(), sourceDb, targetDb, { simplifyElementGeometry: true });
    const numSourceElements = count(sourceDb, Element.classFullName);
    assert.isAtLeast(numSourceElements, 50);
    assert.equal(count(targetDb, Element.classFullName), numSourceElements);
    targetDb.close();
  });

  it("should should combine PhysicalModels in the target iModel", async () => {
    const targetDbFileName = initOutputFile("CompatibilityTestSeed-Combined.bim");
    const targetDb = SnapshotDb.createEmpty(targetDbFileName, {
      rootSubject: { name: `${sourceDb.rootSubject.name}-Combined` },
      ecefLocation: sourceDb.ecefLocation,
    });

    await Transformer.transformAll(new BackendRequestContext(), sourceDb, targetDb, { combinePhysicalModels: true });
    const numSourceSpatialElements = count(sourceDb, SpatialElement.classFullName);
    assert.isAtLeast(numSourceSpatialElements, 6);
    assert.equal(count(targetDb, SpatialElement.classFullName), numSourceSpatialElements);
    assert.equal(count(targetDb, PhysicalPartition.classFullName), 1);
    assert.isAtLeast(count(sourceDb, PhysicalPartition.classFullName), 2);
    targetDb.close();
  });

  it("should exclude categories", async () => {
    const targetDbFileName = initOutputFile("CompatibilityTestSeed-CategoryExcluded.bim");
    const targetDb = SnapshotDb.createEmpty(targetDbFileName, {
      rootSubject: { name: `${sourceDb.rootSubject.name}-CategoryExcluded` },
      ecefLocation: sourceDb.ecefLocation,
    });

    const testCategory = "TestSpatialCategory";

    await Transformer.transformAll(new BackendRequestContext(), sourceDb, targetDb, { excludeCategories: [testCategory] });

    async function getElementCountInTestCategory(db: IModelDb) {
      // do two queries because querying abstract GeometricElement won't contain the category
      const sum = (arr: number[]) => arr.reduce((prev, x) => prev + x, 0);
      return sum(await Promise.all([GeometricElement2d.classFullName, GeometricElement3d.classFullName].map(async (className) => {
        const queryResult = await db.query(
          `SELECT COUNT(*) FROM ${className} e JOIN bis.Category c ON e.category.id=c.ECInstanceId WHERE c.CodeValue=:category`,
          { category: testCategory }
        ).next();
        const value = Object.values(queryResult.value)[0]; // gets the value of the first column in the returned row
        if (typeof value !== "number") {
          throw Error(`unexpected result from COUNT query, queryResult was: '${JSON.stringify(queryResult)}'`);
        }
        return value;
      })));
    }

    async function hasTheCategory(db: IModelDb) {
      return db.queryEntityIds({
        from: Category.classFullName,
        where: "CodeValue=:category",
        bindings: { category: testCategory },
      }).size > 0;
    }

    assert.isTrue(await hasTheCategory(sourceDb));

    const elemsInCategoryInSrc = await getElementCountInTestCategory(sourceDb);
    assert.isAtLeast(elemsInCategoryInSrc, 6);

    assert.isFalse(await hasTheCategory(targetDb));

    const elemsInCategoryInTarget = await getElementCountInTestCategory(targetDb);
    assert.equal(elemsInCategoryInTarget, 0);

    targetDb.close();
  });

  it("should edit schemas", async () => {
    const testSchemaPath = initOutputFile("TestSchema-EditSchemas.ecschema.xml");
    IModelJsFs.writeFileSync(testSchemaPath, `<?xml version="1.0" encoding="UTF-8"?>
      <ECSchema schemaName="Test2" alias="test2" version="01.00" xmlns="http://www.bentley.com/schemas/Bentley.ECXML.3.2">
          <ECSchemaReference name="BisCore" version="01.00" alias="bis"/>
          <ECEntityClass typeName="Test2Element">
              <BaseClass>bis:PhysicalElement</BaseClass>
              <ECProperty propertyName="BaseStr" typeName="string"/>
          </ECEntityClass>
      </ECSchema>`
    );

    const requestContext = new BackendRequestContext();
    const newSchemaSourceDbPath = initOutputFile("sourceDb-EditSchemas.bim");
    const newSchemaSourceDb = SnapshotDb.createEmpty(newSchemaSourceDbPath, {
      rootSubject: { name: "sourcedb-edit-schemas"},
      ecefLocation: sourceDb.ecefLocation,
    });

    await newSchemaSourceDb.importSchemas(requestContext, [testSchemaPath]);
    newSchemaSourceDb.close();

    const targetDbFileName = initOutputFile("EditSchemas.bim");
    const targetDb = SnapshotDb.createEmpty(targetDbFileName, {
      rootSubject: { name: `${newSchemaSourceDb.rootSubject.name}-EditSchemas` },
      ecefLocation: newSchemaSourceDb.ecefLocation,
    });

    await Transformer.transformAll(requestContext, newSchemaSourceDb, targetDb, {
      schemaEditOperations: new Map([[
        "SchemaName", [{
          schemaName: "TestSchema",
          pattern: /typeName="string"/,
          substitution: 'typeName="double"',
        }]],
      ]),
    });

    async function getFooBarTypeName(db: IModelDb) {
      let typeName = "";
      for await (const row of db.query(`
        SELECT p.TypeName
          FROM meta.ECPropertyDef p
          JOIN meta.ECClassDef c
          ON c.ECInstanceId=p.Class.Id
        WHERE c.Name=Foo
          AND p.NAME=Bar
      `)) {
        typeName = row?.typeName;
      }
      return typeName;
    }

    assert.equal("string", await getFooBarTypeName(newSchemaSourceDb));
    assert.equal("double", await getFooBarTypeName(targetDb));

    targetDb.close();
  });
});
