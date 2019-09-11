/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { DbResult, Id64String, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { LowAndHighXYZ, Point3d, Range3d, XYZProps, YawPitchRollAngles } from "@bentley/geometry-core";
import { ColorDef, IModel, Placement3d, Placement3dProps } from "@bentley/imodeljs-common";
import { assert } from "chai";
import * as hash from "object-hash";
import * as path from "path";
import {
  BackendLoggerCategory, BackendRequestContext, ECSqlStatement, Element, ElementMultiAspect, ElementRefersToElements, ElementUniqueAspect, ExternalSourceAspect,
  IModelDb, IModelJsFs, IModelTransformer,
} from "../../imodeljs-backend";
import { IModelTestUtils } from "../IModelTestUtils";
import {
  assertSharedIModelContents, assertTargetDbContents, assertTeamIModelContents, assertUpdatesInTargetDb, createSharedIModel, createTeamIModel, getTeamSubjectId,
  populateSourceDb, prepareSourceDb, prepareTargetDb, TestIModelTransformer, updateSourceDb,
} from "../IModelTransformerUtils";
import { KnownTestLocations } from "../KnownTestLocations";

describe("IModelTransformer", () => {
  before(async () => {
    // initialize logging
    if (false) {
      Logger.initializeToConsole();
      Logger.setLevelDefault(LogLevel.Error);
      Logger.setLevel(BackendLoggerCategory.IModelTransformer, LogLevel.Trace);
    }
  });

  it("should import", async () => {
    const outputDir = KnownTestLocations.outputDir;
    if (!IModelJsFs.existsSync(outputDir))
      IModelJsFs.mkdirSync(outputDir);
    // Source IModelDb
    const createdOutputFile: string = path.join(outputDir, "TestIModelTransformer-Source.bim");
    if (IModelJsFs.existsSync(createdOutputFile))
      IModelJsFs.removeSync(createdOutputFile);
    const sourceDb: IModelDb = IModelDb.createSnapshot(createdOutputFile, { rootSubject: { name: "TestIModelTransformer-Source" } });
    assert.isTrue(IModelJsFs.existsSync(createdOutputFile));
    await prepareSourceDb(sourceDb);
    populateSourceDb(sourceDb);
    sourceDb.saveChanges();
    // Target IModelDb
    const importedOutputFile: string = path.join(outputDir, "TestIModelTransformer-Target.bim");
    if (IModelJsFs.existsSync(importedOutputFile))
      IModelJsFs.removeSync(importedOutputFile);
    const targetDb: IModelDb = IModelDb.createSnapshot(importedOutputFile, { rootSubject: { name: "TestIModelTransformer-Target" } });
    assert.isTrue(IModelJsFs.existsSync(importedOutputFile));
    await prepareTargetDb(targetDb);
    targetDb.saveChanges();

    let numElementsExcluded: number;
    let numElementAspectsExcluded: number;
    let numRelationshipExcluded: number;
    const numSourceUniqueAspects: number = count(sourceDb, ElementUniqueAspect.classFullName);
    const numSourceMultiAspects: number = count(sourceDb, ElementMultiAspect.classFullName);
    const numSourceRelationships: number = count(sourceDb, ElementRefersToElements.classFullName);
    assert.isAbove(numSourceUniqueAspects, 0);
    assert.isAbove(numSourceMultiAspects, 0);
    assert.isAbove(numSourceRelationships, 0);

    if (true) { // initial import
      Logger.logInfo(BackendLoggerCategory.IModelTransformer, "==============");
      Logger.logInfo(BackendLoggerCategory.IModelTransformer, "Initial Import");
      Logger.logInfo(BackendLoggerCategory.IModelTransformer, "==============");
      const transformer = new TestIModelTransformer(sourceDb, targetDb);
      transformer.importAll();
      assert.isAbove(transformer.numCodeSpecsExcluded, 0);
      assert.isAbove(transformer.numRelationshipsExcluded, 0);
      assert.isAbove(transformer.numModelsInserted, 0);
      assert.equal(transformer.numModelsUpdated, 0);
      assert.isAbove(transformer.numElementsInserted, 0);
      assert.equal(transformer.numElementsInserted, transformer.numInsertElementProvenanceCalls);
      assert.isAbove(transformer.numElementsUpdated, 0);
      assert.equal(transformer.numElementsUpdated, transformer.numUpdateElementProvenanceCalls);
      assert.equal(transformer.numElementsDeleted, 0);
      assert.isAbove(transformer.numElementsExcluded, 0);
      assert.isAbove(transformer.numElementAspectsExcluded, 0);
      assert.equal(transformer.numElementsInserted, transformer.numInsertElementCalls);
      assert.equal(transformer.numElementsUpdated, transformer.numUpdateElementCalls);
      assert.equal(transformer.numElementsExcluded, transformer.numExcludedElementCalls);
      assert.isAtLeast(count(targetDb, ElementRefersToElements.classFullName), 1);
      numElementsExcluded = transformer.numElementsExcluded;
      numElementAspectsExcluded = transformer.numElementAspectsExcluded;
      numRelationshipExcluded = transformer.numRelationshipsExcluded;
      targetDb.saveChanges();
      assertTargetDbContents(sourceDb, targetDb);
      transformer.dispose();
    }

    const numTargetElements: number = count(targetDb, Element.classFullName);
    const numTargetUniqueAspects: number = count(targetDb, ElementUniqueAspect.classFullName);
    const numTargetMultiAspects: number = count(targetDb, ElementMultiAspect.classFullName);
    const numTargetExternalSourceAspects: number = count(targetDb, ExternalSourceAspect.classFullName);
    const numTargetRelationships: number = count(targetDb, ElementRefersToElements.classFullName);
    assert.isAbove(numTargetUniqueAspects, 0);
    assert.isAbove(numTargetMultiAspects, 0);
    assert.equal(numSourceUniqueAspects + numSourceMultiAspects, numTargetUniqueAspects + numTargetMultiAspects + numElementAspectsExcluded - numTargetExternalSourceAspects);
    assert.equal(numSourceRelationships, numTargetRelationships + numRelationshipExcluded);

    if (true) { // second import with no changes to source, should be a no-op
      Logger.logInfo(BackendLoggerCategory.IModelTransformer, "");
      Logger.logInfo(BackendLoggerCategory.IModelTransformer, "=================");
      Logger.logInfo(BackendLoggerCategory.IModelTransformer, "Reimport (no-op)");
      Logger.logInfo(BackendLoggerCategory.IModelTransformer, "=================");
      const transformer = new TestIModelTransformer(sourceDb, targetDb);
      transformer.importAll();
      assert.equal(transformer.numModelsInserted, 0);
      assert.equal(transformer.numModelsUpdated, 0);
      assert.equal(transformer.numElementsInserted, 0);
      assert.equal(transformer.numElementsUpdated, 0);
      assert.equal(transformer.numElementsDeleted, 0);
      assert.equal(transformer.numElementsExcluded, numElementsExcluded);
      assert.equal(transformer.numInsertElementCalls, 0);
      assert.equal(transformer.numInsertElementProvenanceCalls, 0);
      assert.equal(transformer.numUpdateElementCalls, 0);
      assert.equal(transformer.numUpdateElementProvenanceCalls, 0);
      assert.equal(transformer.numExcludedElementCalls, numElementsExcluded);
      assert.equal(numTargetElements, count(targetDb, Element.classFullName), "Second import should not add elements");
      assert.equal(numTargetExternalSourceAspects, count(targetDb, ExternalSourceAspect.classFullName), "Second import should not add aspects");
      assert.equal(numTargetRelationships, count(targetDb, ElementRefersToElements.classFullName), "Second import should not add relationships");
      transformer.dispose();
    }

    if (true) { // update source db, then import again
      updateSourceDb(sourceDb);
      sourceDb.saveChanges();
      Logger.logInfo(BackendLoggerCategory.IModelTransformer, "");
      Logger.logInfo(BackendLoggerCategory.IModelTransformer, "===============================");
      Logger.logInfo(BackendLoggerCategory.IModelTransformer, "Reimport after sourceDb update");
      Logger.logInfo(BackendLoggerCategory.IModelTransformer, "===============================");
      const transformer = new TestIModelTransformer(sourceDb, targetDb);
      transformer.importAll();
      assert.equal(transformer.numModelsInserted, 0);
      assert.equal(transformer.numModelsUpdated, 0);
      assert.equal(transformer.numElementsInserted, 0);
      assert.equal(transformer.numElementsInserted, transformer.numInsertElementProvenanceCalls);
      assert.equal(transformer.numElementsUpdated, 3);
      assert.equal(transformer.numElementsUpdated, transformer.numUpdateElementProvenanceCalls);
      assert.equal(transformer.numElementsDeleted, 1);
      assert.equal(transformer.numElementsExcluded, numElementsExcluded);
      targetDb.saveChanges();
      assertUpdatesInTargetDb(targetDb);
      const expectedNumTargetElements: number = numTargetElements + transformer.numElementsInserted - transformer.numElementsDeleted;
      const expectedNumExternalSourceAspects: number = numTargetExternalSourceAspects + transformer.numElementsInserted - transformer.numElementsDeleted;
      assert.equal(expectedNumTargetElements, count(targetDb, Element.classFullName), "Third import should not add elements");
      assert.equal(expectedNumExternalSourceAspects, count(targetDb, ExternalSourceAspect.classFullName), "Third import should not add aspects");
      assert.equal(numTargetRelationships, count(targetDb, ElementRefersToElements.classFullName), "Third import should not add relationships");
      transformer.dispose();
    }

    sourceDb.closeSnapshot();
    targetDb.closeSnapshot();
  });

  function count(iModelDb: IModelDb, classFullName: string): number {
    return iModelDb.withPreparedStatement(`SELECT COUNT(*) FROM ${classFullName}`, (statement: ECSqlStatement): number => {
      return DbResult.BE_SQLITE_ROW === statement.step() ? statement.getValue(0).getInteger() : 0;
    });
  }

  function isEqualHash(object1: object, object2: object): boolean {
    const options: object = { respectType: false };
    const hash1: string = hash(object1, options);
    const hash2: string = hash(object2, options);
    assert.exists(hash1);
    assert.exists(hash2);
    // console.log("==="); // tslint:disable-line:no-console
    // (hash as any).writeToStream(object1, options, process.stdout);
    // console.log("\n==="); // tslint:disable-line:no-console
    // (hash as any).writeToStream(object2, options, process.stdout);
    // console.log("\n==="); // tslint:disable-line:no-console
    return hash1 === hash2;
  }

  it("test object-hash", async () => {
    assert.isTrue(isEqualHash({ a: 1, b: "B" }, { b: "B", a: 1 }), "Object member order should not matter");
    assert.isFalse(isEqualHash([1, 2], [2, 1]), "Array entry order should matter");
    const point1: Point3d = new Point3d(1, 2, 3);
    const point2: Point3d = new Point3d(1, 2, 3);
    const range1: Range3d = new Range3d(1, 1, 1, 2, 2, 2);
    const range2: Range3d = new Range3d(1, 1, 1, 2, 2, 2);
    const placement1: Placement3d = new Placement3d(point1, new YawPitchRollAngles(), range1);
    const placement2: Placement3d = new Placement3d(point2, new YawPitchRollAngles(), range2);
    assert.isTrue(isEqualHash(placement1, placement2), "Should have same hash");
    placement2.bbox.high.z = 3;
    assert.isFalse(isEqualHash(placement1, placement2), "Should recurse into nested objects to detect difference");
    const pointProps1: XYZProps = { x: 1, y: 2, z: 3 };
    const pointProps2: XYZProps = { x: 1, y: 2, z: 3 };
    const rangeProps1: LowAndHighXYZ = { low: { x: 1, y: 1, z: 1 }, high: { x: 2, y: 2, z: 2 } };
    const rangeProps2: LowAndHighXYZ = { low: { x: 1, y: 1, z: 1 }, high: { x: 2, y: 2, z: 2 } };
    const placementProps1: Placement3dProps = { origin: pointProps1, angles: {}, bbox: rangeProps1 };
    const placementProps2: Placement3dProps = { origin: pointProps2, angles: {}, bbox: rangeProps2 };
    assert.isTrue(isEqualHash(placementProps1, placementProps2), "Should have same hash");
    placementProps2.bbox!.high.z = 3;
    assert.isFalse(isEqualHash(placementProps1, placementProps2), "Should recurse into nested objects to detect difference");
  });

  it.skip("should clone test file", async () => {
    // open source iModel
    const sourceFileName = IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim");
    const sourceDb: IModelDb = IModelDb.openSnapshot(sourceFileName);
    const numSourceElements: number = count(sourceDb, Element.classFullName);
    assert.exists(sourceDb);
    assert.isAtLeast(numSourceElements, 12);
    // create target iModel
    const targetDbFile: string = path.join(KnownTestLocations.outputDir, "Clone-Target.bim");
    if (IModelJsFs.existsSync(targetDbFile)) {
      IModelJsFs.removeSync(targetDbFile);
    }
    const targetDb: IModelDb = IModelDb.createSnapshot(targetDbFile, { rootSubject: { name: "Clone-Target" } });
    assert.exists(targetDb);
    // import
    const transformer = new IModelTransformer(sourceDb, targetDb);
    await transformer.importSchemas(new BackendRequestContext());
    transformer.importAll();
    transformer.dispose();
    const numTargetElements: number = count(targetDb, Element.classFullName);
    assert.isAtLeast(numTargetElements, numSourceElements);
    // clean up
    sourceDb.closeSnapshot();
    targetDb.closeSnapshot();
  });

  it.skip("should sync Team iModels into Shared", async () => {
    const iModelA: IModelDb = createTeamIModel("A", Point3d.create(0, 0, 0), ColorDef.green);
    const iModelB: IModelDb = createTeamIModel("B", Point3d.create(0, 10, 0), ColorDef.blue);
    const iModelShared: IModelDb = createSharedIModel(["A", "B"]);

    assertTeamIModelContents(iModelA, "A");
    assertTeamIModelContents(iModelB, "B");

    if (true) {
      const subjectId: Id64String = getTeamSubjectId(iModelShared, "A");
      const transformerA2S = new IModelTransformer(iModelA, iModelShared, subjectId);
      transformerA2S.remapElement(IModel.rootSubjectId, subjectId);
      transformerA2S.excludeSubject("/Context");
      transformerA2S.excludeElement(IModel.dictionaryId);
      transformerA2S.importAll();
      transformerA2S.dispose();
      iModelShared.saveChanges("Imported A");
    }

    if (true) {
      const subjectId: Id64String = getTeamSubjectId(iModelShared, "B");
      const transformerB2S = new IModelTransformer(iModelB, iModelShared, subjectId);
      transformerB2S.remapElement(IModel.rootSubjectId, subjectId);
      transformerB2S.excludeSubject("/Context");
      transformerB2S.excludeElement(IModel.dictionaryId);
      transformerB2S.importAll();
      transformerB2S.dispose();
      iModelShared.saveChanges("Imported B");
      assertSharedIModelContents(iModelShared, ["A", "B"]);
    }

    iModelA.closeSnapshot();
    iModelB.closeSnapshot();
    iModelShared.closeSnapshot();
  });
});
