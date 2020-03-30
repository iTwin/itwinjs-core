/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Guid } from "@bentley/bentleyjs-core";
import { ElementProps, IModel } from "@bentley/imodeljs-common";
import { IModelApp, SnapshotConnection } from "@bentley/imodeljs-frontend";
import { assert } from "chai";
import * as path from "path";

describe("SnapshotConnection", () => {
  before(async () => {
    IModelApp.startup();
  });

  after(async () => {
    IModelApp.shutdown();
  });

  it("SnapshotConnection properties", async () => {
    const snapshotFileName = path.join(process.env.IMODELJS_CORE_DIRNAME!, "core/backend/lib/test/assets/test.bim");
    const snapshotConnection: SnapshotConnection = await SnapshotConnection.openFile(snapshotFileName);
    assert.isTrue(snapshotConnection.isOpen);
    assert.isFalse(snapshotConnection.isClosed);
    assert.isDefined(snapshotConnection.iModelId);
    assert.isTrue(Guid.isV4Guid(snapshotConnection.iModelId));
    assert.isTrue(snapshotConnection.isSnapshot);
    assert.isTrue(snapshotConnection.isSnapshotConnection());
    const elementProps: ElementProps[] = await snapshotConnection.elements.getProps(IModel.rootSubjectId);
    assert.equal(1, elementProps.length);
    assert.equal(elementProps[0].id, IModel.rootSubjectId);
    await snapshotConnection.close();
    assert.isFalse(snapshotConnection.isOpen);
    assert.isTrue(snapshotConnection.isClosed);
  });
});
