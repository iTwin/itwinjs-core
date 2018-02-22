/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { expect, assert } from "chai";
import * as TypeMoq from "typemoq";
import { OpenMode, DbOpcode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { AccessToken, ChangeSet, IModel as HubIModel, MultiCode, CodeState, IModelHubClient,
  ConnectClient, Project, ECJsonTypeMap, WsgInstance } from "@bentley/imodeljs-clients";
import { Code } from "../../common/Code";
import { IModelVersion } from "../../common/IModelVersion";
import { KeepBriefcase, BriefcaseManager, BriefcaseEntry } from "../BriefcaseManager";
import { IModelDb, ConcurrencyControl } from "../IModelDb";
import { IModelTestUtils } from "./IModelTestUtils";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { Element } from "../Element";
import { DictionaryModel } from "../Model";
import { SpatialCategory } from "../Category";
import { Appearance } from "../../common/SubCategoryAppearance";
import { ColorDef } from "../../common/ColorDef";
import { IModel } from "../../common/IModel";
import { IModelJsFs } from "../IModelJsFs";
import { iModelHost } from "../IModelHost";
import { AutoPush, AutoPushState, AutoPushEventHandler, AutoPushEventType } from "../AutoPush";

let lastPushTimeMillis = 0;
let lastAutoPushEventType: AutoPushEventType | undefined;

class Timer {
  private label: string;
  constructor(label: string) {
    // tslint:disable-next-line:no-console
    console.time(this.label = "\t" + label);
  }

  public end() {
    // tslint:disable-next-line:no-console
    console.timeEnd(this.label);
  }
}
export class IModelTestUser {
  public static user = {
    email: "bistroDEV_pmadm1@mailinator.com",
    password: "pmadm1",
  };
}

describe("BriefcaseManager", () => {
  let accessToken: AccessToken;
  let spoofAccessToken: AccessToken | undefined;
  let testProjectId: string;
  let testIModelId: string;
  let testChangeSets: ChangeSet[];
  const testVersionNames = ["FirstVersion", "SecondVersion", "ThirdVersion"];
  const testElementCounts = [80, 81, 82];
  let iModelLocalReadonlyPath: string;
  let iModelLocalReadWritePath: string;
  const assetDir = "./source/backend/test/assets";

  const iModelHubClientMock = TypeMoq.Mock.ofType(IModelHubClient);
  const iModelVersionMock = TypeMoq.Mock.ofType(IModelVersion);
  const connectClientMock = TypeMoq.Mock.ofType(ConnectClient);

  let shouldDeleteAllBriefcases: boolean = false;
  const getElementCount = (iModel: IModelDb): number => {
    const rows: any[] = iModel.executeQuery("SELECT COUNT(*) AS cnt FROM bis.Element");
    const count = +(rows[0].cnt);
    return count;
  };

  const getTypedInstance = <T extends WsgInstance>(typedConstructor: new () => T, jsonBody: any): T => {
    const instance: T | undefined = ECJsonTypeMap.fromJson<T>(typedConstructor, "wsg", jsonBody);
    if (!instance) { throw new Error("Unable to parse JSON into typed instance"); }
    return instance!;
  };

  const getTypedInstances = <T extends WsgInstance>(typedConstructor: new () => T, jsonBody: any): T[] => {
    const instances: T[] = new Array<T>();
    for (const ecJsonInstance of jsonBody) {
      const typedInstance: T | undefined = ECJsonTypeMap.fromJson<T>(typedConstructor, "wsg",  ecJsonInstance);
      if (typedInstance) { instances.push(typedInstance); }
    }
    return instances;
  };

  before(async () => {
    const startTime = new Date().getTime();

    console.log("    Started monitoring briefcase manager performance..."); // tslint:disable-line:no-console

    spoofAccessToken = undefined;

    connectClientMock.setup((f: ConnectClient) => f.getProject(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
      .returns(() => {
        const assetPath = path.join(assetDir, "SampleProject.json");
        const buff = IModelJsFs.readFileSync(assetPath);
        const jsonObj = JSON.parse(buff.toString())[0];
        return Promise.resolve(getTypedInstance<Project>(Project, jsonObj));
      }).verifiable();
    iModelHubClientMock.setup((f: IModelHubClient) => f.getIModels(TypeMoq.It.isAny(), TypeMoq.It.isAnyString(), TypeMoq.It.isAny()))
      .returns(() => {
        const sampleIModelPath = path.join(assetDir, "SampleIModel.json");
        const buff = IModelJsFs.readFileSync(sampleIModelPath);
        const jsonObj = JSON.parse(buff.toString());
        return Promise.resolve(getTypedInstances<HubIModel>(HubIModel, jsonObj));
      }).verifiable();
    iModelHubClientMock.setup((f: IModelHubClient) => f.getChangeSets(TypeMoq.It.isAny(), TypeMoq.It.isAnyString(), TypeMoq.It.isAny()))
      .returns(() => {
        const sampleChangeSetPath = path.join(assetDir, "SampleChangeSets.json");
        const buff = IModelJsFs.readFileSync(sampleChangeSetPath);
        const jsonObj = JSON.parse(buff.toString());
        return Promise.resolve(getTypedInstances<ChangeSet>(ChangeSet, jsonObj));
      }).verifiable();

    // accessToken = await IModelTestUtils.getTestUserAccessToken();
    // testProjectId = await IModelTestUtils.getTestProjectId(accessToken, "NodeJsTestProject");
    // testIModelId = await IModelTestUtils.getTestIModelId(accessToken, testProjectId, "TestModel");
    // testChangeSets = await IModelTestUtils.hubClient.getChangeSets(accessToken, testIModelId, false);

    // getTestProjectId()
    const project: Project = await connectClientMock.object.getProject(spoofAccessToken as any, {
      $select: "*",
      $filter: "Name+eq+'NodeJstestproject'",
    });
    connectClientMock.verify((f: ConnectClient) => f.getProject(TypeMoq.It.isAny(), TypeMoq.It.isAny()), TypeMoq.Times.exactly(1));
    assert(project && project.wsgId);
    testProjectId = project.wsgId;

    // getTestModelId
    const iModels = await iModelHubClientMock.object.getIModels(spoofAccessToken as any, testProjectId, {
      $select: "*",
      $filter: "Name+eq+'TestModel'",
    });
    iModelHubClientMock.verify((f: IModelHubClient) => f.getIModels(TypeMoq.It.isAny(), TypeMoq.It.isAnyString(), TypeMoq.It.isAny()), TypeMoq.Times.exactly(1));
    assert(iModels.length > 0);
    assert(iModels[0].wsgId);
    testIModelId = iModels[0].wsgId;

    // getChangeSets
    testChangeSets = await iModelHubClientMock.object.getChangeSets(spoofAccessToken as any, testIModelId, false);
    iModelHubClientMock.verify((f: IModelHubClient) => f.getChangeSets(TypeMoq.It.isAny(), TypeMoq.It.isAnyString(), TypeMoq.It.isAny()), TypeMoq.Times.exactly(1));
    expect(testChangeSets.length).greaterThan(2);

    expect(testChangeSets.length).greaterThan(2);
    console.log(`    ...getting information on Project+IModel+ChangeSets for test case from mock data: ${new Date().getTime() - startTime} ms`); // tslint:disable-line:no-console

    const cacheDir = iModelHost.configuration.briefcaseCacheDir;
    iModelLocalReadonlyPath = path.join(cacheDir, testIModelId, "readOnly");
    iModelLocalReadWritePath = path.join(cacheDir, testIModelId, "readWrite");

    // Recreate briefcases if the cache has been cleaned. todo: Figure a better way to prevent bleeding briefcase ids
    // Mocking notes:
    //              - Do we ever need to clear briefcases if they're never actually created from the mocks?
    shouldDeleteAllBriefcases = !IModelJsFs.existsSync(cacheDir);
    if (shouldDeleteAllBriefcases) {
      await IModelTestUtils.deleteAllBriefcases(accessToken, testIModelId);
    }

  });

  it("should open multiple versions of iModels", async () => {
    const iModelNames = ["TestModel", "NoVersionsTest"];
    for (const name of iModelNames) {
       const iModelId = await IModelTestUtils.getTestIModelId(accessToken, testProjectId, name);

       await IModelDb.open(accessToken, testProjectId, iModelId, OpenMode.Readonly, IModelVersion.first());
       await IModelDb.open(accessToken, testProjectId, iModelId, OpenMode.Readonly, IModelVersion.latest());
     }
   });

  it.only("should be able to open an cached first version IModel in Readonly mode", async () => {
    // Arrange
    iModelVersionMock.setup((f: IModelVersion) => f.evaluateChangeSet(spoofAccessToken as any, TypeMoq.It.isAnyString(), iModelHubClientMock.object))
      .returns(() => Promise.resolve(""));
    iModelHubClientMock.setup((f: IModelHubClient) => f.getIModel(TypeMoq.It.isAny(), TypeMoq.It.isAnyString(), TypeMoq.It.isAny()))
      .returns(() => {
      const sampleIModelPath = path.join(assetDir, "SampleIModel.json");
      const buff = IModelJsFs.readFileSync(sampleIModelPath);
      const jsonObj = JSON.parse(buff.toString());
      return Promise.resolve(getTypedInstance<HubIModel>(HubIModel, jsonObj));
    }).verifiable();

    // Act
    const iModel: BriefcaseEntry = await BriefcaseManager.open(spoofAccessToken as any, testProjectId, testIModelId, OpenMode.Readonly, iModelVersionMock.object);

    // Assert
    assert.exists(iModel);
    assert(iModel.openMode === OpenMode.Readonly);

    // some verify stuff
    // expect(IModelJsFs.existsSync(iModelLocalReadonlyPath));
    // const files = IModelJsFs.readdirSync(iModelLocalReadonlyPath);
    // expect(files.length).greaterThan(0);

    // iModel.close(accessToken);
  });

  it("should be able to open an IModel from the Hub in ReadWrite mode", async () => {
    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.ReadWrite, IModelVersion.latest()); // Note: No frontend support for ReadWrite open yet
    assert.exists(iModel);
    assert(iModel.iModelToken.openMode === OpenMode.ReadWrite);

    expect(IModelJsFs.existsSync(iModelLocalReadWritePath));
    const files = IModelJsFs.readdirSync(iModelLocalReadWritePath);
    expect(files.length).greaterThan(0);

    iModel.close(accessToken);
  });

  it("should reuse open briefcases in Readonly mode", async () => {
    let timer = new Timer("open briefcase first time");
    const iModel0: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId);
    assert.exists(iModel0);
    timer.end();

    const briefcases = IModelJsFs.readdirSync(iModelLocalReadonlyPath);
    expect(briefcases.length).greaterThan(0);

    timer = new Timer("open briefcase 5 more times");
    const iModels = new Array<IModelDb>();
    for (let ii = 0; ii < 5; ii++) {
      const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId);
      assert.exists(iModel);
      iModels.push(iModel);
    }
    timer.end();

    const briefcases2 = IModelJsFs.readdirSync(iModelLocalReadonlyPath);
    expect(briefcases2.length).equals(briefcases.length);
    const diff = briefcases2.filter((item) => briefcases.indexOf(item) < 0);
    expect(diff.length).equals(0);
  });

  it("should reuse closed briefcases in ReadWrite mode", async () => {
    const files = IModelJsFs.readdirSync(iModelLocalReadWritePath);

    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.ReadWrite); // Note: No frontend support for ReadWrite open yet
    assert.exists(iModel);

    const files2 = IModelJsFs.readdirSync(iModelLocalReadWritePath);
    expect(files2.length).equals(files.length);
    const diff = files2.filter((item) => files.indexOf(item) < 0);
    expect(diff.length).equals(0);

    iModel.close(accessToken);
  });

  it("should open briefcases of specific versions in Readonly mode", async () => {
    const iModelFirstVersion: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.Readonly, IModelVersion.first());
    assert.exists(iModelFirstVersion);

    for (const [arrayIndex, versionName] of testVersionNames.entries()) {
      const iModelFromVersion: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.Readonly, IModelVersion.asOfChangeSet(testChangeSets[arrayIndex].wsgId));
      assert.exists(iModelFromVersion);

      const iModelFromChangeSet: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.Readonly, IModelVersion.named(versionName));
      assert.exists(iModelFromChangeSet);

      const elementCount = getElementCount(iModelFromVersion);
      assert.equal(elementCount, testElementCounts[arrayIndex]);
    }

    const iModelLatestVersion: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.Readonly, IModelVersion.latest());
    assert.exists(iModelLatestVersion);
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
    const devIModel: IModelDb = await IModelDb.open(accessToken, devProjectId, devIModelId, OpenMode.Readonly, IModelVersion.latest());
    assert.exists(devIModel);

    IModelTestUtils.setIModelHubDeployConfig("QA");
    const qaProjectId = await IModelTestUtils.getTestProjectId(accessToken, "NodeJsTestProject");
    assert(qaProjectId);
    const qaIModelId = await IModelTestUtils.getTestIModelId(accessToken, qaProjectId, "MyTestModel");
    assert(qaIModelId);
    const qaChangeSets: ChangeSet[] = await IModelTestUtils.hubClient.getChangeSets(accessToken, qaIModelId, false);
    expect(qaChangeSets.length).greaterThan(0);
    const qaIModel: IModelDb = await IModelDb.open(accessToken, qaProjectId, qaIModelId, OpenMode.Readonly, IModelVersion.latest());
    assert.exists(qaIModel);
  });

  it("should be able to reverse and reinstate changes", async () => {
    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.Readonly, IModelVersion.latest());

    let arrayIndex: number;
    for (arrayIndex = testVersionNames.length - 1; arrayIndex >= 0; arrayIndex--) {
      await iModel.reverseChanges(accessToken, IModelVersion.named(testVersionNames[arrayIndex]));
      assert.equal(testElementCounts[arrayIndex], getElementCount(iModel));
    }

    await iModel.reverseChanges(accessToken, IModelVersion.first());

    for (arrayIndex = 0; arrayIndex < testVersionNames.length; arrayIndex++) {
      await iModel.reinstateChanges(accessToken, IModelVersion.named(testVersionNames[arrayIndex]));
      assert.equal(testElementCounts[arrayIndex], getElementCount(iModel));
    }

    await iModel.reinstateChanges(accessToken, IModelVersion.latest());
  });

  it("should build concurrency control request", async () => {
    const iModel: IModelDb = await IModelDb.open(accessToken, testProjectId, testIModelId, OpenMode.ReadWrite);

    const el: Element = iModel.elements.getRootSubject();
    el.buildConcurrencyControlRequest(DbOpcode.Update);    // make a list of the locks, etc. that will be needed to update this element
    const reqAsAny: any = ConcurrencyControl.convertRequestToAny(iModel.concurrencyControl.pendingRequest);
    assert.isDefined(reqAsAny);
    assert.isArray(reqAsAny.Locks);
    assert.equal(reqAsAny.Locks.length, 3, " we expect to need a lock on the element (exclusive), its model (shared), and the db itself (shared)");
    assert.isArray(reqAsAny.Codes);
    assert.equal(reqAsAny.Codes.length, 0, " since we didn't add or change the element's code, we don't expect to need a code reservation");

    iModel.close(accessToken);
  });

  it.skip("should write to briefcase with optimistic concurrency", async () => {
    let timer = new Timer("delete iModels");
    // Delete any existing iModels with the same name as the read-write test iModel
    const iModelName = "ReadWriteTest";
    const iModels: HubIModel[] = await IModelTestUtils.hubClient.getIModels(accessToken, testProjectId, {
      $select: "*",
      $filter: "Name+eq+'" + iModelName + "'",
    });
    for (const iModelTemp of iModels) {
      await IModelTestUtils.hubClient.deleteIModel(accessToken, testProjectId, iModelTemp.wsgId);
    }
    timer.end();

    // Create a new iModel on the Hub (by uploading a seed file)
    timer = new Timer("create iModel");
    const rwIModel: IModelDb = await IModelDb.create(accessToken, testProjectId, "ReadWriteTest", "TestSubject");
    const rwIModelId = rwIModel.iModelToken.iModelId;
    assert.isNotEmpty(rwIModelId);
    timer.end();

    timer = new Timer("make local changes");

    // Turn on optimistic concurrency control. This allows the app to modify elements, models, etc. without first acquiring locks.
    // Later, when the app downloads and merges changeSets from the Hub into the briefcase, BriefcaseManager will merge changes and handle conflicts.
    // The app still has to reserve codes.
    rwIModel.concurrencyControl.setPolicy(new ConcurrencyControl.OptimisticPolicy());

    // Show that we can modify the properties of an element. In this case, we modify the root element itself.
    const rootEl: Element = (rwIModel.elements.getRootSubject()).copyForEdit<Element>();
    rootEl.userLabel = rootEl.userLabel + "changed";
    rwIModel.elements.updateElement(rootEl);

    assert.isFalse(rwIModel.concurrencyControl.hasPendingRequests());

    // Create a new physical model.
    let newModelId: Id64;
    [, newModelId] = IModelTestUtils.createAndInsertPhysicalModel(rwIModel, IModelTestUtils.getUniqueModelCode(rwIModel, "newPhysicalModel"), true);

    // Find or create a SpatialCategory.
    const dictionary: DictionaryModel = rwIModel.models.getModel(IModel.getDictionaryId()) as DictionaryModel;
    const newCategoryCode = IModelTestUtils.getUniqueSpatialCategoryCode(dictionary, "ThisTestSpatialCategory");
    const spatialCategoryId: Id64 = IModelTestUtils.createAndInsertSpatialCategory(dictionary, newCategoryCode.value!, new Appearance({ color: new ColorDef("rgb(255,0,0)") }));

    timer.end();

    timer = new Timer("query Codes I");

    // iModel.concurrencyControl should have recorded the codes that are required by the new elements.
    assert.isTrue(rwIModel.concurrencyControl.hasPendingRequests());
    assert.isTrue(await rwIModel.concurrencyControl.areAvailable(accessToken));

    timer.end();
    timer = new Timer("reserve Codes");

    // Reserve all of the codes that are required by the new model and category.
    try {
      await rwIModel.concurrencyControl.request(accessToken);
    } catch (err) {
      if (err instanceof ConcurrencyControl.RequestError) {
          assert.fail(JSON.stringify(err.unavailableCodes) + ", " + JSON.stringify(err.unavailableLocks));
      }
    }

    timer.end();
    timer = new Timer("query Codes II");

    // Verify that the codes are reserved.
    const category = rwIModel.elements.getElement(spatialCategoryId);
    assert.isTrue(category.code.value !== undefined);
    const codeStates: MultiCode[] = await rwIModel.concurrencyControl.codes.query(accessToken, category.code.spec, category.code.scope);
    const foundCode: MultiCode[] = codeStates.filter((cs) => cs.values!.includes(category.code.value!) && (cs.state === CodeState.Reserved));
    assert.equal(foundCode.length, 1);

      /* NEEDS WORK - query just this one code
    assert.isTrue(category.code.value !== undefined);
    const codeStates2 = await iModel.concurrencyControl.codes.query(accessToken, category.code.spec, category.code.scope, category.code.value!);
    assert.equal(codeStates2.length, 1);
    assert.equal(codeStates2[0].values.length, 1);
    assert.equal(codeStates2[0].values[0], category.code.value!);
    */

    timer.end();

    timer = new Timer("make more local changes");

    // Create a couple of physical elements.
    const elid1 = rwIModel.elements.insertElement(IModelTestUtils.createPhysicalObject(rwIModel, newModelId, spatialCategoryId));
    rwIModel.elements.insertElement(IModelTestUtils.createPhysicalObject(rwIModel, newModelId, spatialCategoryId));

    // Commit the local changes to a local transaction in the briefcase.
    // (Note that this ends the bulk operation automatically, so there's no need to call endBulkOperation.)
    rwIModel.saveChanges("inserted generic objects");

    rwIModel.elements.getElement(elid1); // throws if elid1 is not found
    rwIModel.elements.getElement(spatialCategoryId); // throws if spatialCategoryId is not found

    timer.end();

    timer = new Timer("pullmergepush");

    // Push the changes to the hub
    await rwIModel.pushChanges(accessToken);

    timer.end();

    // Open a readonly copy of the iModel
    const roIModel: IModelDb = await IModelDb.open(accessToken, testProjectId, rwIModelId!, OpenMode.Readonly, IModelVersion.latest());
    assert.exists(roIModel);

    rwIModel.close(accessToken, KeepBriefcase.No);
    roIModel.close(accessToken);
  });

  it.skip("should make change sets", async () => {
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

    for (const el of elements) {
      el.buildConcurrencyControlRequest(DbOpcode.Insert);    // make a list of the resources that will be needed to insert this element (e.g., a shared lock on the model and a code)
    }

    await iModel.concurrencyControl.request(accessToken); // In a pessimistic concurrency regime, we must request locks and codes *before* writing to the local IModelDb.

    for (const el of elements)
      iModel.elements.insertElement(el);

    iModel.saveChanges("inserted generic objects");

    iModel.close(accessToken);
  });

  it("should be able to create a standalone IModel", async () => {
    const iModel: IModelDb = IModelTestUtils.createStandaloneIModel("TestStandalone.bim", "TestSubject");
    iModel.closeStandalone();
  });

  it.skip("should test AutoPush", async () => {
    let isIdle: boolean = true;
    const activityMonitor = {
      isIdle: () => isIdle,
    };

    const fakePushTimeRequired = 1; // pretend that it takes 1/1000 of a second to do the push
    const millisToWaitForAutoPush = (5 * fakePushTimeRequired); // a long enough wait to ensure that auto-push ran.

    const iModel = {
      pushChanges: async (_clientAccessToken: AccessToken) => {
        await new Promise((resolve, _reject)  => { setTimeout(resolve, fakePushTimeRequired); }); // sleep, in order to simulate time spent doing push
        lastPushTimeMillis = Date.now();
      },
      iModelToken: {
        changeSetId: "",
      },
      concurrencyControl: {
        request: async (_clientAccessToken: AccessToken) => {},
      },
    };
    lastPushTimeMillis = 0;
    lastAutoPushEventType = undefined;

    // Create an autopush in manual-schedule mode.
    const autoPush = new AutoPush(iModel as any, {pushIntervalSecondsMin: 0, pushIntervalSecondsMax: 1, autoSchedule: false}, accessToken, activityMonitor);
    assert.equal(autoPush.state, AutoPushState.NotRunning, "I configured auto-push NOT to start automatically");
    assert.isFalse(autoPush.autoSchedule);

    // Schedule the next push
    autoPush.scheduleNextPush();
    assert.equal(autoPush.state, AutoPushState.Scheduled);

    // Wait long enough for the auto-push to happen
    await new Promise((resolve, _reject)  => { setTimeout(resolve, millisToWaitForAutoPush); });

    // Verify that push happened during the time that I was asleep.
    assert.equal(autoPush.state, AutoPushState.NotRunning, "I configured auto-push NOT to restart automatically");
    assert.notEqual(lastPushTimeMillis, 0);
    assert.isAtLeast(autoPush.durationOfLastPushMillis, fakePushTimeRequired);
    assert.isUndefined(lastAutoPushEventType);  // not listening to events yet.

    // Cancel the next scheduled push
    autoPush.cancel();
    assert.equal(autoPush.state, AutoPushState.NotRunning, "cancel does NOT automatically schedule the next push");

    // Register an event handler
    const autoPushEventHandler: AutoPushEventHandler = (etype: AutoPushEventType, _theAutoPush: AutoPush) => { lastAutoPushEventType = etype; };
    autoPush.event.addListener(autoPushEventHandler);

    lastPushTimeMillis = 0;

    // Explicitly schedule the next auto-push
    autoPush.scheduleNextPush();
    assert.equal(autoPush.state, AutoPushState.Scheduled);

    // wait long enough for the auto-push to happen
    await new Promise((resolve, _reject)  => { setTimeout(resolve, millisToWaitForAutoPush); });
    assert.equal(autoPush.state, AutoPushState.NotRunning, "I configured auto-push NOT to start automatically");
    assert.notEqual(lastPushTimeMillis, 0);
    assert.equal(lastAutoPushEventType, AutoPushEventType.PushFinished, "event handler should have been called");

    // Just verify that this doesn't blow up.
    autoPush.reserveCodes();

    // Now turn on auto-schedule and verify that we get a few auto-pushes
    lastPushTimeMillis = 0;
    autoPush.autoSchedule = true;
    await new Promise((resolve, _reject)  => { setTimeout(resolve, millisToWaitForAutoPush); }); // let auto-push run
    assert.notEqual(lastPushTimeMillis, 0);
    lastPushTimeMillis = 0;
    await new Promise((resolve, _reject)  => { setTimeout(resolve, millisToWaitForAutoPush); }); // let auto-push run
    assert.notEqual(lastPushTimeMillis, 0);
    autoPush.cancel();
    await new Promise((resolve, _reject)  => { setTimeout(resolve, millisToWaitForAutoPush); }); // let auto-push run
    assert(autoPush.state === AutoPushState.NotRunning);
    assert.isFalse(autoPush.autoSchedule, "cancel turns off autoSchedule");

    // Test auto-push when isIdle returns false
    isIdle = false;
    lastPushTimeMillis = 0;
    autoPush.autoSchedule = true;
    await new Promise((resolve, _reject)  => { setTimeout(resolve, millisToWaitForAutoPush); }); // let auto-push run
    assert.equal(lastPushTimeMillis, 0); // auto-push should not have run, because isIdle==false.
    assert.equal(autoPush.state, AutoPushState.Scheduled); // Instead, it should have re-scheduled
    autoPush.cancel();
  });

});
