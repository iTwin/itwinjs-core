/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import { CloudSqlite } from "../../CloudSqlite";
import { BlobContainer } from "../../BlobContainerService";
import { setOnlineStatus } from "../../internal/OnlineStatus";

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

  it("returns empty token when BlobContainer.service.requestToken rejects", async () => {
    setOnlineStatus(true);
    BlobContainer.service = {
      requestToken: sinon.stub().rejects(new Error("getaddrinfo ENOTFOUND api.bentley.com")),
    } as any;

    const token = await CloudSqlite.requestToken(args);

    expect(token).to.equal("");
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
