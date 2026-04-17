/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as fs from "fs-extra";
import { extname } from "path";
import * as sinon from "sinon";
import { Guid } from "@itwin/core-bentley";
import { Range3d } from "@itwin/core-geometry";
import { SettingsPriority } from "../../workspace/Settings";
import { settingsWorkspaceDbName } from "../../workspace/SettingsDb";
import { Workspace, WorkspaceContainer, WorkspaceContainerProps, WorkspaceDbLoadError, WorkspaceDbManifest, WorkspaceDbProps } from "../../workspace/Workspace";
import { EditableWorkspaceDb, WorkspaceEditor } from "../../workspace/WorkspaceEditor";
import { IModelTestUtils } from "../IModelTestUtils";
import { validateWorkspaceContainerId } from "../../internal/workspace/WorkspaceImpl";
import { _nativeDb } from "../../internal/Symbols";
import { CloudSqlite } from "../../CloudSqlite";
import { BlobContainer } from "../../BlobContainerService";

describe("WorkspaceFile", () => {

  let editor: WorkspaceEditor;
  let workspace: Workspace;

  before(() => {
    editor = WorkspaceEditor.construct();
    workspace = editor.workspace;
  });
  after(() => {
    editor.close();
  });

  async function makeEditableDb(props: WorkspaceDbProps & WorkspaceContainerProps, manifest: WorkspaceDbManifest): Promise<EditableWorkspaceDb> {
    const container = editor.getContainer({ ...props, accessToken: "" });
    const wsFile = await container.createDb({ ...props, manifest });
    wsFile.open();
    return wsFile;
  }

  function compareFiles(file1: string, file2: string) {
    expect(fs.lstatSync(file1).size).equal(fs.lstatSync(file2).size);
    expect(fs.readFileSync(file1)).to.deep.equal(fs.readFileSync(file2));
  }

  it("WorkspaceContainer names", () => {
    const expectBadName = (names: string[]) => {
      names.forEach((containerId) => {
        expect(() => validateWorkspaceContainerId(containerId), containerId).to.throw("containerId");
      });
    };

    expectBadName([
      "",
      "  ",
      "12", // too short
      "a\\b",
      `a"b`,
      "a:b",
      "a.b",
      "a?b",
      "a*b",
      "a|b",
      "123--4",
      "Abc",
      "return\r",
      "newline\n",
      "a".repeat(64), // too long
      "-leading-dash",
      "trailing-dash-"]);

    validateWorkspaceContainerId(Guid.createValue()); // guids should be valid
  });

  it("WorkspaceDbNames", () => {
    const expectBadName = (names: string[]) => {
      names.forEach((dbName) => {
        expect(() => CloudSqlite.validateDbName(dbName)).to.throw("dbName");
      });
    };

    expectBadName([
      "",
      "  ",
      "1/2",
      "a\\b",
      `a"b`,
      "base:1.2.3",
      "a:b",
      "a.b",
      "a?b",
      "a*b",
      "a|b",
      "con",
      "prn",
      "return\r",
      "newline\n",
      "a".repeat(256), // too long
      " leading space",
      "trailing space ",
      "per.iod",
      "hash#tag",
      "back`tick",
      "single'quote",
    ]);

    CloudSqlite.validateDbName(Guid.createValue()); // guids should be valid
  });

  it("WorkspaceDb version fallback", () => {
    expect(CloudSqlite.validateDbVersion("" as CloudSqlite.DbVersion)).equals("0.0.0");
    expect(CloudSqlite.makeSemverName("db1", "" as CloudSqlite.DbVersion)).equals("db1:0.0.0");
    expect(() => CloudSqlite.validateDbVersion(" " as CloudSqlite.DbVersion)).to.throw("invalid version specification");
  });

  it("create new WorkspaceDb", async () => {
    const manifest: WorkspaceDbManifest = { workspaceName: "resources for acme users", contactName: "contact me" };
    const wsFile = await makeEditableDb({ containerId: "acme-engineering-inc-2", dbName: "db1", baseUri: "", storageType: "azure" }, manifest);
    const inFile = IModelTestUtils.resolveAssetFile("test.setting.json5");
    const testRange = new Range3d(1.2, 2.3, 3.4, 4.5, 5.6, 6.7);
    let blobVal = new Uint8Array(testRange.toFloat64Array().buffer);
    let strVal = "this is test1";
    const strRscName = "string-resource/1";
    const blobRscName = "blob.resource:1";
    const fileRscName = "settings files/my settings/a.json5";

    let testManifest = wsFile.manifest;
    expect(testManifest.workspaceName).equals(manifest.workspaceName);
    expect(testManifest.contactName).equals(manifest.contactName);

    wsFile.updateManifest({ ...testManifest, contactName: "new contact" });
    testManifest = wsFile.manifest;
    expect(testManifest.workspaceName).equals(manifest.workspaceName);
    expect(testManifest.contactName).equals("new contact");

    expect(() => wsFile.addFile(fileRscName, "bad file name")).to.throw("no such file");
    expect(() => wsFile.updateFile(fileRscName, inFile)).to.throw("error replacing");
    expect(() => wsFile.removeFile(fileRscName)).to.throw("does not exist");

    wsFile.addBlob(blobRscName, blobVal);
    wsFile.addString(strRscName, strVal);
    expect(wsFile.getString(strRscName)).equals(strVal);
    expect(wsFile.getBlob(blobRscName)).to.deep.equal(blobVal);
    strVal = "updated string";
    blobVal = Uint8Array.from([0, 1, 2, 3]);
    wsFile.updateString(strRscName, strVal);
    wsFile.updateBlob(blobRscName, blobVal);
    expect(wsFile.getString(strRscName)).equals(strVal);
    expect(wsFile.getBlob(blobRscName)).to.deep.equal(blobVal);

    wsFile.removeBlob(blobRscName);
    wsFile.removeString(strRscName);
    expect(wsFile.getString(strRscName)).to.be.undefined;
    expect(wsFile.getBlob(blobRscName)).to.be.undefined;

    wsFile.addFile(fileRscName, inFile);
    const writeFile = sinon.spy(wsFile.sqliteDb[_nativeDb], "extractEmbeddedFile");
    expect(writeFile.callCount).eq(0);
    const outFile = wsFile.getFile(fileRscName)!;
    expect(writeFile.callCount).eq(1);
    expect(extname(outFile)).equals(".json5");
    compareFiles(inFile, outFile);

    let outFile2 = wsFile.getFile(fileRscName)!;
    expect(writeFile.callCount).eq(1);
    expect(outFile).eq(outFile2);

    const inFile2 = IModelTestUtils.resolveAssetFile("TestSettings.schema.json");
    wsFile.updateFile(fileRscName, inFile2);
    outFile2 = wsFile.getFile(fileRscName)!;
    expect(writeFile.callCount).eq(2);
    expect(outFile).eq(outFile2);
    compareFiles(inFile2, outFile);
  });

  it("load workspace settings", async () => {
    const settingsFile = IModelTestUtils.resolveAssetFile("test.setting.json5");
    const defaultDb = await makeEditableDb({ containerId: "default", dbName: "db1", baseUri: "", storageType: "azure" }, { workspaceName: "default resources", contactName: "contact 123" });
    defaultDb.addString("default-settings", fs.readFileSync(settingsFile, "utf-8"));
    defaultDb.close();

    const settings = workspace.settings;
    await workspace.loadSettingsDictionary(
      { dbName: "db1", containerId: "default", baseUri: "", storageType: "azure", resourceName: "default-settings", priority: SettingsPriority.defaults });
    expect(settings.getSetting("editor/renderWhitespace")).equals("selection");

    const workspaceName = "all fonts workspace";
    const schemaFile = IModelTestUtils.resolveAssetFile("TestSettings.schema.json");
    const fontsDb = await makeEditableDb({ containerId: "fonts", dbName: "fonts", baseUri: "", storageType: "azure" }, { workspaceName, contactName: "font guy" });

    fontsDb.addFile("Helvetica.ttf", schemaFile, "ttf");
    fontsDb.close();
  });

  it("settingsWorkspaceDbName discovers all string resources as dictionaries", async () => {
    const containerProps = { containerId: "load-all-test", baseUri: "", storageType: "azure" as const };
    const db = await makeEditableDb({ ...containerProps, dbName: settingsWorkspaceDbName }, { workspaceName: "load-all workspace" });
    db.addString("dict-a", JSON.stringify({ "editor/renderWhitespace": "all" }));
    db.addString("dict-b", JSON.stringify({ "editor/fontSize": 14 }));
    db.close();


    const settings = workspace.settings;
    await workspace.loadSettingsDictionary({
      ...containerProps,
      priority: SettingsPriority.iTwin,
      dbName: settingsWorkspaceDbName,
    });
    expect(settings.getSetting("editor/renderWhitespace")).equals("all");
    expect(settings.getSetting("editor/fontSize")).equals(14);
  });

  it("settingsWorkspaceDbName loads resourceName last when set", async () => {
    const containerProps = { containerId: "load-all-ignore-rsc", baseUri: "", storageType: "azure" as const };
    const db = await makeEditableDb({ ...containerProps, dbName: settingsWorkspaceDbName }, { workspaceName: "load-all-priority" });
    db.addString("first", JSON.stringify({ "editor/tabSize": 2, "editor/shared": "first" }));
    db.addString("second", JSON.stringify({ "editor/wordWrap": "on", "editor/shared": "second" }));
    db.close();

    const settings = workspace.settings;
    await workspace.loadSettingsDictionary({
      ...containerProps,
      priority: SettingsPriority.defaults,
      dbName: settingsWorkspaceDbName,
      resourceName: "second",
    });
    // All dictionaries are loaded, with resourceName loaded last.
    expect(settings.getSetting("editor/tabSize")).equals(2);
    expect(settings.getSetting("editor/wordWrap")).equals("on");
    expect(settings.getSetting("editor/shared")).equals("second");
  });

  it("settingsWorkspaceDbName continues loading sibling dictionaries after a resource fails", async () => {
    const containerProps = { containerId: "load-all-continue-on-error", baseUri: "", storageType: "azure" as const };
    const db = await makeEditableDb({ ...containerProps, dbName: settingsWorkspaceDbName }, { workspaceName: "load-all-continue-on-error" });
    db.addString("dict-valid", JSON.stringify({ "editor/continueAfterError": true }));
    db.addString("dict-invalid", "not valid json");
    db.close();

    const problems: WorkspaceDbLoadError[] = [];
    await workspace.loadSettingsDictionary({
      ...containerProps,
      priority: SettingsPriority.defaults,
      dbName: settingsWorkspaceDbName,
      // Force this valid resource to be evaluated last.
      resourceName: "dict-valid",
    }, problems);

    expect(workspace.settings.getSetting("editor/continueAfterError")).to.equal(true);
    expect(problems.length).to.equal(1);
  });



  describe("workspace db version cache key", () => {
    afterEach(() => sinon.restore());

    function getContainer(containerId: string, props?: Partial<WorkspaceContainerProps>) {
      return editor.getContainer({ containerId, baseUri: "", storageType: "azure", accessToken: "", ...props });
    }

    function createFakeCloudContainer(containerId: string): CloudSqlite.CloudContainer {
      return {
        connect: () => { },
        disconnect: () => { },
        checkForChanges: () => { },
        queryDatabase: () => undefined,
        queryDatabases: () => [],
        acquireWriteLock: () => { },
        releaseWriteLock: () => { },
        abandonChanges: () => { },
        containerId,
        baseUri: "https://example.invalid",
        storageType: "azure",
        isPublic: false,
      } as unknown as CloudSqlite.CloudContainer;
    }

    function stubCloudLookup(containerId: string, resolveVersion: (props: WorkspaceDbProps) => string) {
      sinon.stub(CloudSqlite, "createCloudContainer").returns(createFakeCloudContainer(containerId));
      sinon.stub(CloudSqlite, "querySemverMatch").callsFake((props) => CloudSqlite.makeSemverName(props.dbName, resolveVersion(props)));
      sinon.stub(CloudSqlite, "isSemverEditable").returns(true);
    }

    it("local getWorkspaceDb ignores version selectors for cache identity", async () => {
      const container = getContainer("workspace-cache-local");
      await container.createDb({ dbName: "test-db", manifest: { workspaceName: "workspace-cache-local" } });

      const db1 = container.getWorkspaceDb({ dbName: "test-db" });
      const db2 = container.getWorkspaceDb({ dbName: "test-db", version: "1.0.0", includePrerelease: true });
      expect(db1).to.equal(db2);
    });

    it("local createDb with omitted dbName matches an explicit default-name lookup", async () => {
      const container = getContainer("workspace-cache-local-default-name");
      const db1 = await container.createDb({ manifest: { workspaceName: "workspace-cache-local-default-name" } });

      const db2 = container.getEditableDb({ dbName: "workspace-db" });
      expect(db1).to.equal(db2);
    });

    it("cloud getWorkspaceDb reuses the same instance for semver-equivalent selectors", () => {
      const containerId = "workspace-cache-cloud-equivalent";
      stubCloudLookup(containerId, (props) => props.version === "1" ? "1.0.0" : (props.version ?? "1.0.0"));

      const container = getContainer(containerId, { baseUri: "https://example.invalid" });
      const db1 = container.getWorkspaceDb({ dbName: "test-db", version: "1" });
      const db2 = container.getWorkspaceDb({ dbName: "test-db", version: "1.0.0" });
      expect(db1).to.equal(db2);
    });

    it("cloud getWorkspaceDb returns different instances for different resolved versions", () => {
      const containerId = "workspace-cache-cloud-different";
      stubCloudLookup(containerId, (props) => props.version ?? "1.0.0");

      const container = getContainer(containerId, { baseUri: "https://example.invalid" });
      const db1 = container.getWorkspaceDb({ dbName: "test-db", version: "1.0.0" });
      const db2 = container.getWorkspaceDb({ dbName: "test-db", version: "2.0.0" });
      expect(db1).to.not.equal(db2);
    });

    it("cloud getWorkspaceDb respects includePrerelease only when it resolves differently", () => {
      const containerId = "workspace-cache-cloud-prerelease";
      stubCloudLookup(containerId, (props) => props.includePrerelease ? "1.1.0-beta.1" : "1.0.0");

      const container = getContainer(containerId, { baseUri: "https://example.invalid" });
      const stable = container.getWorkspaceDb({ dbName: "test-db", version: "*" });
      const prerelease = container.getWorkspaceDb({ dbName: "test-db", version: "*", includePrerelease: true });
      expect(stable).to.not.equal(prerelease);
    });

    it("createDb with explicit version returns the cached editable db for that resolved version", async () => {
      const containerId = "workspace-create-version";
      stubCloudLookup(containerId, (props) => props.version ?? "0.0.0");
      sinon.stub(CloudSqlite, "uploadDb").resolves();

      const container = getContainer(containerId, { baseUri: "https://example.invalid" });
      const db = await container.createDb({ dbName: "test-db", version: "1.0.0", manifest: { workspaceName: "workspace-create-version" } });

      const dbAgain = container.getEditableDb({ dbName: "test-db", version: "1.0.0" });
      expect(db).to.equal(dbAgain);
    });

    it("createDb without an explicit version returns the cached editable db for version 0.0.0", async () => {
      const containerId = "workspace-create-default-version";
      stubCloudLookup(containerId, (props) => props.version ?? "0.0.0");
      sinon.stub(CloudSqlite, "uploadDb").resolves();

      const container = getContainer(containerId, { baseUri: "https://example.invalid" });
      const db = await container.createDb({ dbName: "test-db", manifest: { workspaceName: "workspace-create-default-version" } });

      const dbAgain = container.getEditableDb({ dbName: "test-db", version: "0.0.0" });
      expect(db).to.equal(dbAgain);
    });

    it("cloud createDb uploads using the requested version", async () => {
      const containerId = "workspace-cloud-explicit-version";
      stubCloudLookup(containerId, (props) => props.version ?? "0.0.0");
      const uploadDb = sinon.stub(CloudSqlite, "uploadDb").resolves();

      const container = getContainer(containerId, { baseUri: "https://example.invalid" });
      await container.createDb({ dbName: "test-db", version: "1.2.3", manifest: { workspaceName: "workspace-cloud-explicit-version" } });

      expect(uploadDb.calledOnce).to.be.true;
      expect(uploadDb.firstCall.args[1].dbName).to.equal("test-db:1.2.3");
    });

    it("cloud createDb defaults omitted version to 0.0.0", async () => {
      const containerId = "workspace-cloud-default-version";
      stubCloudLookup(containerId, (props) => props.version ?? "0.0.0");
      const uploadDb = sinon.stub(CloudSqlite, "uploadDb").resolves();

      const container = getContainer(containerId, { baseUri: "https://example.invalid" });
      await container.createDb({ dbName: "test-db", manifest: { workspaceName: "workspace-cloud-default-version" } });

      expect(uploadDb.calledOnce).to.be.true;
      expect(uploadDb.firstCall.args[1].dbName).to.equal("test-db:0.0.0");
    });
  });


  describe("getContainerAsync token resolution", () => {
    afterEach(() => sinon.restore());

    it("preserves an explicitly-provided accessToken", async () => {
      const requestTokenStub = sinon.stub(CloudSqlite, "requestToken").rejects(new Error("should not be called"));
      const getContainerStub = sinon.stub(workspace, "getContainer").callsFake((args) => {
        return { fromProps: args } as WorkspaceContainer;
      });
      const props: WorkspaceContainerProps = {
        containerId: "explicit-token-test",
        baseUri: "https://some-cloud-uri",
        storageType: "azure",
        accessToken: "my-explicit-token",
      };

      const container = await workspace.getContainerAsync(props);

      expect(requestTokenStub.called).to.be.false;
      expect(getContainerStub.calledOnce).to.be.true;
      expect(getContainerStub.firstCall.args[0].accessToken).to.equal("my-explicit-token");
      expect(container.fromProps.accessToken).to.equal("my-explicit-token");
    });

    it("uses empty token for local containers with empty baseUri", async () => {
      const requestTokenStub = sinon.stub(CloudSqlite, "requestToken").rejects(new Error("should not be called"));
      const getContainerStub = sinon.stub(workspace, "getContainer").callsFake((args) => {
        return { fromProps: args } as WorkspaceContainer;
      });
      const props: WorkspaceContainerProps = {
        containerId: "local-token-test",
        baseUri: "",
        storageType: "azure",
      };

      const container = await workspace.getContainerAsync(props);
      expect(requestTokenStub.called).to.be.false;
      expect(getContainerStub.calledOnce).to.be.true;
      expect(getContainerStub.firstCall.args[0].accessToken).to.equal("");
      expect(container.fromProps.accessToken).to.equal("");
    });

    it("calls requestToken when no accessToken is provided for a cloud container", async () => {
      const requestTokenStub = sinon.stub(CloudSqlite, "requestToken").resolves("resolved-token");
      const getContainerStub = sinon.stub(workspace, "getContainer").callsFake((args) => {
        return { fromProps: args } as WorkspaceContainer;
      });
      const props: WorkspaceContainerProps = {
        containerId: "cloud-no-token-test",
        baseUri: "https://some-cloud-uri",
        storageType: "azure",
      };

      const container = await workspace.getContainerAsync(props);
      expect(requestTokenStub.calledOnce).to.be.true;
      expect(getContainerStub.calledOnce).to.be.true;
      expect(getContainerStub.firstCall.args[0].accessToken).to.equal("resolved-token");
      expect(container.fromProps.accessToken).to.equal("resolved-token");
    });
  });

  describe("findContainers", () => {
    const testContainerId = "mock-workspace-container-id";
    const testITwinId = "mock-itwin-id";
    const testIModelId = "mock-imodel-id";
    let savedService: BlobContainer.ContainerService | undefined;

    function createMockService(containers: BlobContainer.MetadataResponse[]): BlobContainer.ContainerService {
      return {
        create: async () => ({ containerId: testContainerId, baseUri: "https://mock.blob.core/", provider: "azure" as const }),
        delete: async () => { },
        queryScope: async () => ({ iTwinId: testITwinId }),
        queryMetadata: async () => ({ containerType: "workspace", label: "mock" }),
        queryContainersMetadata: async (_userToken, args) => {
          return containers.filter((c) =>
            (args.containerType === undefined || c.containerType === args.containerType) &&
            (args.iTwinId === testITwinId || args.iTwinId === undefined),
          );
        },
        updateJson: async () => { },
        requestToken: async (_props) => ({
          token: "",
          scope: { iTwinId: testITwinId },
          provider: "azure" as const,
          expiration: new Date(Date.now() + 3600000),
          metadata: { containerType: "workspace", label: "mock" },
          baseUri: "",
        }),
      };
    }

    before(() => {
      savedService = BlobContainer.service;
    });

    afterEach(() => {
      BlobContainer.service = savedService;
    });

    it("finds containers by iTwinId", async () => {
      BlobContainer.service = createMockService([
        { containerId: testContainerId, containerType: "workspace", label: "Test Workspace" },
      ]);

      const containers = await editor.findContainers({ iTwinId: testITwinId });
      expect(containers).to.have.length(1);
      expect(containers[0].fromProps.containerId).to.equal(testContainerId);
    });

    it("finds a container by iTwinId and iModelId", async () => {
      BlobContainer.service = createMockService([
        { containerId: "imodel-scoped-container", containerType: "workspace", label: "iModel Workspace" },
      ]);

      const containers = await editor.findContainers({ iTwinId: testITwinId, iModelId: testIModelId });
      expect(containers).to.have.length(1);
      expect(containers[0].fromProps.containerId).to.equal("imodel-scoped-container");
    });

    it("returns empty array when no workspace containers are found", async () => {
      BlobContainer.service = createMockService([]);

      const containers = await editor.findContainers({ iTwinId: "nonexistent-itwin" });
      expect(containers).to.have.length(0);
    });

    it("throws when BlobContainer.service is not available", async () => {
      BlobContainer.service = undefined;

      await expect(editor.findContainers({ iTwinId: testITwinId }))
        .to.be.rejectedWith(/BlobContainer.service is not available/);
    });
  });

});
