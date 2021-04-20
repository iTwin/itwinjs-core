/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import * as path from "path";
import { DbResult, Logger, LogLevel } from "@bentley/bentleyjs-core";
import {
  BackendLoggerCategory, BackendRequestContext, ECSqlStatement, Element, GeometricElement2d, GeometricElement3d, IModelDb, IModelHost, IModelJsFs,
  PhysicalPartition, SnapshotDb, SpatialElement,
} from "@bentley/imodeljs-backend";
import { progressLoggerCategory, Transformer } from "../Transformer";
import { Code, GeometricElementProps } from "@bentley/imodeljs-common";

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

    const testSpatialCategory = {
      name: "TestSpatialCategory",
      id: "0x14",
      code: new Code({
        scope: "0x10",
        spec: "0x16",
        value: "TestSpatialCategory",
      }),
    };

    await Transformer.transformAll(new BackendRequestContext(), sourceDb, targetDb, { excludeCategories: [testSpatialCategory.name] });

    async function getElementsInTestCategory(db: IModelDb) {
      const result: GeometricElementProps[] = [];
      // do two queries because querying abstract GeometricElement won't contain the category
      for (const type of [GeometricElement2d.classFullName, GeometricElement3d.classFullName]) {
        for await (const elem of db.query(
          `SELECT * FROM ${type} e JOIN bis.Category c ON e.category.id=c.ECInstanceId WHERE c.CodeValue=:category`,
          { category: testSpatialCategory.code.value },
        )) {
          result.push(elem);
        }
      }
      return result;
    }

    const categoryInSrc = sourceDb.elements.tryGetElement(testSpatialCategory.code);
    assert.isDefined(categoryInSrc);

    const elemsInCategoryInSrc = await getElementsInTestCategory(sourceDb);
    assert.isAtLeast(elemsInCategoryInSrc.length, 6);

    const categoryInTarget = targetDb.elements.tryGetElement(testSpatialCategory.code);
    assert.isDefined(categoryInTarget);

    const elemsInCategoryInTarget = await getElementsInTestCategory(targetDb);
    assert.isAtLeast(elemsInCategoryInTarget.length, 0);

    targetDb.close();
  });
});
