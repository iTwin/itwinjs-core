/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect, assert } from "chai";

import { AuthorizationClient } from "./setup/AuthorizationClient";
import { TestContext } from "./setup/TestContext";

import { AccessToken } from "@bentley/imodeljs-clients";
import { OpenMode } from "@bentley/bentleyjs-core";
import { IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { Range3d } from "@bentley/geometry-core";

describe("IModel Read/Write Connection", () => {
  let accessToken: AccessToken;
  let testContext: TestContext;

  before(async function () {
    testContext = await TestContext.instance();

    if (!testContext.settings.runiModelWriteRpcTests)
      this.skip();

    accessToken = testContext.adminUserAccessToken;
    (IModelApp.authorizationClient as AuthorizationClient).setAccessToken(accessToken);
  });

  it("should successfully open an IModelConnection for read/write", async () => {
    const contextId = testContext.settings.writeIModel.projectId;
    const openMode = OpenMode.ReadWrite;
    const iModelId = testContext.settings.writeIModel.id;

    const iModel: IModelConnection = await IModelConnection.open(contextId, iModelId, openMode);

    expect(iModel).to.exist.and.be.not.empty;

    const iModelToken = iModel.iModelToken;
    expect(iModelToken).to.exist.and.be.not.empty;
  });
  it("should successfully close an open read/write IModelConnection", async () => {
    const contextId = testContext.settings.writeIModel.projectId;
    const openMode = OpenMode.ReadWrite;
    const iModelId = testContext.settings.writeIModel.id;
    const iModel: IModelConnection = await IModelConnection.open(contextId, iModelId, openMode);

    expect(iModel).to.exist;
    return expect(iModel.close()).to.eventually.be.fulfilled;
  });

  it("should successfully update the project extents", async () => {
    const contextId = testContext.settings.writeIModel.projectId;
    const iModelId = testContext.settings.writeIModel.id;

    const iModel: IModelConnection = await IModelConnection.open(contextId, iModelId, OpenMode.ReadWrite);

    const originalExtents = iModel.projectExtents;
    const newExtents = Range3d.create(originalExtents.low, originalExtents.high);
    newExtents.low.x -= 50; newExtents.low.y -= 25; newExtents.low.z -= 189;
    newExtents.high.x += 1087; newExtents.high.y += 19; newExtents.high.z += .001;
    await iModel.updateProjectExtents(newExtents);

    await iModel.saveChanges();

    const updatediModel: IModelConnection = await IModelConnection.open(contextId, iModelId, OpenMode.ReadWrite);

    const updatedExtents = Range3d.fromJSON(updatediModel.projectExtents);
    assert.isTrue(newExtents.isAlmostEqual(updatedExtents), "Project extents successfully updated in database");
  });

  it("should successfully save a thumbnail", async () => {
    const contextId = testContext.settings.writeIModel.projectId;
    const iModelId = testContext.settings.writeIModel.id;

    const iModel: IModelConnection = await IModelConnection.open(contextId, iModelId, OpenMode.ReadWrite);

    const viewList = await iModel.views.getViewList({});
    assert.isAtLeast(viewList.length, 1);
    const viewId = viewList[0].id;

    const thumbnail = await iModel.views.getThumbnail(viewId);

    assert.equal(thumbnail.format, "png");
    assert.equal(thumbnail.height, 768);
    assert.equal(thumbnail.width, 768);
    assert.equal(thumbnail.image.length, 19086);
    assert.equal(thumbnail.image[3], 71);
    assert.equal(thumbnail.image[18061], 160);

    thumbnail.format = "png";
    thumbnail.height = 100;
    thumbnail.width = 200;
    thumbnail.image = new Uint8Array(301); // try with odd number of bytes
    thumbnail.image.fill(33);

    await iModel.views.saveThumbnail(viewId, thumbnail);

    const thumbnail2 = await iModel.views.getThumbnail(viewId);
    assert.equal(thumbnail2.format, "png");
    assert.equal(thumbnail2.height, 100);
    assert.equal(thumbnail2.width, 200);
    assert.equal(thumbnail2.image.length, 301);
    assert.equal(thumbnail2.image[3], 33);
  });
});
