/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
const assert = chai.assert;

import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { OidcDesktopClient, IModelHost } from "@bentley/imodeljs-backend";
import { signIn } from "../signIn";

describe.skip("ExtensionClient CLI (#integration)", () => {
  it("gets token", async () => {
    IModelHost.startup();

    // Initialize an OidcDesktopClient to delete refresh token from global store, then dispose it.
    const requestContext = new ClientRequestContext();
    const client = new OidcDesktopClient({
      clientId: "imodeljs-extension-publisher",
      redirectUri: "",
      scope: "",
    });
    await client.initialize(requestContext);
    await (client as any)._tokenStore.delete();
    client.dispose();

    const token = await signIn();
    assert.exists(token);
    IModelHost.shutdown();
  });
});
