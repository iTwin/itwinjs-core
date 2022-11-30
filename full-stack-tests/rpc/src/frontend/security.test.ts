/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { EmptyLocalization } from "@itwin/core-common";
import { IModelApp } from "@itwin/core-frontend";
import { TestRpcInterface } from "../common/TestRpcInterface";
import { currentEnvironment } from "./_Setup.test";

// cspell:ignore csrf

describe("CSRF Protection (Enabled)", () => {
  it("should send requests with token in header", async () => {
    if (currentEnvironment === "websocket") {
      return;
    }

    if (IModelApp.initialized) {
      await IModelApp.shutdown();
    }

    await IModelApp.startup({
      security: { csrfProtection: { enabled: true } },
      localization: new EmptyLocalization()
    });

    const client = TestRpcInterface.getClient();
    await client.startCSRFTest();
    await client.csrfTestEnabled();
    await client.stopCSRFTest();

    await IModelApp.shutdown();
  });
});

describe("CSRF Protection (Disabled)", () => {
  it("should send requests without token in header", async () => {
    if (currentEnvironment === "websocket") {
      return;
    }

    if (IModelApp.initialized) {
      await IModelApp.shutdown();
    }

    await IModelApp.startup({ localization: new EmptyLocalization() });

    const client = TestRpcInterface.getClient();
    await client.startCSRFTest();
    await client.csrfTestDisabled();
    await client.stopCSRFTest();

    await IModelApp.shutdown();
  });
});
