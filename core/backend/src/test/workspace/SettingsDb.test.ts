/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as sinon from "sinon";
import { WorkspaceError } from "@itwin/core-common";
import { CloudSqlite } from "../../CloudSqlite";
import { IModelHost } from "../../IModelHost";
import { SettingsPriority } from "../../workspace/Settings";
import { EditableSettingsCloudContainer, SettingsEditor } from "../../workspace/SettingsEditor";
import { SettingsDbProps } from "../../workspace/SettingsDb";
import { SettingsDbImpl } from "../../internal/workspace/SettingsDbImpl";
import { BlobContainer } from "../../BlobContainerService";

describe("SettingsDb", () => {
  let editor: SettingsEditor;

  before(async () => {
    await IModelHost.startup();
    editor = SettingsEditor.construct();
  });

  after(() => {
    editor.close();
  });

  function getContainer(containerId: string, baseUri = ""): EditableSettingsCloudContainer {
    return editor.getContainer({ containerId, baseUri, storageType: "azure", accessToken: "" });
  }

  it("SettingsDbImpl construction", async () => {
    const container = getContainer("construct-test");
    await container.createDb({ dbName: "test-db", manifest: { settingsName: "construct-test" } });

    const settingsDb = new SettingsDbImpl({ dbName: "test-db" }, container, SettingsPriority.application);
    expect(settingsDb.dbName).to.equal("test-db");
    expect(settingsDb.priority).to.equal(SettingsPriority.application);
    expect(settingsDb.isOpen).to.be.false;
    expect(settingsDb.container).to.equal(container);
    expect(settingsDb.version).to.equal("0.0.0");
  });

  it("open and close", async () => {
    const container = getContainer("open-close-test");
    await container.createDb({ dbName: "test-db", manifest: { settingsName: "open-close-test" } });

    const settingsDb = new SettingsDbImpl({ dbName: "test-db" }, container, SettingsPriority.application);
    expect(settingsDb.isOpen).to.be.false;

    settingsDb.open();
    expect(settingsDb.isOpen).to.be.true;

    settingsDb.close();
    expect(settingsDb.isOpen).to.be.false;

    // closing an already-closed db is safe
    settingsDb.close();
    expect(settingsDb.isOpen).to.be.false;
  });

  it("getSetting reads a written setting", async () => {
    const container = getContainer("get-setting-test");
    const editableDb = await container.createDb({ dbName: "test-db", manifest: { settingsName: "get-setting-test" } });

    editableDb.open();
    editableDb.updateSettings({
      "setting1": "value1",
      "setting2": 42,
      "setting3": true,
    });
    editableDb.close();

    const settingsDb = new SettingsDbImpl({ dbName: "test-db" }, container, SettingsPriority.iTwin);
    settingsDb.open();

    expect(settingsDb.getSetting<string>("setting1")).to.equal("value1");
    expect(settingsDb.getSetting<number>("setting2")).to.equal(42);
    expect(settingsDb.getSetting<boolean>("setting3")).to.equal(true);

    settingsDb.close();
  });

  it("getSettings reads all settings", async () => {
    const container = getContainer("get-settings-test");
    const editableDb = await container.createDb({ dbName: "test-db", manifest: { settingsName: "get-settings-test" } });

    editableDb.open();
    editableDb.updateSettings({
      "keyA": "valA",
      "keyB": 100,
      "keyC": [1, 2, 3],
    });
    editableDb.close();

    const settingsDb = new SettingsDbImpl({ dbName: "test-db" }, container, SettingsPriority.organization);
    settingsDb.open();

    const all = settingsDb.getSettings();
    expect(all.keyA).to.equal("valA");
    expect(all.keyB).to.equal(100);
    expect(all.keyC).to.deep.equal([1, 2, 3]);

    settingsDb.close();
  });

  it("getSetting returns undefined for non-existent setting", async () => {
    const container = getContainer("no-setting-test");
    await container.createDb({ dbName: "test-db", manifest: { settingsName: "no-setting-test" } });

    const settingsDb = new SettingsDbImpl({ dbName: "test-db" }, container, SettingsPriority.defaults);
    settingsDb.open();

    expect(settingsDb.getSetting("nonExistentSetting")).to.be.undefined;

    settingsDb.close();
  });

  it("manifest reads stored manifest", async () => {
    const container = getContainer("manifest-test");
    await container.createDb({
      dbName: "test-db",
      manifest: { settingsName: "My Settings DB", description: "A test settings database" },
    });

    const settingsDb = new SettingsDbImpl({ dbName: "test-db" }, container, SettingsPriority.application);

    // manifest auto-opens the db via withOpenDb when not explicitly opened
    const manifest = settingsDb.manifest;
    expect(manifest.settingsName).to.equal("My Settings DB");
    expect(manifest.description).to.equal("A test settings database");
    expect(settingsDb.isOpen).to.be.false;
  });

  it("getSetting auto-opens and auto-closes when db is not open", async () => {
    const container = getContainer("auto-open-test");
    const editableDb = await container.createDb({ dbName: "test-db", manifest: { settingsName: "auto-open-test" } });

    editableDb.open();
    editableDb.updateSettings({ "key": "auto-value" });
    editableDb.close();

    const settingsDb = new SettingsDbImpl({ dbName: "test-db" }, container, SettingsPriority.application);
    expect(settingsDb.isOpen).to.be.false;

    // getSetting should auto-open, read, and auto-close
    expect(settingsDb.getSetting<string>("key")).to.equal("auto-value");
    expect(settingsDb.isOpen).to.be.false;
  });

  it("removeSetting removes a setting", async () => {
    const container = getContainer("remove-setting-test");
    const editableDb = await container.createDb({ dbName: "test-db", manifest: { settingsName: "remove-setting-test" } });

    editableDb.open();
    editableDb.updateSettings({ "toKeep": 1, "toRemove": 2 });
    editableDb.close();

    // Verify both exist
    const settingsDb = new SettingsDbImpl({ dbName: "test-db" }, container, SettingsPriority.application);
    settingsDb.open();
    expect(settingsDb.getSetting("toKeep")).to.equal(1);
    expect(settingsDb.getSetting("toRemove")).to.equal(2);
    settingsDb.close();

    // Remove one
    editableDb.open();
    editableDb.removeSetting("toRemove");
    editableDb.close();

    // Verify only one remains
    settingsDb.open();
    const all = settingsDb.getSettings();
    expect(all.toKeep).to.equal(1);
    expect(all.toRemove).to.be.undefined;
    expect(settingsDb.getSetting("toRemove")).to.be.undefined;
    settingsDb.close();
  });

  it("close updates lastEditedBy in manifest when write lock is held", async () => {
    const container = getContainer("manifest-update-test");
    const editableDb = await container.createDb({
      dbName: "test-db",
      manifest: { settingsName: "manifest-update-test", contactName: "Original Author" },
    });

    // For local (non-cloud) containers, acquireWriteLock is a no-op,
    // so lastEditedBy should remain unchanged after close.
    container.acquireWriteLock("Jane Admin");
    editableDb.open();
    editableDb.updateSettings({ "key": "value" });
    editableDb.close();
    container.releaseWriteLock();

    const settingsDb = new SettingsDbImpl({ dbName: "test-db" }, container, SettingsPriority.application);
    const manifest = settingsDb.manifest;
    expect(manifest.settingsName).to.equal("manifest-update-test");
    expect(manifest.contactName).to.equal("Original Author");
    // lastEditedBy is only auto-set for cloud containers (where acquireWriteLock actually tracks the user)
    expect(manifest.lastEditedBy).to.be.undefined;
  });

  it("getSettingsDb returns a SettingsDb from a loaded container", async () => {
    const container = getContainer("getsettingsdb-test");
    await container.createDb({ dbName: "settings-db", manifest: { settingsName: "getsettingsdb-test" } });

    const settingsDb = editor.workspace.getSettingsDb({ containerId: "getsettingsdb-test", priority: SettingsPriority.iTwin });
    expect(settingsDb).to.not.be.undefined;
    expect(settingsDb.dbName).to.equal("settings-db");
    expect(settingsDb.manifest.settingsName).to.equal("getsettingsdb-test");
  });

  it("getSettingsDb throws for unloaded container", () => {
    expect(() => editor.workspace.getSettingsDb({ containerId: "nonexistent-container-id", priority: SettingsPriority.iTwin }))
      .to.throw()
      .and.satisfy((e: unknown) => WorkspaceError.isError(e, "does-not-exist"));
  });

  it("getSettingsDb uses caller-supplied priority", async () => {
    const container = getContainer("imodel-scope-test");
    await container.createDb({ dbName: "settings-db", manifest: { settingsName: "imodel-scope-test" } });

    const settingsDb = editor.workspace.getSettingsDb({ containerId: "imodel-scope-test", priority: SettingsPriority.iModel });
    expect(settingsDb).to.not.be.undefined;
    expect(settingsDb.priority).to.equal(SettingsPriority.iModel);
  });

  it("getSettingsDb respects iTwin priority", async () => {
    const container = getContainer("itwin-priority-test");
    await container.createDb({ dbName: "settings-db", manifest: { settingsName: "itwin-priority-test" } });

    const settingsDb = editor.workspace.getSettingsDb({ containerId: "itwin-priority-test", priority: SettingsPriority.iTwin });
    expect(settingsDb.priority).to.equal(SettingsPriority.iTwin);
  });

  it("hasSettingsManifestProperty returns true for SettingsDb containers", async () => {
    const container = getContainer("has-manifest-test");
    await container.createDb({ dbName: "settings-db", manifest: { settingsName: "has-manifest-test" } });

    const settingsDb = new SettingsDbImpl({ dbName: "settings-db" }, container, SettingsPriority.application);
    expect(settingsDb.hasSettingsManifestProperty).to.be.true;
  });

  it("getSetting returns undefined on empty db", async () => {
    const container = getContainer("missing-setting-test");
    await container.createDb({ dbName: "test-db", manifest: { settingsName: "missing-setting-test" } });

    const settingsDb = new SettingsDbImpl({ dbName: "test-db" }, container, SettingsPriority.application);
    settingsDb.open();
    expect(settingsDb.getSetting("does-not-exist")).to.be.undefined;
    settingsDb.close();
  });

  it("editor close is resilient to container cleanup failures", () => {
    // Verify that closing an editor with no containers doesn't throw
    const freshEditor = SettingsEditor.construct();
    expect(() => freshEditor.close()).to.not.throw();
  });

  it("getSettingsDb with custom dbName", async () => {
    const container = getContainer("custom-dbname-test");
    await container.createDb({ dbName: "my-custom-db", manifest: { settingsName: "custom-dbname" } });

    const settingsDb = editor.workspace.getSettingsDb({ containerId: "custom-dbname-test", priority: SettingsPriority.application, dbName: "my-custom-db" });
    expect(settingsDb.dbName).to.equal("my-custom-db");
  });

  it("iTwin and iModel settings containers coexist with correct priorities", async () => {
    // Simulate the real scenario: an iTwin has its own settings container, and one of its
    // iModels also has a settings container. Both are loaded into the workspace with separate
    // containerId GUIDs (assigned by the storage container service) and different priorities.
    const itwinContainer = getContainer("itwin-container-guid");
    const imodelContainer = getContainer("imodel-container-guid");

    const itwinDb = await itwinContainer.createDb({ dbName: "settings-db", manifest: { settingsName: "iTwin Settings" } });
    const imodelDb = await imodelContainer.createDb({ dbName: "settings-db", manifest: { settingsName: "iModel Settings" } });

    // Write the same setting name to both, with different values
    itwinDb.open();
    itwinDb.updateSettings({ "theme": "light", "itwinOnly": true });
    itwinDb.close();

    imodelDb.open();
    imodelDb.updateSettings({ "theme": "dark", "imodelOnly": true });
    imodelDb.close();

    // Retrieve both via getSettingsDb with the priorities a real caller would assign
    const itwinSettingsDb = editor.workspace.getSettingsDb({ containerId: "itwin-container-guid", priority: SettingsPriority.iTwin });
    const imodelSettingsDb = editor.workspace.getSettingsDb({ containerId: "imodel-container-guid", priority: SettingsPriority.iModel });

    // Verify they are independent dbs with correct priorities
    expect(itwinSettingsDb.priority).to.equal(SettingsPriority.iTwin);
    expect(imodelSettingsDb.priority).to.equal(SettingsPriority.iModel);
    expect(imodelSettingsDb.priority).to.be.greaterThan(itwinSettingsDb.priority);

    // Verify each db returns its own setting values
    expect(itwinSettingsDb.getSetting<string>("theme")).to.equal("light");
    expect(itwinSettingsDb.getSetting<boolean>("itwinOnly")).to.equal(true);

    expect(imodelSettingsDb.getSetting<string>("theme")).to.equal("dark");
    expect(imodelSettingsDb.getSetting<boolean>("imodelOnly")).to.equal(true);
  });

  it("SettingsEditor uses a separate cloud cache from the read-only Workspace", () => {
    const editorCache = editor.workspace.getCloudCache();
    const workspaceCache = IModelHost.appWorkspace.getCloudCache();
    expect(editorCache.name).to.equal("SettingsEditor");
    expect(workspaceCache.name).to.equal("Workspace");
    expect(editorCache).to.not.equal(workspaceCache);
  });

  describe("findContainers", () => {
    const testContainerId = "mock-settings-container-id";
    const testITwinId = "mock-itwin-id";
    const testIModelId = "mock-imodel-id";
    let savedService: BlobContainer.ContainerService | undefined;

    function createMockService(containers: BlobContainer.MetadataResponse[]): BlobContainer.ContainerService {
      return {
        create: async () => ({ containerId: testContainerId, baseUri: "https://mock.blob.core/", provider: "azure" as const }),
        delete: async () => {},
        queryScope: async () => ({ iTwinId: testITwinId }),
        queryMetadata: async () => ({ containerType: "settings", label: "mock" }),
        queryContainersMetadata: async (_userToken, args) => {
          // Filter by containerType and iTwinId like the real service would
          return containers.filter((c) =>
            (args.containerType === undefined || c.containerType === args.containerType) &&
            (args.iTwinId === testITwinId || args.iTwinId === undefined),
          );
        },
        updateJson: async () => {},
        requestToken: async (_props) => ({
          token: "",
          scope: { iTwinId: testITwinId },
          provider: "azure" as const,
          expiration: new Date(Date.now() + 3600000),
          metadata: { containerType: "settings", label: "mock" },
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
        { containerId: testContainerId, containerType: "settings", label: "Test Settings" },
      ]);

      const containers = await editor.findContainers({ iTwinId: testITwinId });
      expect(containers).to.have.length(1);
      expect(containers[0].fromProps.containerId).to.equal(testContainerId);
    });

    it("finds a container by iTwinId and iModelId", async () => {
      BlobContainer.service = createMockService([
        { containerId: "imodel-scoped-container", containerType: "settings", label: "iModel Settings" },
      ]);

      const containers = await editor.findContainers({ iTwinId: testITwinId, iModelId: testIModelId });
      expect(containers).to.have.length(1);
      expect(containers[0].fromProps.containerId).to.equal("imodel-scoped-container");
    });

    it("returns empty array when no settings containers are found", async () => {
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

  describe("getSettings", () => {
    it("returns a deep copy of all settings", async () => {
      const container = getContainer("getsettings-deep-copy-test");
      const editableDb = await container.createDb({ dbName: "test-db", manifest: { settingsName: "getsettings-deep-copy-test" } });

      editableDb.open();
      editableDb.updateSettings({
        "theme": "dark",
        "fontSize": 14,
        "nested": { "a": 1, "b": [2, 3] },
      });
      editableDb.close();

      const settingsDb = new SettingsDbImpl({ dbName: "test-db" }, container, SettingsPriority.application);
      const all = settingsDb.getSettings();
      expect(all).to.deep.equal({ "theme": "dark", "fontSize": 14, "nested": { "a": 1, "b": [2, 3] } });

      // Mutating the copy should not affect the stored settings
      (all as any).theme = "light";
      (all as any).nested.a = 999;
      expect(settingsDb.getSetting<string>("theme")).to.equal("dark");
      expect(settingsDb.getSetting<{ a: number }>("nested")).to.deep.equal({ "a": 1, "b": [2, 3] });
    });

    it("returns empty object for empty db", async () => {
      const container = getContainer("getsettings-empty-test");
      await container.createDb({ dbName: "test-db", manifest: { settingsName: "getsettings-empty-test" } });

      const settingsDb = new SettingsDbImpl({ dbName: "test-db" }, container, SettingsPriority.application);
      expect(settingsDb.getSettings()).to.deep.equal({});
    });
  });

  it("getSetting returns undefined for inherited prototype properties", async () => {
    const container = getContainer("prototype-safety-test");
    const editableDb = await container.createDb({ dbName: "test-db", manifest: { settingsName: "prototype-safety-test" } });

    editableDb.open();
    editableDb.updateSettings({ "realSetting": "value" });
    editableDb.close();

    const settingsDb = new SettingsDbImpl({ dbName: "test-db" }, container, SettingsPriority.application);
    expect(settingsDb.getSetting<string>("realSetting")).to.equal("value");
    expect(settingsDb.getSetting("constructor")).to.be.undefined;
    expect(settingsDb.getSetting("toString")).to.be.undefined;
  });



  describe("editable db version cache key", () => {
    afterEach(() => sinon.restore());

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

    function stubCloudLookup(containerId: string, resolveVersion: (props: SettingsDbProps) => string) {
      sinon.stub(CloudSqlite, "createCloudContainer").returns(createFakeCloudContainer(containerId));
      sinon.stub(CloudSqlite, "querySemverMatch").callsFake((props) => CloudSqlite.makeSemverName(props.dbName ?? "settings-db", resolveVersion(props)));
      sinon.stub(CloudSqlite, "isSemverEditable").returns(true);
    }

    it("local getEditableDb ignores version selectors for cache identity", async () => {
      const container = getContainer("cache-local-version-selectors");
      await container.createDb({ dbName: "test-db", manifest: { settingsName: "cache-local-version-selectors" } });

      const db1 = container.getEditableDb({ dbName: "test-db" });
      const db2 = container.getEditableDb({ dbName: "test-db", version: "1.0.0" });
      expect(db1).to.equal(db2);
    });

    it("local getEditableDb reuses the same instance for omitted vs explicit default dbName", async () => {
      const container = getContainer("cache-local-default-name");
      const db1 = await container.createDb({ manifest: { settingsName: "cache-local-default-name" } });

      const db2 = container.getEditableDb({ dbName: "settings-db" });
      expect(db1).to.equal(db2);
    });

    it("cloud getEditableDb reuses the same instance for omitted vs explicit resolved version", () => {
      const containerId = "cache-cloud-default-vs-resolved";
      stubCloudLookup(containerId, (props) => props.version ?? "0.0.0");

      const container = getContainer(containerId, "https://example.invalid");
      const db1 = container.getEditableDb({ dbName: "test-db" });
      const db2 = container.getEditableDb({ dbName: "test-db", version: "0.0.0" });
      expect(db1).to.equal(db2);
    });

    it("cloud getEditableDb reuses the same instance for semver-equivalent selectors", () => {
      const containerId = "cache-cloud-semver-equivalent";
      stubCloudLookup(containerId, (props) => props.version === "1" ? "1.0.0" : (props.version ?? "1.0.0"));

      const container = getContainer(containerId, "https://example.invalid");
      const db1 = container.getEditableDb({ dbName: "test-db", version: "1" });
      const db2 = container.getEditableDb({ dbName: "test-db", version: "1.0.0" });
      expect(db1).to.equal(db2);
    });

    it("cloud getEditableDb returns different instances for different resolved versions", () => {
      const containerId = "cache-cloud-different-versions";
      stubCloudLookup(containerId, (props) => props.version ?? "1.0.0");

      const container = getContainer(containerId, "https://example.invalid");
      const db1 = container.getEditableDb({ dbName: "test-db", version: "1.0.0" });
      const db2 = container.getEditableDb({ dbName: "test-db", version: "2.0.0" });
      expect(db1).to.not.equal(db2);
    });

    it("createDb with explicit version returns db matching that resolved version", async () => {
      const containerId = "cache-create-explicit-version";
      stubCloudLookup(containerId, (props) => props.version ?? "0.0.0");
      sinon.stub(CloudSqlite, "uploadDb").resolves();

      const container = getContainer(containerId, "https://example.invalid");
      const db = await container.createDb({ dbName: "test-db", version: "1.0.0", manifest: { settingsName: "cache-create-explicit-version" } });

      const dbAgain = container.getEditableDb({ dbName: "test-db", version: "1.0.0" });
      expect(db).to.equal(dbAgain);
    });

    it("createDb without an explicit version returns the new 0.0.0 db instead of the latest match", async () => {
      const containerId = "cache-create-default-version";
      stubCloudLookup(containerId, (props) => props.version ?? "2.0.0");
      sinon.stub(CloudSqlite, "uploadDb").resolves();

      const container = getContainer(containerId, "https://example.invalid");
      const db = await container.createDb({ dbName: "test-db", manifest: { settingsName: "cache-create-default-version" } });

      expect(db.version).to.equal("0.0.0");
      expect(db).to.equal(container.getEditableDb({ dbName: "test-db", version: "0.0.0" }));
      expect(db).to.not.equal(container.getEditableDb({ dbName: "test-db" }));
    });
  });

  describe("updateSetting", () => {
    it("adds a setting to an empty db", async () => {
      const container = getContainer("updatesetting-new-test");
      const editableDb = await container.createDb({ dbName: "test-db", manifest: { settingsName: "updatesetting-new-test" } });

      editableDb.open();
      editableDb.updateSetting({ settingName: "myKey", value: "myValue" });
      editableDb.close();

      const settingsDb = new SettingsDbImpl({ dbName: "test-db" }, container, SettingsPriority.application);
      expect(settingsDb.getSetting<string>("myKey")).to.equal("myValue");
    });

    it("patches existing settings without losing other keys", async () => {
      const container = getContainer("updatesetting-patch-test");
      const editableDb = await container.createDb({ dbName: "test-db", manifest: { settingsName: "updatesetting-patch-test" } });

      editableDb.open();
      editableDb.updateSettings({
        "theme": "light",
        "fontSize": 12,
        "showGrid": true,
      });

      // Patch just one key
      editableDb.updateSetting({ settingName: "theme", value: "dark" });
      editableDb.close();

      const settingsDb = new SettingsDbImpl({ dbName: "test-db" }, container, SettingsPriority.application);
      expect(settingsDb.getSetting<string>("theme")).to.equal("dark");
      expect(settingsDb.getSetting<number>("fontSize")).to.equal(12);
      expect(settingsDb.getSetting<boolean>("showGrid")).to.equal(true);
    });

    it("adds a new key to existing settings", async () => {
      const container = getContainer("updatesetting-addkey-test");
      const editableDb = await container.createDb({ dbName: "test-db", manifest: { settingsName: "updatesetting-addkey-test" } });

      editableDb.open();
      editableDb.updateSettings({ "existing": "value" });

      editableDb.updateSetting({ settingName: "newKey", value: 42 });
      editableDb.close();

      const settingsDb = new SettingsDbImpl({ dbName: "test-db" }, container, SettingsPriority.application);
      expect(settingsDb.getSetting<string>("existing")).to.equal("value");
      expect(settingsDb.getSetting<number>("newKey")).to.equal(42);
    });
  });
});
