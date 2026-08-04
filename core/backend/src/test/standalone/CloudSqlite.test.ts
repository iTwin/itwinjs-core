/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import { NativeLibrary } from "@bentley/imodeljs-native";
import { CloudSqlite } from "../../CloudSqlite";
import { BlobContainer } from "../../BlobContainerService";
import { setOnlineStatus } from "../../internal/OnlineStatus";

class FakeNativeCloudContainer {
  public accessToken = "";
  public constructor(_args: CloudSqlite.ContainerAccessProps) { }
}

type TestCloudContainer = CloudSqlite.CloudContainer & {
  timer?: NodeJS.Timeout;
  refreshPromise?: Promise<void>;
};

describe("CloudSqlite.requestToken", () => {
  // Supply userToken directly so IModelHost.getAccessToken is never called
  const args: CloudSqlite.RequestTokenArgs = {
    containerId: "test-container",
    accessLevel: "read",
    userToken: "test-user-token",
  };

  let originalService: BlobContainer.ContainerService | undefined;

  beforeEach(() => {
    originalService = BlobContainer.service;
  });

  afterEach(() => {
    BlobContainer.service = originalService;
    sinon.restore();
    setOnlineStatus(true);
  });

  it("returns empty token and does not call BlobContainer.service when offline", async () => {
    setOnlineStatus(false);
    const requestTokenStub = sinon.stub().rejects(new Error("should not be called"));
    BlobContainer.service = { requestToken: requestTokenStub } as any;

    const token = await CloudSqlite.requestToken(args);

    expect(token).to.equal("");
    expect(requestTokenStub.called).to.be.false;
  });

  it("returns the token from BlobContainer.service when online and request succeeds", async () => {
    setOnlineStatus(true);
    BlobContainer.service = {
      requestToken: sinon.stub().resolves({ token: "my-sas-token" }),
    } as any;

    const token = await CloudSqlite.requestToken(args);

    expect(token).to.equal("my-sas-token");
  });
});

describe("CloudSqlite.createCloudContainer token-refresh scheduling", () => {
  afterEach(() => sinon.restore());

  it("does not reschedule the refresh timer if the container is disconnected while a refresh is in flight", async () => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const fakeNativeLib = { CloudContainer: FakeNativeCloudContainer };
    sinon.stub(NativeLibrary, "nativeLib").get(() => fakeNativeLib);

    let resolveTokenFn: (token: string) => void = () => { };
    const deferredToken = new Promise<string>((resolve) => { resolveTokenFn = resolve; });

    const container = CloudSqlite.createCloudContainer({
      containerId: "test-container",
      baseUri: "https://example.invalid",
      storageType: "azure",
      accessToken: "",
      tokenRefreshSeconds: 0.01,
      tokenFn: async () => deferredToken,
    }) as TestCloudContainer;

    container.onConnected?.(container);

    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(container.refreshPromise, "doRefresh should be in flight").to.not.be.undefined;

    container.onDisconnect?.(container, false);
    expect(container.timer, "timer should be cleared on disconnect").to.be.undefined;

    resolveTokenFn("late-token");
    await deferredToken;
    // flush the microtask queue so the rest of the refresh callback (including the reschedule check) runs
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(container.timer, "a disconnected container must not have its refresh timer rescheduled").to.be.undefined;
  });
});
