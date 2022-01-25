/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import * as path from "path";
import { Guid, OpenMode, ProcessDetector } from "@itwin/core-bentley";
import { IModel, IModelError } from "@itwin/core-common";
import { BriefcaseConnection } from "@itwin/core-frontend";
import { TestUtility } from "../TestUtility";

if (ProcessDetector.isElectronAppFrontend) { // BriefcaseConnection tests only run on electron
  describe("BriefcaseConnection.openStandalone", () => {
    before(async () => {
      await TestUtility.startFrontend();
    });

    after(async () => {
      await TestUtility.shutdownFrontend();
    });

    it("openStandalone properties", async () => {
      const filePath = path.join(process.env.IMODELJS_CORE_DIRNAME!, "core/backend/lib/cjs/test/assets/test.bim");
      const connection = await BriefcaseConnection.openStandalone(filePath);

      assert.isTrue(connection.isOpen);
      assert.equal(connection.openMode, OpenMode.ReadWrite);
      assert.isFalse(connection.isClosed);
      assert.isDefined(connection.iModelId);
      assert.isTrue(Guid.isV4Guid(connection.iModelId));
      assert.isTrue(connection.isBriefcaseConnection());
      assert.isFalse(connection.isSnapshotConnection());
      assert.isFalse(connection.isBlankConnection());
      assert.isFalse(connection.isCheckpointConnection());

      assert.isTrue(connection.isBriefcase);
      assert.isFalse(connection.isSnapshot);
      assert.isFalse(connection.isBlank);

      assert.equal(connection.iTwinId, Guid.empty, "standalone imodels have empty iTwinId");
      await expect(connection.pushChanges("bad")).to.eventually.be.rejectedWith(IModelError); // standalone imodels can't push changes
      await expect(connection.pullChanges()).to.eventually.be.rejectedWith(IModelError);// standalone imodels can't pull changes

      const elementProps = await connection.elements.getProps(IModel.rootSubjectId);
      assert.equal(1, elementProps.length);
      assert.equal(elementProps[0].id, IModel.rootSubjectId);
      await connection.close();

      assert.isFalse(connection.isOpen);
      assert.isTrue(connection.isClosed);

      const readOnlyConnection = await BriefcaseConnection.openStandalone(filePath, OpenMode.Readonly);
      assert.equal(readOnlyConnection.openMode, OpenMode.Readonly);
      await readOnlyConnection.close();
    });
  });
}
