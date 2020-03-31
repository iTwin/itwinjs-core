/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Guid } from "@bentley/bentleyjs-core";
import { ElementProps, IModel } from "@bentley/imodeljs-common";
import { IModelApp, SnapshotConnection } from "@bentley/imodeljs-frontend";
import { assert } from "chai";

describe("SnapshotConnection", () => {
  before(async () => {
    IModelApp.startup();
  });

  after(async () => {
    IModelApp.shutdown();
  });

  it("SnapshotConnection properties", async () => {
    const snapshotConnection1: SnapshotConnection = await SnapshotConnection.openFile("test.bim"); // relative path resolved by BackendTestAssetResolver
    const snapshotConnection2: SnapshotConnection = await SnapshotConnection.openRemote("test2-key"); // file key resolved by BackendTestAssetResolver
    assert.isTrue(snapshotConnection1.isOpen);
    assert.isTrue(snapshotConnection2.isOpen);
    assert.isFalse(snapshotConnection1.isClosed);
    assert.isFalse(snapshotConnection2.isClosed);
    assert.isDefined(snapshotConnection1.iModelId);
    assert.isDefined(snapshotConnection2.iModelId);
    assert.isTrue(Guid.isV4Guid(snapshotConnection1.iModelId));
    assert.isTrue(Guid.isV4Guid(snapshotConnection2.iModelId));
    assert.isTrue(snapshotConnection1.isSnapshot);
    assert.isTrue(snapshotConnection2.isSnapshot);
    assert.isTrue(snapshotConnection1.isSnapshotConnection());
    assert.isTrue(snapshotConnection2.isSnapshotConnection());
    const elementProps1: ElementProps[] = await snapshotConnection1.elements.getProps(IModel.rootSubjectId);
    const elementProps2: ElementProps[] = await snapshotConnection2.elements.getProps(IModel.rootSubjectId);
    assert.equal(1, elementProps1.length);
    assert.equal(1, elementProps2.length);
    assert.equal(elementProps1[0].id, IModel.rootSubjectId);
    assert.equal(elementProps2[0].id, IModel.rootSubjectId);
    await snapshotConnection1.close();
    await snapshotConnection2.close();
    assert.isFalse(snapshotConnection1.isOpen);
    assert.isFalse(snapshotConnection2.isOpen);
    assert.isTrue(snapshotConnection1.isClosed);
    assert.isTrue(snapshotConnection2.isClosed);
  });
});
