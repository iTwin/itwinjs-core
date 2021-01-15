/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
const expect = chai.expect;
import * as path from "path";
import * as chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
import { isElectronRenderer, OpenMode } from "@bentley/bentleyjs-core";
import { IModelError } from "@bentley/imodeljs-common";
import { IModelApp, InteractiveEditingSession, StandaloneConnection } from "@bentley/imodeljs-frontend";

if (isElectronRenderer) {
  describe("InteractiveEditingSession", () => {
    let imodel: StandaloneConnection | undefined;
    // Editable; BisCore version < 1.0.11
    const oldFilePath = path.join(process.env.IMODELJS_CORE_DIRNAME!, "core/backend/lib/test/assets/test.bim");
    // Editable; BisCore version == 1.0.11
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

    it("should not be supported for read-only connections", async () => {
      imodel = await StandaloneConnection.openFile(oldFilePath, OpenMode.Readonly);
      expect(imodel.openMode).to.equal(OpenMode.Readonly);
      expect(await InteractiveEditingSession.isSupported(imodel)).to.be.false;
      await expect(InteractiveEditingSession.begin(imodel)).to.be.rejectedWith(IModelError);
    });

    it("should not be supported for iModels with BisCore < 1.0.11", async () => {
      imodel = await StandaloneConnection.openFile(oldFilePath);
      expect(imodel.openMode).to.equal(OpenMode.ReadWrite);
      expect(await InteractiveEditingSession.isSupported(imodel)).to.be.false;
      await expect(InteractiveEditingSession.begin(imodel)).to.be.rejectedWith(IModelError);
    });

    it("should not be supported for read-only iModels with BisCore >= 1.0.11", async () => {
      imodel = await StandaloneConnection.openFile(newFilePath, OpenMode.Readonly);
      expect(imodel.openMode).to.equal(OpenMode.Readonly);
      expect(await InteractiveEditingSession.isSupported(imodel)).to.be.false;
      await expect(InteractiveEditingSession.begin(imodel)).to.be.rejectedWith(IModelError);
    });

    it("should be supported for writable iModels with BisCore >= 1.0.11", async () => {
      imodel = await StandaloneConnection.openFile(newFilePath, OpenMode.ReadWrite);
      expect(imodel.openMode).to.equal(OpenMode.ReadWrite);
      expect(await InteractiveEditingSession.isSupported(imodel)).to.be.true;
      const session = await InteractiveEditingSession.begin(imodel);
      await session.end();
    });

    async function openWritable(): Promise<StandaloneConnection> {
      expect(imodel).to.be.undefined;
      return StandaloneConnection.openFile(newFilePath, OpenMode.ReadWrite);
    }

    it("throws if begin is called repeatedly", async () => {
      imodel = await openWritable();
      const session = await InteractiveEditingSession.begin(imodel);
      await expect(InteractiveEditingSession.begin(imodel)).to.be.rejectedWith("Cannot create an editing session for an iModel that already has one");
      await session.end();
    });

    it("throws if end is called repeatedly", async () => {
      imodel = await openWritable();
      const session = await InteractiveEditingSession.begin(imodel);
      await session.end();
      await expect(session.end()).to.be.rejectedWith("Cannot end editing session after it is disconnected from the iModel");
    });

    it("throws if the iModel is closed before ending the session", async () => {
      imodel = await openWritable();
      const session = await InteractiveEditingSession.begin(imodel);
      await expect(imodel.close()).to.be.rejectedWith("InteractiveEditingSession must be ended before closing the associated iModel");
      await session.end();
    });

    it("dispatches events when sessions begin or end", async () => {
      imodel = await openWritable();

      let beginCount = 0;
      const removeBeginListener = InteractiveEditingSession.onBegin.addListener((_: InteractiveEditingSession) => ++beginCount);

      const session = await InteractiveEditingSession.begin(imodel);
      expect(beginCount).to.equal(1);

      let endingCount = 0;
      let endCount = 0;
      const removeEndingListener = session.onEnding.addListener((_: InteractiveEditingSession) => ++endingCount);
      const removeEndListener = session.onEnded.addListener((_: InteractiveEditingSession) => ++endCount);

      const endPromise = session.end();
      expect(endingCount).to.equal(1);
      expect(endCount).to.equal(0);

      await endPromise;
      expect(endCount).to.equal(1);

      removeBeginListener();
      removeEndListener();
      removeEndingListener();
    });
  });
}
