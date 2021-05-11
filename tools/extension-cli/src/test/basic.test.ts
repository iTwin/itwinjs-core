/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
const assert = chai.assert;

import { IModelHost } from "@bentley/imodeljs-backend";
import { signIn } from "../helpers";
import { ElectronAuthorizationBackend } from "@bentley/electron-manager/lib/ElectronBackend";

describe.skip("ExtensionClient CLI (#integration)", () => {
  it("gets token", async () => {
    await IModelHost.startup();

    // Initialize an DesktopAuthorizationClient to delete refresh token from global store, then dispose it.
    const client = new ElectronAuthorizationBackend();
    await client.initialize({
      clientId: "imodeljs-extension-publisher",
      redirectUri: "",
      scope: "",
    });
    await (client as any)._tokenStore.delete();

    const token = await signIn();
    assert.exists(token);
    await IModelHost.shutdown();
  });
});
