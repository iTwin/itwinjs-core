/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as path from "path";
import { OpenMode } from "@bentley/bentleyjs-core";
import { ElectronRpcConfiguration, IModelError, IModelStatus } from "@bentley/imodeljs-common";
import { IModelApp, InteractiveEditingSession, StandaloneConnection } from "@bentley/imodeljs-frontend";

if (ElectronRpcConfiguration.isElectron) {
  describe.only("InteractiveEditingSession", () => {
    let imodel: StandaloneConnection | undefined;
    const oldFilePath = path.join(process.env.IMODELJS_CORE_DIRNAME!, "core/backend/lib/test/assets/test.bim");
    const newFilePath = path.join(process.env.IMODELJS_CORE_DIRNAME!, "core/backend/lib/test/assets/planprojection.bim");

    async function closeIModel(): Promise<void> {
      if (imodel) {
        await imodel.close();
        imodel = undefined;
      }
    }

    before(async () => {
      await IModelApp.startup();
    });

    after(async () => {
      await closeIModel();
      await IModelApp.shutdown();
    });

    afterEach(async () => {
      await closeIModel();
    });

    async function expectIModelError(expected: IModelStatus, func: () => Promise<void>): Promise<void> {
      let actual: IModelStatus | undefined;
      try {
        await func();
      } catch (e) {
        expect(e instanceof IModelError).to.be.true
        actual = (e as IModelError).errorNumber;
      }

      expect(actual).not.to.be.undefined;
      expect(actual).to.equal(expected);
    }

    it("should not be supported for read-only connections", async () => {
      imodel = await StandaloneConnection.openFile(oldFilePath, OpenMode.Readonly);
      expect(imodel.openMode).to.equal(OpenMode.Readonly);
      expect(await InteractiveEditingSession.isSupported(imodel)).to.be.false;
      expectIModelError(IModelStatus.ReadOnly, async () => { await InteractiveEditingSession.begin(imodel!); });
    });

    it("should not be supported for iModels with BisCore < 1.0.11", async () => {
      imodel = await StandaloneConnection.openFile(oldFilePath);
      expect(imodel.openMode).to.equal(OpenMode.ReadWrite);
      expect(await InteractiveEditingSession.isSupported(imodel)).to.be.false;
      expectIModelError(IModelStatus.VersionTooOld, async () => { await InteractiveEditingSession.begin(imodel!); });
    });

    it("should not be supported for read-only iModels with BisCore >= 1.0.11", async () => {
      imodel = await StandaloneConnection.openFile(newFilePath, OpenMode.Readonly);
      expect(imodel.openMode).to.equal(OpenMode.Readonly);
      expect(await InteractiveEditingSession.isSupported(imodel)).to.be.false;
      expectIModelError(IModelStatus.ReadOnly, async () => { await InteractiveEditingSession.begin(imodel!); });
    });

    it("should be supported for writable iModels with BisCore >= 1.0.11", async () => {
      imodel = await StandaloneConnection.openFile(newFilePath, OpenMode.ReadWrite);
      expect(imodel.openMode).to.equal(OpenMode.ReadWrite);
      expect(await InteractiveEditingSession.isSupported(imodel)).to.be.true;
      const session = await InteractiveEditingSession.begin(imodel);
      await session.end();
    });
  });
}
