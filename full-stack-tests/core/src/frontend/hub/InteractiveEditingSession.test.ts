/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
const expect = chai.expect;
import * as path from "path";
import * as chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
import { BeDuration, DbOpcode, OpenMode } from "@bentley/bentleyjs-core";
import { ElementGeometryChange, IModelError, IModelWriteRpcInterface } from "@bentley/imodeljs-common";
import { IModelApp, IModelConnection, InteractiveEditingSession, RemoteBriefcaseConnection } from "@bentley/imodeljs-frontend";
import { TestUsers } from "@bentley/oidc-signin-tool/lib/TestUsers";
import { TestUtility } from "./TestUtility";

describe("InteractiveEditingSession (#integration)", () => {
  let imodel: IModelConnection | undefined;
  let projectId: string;
  let oldIModelId: string; // BisCore < 1.0.11
  let newIModelId: string; // BisCore = 1.0.11

  async function openOldIModel(writable = false): Promise<IModelConnection> {
    return RemoteBriefcaseConnection.open(projectId, oldIModelId, writable ? OpenMode.ReadWrite : OpenMode.Readonly);
  }

  async function openNewIModel(writable = false): Promise<IModelConnection> {
    return RemoteBriefcaseConnection.open(projectId, newIModelId, writable ? OpenMode.ReadWrite : OpenMode.Readonly);
  }

  async function closeIModel(): Promise<void> {
    if (imodel) {
      await imodel.close();
      imodel = undefined;
    }
  }

  before(async () => {
    const projectName = "iModelJsIntegrationTest";
    await IModelApp.startup({
      authorizationClient: await TestUtility.initializeTestProject(projectName, TestUsers.regular),
      imodelClient: TestUtility.imodelCloudEnv.imodelClient,
      applicationVersion: "1.2.1.1",
    });

    projectId = await TestUtility.getTestProjectId(projectName);
    oldIModelId = await TestUtility.getTestIModelId(projectId, "test");
    newIModelId = await TestUtility.getTestIModelId(projectId, "planprojection");
  });

  after(async () => {
    await closeIModel();
    await IModelApp.shutdown();
  });

  afterEach(async () => {
    await closeIModel();
  });

  it("should not be supported for read-only connections", async () => {
    imodel = await openOldIModel();
    expect(imodel.openMode).to.equal(OpenMode.Readonly);
    expect(await InteractiveEditingSession.isSupported(imodel)).to.be.false;
    await expect(InteractiveEditingSession.begin(imodel)).to.be.rejectedWith(IModelError);
  });

  it("should not be supported for iModels with BisCore < 1.0.11", async () => {
    imodel = await openOldIModel(true);
    expect(imodel.openMode).to.equal(OpenMode.ReadWrite);
    expect(await InteractiveEditingSession.isSupported(imodel)).to.be.false;
    await expect(InteractiveEditingSession.begin(imodel)).to.be.rejectedWith(IModelError);
  });

  it("should not be supported for read-only iModels with BisCore >= 1.0.11", async () => {
    imodel = await openNewIModel();
    expect(imodel.openMode).to.equal(OpenMode.Readonly);
    expect(await InteractiveEditingSession.isSupported(imodel)).to.be.false;
    await expect(InteractiveEditingSession.begin(imodel)).to.be.rejectedWith(IModelError);
  });

  it("should be supported for writable iModels with BisCore >= 1.0.11", async () => {
    imodel = await openNewIModel(true);
    expect(imodel.openMode).to.equal(OpenMode.ReadWrite);
    expect(await InteractiveEditingSession.isSupported(imodel)).to.be.true;
    const session = await InteractiveEditingSession.begin(imodel);
    await session.end();
  });

  async function openWritable(): Promise<IModelConnection> {
    expect(imodel).to.be.undefined;
    return await openNewIModel(true);
  }

  it("throws if begin is called repeatedly", async () => {
    imodel = await openWritable();
    const session = await InteractiveEditingSession.begin(imodel);
    await expect(InteractiveEditingSession.begin(imodel)).to.be.rejectedWith("Cannot create an editing session for an iModel that already has one");
    await session.end();
  });

  it("throws if end is called repeatedly", async () => {
    imodel = await openWritable();
    const session = await InteractiveEditingSession.begin(imodel);
    await session.end();
    await expect(session.end()).to.be.rejectedWith("Cannot end editing session after it is disconnected from the iModel");
  });

  it("throws if the iModel is closed before ending the session", async () => {
    imodel = await openWritable();
    const session = await InteractiveEditingSession.begin(imodel);
    await expect(imodel.close()).to.be.rejectedWith("InteractiveEditingSession must be ended before closing the associated iModel");
    await session.end();
  });

  it("dispatches events when sessions begin or end", async () => {
    imodel = await openWritable();

    let beginCount = 0;
    const removeBeginListener = InteractiveEditingSession.onBegin.addListener((_: InteractiveEditingSession) => ++beginCount);

    const session = await InteractiveEditingSession.begin(imodel);
    expect(beginCount).to.equal(1);

    let endingCount = 0;
    let endCount = 0;
    const removeEndingListener = session.onEnding.addListener((_: InteractiveEditingSession) => ++endingCount);
    const removeEndListener = session.onEnded.addListener((_: InteractiveEditingSession) => ++endCount);

    const endPromise = session.end();
    expect(endingCount).to.equal(1);
    expect(endCount).to.equal(0);

    await endPromise;
    expect(endCount).to.equal(1);

    removeBeginListener();
    removeEndListener();
    removeEndingListener();
  });

  it("accumulates geometry changes", async () => {
    imodel = await openWritable();

    // The iModel contains one spatial element - a white rectangle.
    const modelId = "0x17";
    const elemId = "0x27";
    await expect(imodel.models.getProps([ modelId ])).not.to.be.undefined;
    await expect(imodel.elements.getProps([ elemId ])).not.to.be.undefined;

    const session = await InteractiveEditingSession.begin(imodel);
    await IModelWriteRpcInterface.getClient().deleteElements(imodel.getRpcProps(), [ elemId ]);
    expect(session.getGeometryChangesForModel(modelId)).to.be.undefined;
    await IModelWriteRpcInterface.getClient().saveChanges(imodel.getRpcProps(), "delete rectangle");

    // ###TODO: After we switch from polling for native events, we should not need to wait for changed event here...
    await BeDuration.wait(5000);
    const changes = session.getGeometryChangesForModel(modelId)!;
    expect(changes).not.to.be.undefined;

    let change: ElementGeometryChange | undefined;
    for (const entry of changes) {
      expect(change).to.be.undefined;
      change = entry;
    }

    expect(change).not.to.be.undefined;
    expect(change!.id).to.equal(elemId);
    expect(change!.type).to.equal(DbOpcode.Delete);
  });
});
