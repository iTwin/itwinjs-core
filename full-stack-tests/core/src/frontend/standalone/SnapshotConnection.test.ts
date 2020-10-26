/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Guid } from "@bentley/bentleyjs-core";
import { ElementProps, IModel } from "@bentley/imodeljs-common";
import { IModelApp, SnapshotConnection } from "@bentley/imodeljs-frontend";

// ###TODO: snapshotR1 and snapshotF1 have same filekey (and iModelId - shapshotR2 also has same iModelId for some reason)
// Causese exception in RpcPushChannel when we try to create two EventSources with same id.
describe("SnapshotConnection", () => {
  before(async () => {
    await IModelApp.startup();
  });

  after(async () => {
    await IModelApp.shutdown();
  });

  it("SnapshotConnection properties", async () => {
    const snapshotR1: SnapshotConnection = await SnapshotConnection.openRemote("test-key"); // file key resolved by BackendTestAssetResolver
    const snapshotR2: SnapshotConnection = await SnapshotConnection.openRemote("test2-key"); // file key resolved by BackendTestAssetResolver
    const snapshotF1: SnapshotConnection = await SnapshotConnection.openFile("test.bim"); // relative path resolved by BackendTestAssetResolver

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

    assert.isFalse(snapshotR1.isLocalBriefcaseConnection());
    assert.isFalse(snapshotR2.isLocalBriefcaseConnection());
    assert.isFalse(snapshotF1.isLocalBriefcaseConnection());

    assert.isFalse(snapshotR1.isRemoteBriefcaseConnection());
    assert.isFalse(snapshotR2.isRemoteBriefcaseConnection());
    assert.isFalse(snapshotF1.isRemoteBriefcaseConnection());

    const elementPropsR1: ElementProps[] = await snapshotR1.elements.getProps(IModel.rootSubjectId);
    assert.equal(1, elementPropsR1.length);
    assert.equal(elementPropsR1[0].id, IModel.rootSubjectId);
    await snapshotR1.close(); // R1 is the same backend iModel as F1, but close should not affect F1

    const elementPropsR2: ElementProps[] = await snapshotR2.elements.getProps(IModel.rootSubjectId);
    assert.equal(1, elementPropsR2.length);
    assert.equal(elementPropsR2[0].id, IModel.rootSubjectId);
    await snapshotR2.close();

    const elementPropsF1: ElementProps[] = await snapshotF1.elements.getProps(IModel.rootSubjectId);
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
