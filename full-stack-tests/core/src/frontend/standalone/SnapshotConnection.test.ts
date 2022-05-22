/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Guid } from "@itwin/core-bentley";
import { IModel } from "@itwin/core-common";
import { SnapshotConnection } from "@itwin/core-frontend";
import { TestUtility } from "../TestUtility";

describe("SnapshotConnection", () => {
  before(async () => {
    await TestUtility.startFrontend();
  });

  after(async () => {
    await TestUtility.shutdownFrontend();
  });

  it("SnapshotConnection properties", async () => {
    const snapshotR1 = await SnapshotConnection.openRemote("test-key"); // file key resolved by BackendTestAssetResolver
    const snapshotR2 = await SnapshotConnection.openRemote("test2-key"); // file key resolved by BackendTestAssetResolver
    const snapshotF1 = await SnapshotConnection.openFile("test.bim"); // relative path resolved by BackendTestAssetResolver

    assert.notEqual(snapshotR1.key, snapshotF1.key);
    assert.isTrue(snapshotR1.isRemote);
    assert.isTrue(snapshotR2.isRemote);
    assert.isFalse(snapshotF1.isRemote);

    assert.isTrue(snapshotR1.isOpen);
    assert.isTrue(snapshotR2.isOpen);
    assert.isTrue(snapshotF1.isOpen);

    assert.isFalse(snapshotR1.isClosed);
    assert.isFalse(snapshotR2.isClosed);
    assert.isFalse(snapshotF1.isClosed);

    assert.isDefined(snapshotR1.iModelId);
    assert.isDefined(snapshotR2.iModelId);
    assert.isDefined(snapshotF1.iModelId);

    assert.isTrue(Guid.isV4Guid(snapshotR1.iModelId));
    assert.isTrue(Guid.isV4Guid(snapshotR2.iModelId));
    assert.isTrue(Guid.isV4Guid(snapshotF1.iModelId));

    assert.isTrue(snapshotR1.isSnapshot);
    assert.isTrue(snapshotR2.isSnapshot);
    assert.isTrue(snapshotF1.isSnapshot);

    assert.isTrue(snapshotR1.isSnapshotConnection());
    assert.isTrue(snapshotR2.isSnapshotConnection());
    assert.isTrue(snapshotF1.isSnapshotConnection());

    assert.isFalse(snapshotR1.isBriefcase);
    assert.isFalse(snapshotR2.isBriefcase);
    assert.isFalse(snapshotF1.isBriefcase);

    assert.isFalse(snapshotR1.isCheckpointConnection());
    assert.isFalse(snapshotR2.isCheckpointConnection());
    assert.isFalse(snapshotF1.isCheckpointConnection());

    const elementPropsR1 = await snapshotR1.elements.getProps(IModel.rootSubjectId);
    assert.equal(1, elementPropsR1.length);
    assert.equal(elementPropsR1[0].id, IModel.rootSubjectId);
    await snapshotR1.close(); // R1 is the same backend iModel as F1, but close should not affect F1

    const elementPropsR2 = await snapshotR2.elements.getProps(IModel.rootSubjectId);
    assert.equal(1, elementPropsR2.length);
    assert.equal(elementPropsR2[0].id, IModel.rootSubjectId);
    await snapshotR2.close();

    const elementPropsF1 = await snapshotF1.elements.getProps(IModel.rootSubjectId);
    assert.equal(1, elementPropsF1.length, "R1 close should not have affected F1");
    assert.equal(elementPropsF1[0].id, IModel.rootSubjectId, "R1 close should not have affected F1");
    await snapshotF1.close();

    assert.isFalse(snapshotR1.isOpen);
    assert.isFalse(snapshotR2.isOpen);
    assert.isFalse(snapshotF1.isOpen);

    assert.isTrue(snapshotR1.isClosed);
    assert.isTrue(snapshotR2.isClosed);
    assert.isTrue(snapshotF1.isClosed);
  });
});
