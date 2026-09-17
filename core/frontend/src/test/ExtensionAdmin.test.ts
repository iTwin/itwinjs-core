/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ExtensionManifest, ExtensionProvider, RemoteExtensionProvider } from "../core-frontend";
import { ExtensionAdmin } from "../extension/ExtensionAdmin";

describe("ExtensionAdmin", () => {
  const extensions = [
    new RemoteExtensionProvider({
      jsUrl: "http://localhost:3000/index.js",
      manifestUrl: "http://localhost:3000/package.json",
    }),
    new RemoteExtensionProvider({
      jsUrl: "https://somedomain:3001/index.js",
      manifestUrl: "https://somedomain:3001/package.json",
    }),
    new RemoteExtensionProvider({
      jsUrl: "https://anotherdomain.com/index.js",
      manifestUrl: "https://anotherdomain.com/package.json",
    }),
  ];
  const stubManifest: Promise<ExtensionManifest> = new Promise((res) => res({
    name: "mock-extension",
    version: "1.0.0",
    main: "index.js",
    activationEvents: [],
  }));

  beforeAll(async () => {
    vi.spyOn(RemoteExtensionProvider.prototype, "getManifest").mockReturnValue(stubManifest);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
  });

  it("ExtensionAdmin can register a url", async () => {
    const extensionAdmin = new ExtensionAdmin();
    extensionAdmin.registerHost(extensions[0].hostname);
    extensionAdmin.registerHost("https://somedomain:3001");
    extensionAdmin.registerHost("https://anotherdomain.com/dist/index.js");
    for (const extension of extensions) {
      await expect(extensionAdmin.addExtension(extension)).resolves.toBeUndefined();
    }
  });

  it("ExtensionAdmin can register a hostname", async () => {
    const extensionAdmin = new ExtensionAdmin();
    extensionAdmin.registerHost(extensions[0].hostname);
    extensionAdmin.registerHost("www.somedomain");
    extensionAdmin.registerHost("anotherdomain.com");

    for (const extension of extensions) {
      await expect(extensionAdmin.addExtension(extension)).resolves.toBeUndefined();
    }
  });

  it("ExtensionAdmin will fail if remote extension hostname was not registered", async () => {
    const extensionAdmin = new ExtensionAdmin();
    extensionAdmin.registerHost("aDifferentHostname");
    for (const extension of extensions) {
      await expect(extensionAdmin.addExtension(extension)).rejects.toThrow(/not registered/);
    }
  });

  it("ExtensionAdmin will reject invalid URLs or hostnames", () => {
    const extensionAdmin = new ExtensionAdmin();
    expect(() => extensionAdmin.registerHost("3001:invalidUrl")).toThrow(/not a valid URL or hostname/);
    expect(() => extensionAdmin.registerHost("invalidUrl342!@#")).toThrow(/not a valid URL or hostname/);
    expect(() => extensionAdmin.registerHost("file:///extension.js")).toThrow(/not a valid URL or hostname/);
  });

  it("ExtensionAdmin treats a www. subdomain of a registered host as the same host", async () => {
    const extensionAdmin = new ExtensionAdmin();
    extensionAdmin.registerHost("example.com");

    const extension = new RemoteExtensionProvider({
      jsUrl: "https://www.example.com/index.js",
      manifestUrl: "https://www.example.com/package.json",
    });
    await expect(extensionAdmin.addExtension(extension)).resolves.toBeUndefined();

    const withoutWww = new ExtensionAdmin();
    withoutWww.registerHost("https://www.example.com");
    await expect(withoutWww.addExtension(new RemoteExtensionProvider({
      jsUrl: "https://example.com/index.js",
      manifestUrl: "https://example.com/package.json",
    }))).resolves.toBeUndefined();
  });

  it("ExtensionAdmin will not confuse a lookalike host with a registered host", async () => {
    const extensionAdmin = new ExtensionAdmin();
    extensionAdmin.registerHost("example.com");

    const lookalikes = [
      "https://wwwexample.com/index.js",
      "https://www.example.com.evil.com/index.js",
      "https://example.com.evil.com/index.js",
      "https://evil.com/www.example.com/index.js",
      "https://notexample.com/index.js",
    ];
    for (const jsUrl of lookalikes) {
      const extension = new RemoteExtensionProvider({ jsUrl, manifestUrl: `${jsUrl}/package.json` });
      await expect(extensionAdmin.addExtension(extension)).rejects.toThrow(/not registered/);
    }
  });

  it("ExtensionAdmin compares hostnames case-insensitively", async () => {
    const extensionAdmin = new ExtensionAdmin();
    extensionAdmin.registerHost("EXAMPLE.com");

    const extension = new RemoteExtensionProvider({
      jsUrl: "https://Example.COM/index.js",
      manifestUrl: "https://Example.COM/package.json",
    });
    await expect(extensionAdmin.addExtension(extension)).resolves.toBeUndefined();
  });

  it("ExtensionAdmin will reject a jsUrl that carries no hostname", async () => {
    // these schemes parse successfully but produce an empty hostname, so there is nothing
    // to match against a registered host
    const hostless = [
      "data:text/javascript,globalThis.pwned=1",
      "file:///evil.js",
      "blob:https://app.example.com/uuid",
      "javascript:alert(1)",
    ];
    for (const jsUrl of hostless) {
      const extensionAdmin = new ExtensionAdmin();
      extensionAdmin.registerHost("example.com");

      const extension = new RemoteExtensionProvider({ jsUrl, manifestUrl: "https://example.com/package.json" });
      await expect(extensionAdmin.addExtension(extension)).rejects.toThrow(/not a valid URL or hostname/);
    }
  });

  it("ExtensionAdmin will not treat an empty provider hostname as a local extension", async () => {
    const extensionAdmin = new ExtensionAdmin();
    extensionAdmin.registerHost("example.com");

    // a custom ExtensionProvider is free to report an empty hostname - it must not bypass the check
    const hostless: ExtensionProvider = {
      hostname: "",
      getManifest: async () => stubManifest,
      execute: async () => "",
    };
    await expect(extensionAdmin.addExtension(hostless)).rejects.toThrow(/not a valid URL or hostname/);
  });

  it("ExtensionAdmin will not host-gate extensions without a hostname", async () => {
    const extensionAdmin = new ExtensionAdmin();
    extensionAdmin.registerHost("example.com");

    const local: ExtensionProvider = {
      getManifest: async () => stubManifest,
      execute: async () => "",
    };
    await expect(extensionAdmin.addExtension(local)).resolves.toBeUndefined();
  });
});
