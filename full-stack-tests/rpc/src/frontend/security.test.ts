/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { EmptyLocalization } from "@itwin/core-common";
import { IModelApp } from "@itwin/core-frontend";
import { TestRpcInterface } from "../common/TestRpcInterface";
import { currentEnvironment } from "./testSetup";

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
      localization: new EmptyLocalization(),
    });

    const client = TestRpcInterface.getClient();
    // Playwright 1.64's Chromium no longer accepts cross-origin Set-Cookie with fetch's default credentials,
    // even with --disable-web-security. Seed the frontend cookie directly.
    document.cookie = "XSRF-TOKEN=test; path=/";
    try {
      await client.startCSRFTest();
      await client.csrfTestEnabled();
      await client.stopCSRFTest();
    } finally {
      document.cookie = "XSRF-TOKEN=; path=/; max-age=0";
      await IModelApp.shutdown();
    }
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
    document.cookie = "XSRF-TOKEN=test; path=/";
    try {
      await client.startCSRFTest();
      await client.csrfTestDisabled();
      await client.stopCSRFTest();
    } finally {
      document.cookie = "XSRF-TOKEN=; path=/; max-age=0";
      await IModelApp.shutdown();
    }
  });
});
