/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import { Logger } from "@itwin/core-bentley";
import { CloudSqlite, GcsDbProps, GeoCoordConfig, IModelHost } from "../../core-backend";
import { IModelNative } from "../../internal/NativePlatform";
import { TestUtils } from "../TestUtils";

describe("GeoCoordConfig", () => {
  const dbProps: GcsDbProps = { baseUri: "", storageType: "azure", containerId: "gcs-retry-test", dbName: "vertical", prefetch: true };
  const sandbox = sinon.createSandbox();
  let getContainer: sinon.SinonStub;
  let getArray: sinon.SinonStub;
  let getBoolean: sinon.SinonStub;
  let queryDatabase: sinon.SinonStub;
  let addWorkspace: sinon.SinonStub;
  let prefetch: sinon.SinonStub;
  let logError: sinon.SinonStub;
  let connected: boolean;

  beforeEach(() => {
    GeoCoordConfig.onStartup();
    const workspace = IModelHost.appWorkspace;
    const container = workspace.getContainer({ ...dbProps, accessToken: "" });
    connected = true;
    queryDatabase = sandbox.stub().returns({ totalBlocks: 10, localBlocks: 0 });
    sandbox.stub(container, "cloudContainer").get(() => ({ isConnected: connected, queryDatabase }));
    sandbox.stub(container, "resolveDbFileName").callsFake((props) => `${props.dbName}:1.0.0`);
    getContainer = sandbox.stub(workspace, "getContainer").returns(container);
    getArray = sandbox.stub(workspace.settings, "getArray").returns([dbProps]);
    getBoolean = sandbox.stub(workspace.settings, "getBoolean").returns(false);
    addWorkspace = sandbox.stub().returns(true);
    const nativePlatform = { ...IModelNative.platform, addGcsWorkspaceDb: addWorkspace };
    sandbox.stub(IModelNative, "platform").get(() => nativePlatform);
    prefetch = sandbox.stub(CloudSqlite, "startCloudPrefetch").callsFake((cloudContainer, dbName) => ({
      cloudContainer, dbName, promise: Promise.resolve(true), cancel: () => undefined,
    }));
    logError = sandbox.stub(Logger, "logError");
  });

  afterEach(() => {
    sandbox.restore();
    GeoCoordConfig.onStartup();
    TestUtils.disableGcsWorkspaces();
  });

  function expectRetryToSucceed() {
    GeoCoordConfig.loadDefaultDatabases();
    expect(getContainer.callCount).to.equal(2);
    expect(prefetch.callCount).to.equal(1);
    expect(GeoCoordConfig.prefetches).to.have.lengthOf(1);
    GeoCoordConfig.loadDefaultDatabases();
    expect(getContainer.callCount).to.equal(2);
  }

  it("retries after a container load throws", () => {
    getContainer.onFirstCall().throws(new Error("temporary container failure"));
    GeoCoordConfig.loadDefaultDatabases();
    expect(logError.calledOnce).to.be.true;
    expect(addWorkspace.called).to.be.false;
    expectRetryToSucceed();
  });

  it("retries after a disconnected container", () => {
    connected = false;
    GeoCoordConfig.loadDefaultDatabases();
    expect(logError.calledOnce).to.be.true;
    expect(addWorkspace.called).to.be.false;
    connected = true;
    expectRetryToSucceed();
  });

  it("retries after a missing database", () => {
    queryDatabase.onFirstCall().returns(undefined);
    GeoCoordConfig.loadDefaultDatabases();
    expect(logError.calledOnce).to.be.true;
    expect(addWorkspace.called).to.be.false;
    expectRetryToSucceed();
  });

  it("attempts every database and accepts already registered databases on retry", () => {
    getArray.returns([dbProps, { ...dbProps, dbName: "horizontal" }]);
    queryDatabase.onFirstCall().returns(undefined);
    addWorkspace.onSecondCall().returns(true);
    addWorkspace.onThirdCall().returns(false);
    GeoCoordConfig.loadDefaultDatabases();
    expect(getContainer.callCount).to.equal(2);
    expect(addWorkspace.calledOnceWithExactly("horizontal:1.0.0", sinon.match.object, undefined)).to.be.true;
    expect(logError.calledOnce).to.be.true;
    GeoCoordConfig.loadDefaultDatabases();
    expect(getContainer.callCount).to.equal(4);
    expect(addWorkspace.callCount).to.equal(3);
    expect(prefetch.callCount).to.equal(2);
    expect(GeoCoordConfig.prefetches).to.have.lengthOf(2);
    GeoCoordConfig.loadDefaultDatabases();
    expect(getContainer.callCount).to.equal(4);
  });

  it("loads defaults after workspaces are re-enabled", () => {
    getBoolean.returns(true);
    GeoCoordConfig.loadDefaultDatabases();
    expect(getContainer.called).to.be.false;
    getBoolean.returns(false);
    GeoCoordConfig.loadDefaultDatabases();
    expect(addWorkspace.calledOnce).to.be.true;
    GeoCoordConfig.loadDefaultDatabases();
    expect(addWorkspace.calledOnce).to.be.true;
  });
});
