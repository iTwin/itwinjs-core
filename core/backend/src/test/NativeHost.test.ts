/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import { Guid } from "@itwin/core-bentley";
import { IModelHost } from "../IModelHost";
import { IModelJsFs } from "../IModelJsFs";
import { NativeHost } from "../NativeHost";
import { setOnlineStatus } from "../internal/OnlineStatus";
import { TestUtils } from "./TestUtils";

describe("NativeHost", () => {
  const opts = { cacheDir: TestUtils.getCacheDir() };

  beforeEach(async () => {
    await NativeHost.shutdown();
    await TestUtils.shutdownBackend();
    setOnlineStatus(true);

    await IModelHost.startup(opts);
    IModelJsFs.purgeDirSync(NativeHost.appSettingsCacheDir);
    await NativeHost.startup({ nativeHost: { applicationName: "NativeHostTest" } });
  });

  afterEach(async () => {
    setOnlineStatus(true);
    sinon.restore();
    await NativeHost.shutdown();
    await TestUtils.shutdownBackend();
  });

  after(async () => {
    await TestUtils.startBackend(); // restart normal backend so subsequent test suites aren't left without IModelHost
  });

  it("uses cached container props when offline", async () => {
    const iTwinId = Guid.createValue();
    const containerProps = {
      accessToken: "",
      baseUri: "",
      containerId: "itwin-settings-a",
      storageType: "azure",
    } as any;
    const onlineWorkspace = { containerProps } as any;
    const offlineWorkspace = {} as any;
    const getITwinWorkspace = sinon.stub(IModelHost, "getITwinWorkspace");
    getITwinWorkspace.onFirstCall().resolves(onlineWorkspace);
    getITwinWorkspace.onSecondCall().resolves(offlineWorkspace);

    const firstWorkspace = await NativeHost.getITwinWorkspace(iTwinId);
    expect(firstWorkspace).to.equal(onlineWorkspace);
    expect(getITwinWorkspace.firstCall.args[0]).to.equal(iTwinId);

    setOnlineStatus(false);
    const secondWorkspace = await NativeHost.getITwinWorkspace(iTwinId);

    expect(secondWorkspace).to.equal(offlineWorkspace);
    expect(getITwinWorkspace.calledTwice).to.be.true;
    expect(getITwinWorkspace.secondCall.args[0]).to.deep.equal(containerProps);
  });

  it("throws when offline and no cached container props exist", async () => {
    setOnlineStatus(false);

    await expect(NativeHost.getITwinWorkspace(Guid.createValue())).to.be.rejectedWith("No cached container props for iTwin");
  });
});