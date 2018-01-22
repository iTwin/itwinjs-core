/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
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
import { DictionaryModel } from "../backend/Model";
import { SpatialCategory } from "../backend/Category";
import { Appearance } from "../common/SubCategoryAppearance";
import { ColorDef } from "../common/ColorDef";
import { IModel } from "../common/IModel";

describe("BriefcaseManager", () => {
  let accessToken: AccessToken;
  let testProjectId: string;
  let testIModelId: string;
  let testChangeSets: ChangeSet[];
  let iModelLocalReadonlyPath: string;
  let iModelLocalReadWritePath: string;

  let shouldDeleteAllBriefcases: boolean = false;

  before(async () => {
    let startTime = new Date().getTime();
    console.log("    Started monitoring briefcase manager performance..."); // tslint:disable-line:no-console

    accessToken = await IModelTestUtils.getTestUserAccessToken();
    console.log(`    ...getting user access token from IMS: ${new Date().getTime() - startTime} ms`); // tslint:disable-line:no-console
    startTime = new Date().getTime();

    testProjectId = await IModelTestUtils.getTestProjectId(accessToken, "NodeJsTestProject");
    testIModelId = await IModelTestUtils.getTestIModelId(accessToken, testProjectId, "TestModel");

    testChangeSets = await IModelTestUtils.hubClient.getChangeSets(accessToken, testIModelId, false);
    expect(testChangeSets.length).greaterThan(2);

    iModelLocalReadonlyPath = path.join(BriefcaseManager.cachePath, testIModelId, "readOnly");
    iModelLocalReadWritePath = path.join(BriefcaseManager.cachePath, testIModelId, "readWrite");

    // Recreate briefcases if it's a TMR. todo: Figure a better way to prevent bleeding briefcase ids
    shouldDeleteAllBriefcases = !fs.existsSync(BriefcaseManager.cachePath);
    if (shouldDeleteAllBriefcases)
      await IModelTestUtils.deleteAllBriefcases(accessToken, testIModelId);

    console.log(`    ...getting information on Project+IModel+ChangeSets for test case from the Hub: ${new Date().getTime() - startTime} ms`); // tslint:disable-line:no-console
  });

  it("should be able to open an IModel from the Hub in Readonly mode", async () => {
    const iModel: IModelConnection = await IModelConnection.open(accessToken, testProjectId, testIModelId);
    assert.exists(iModel);
    assert(iModel.iModelToken.openMode === OpenMode.Readonly);

    expect(fs.existsSync(iModelLocalReadonlyPath));
    const files = fs.readdirSync(iModelLocalReadonlyPath);
    expect(files.length).greaterThan(0);

    iModel.close(accessToken);
  });

  it("should be able to open an IModel from the Hub in ReadWrite mode", async () => {
    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.ReadWrite, IModelVersion.latest()); // Note: No frontend support for ReadWrite open yet
    assert.exists(iModel);
    assert(iModel.iModelToken.openMode === OpenMode.ReadWrite);

    expect(fs.existsSync(iModelLocalReadWritePath));
    const files = fs.readdirSync(iModelLocalReadWritePath);
    expect(files.length).greaterThan(0);

    iModel.close(accessToken);
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

    iModel.close(accessToken);
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

  it.skip("should open briefcase of an iModel in both DEV and QA", async () => {
    // Note: This test is commented out since it causes the entire cache to be discarded and is therefore expensive.
    IModelTestUtils.setIModelHubDeployConfig("DEV");
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // Turn off SSL validation in DEV
    const devProjectId = await IModelTestUtils.getTestProjectId(accessToken, "NodeJsTestProject");
    assert(devProjectId);
    const devIModelId = await IModelTestUtils.getTestIModelId(accessToken, devProjectId, "MyTestModel");
    assert(devIModelId);
    const devChangeSets: ChangeSet[] = await IModelTestUtils.hubClient.getChangeSets(accessToken, devIModelId, false);
    expect(devChangeSets.length).equals(0); // needs change sets
    const devIModel: IModelConnection = await IModelConnection.open(accessToken, devProjectId, devIModelId, OpenMode.Readonly, IModelVersion.latest());
    assert.exists(devIModel);

    IModelTestUtils.setIModelHubDeployConfig("QA");
    const qaProjectId = await IModelTestUtils.getTestProjectId(accessToken, "NodeJsTestProject");
    assert(qaProjectId);
    const qaIModelId = await IModelTestUtils.getTestIModelId(accessToken, qaProjectId, "MyTestModel");
    assert(qaIModelId);
    const qaChangeSets: ChangeSet[] = await IModelTestUtils.hubClient.getChangeSets(accessToken, qaIModelId, false);
    expect(qaChangeSets.length).greaterThan(0);
    const qaIModel: IModelConnection = await IModelConnection.open(accessToken, qaProjectId, qaIModelId, OpenMode.Readonly, IModelVersion.latest());
    assert.exists(qaIModel);
  });

  it("should build resource request", async () => {
    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.ReadWrite);

    const el: Element = iModel.elements.getRootSubject();
    const req: BriefcaseManager.ResourcesRequest = BriefcaseManager.ResourcesRequest.create();
    el.buildResourcesRequest(req, DbOpcode.Update);    // make a list of the resources that will be needed to update this element (e.g., a shared lock on the model and a code)
    const reqAsAny: any = BriefcaseManager.ResourcesRequest.toAny(req);
    assert.isDefined(reqAsAny);
    assert.isArray(reqAsAny.Locks);
    assert.equal(reqAsAny.Locks.length, 3);
    assert.isArray(reqAsAny.Codes);
    assert.equal(reqAsAny.Codes.length, 0);

    iModel.close(accessToken);
  });

  it.skip("should write to briefcase with optimistic concurrency", async () => {

    // Acquire a briefcase from iModelHub
    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.ReadWrite);

    // Turn on optimistic concurrency control. This allows the app to modify elements, models, etc. without first acquiring locks.
    // (Later, when the app downloads and merges changeSets from the Hub into the briefcase, BriefcaseManager will merge changes and handle conflicts.)
    iModel.setConcurrencyControlPolicy(new BriefcaseManager.OptimisticConcurrencyControlPolicy({
      updateVsUpdate: BriefcaseManager.ConflictResolution.Reject,
      updateVsDelete: BriefcaseManager.ConflictResolution.Take,
      deleteVsUpdate: BriefcaseManager.ConflictResolution.Reject,
    }));

    // Show that we can modify the properties of an element. In this case, we modify the root element itself.
    const rootEl: Element = (iModel.elements.getRootSubject()).copyForEdit<Element>();
    rootEl.userLabel = rootEl.userLabel + "changed";
    iModel.elements.updateElement(rootEl);

    // Create a new physical model
    let newModelId: Id64;
    [, newModelId] = IModelTestUtils.createAndInsertPhysicalModel(iModel, Code.createEmpty(), true);

    // Find or create a SpatialCategory
    const dictionary: DictionaryModel = iModel.models.getModel(IModel.getDictionaryId()) as DictionaryModel;
    let spatialCategoryId: Id64 | undefined = SpatialCategory.queryCategoryIdByName(dictionary, "MySpatialCategory");
    if (undefined === spatialCategoryId) {
      spatialCategoryId = IModelTestUtils.createAndInsertSpatialCategory(dictionary, "MySpatialCategory", new Appearance({ color: new ColorDef("rgb(255,0,0)") }));
    }

    // Create a couple of physical elements.
    iModel.elements.insertElement(IModelTestUtils.createPhysicalObject(iModel, newModelId, spatialCategoryId));
    iModel.elements.insertElement(IModelTestUtils.createPhysicalObject(iModel, newModelId, spatialCategoryId));

    // Commit the local changes to a local transaction in the briefcase.
    iModel.saveChanges("inserted generic objects");

    // TBD: Sync with iModelHub and  then upload the local changes as a changeSet to iModelHub

    iModel.close(accessToken);
  });

  it.skip("should make revisions", async () => {
    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.ReadWrite);
    assert.exists(iModel);

    const dictionary: DictionaryModel = iModel.models.getModel(IModel.getDictionaryId()) as DictionaryModel;

    let newModelId: Id64;
    [, newModelId] = IModelTestUtils.createAndInsertPhysicalModel(iModel, Code.createEmpty(), true);

    const spatialCategoryId: Id64 = SpatialCategory.create(dictionary, "Cat1").insert();

    // Insert a few elements
    const elements: Element[] = [
      IModelTestUtils.createPhysicalObject(iModel, newModelId, spatialCategoryId),
      IModelTestUtils.createPhysicalObject(iModel, newModelId, spatialCategoryId),
    ];

    const req: BriefcaseManager.ResourcesRequest = BriefcaseManager.ResourcesRequest.create();
    for (const el of elements) {
      el.buildResourcesRequest(req, DbOpcode.Insert);    // make a list of the resources that will be needed to insert this element (e.g., a shared lock on the model and a code)
    }

    iModel.requestResources(req);

    for (const el of elements)
      iModel.elements.insertElement(el);

    iModel.saveChanges("inserted generic objects");

    iModel.close(accessToken);
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
  // should not reuse briefcases between users in readWrite mode
});
