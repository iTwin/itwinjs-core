/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ExtensionManifest, RemoteExtensionProvider } from "../core-frontend";
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
    expect(() => extensionAdmin.registerHost("3001:invalidUrl")).toThrow(/should be a valid URL or hostname/);
    expect(() => extensionAdmin.registerHost("invalidUrl342!@#")).toThrow(/should be a valid URL or hostname/);
  });
});
