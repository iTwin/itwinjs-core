/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "vitest";
import * as path from "path";
import { Guid, OpenMode, ProcessDetector } from "@itwin/core-bentley";
import { IModel, IModelError } from "@itwin/core-common";
import { BriefcaseConnection } from "@itwin/core-frontend";
import { TestUtility } from "../TestUtility";

if (ProcessDetector.isElectronAppFrontend) { // BriefcaseConnection tests only run on electron
  describe("BriefcaseConnection.openStandalone", () => {
    beforeAll(async () => {
      await TestUtility.startFrontend();
    });

    afterAll(async () => {
      await TestUtility.shutdownFrontend();
    });

    it("openStandalone properties", async () => {
      const filePath = path.join(process.env.IMODELJS_CORE_DIRNAME!, "core/backend/lib/cjs/test/assets/test.bim");
      const connection = await BriefcaseConnection.openStandalone(filePath);

      expect(connection.isOpen).toBe(true);
      expect(connection.openMode).toBe(OpenMode.ReadWrite);
      expect(connection.isClosed).toBe(false);
      expect(connection.iModelId).toBeDefined();
      expect(Guid.isV4Guid(connection.iModelId)).toBe(true);
      expect(connection.isBriefcaseConnection()).toBe(true);
      expect(connection.isSnapshotConnection()).toBe(false);
      expect(connection.isBlankConnection()).toBe(false);
      expect(connection.isCheckpointConnection()).toBe(false);

      expect(connection.isBriefcase).toBe(true);
      expect(connection.isSnapshot).toBe(false);
      expect(connection.isBlank).toBe(false);

      expect(connection.iTwinId, "standalone imodels have empty iTwinId").toBe(Guid.empty);
      await expect(connection.pushChanges("bad")).rejects.toThrow(IModelError); // standalone imodels can't push changes
      await expect(connection.pullChanges()).rejects.toThrow(IModelError);// standalone imodels can't pull changes

      const elementProps = await connection.elements.getProps(IModel.rootSubjectId);
      expect(1).toBe(elementProps.length);
      expect(elementProps[0].id).toBe(IModel.rootSubjectId);
      await connection.close();

      expect(connection.isOpen).toBe(false);
      expect(connection.isClosed).toBe(true);

      const readOnlyConnection = await BriefcaseConnection.openStandalone(filePath, OpenMode.Readonly);
      expect(readOnlyConnection.openMode).toBe(OpenMode.Readonly);
      await readOnlyConnection.close();
    });
  });
}
