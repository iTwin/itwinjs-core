/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as chai from "chai";
const assert = chai.assert;

import { Config, ConnectClient, AuthorizedClientRequestContext } from "@bentley/imodeljs-clients";
import { LogLevel, Logger, Guid, ExtensionStatus } from "@bentley/bentleyjs-core";
import { IModelJsConfig } from "../../node_modules/@bentley/config-loader/lib/IModelJsConfig";
import { getTestOidcToken, TestUsers } from "@bentley/oidc-signin-tool";
import { ExtensionClient } from "../ExtensionClient";
import { ExtensionProps } from "../Extension";

describe("ExtensionClient (#integration)", () => {
  let projectId: string;
  let projectName: string;
  let extensionClient: ExtensionClient;
  let requestContext: AuthorizedClientRequestContext;

  before(async () => {
    Logger.initializeToConsole();
    Logger.setLevelDefault(LogLevel.Error);

    IModelJsConfig.init(true, true, Config.App);

    extensionClient = new ExtensionClient();

    const oidcConfig = {
      clientId: "imodeljs-extension-publisher",
      redirectUri: "http://localhost:5001/signin-oidc",
      scope: "openid imodel-extension-service-api context-registry-service:read-only offline_access",
    };

    const token = await getTestOidcToken(oidcConfig, TestUsers.regular);
    requestContext = new AuthorizedClientRequestContext(token);

    projectName = Config.App.getString("imjs_test_project_name");

    const connectClient = new ConnectClient();
    const project = await connectClient.getProject(requestContext, {
      $select: "*",
      $filter: `Name+eq+'${projectName}'`,
    });
    if (!project || !project.wsgId) {
      const userInfo = requestContext.accessToken.getUserInfo();
      throw new Error(`Project ${projectName} not found for user ${!userInfo ? "n/a" : userInfo.email}.`);
    }
    projectId = project.wsgId;
  });

  after(async () => {
    const availableExtensions = await extensionClient.getExtensions(requestContext, projectId);

    for (const extension of availableExtensions) {
      if (extension.extensionName.length === 48 && extension.extensionName.startsWith("tempTestExt-"))
        try {
          await extensionClient.deleteExtension(requestContext, projectId, extension.extensionName, extension.version);
        } catch (e) { }
    }
  });

  it("gets extensions", async () => {
    const expectedExtensions = [
      {
        extensionName: "testExt1",
        version: "v1",
        files: [
          "testFile1.txt",
          "testFile2",
          "testDir1/testDir2/test file3.txt",
        ].sort(),
        uploadedBy: TestUsers.regular.email,
      },
      {
        extensionName: "testExt1",
        version: "v2",
        files: [
          "testFile1_1.txt",
          "testFile2",
          "testDir1/testDir2/test file3.txt",
        ].sort(),
        uploadedBy: TestUsers.regular.email,
      },
      {
        extensionName: "testExt 2",
        version: "v1",
        files: [
          "testFile",
          "testDir1/testFile.txt",
        ].sort(),
        uploadedBy: TestUsers.regular.email,
      },
    ];

    const foundExtensions = await extensionClient.getExtensions(requestContext, projectId);
    assert.exists(foundExtensions);
    assert.isAbove(foundExtensions.length, 2);

    for (const expected of expectedExtensions) {
      const found = foundExtensions.find((props: ExtensionProps) => props.extensionName === expected.extensionName && props.version === expected.version);
      assert.isDefined(found, "Could not find extension with name " + expected.extensionName + " and version " + expected.version);

      assert.strictEqual(found!.uploadedBy, expected.uploadedBy, "UploadedBy does not match");
      assert.strictEqual(found!.contextId, projectId, "ContextId does not match");
      assert.strictEqual(found!.uri.length, expected.files.length, "Returned file count does not match");

      const sortedUris = found!.uri.sort();
      const firstUri = sortedUris[0];
      const lastUri = sortedUris[sortedUris.length - 1];
      let relativePathStart = 0;
      while (relativePathStart < firstUri.length && firstUri[relativePathStart] === lastUri[relativePathStart]) relativePathStart++;
      while (relativePathStart > 0 && firstUri[relativePathStart] !== "/") relativePathStart--;

      for (let i = 0; i < expected.files.length; i++) {
        assert.isTrue(sortedUris[i].startsWith(expected.files[i] + "?", relativePathStart + 1), "File name does not match - expected " + expected.files[i] + ", found " + sortedUris[i].substr(relativePathStart));
      }
    }
  });

  it("gets extensions with name", async () => {
    const expectedExtensions = [
      {
        extensionName: "testExt1",
        version: "v1",
        files: [
          "testFile1.txt",
          "testFile2",
          "testDir1/testDir2/test file3.txt",
        ].sort(),
        uploadedBy: TestUsers.regular.email,
      },
      {
        extensionName: "testExt1",
        version: "v2",
        files: [
          "testFile1_1.txt",
          "testFile2",
          "testDir1/testDir2/test file3.txt",
        ].sort(),
        uploadedBy: TestUsers.regular.email,
      },
    ];

    const foundExtensions = await extensionClient.getExtensions(requestContext, projectId, "testExt1");
    assert.exists(foundExtensions);
    assert.strictEqual(foundExtensions.length, 2);

    for (const expected of expectedExtensions) {
      const found = foundExtensions.find((props: ExtensionProps) => props.extensionName === expected.extensionName && props.version === expected.version);
      assert.isDefined(found, "Could not find extension with name " + expected.extensionName + " and version " + expected.version);

      assert.strictEqual(found!.uploadedBy, expected.uploadedBy, "UploadedBy does not match");
      assert.strictEqual(found!.contextId, projectId, "ContextId does not match");
      assert.strictEqual(found!.uri.length, expected.files.length, "Returned file count does not match");

      const sortedUris = found!.uri.sort();
      const firstUri = sortedUris[0];
      const lastUri = sortedUris[sortedUris.length - 1];
      let relativePathStart = 0;
      while (relativePathStart < firstUri.length && firstUri[relativePathStart] === lastUri[relativePathStart]) relativePathStart++;
      while (relativePathStart > 0 && firstUri[relativePathStart] !== "/") relativePathStart--;

      for (let i = 0; i < expected.files.length; i++) {
        assert.isTrue(sortedUris[i].startsWith(expected.files[i] + "?", relativePathStart + 1), "File name does not match - expected " + expected.files[i] + ", found " + sortedUris[i].substr(relativePathStart));
      }
    }
  });

  [{
    name: "testExt1",
    version: "v1",
    files: [
      { name: "testFile1.txt", content: "test file content 1" },
      { name: "testFile2", content: "test file content 2" },
      { name: "testDir1/testDir2/test file3.txt", content: "test file content 3" },
    ],
  },
  {
    name: "testExt1",
    version: "v2",
    files: [
      { name: "testFile1_1.txt", content: "test file content 1 ++" },
      { name: "testFile2", content: "test file content 2 ++" },
      { name: "testDir1/testDir2/test file3.txt", content: "test file content 3 ++" },
    ],
  },
  {
    name: "testExt 2",
    version: "v1",
    files: [
      { name: "testFile", content: "test file content 1" },
      { name: "testDir1/testFile.txt", content: "test file content 2" },
    ],
  }].forEach((testCase) => {
    it("downloads extension " + testCase.name + ", version " + testCase.version, async () => {
      const files = await extensionClient.downloadExtension(requestContext, projectId, testCase.name, testCase.version);

      for (const file of testCase.files) {
        const foundFile = files.find((f) => f.fileName === file.name);
        assert.isDefined(foundFile, "File not downloaded: " + file.name);
        const content = Buffer.from(foundFile!.content).toString();
        assert.strictEqual(content, file.content, "Incorrect file content downloaded: " + file.name);
      }
      assert.isTrue(true);
    });
  });

  [{ name: "testExt1", version: "v3" },
  { name: "testExt that doesn't exist", version: "v1" }].forEach((testCase) => {
    it("fails to download extension `" + testCase.name + "`, version `" + testCase.version + "` that doesn't exist", async () => {
      let thrown = false;
      try {
        await extensionClient.downloadExtension(requestContext, projectId, testCase.name, testCase.version);
      } catch (error) {
        thrown = true;
        assert.isDefined(error.errorNumber);
        assert.isDefined(error.message);
        assert.strictEqual(error.errorNumber, ExtensionStatus.BadRequest);
        assert.strictEqual(error.message, "The requested extension does not exist");
      }
      assert.isTrue(thrown, "Exception not thrown");
    });
  });

  it.skip("uploads and deletes extension with specific version", async () => {
    const extensionName = "tempTestExt-" + Guid.createValue();
    const currentTime = new Date().getTime();
    await extensionClient.createExtension(requestContext, projectId, extensionName, "v1", new ArrayBuffer(64));
    await extensionClient.createExtension(requestContext, projectId, extensionName, "v2", new ArrayBuffer(64));

    let extensions = await extensionClient.getExtensions(requestContext, projectId);
    let created = extensions.find((props) => props.extensionName === extensionName && props.version === "v1");
    assert.isDefined(created);
    assert.strictEqual(created!.contextId, projectId, "Incorrect contextId");
    assert.strictEqual(created!.uploadedBy, TestUsers.regular.email, "Incorrect uploadedBy");
    assert.approximately(created!.timestamp.getTime(), currentTime, 60 * 1000, "Incorrect timestamp");

    created = extensions.find((props) => props.extensionName === extensionName && props.version === "v2");
    assert.isDefined(created);
    assert.strictEqual(created!.contextId, projectId, "Incorrect contextId");
    assert.strictEqual(created!.uploadedBy, TestUsers.regular.email, "Incorrect uploadedBy");
    assert.approximately(created!.timestamp.getTime(), currentTime, 60 * 1000, "Incorrect timestamp");

    await extensionClient.deleteExtension(requestContext, projectId, extensionName, "v1");
    extensions = await extensionClient.getExtensions(requestContext, projectId);
    const deleted = extensions.find((props) => props.extensionName === extensionName && props.version === "v1");
    assert.isUndefined(deleted);
    const notDeleted = extensions.find((props) => props.extensionName === extensionName && props.version === "v2");
    assert.isDefined(notDeleted);

    await extensionClient.deleteExtension(requestContext, projectId, extensionName, "v2");
  });

  it.skip("uploads and deletes all versions of extension", async () => {
    const extensionName = "tempTestExt-" + Guid.createValue();
    await extensionClient.createExtension(requestContext, projectId, extensionName, "v1", new ArrayBuffer(64));
    await extensionClient.createExtension(requestContext, projectId, extensionName, "v2", new ArrayBuffer(64));

    let extensions = await extensionClient.getExtensions(requestContext, projectId);
    let created = extensions.find((props) => props.extensionName === extensionName && props.version === "v1");
    assert.isDefined(created);
    created = extensions.find((props) => props.extensionName === extensionName && props.version === "v2");
    assert.isDefined(created);

    await extensionClient.deleteExtension(requestContext, projectId, extensionName);
    extensions = await extensionClient.getExtensions(requestContext, projectId);
    const deleted = extensions.find((props) => props.extensionName === extensionName);
    assert.isUndefined(deleted);
  });

  it("fails to upload already existing extension", async () => {
    let thrown = false;
    try {
      await extensionClient.createExtension(requestContext, projectId, "testExt1", "v1", new ArrayBuffer(64));
    } catch (error) {
      thrown = true;
      assert.isDefined(error.errorNumber);
      assert.isDefined(error.message);
      assert.strictEqual(error.errorNumber, ExtensionStatus.ExtensionAlreadyExists);
      assert.strictEqual(error.message, "An extension with this name and version already exists");
    }
    assert.isTrue(thrown, "Exception not thrown");
  });

  it("fails to get extensions with incorrect context id", async () => {
    let thrown = false;
    try {
      await extensionClient.getExtensions(requestContext, "invalid id");
    } catch (error) {
      thrown = true;
      assert.isDefined(error.errorNumber);
      assert.isDefined(error.message);
      assert.strictEqual(error.errorNumber, ExtensionStatus.BadRequest);
      assert.strictEqual(error.message, "Please Enter valid Context Id");
    }
    assert.isTrue(thrown, "Exception not thrown");
  });
});
