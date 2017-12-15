/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import * as path from "path";
import { expect, assert } from "chai";
import { OpenMode, DbOpcode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { AccessToken } from "@bentley/imodeljs-clients";
import { ChangeSet } from "@bentley/imodeljs-clients";
import { IModelVersion } from "../common/IModelVersion";
import { BriefcaseManager } from "../backend/BriefcaseManager";
import { IModelDb } from "../backend/IModelDb";
import { IModelConnection } from "../frontend/IModelConnection";
import { IModelTestUtils } from "./IModelTestUtils";
import { Code } from "../common/Code";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { Element } from "../backend/Element";

describe("BriefcaseManager", () => {
  let accessToken: AccessToken;
  let testProjectId: string;
  let testIModelId: string;
  let testChangeSets: ChangeSet[];
  let iModelLocalReadonlyPath: string;
  let iModelLocalReadWritePath: string;

  let shouldDeleteAllBriefcases: boolean = false;

  before(async () => {
    accessToken = await IModelTestUtils.getTestUserAccessToken();
    testProjectId = await IModelTestUtils.getTestProjectId(accessToken, "NodeJsTestProject");
    testIModelId = await IModelTestUtils.getTestIModelId(accessToken, testProjectId, "MyTestModel");

    testChangeSets = await IModelTestUtils.hubClient.getChangeSets(accessToken, testIModelId, false);
    expect(testChangeSets.length).greaterThan(2);

    iModelLocalReadonlyPath = path.join(BriefcaseManager.cachePath, testIModelId, "readOnly");
    iModelLocalReadWritePath = path.join(BriefcaseManager.cachePath, testIModelId, "readWrite");

    // Recreate briefcases if it's a TMR. todo: Figure a better way to prevent bleeding briefcase ids
    shouldDeleteAllBriefcases = !fs.existsSync(BriefcaseManager.cachePath);
    if (shouldDeleteAllBriefcases)
      await IModelTestUtils.deleteAllBriefcases(accessToken, testIModelId);
  });

  it("should be able to open an IModel from the Hub in Readonly mode", async () => {
    const iModel: IModelConnection = await IModelConnection.open(accessToken, testProjectId, testIModelId);
    assert.exists(iModel);
    assert(iModel.iModelToken.openMode === OpenMode.Readonly);

    expect(fs.existsSync(iModelLocalReadonlyPath));
    const files = fs.readdirSync(iModelLocalReadonlyPath);
    expect(files.length).greaterThan(0);

    await iModel.close(accessToken);
  });

  it("should be able to open an IModel from the Hub in ReadWrite mode", async () => {
    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.ReadWrite, IModelVersion.latest()); // Note: No frontend support for ReadWrite open yet
    assert.exists(iModel);
    assert(iModel.iModelToken.openMode === OpenMode.ReadWrite);

    expect(fs.existsSync(iModelLocalReadWritePath));
    const files = fs.readdirSync(iModelLocalReadWritePath);
    expect(files.length).greaterThan(0);

    await iModel.close(accessToken);
  });

  it("should reuse open briefcases in Readonly mode", async () => {
    const iModel0: IModelConnection = await IModelConnection.open(accessToken, testProjectId, testIModelId);
    assert.exists(iModel0);

    const briefcases = fs.readdirSync(iModelLocalReadonlyPath);
    expect(briefcases.length).greaterThan(0);

    const iModels = new Array<IModelConnection>();
    for (let ii = 0; ii < 5; ii++) {
      const iModel: IModelConnection = await IModelConnection.open(accessToken, testProjectId, testIModelId);
      assert.exists(iModel);
      iModels.push(iModel);
    }

    const briefcases2 = fs.readdirSync(iModelLocalReadonlyPath);
    expect(briefcases2.length).equals(briefcases.length);
    const diff = briefcases2.filter((item) => briefcases.indexOf(item) < 0);
    expect(diff.length).equals(0);
  });

  it("should reuse closed briefcases in ReadWrite mode", async () => {
    const files = fs.readdirSync(iModelLocalReadWritePath);

    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.ReadWrite); // Note: No frontend support for ReadWrite open yet
    assert.exists(iModel);

    const files2 = fs.readdirSync(iModelLocalReadWritePath);
    expect(files2.length).equals(files.length);
    const diff = files2.filter((item) => files.indexOf(item) < 0);
    expect(diff.length).equals(0);

    await iModel.close(accessToken);
  });

  it("should open briefcases of specific versions in Readonly mode", async () => {
    const versionNames = ["FirstVersion", "SecondVersion", "ThirdVersion"];

    for (const [changeSetIndex, versionName] of versionNames.entries()) {
      const iModelFromVersion: IModelConnection = await IModelConnection.open(accessToken, testProjectId, testIModelId, OpenMode.Readonly, IModelVersion.asOfChangeSet(testChangeSets[changeSetIndex].wsgId));
      assert.exists(iModelFromVersion);

      const iModelFromChangeSet: IModelConnection = await IModelConnection.open(accessToken, testProjectId, testIModelId, OpenMode.Readonly, IModelVersion.named(versionName));
      assert.exists(iModelFromChangeSet);
    }
  });

  it("should open a briefcase of an iModel with no versions", async () => {
    const iModelNoVerId = await IModelTestUtils.getTestIModelId(accessToken, testProjectId, "NoVersionsTest");

    if (shouldDeleteAllBriefcases)
      await IModelTestUtils.deleteAllBriefcases(accessToken, iModelNoVerId);

    const iModelNoVer: IModelDb = await IModelDb.open(accessToken, testProjectId, iModelNoVerId, OpenMode.Readonly);
    assert.exists(iModelNoVer);
  });

  it("should build resource request", async () => {
    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.ReadWrite);

    const el: Element = await iModel.elements.getRootSubject();
    const req: BriefcaseManager.ResourcesRequest = BriefcaseManager.ResourcesRequest.create();
    el.buildResourcesRequest(req, DbOpcode.Update);    // make a list of the resources that will be needed to update this element (e.g., a shared lock on the model and a code)
    const reqAsAny: any = BriefcaseManager.ResourcesRequest.toAny(req);
    assert.isDefined(reqAsAny);
    assert.isArray(reqAsAny.Locks);
    assert.equal(reqAsAny.Locks.length, 3);
    assert.isArray(reqAsAny.Codes);
    assert.equal(reqAsAny.Codes.length, 0);

    await iModel.close(accessToken);
  });

  it.only("should write to briefcase with optimistic concurrency", async () => {
    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.ReadWrite);

    /* TBD - test
    iModel.setConcurrencyControlPolicy(new BriefcaseManager.PessimisticConcurrencyControlPolicy());
    iModel.startBulkUpdateMode();
    iModel.endBulkUpdateMode();
    */

    iModel.setConcurrencyControlPolicy(new BriefcaseManager.OptimisticConcurrencyControlPolicy({
      updateVsUpdate: BriefcaseManager.ConflictResolution.Reject,
      updateVsDelete: BriefcaseManager.ConflictResolution.Take,
      deleteVsUpdate: BriefcaseManager.ConflictResolution.Reject,
    }));

    // The following ops that modify insert models and elements should succeed, even though we don't acquire locks and codes.

    const rootEl: Element = (await iModel.elements.getRootSubject()).copyForEdit<Element>();
    assert.notEqual(rootEl.userLabel, "root label changed");
    rootEl.userLabel = "root label changed";
    iModel.elements.updateElement(rootEl);

    let newModelId: Id64;
    [, newModelId] = IModelTestUtils.createAndInsertPhysicalModel(iModel, Code.createEmpty(), true);

    const spatialCategoryId: Id64 = IModelTestUtils.createSpatialCategory(iModel, "Cat1", newModelId);
    
    iModel.elements.insertElement(IModelTestUtils.createPhysicalObject(iModel, newModelId, spatialCategoryId));
    iModel.elements.insertElement(IModelTestUtils.createPhysicalObject(iModel, newModelId, spatialCategoryId));

    iModel.saveChanges("inserted generic objects");

    await iModel.close(accessToken);
  });

  it.skip("should make revisions", async () => {
    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.ReadWrite);
    assert.exists(iModel);

    let newModelId: Id64;
    [, newModelId] = IModelTestUtils.createAndInsertPhysicalModel(iModel, Code.createEmpty(), true);

    const spatialCategoryId: Id64 = IModelTestUtils.createSpatialCategory(iModel, "Cat1", newModelId);

    // Insert a few elements
    const elements: Element[] = [
      IModelTestUtils.createPhysicalObject(iModel, newModelId, spatialCategoryId),
      IModelTestUtils.createPhysicalObject(iModel, newModelId, spatialCategoryId),
    ];

    const req: BriefcaseManager.ResourcesRequest = BriefcaseManager.ResourcesRequest.create();
    for (const el of elements) {
      el.buildResourcesRequest(req);    // make a list of the resources that will be needed to insert this element (e.g., a shared lock on the model and a code)
    }

    iModel.requestResources(req);

    for (const el of elements)
        iModel.elements.insertElement(el);

    iModel.saveChanges("inserted generic objects");

    await iModel.close(accessToken);
  });

  // should not be able to open the same iModel both Readonly and ReadWrite
  // should not be able to open two copies of the iModel in ReadWrite mode
  // Readme briefcases should always be standalone.
  // should keep previously downloaded seed files and change sets
  // should not reuse open briefcases in ReadWrite mode
  // should not reuse open briefcases for different versions in Readonly mode
  // should reuse closed briefcases for newer versions
  // should not reuse closed briefcases for older versions
  // should delete closed briefcases if necessary
  // should reuse briefcases between users in readonly mode
  // should not reuse briefcases between users in readwrite mode
});
