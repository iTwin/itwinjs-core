/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as path from "path";
import { Guid, isElectronRenderer, OpenMode } from "@bentley/bentleyjs-core";
import { ElectronApp } from "@bentley/electron-manager/lib/ElectronFrontend";
import { ElementProps, IModel } from "@bentley/imodeljs-common";
import { StandaloneConnection } from "@bentley/imodeljs-frontend";

if (isElectronRenderer) { // StandaloneConnection tests only run on electron
  describe("StandaloneConnection", () => {
    before(async () => {
      await ElectronApp.startup();
    });

    after(async () => {
      await ElectronApp.shutdown();
    });

    it("StandaloneConnection properties", async () => {
      const filePath = path.join(process.env.IMODELJS_CORE_DIRNAME!, "core/backend/lib/test/assets/test.bim");
      const connection = await StandaloneConnection.openFile(filePath);

      assert.isTrue(connection.isOpen);
      assert.equal(connection.openMode, OpenMode.ReadWrite);
      assert.isFalse(connection.isClosed);

      assert.isDefined(connection.iModelId);
      assert.isTrue(Guid.isV4Guid(connection.iModelId));

      assert.isTrue(connection.isStandaloneConnection());
      assert.isFalse(connection.isSnapshotConnection());
      assert.isFalse(connection.isBriefcaseConnection());
      assert.isFalse(connection.isBlankConnection());

      assert.isTrue(connection.isStandalone);
      assert.isFalse(connection.isBriefcase);
      assert.isFalse(connection.isSnapshot);
      assert.isFalse(connection.isBlank);

      const elementProps: ElementProps[] = await connection.elements.getProps(IModel.rootSubjectId);
      assert.equal(1, elementProps.length);
      assert.equal(elementProps[0].id, IModel.rootSubjectId);
      await connection.close();

      assert.isFalse(connection.isOpen);
      assert.isTrue(connection.isClosed);

      const readOnlyConnection: StandaloneConnection = await StandaloneConnection.openFile(filePath, OpenMode.Readonly);
      assert.equal(readOnlyConnection.openMode, OpenMode.Readonly);
      await readOnlyConnection.close();
    });
  });
}
