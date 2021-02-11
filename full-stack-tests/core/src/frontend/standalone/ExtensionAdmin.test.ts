/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert } from "chai";
import { ExternalServerExtensionLoader, IModelApp } from "@bentley/imodeljs-frontend";
import { ProcessDetector } from "@bentley/bentleyjs-core";

describe("ExtensionAdmin tests", () => {
  before(async () => IModelApp.startup());
  after(async () => IModelApp.shutdown());

  if (!ProcessDetector.isElectronAppFrontend) {
    it("loads local extension", async () => {
      IModelApp.extensionAdmin.addExtensionLoaderFront(new ExternalServerExtensionLoader(`http://localhost:${Number(window.location.port) + 4000}`));

      await IModelApp.extensionAdmin.loadExtension("loadingTestExtension");

      await new Promise<void>((resolve, reject) => {
        IModelApp.extensionAdmin.onExtensionLoaded.addListener((extName) => {
          if (extName === "loadingTestExtension")
            resolve();
        });
        // Add a timeout so that the test doesn't hang indefinitely.
        setTimeout(reject, 10000);
      }).catch(() => assert.fail("Failed to load extension"));

      assert.isOk((IModelApp as any).extensionLoaded, "onLoad was not called");
      assert.isOk((IModelApp as any).extensionExecuted, "onExecute was not called");
      assert.isBelow((IModelApp as any).extensionLoaded, (IModelApp as any).extensionExecuted, "onExecute was called before onLoad");
    });
  }
});
