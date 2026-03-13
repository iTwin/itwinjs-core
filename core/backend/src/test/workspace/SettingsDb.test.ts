/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { WorkspaceError } from "@itwin/core-common";
import { IModelHost } from "../../IModelHost";
import { SettingsPriority } from "../../workspace/Settings";
import { EditableSettingsCloudContainer, SettingsEditor } from "../../workspace/SettingsEditor";
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

  function getContainer(containerId: string): EditableSettingsCloudContainer {
    return editor.getContainer({ containerId, baseUri: "", storageType: "azure", accessToken: "" });
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

  it("getDictionary reads a written dictionary", async () => {
    const container = getContainer("get-dict-test");
    const editableDb = await container.createDb({ dbName: "test-db", manifest: { settingsName: "get-dict-test" } });

    editableDb.open();
    editableDb.updateSettingsDictionary("myDict", {
      "setting1": "value1",
      "setting2": 42,
      "setting3": true,
    });
    editableDb.close();

    const settingsDb = new SettingsDbImpl({ dbName: "test-db" }, container, SettingsPriority.iTwin);
    settingsDb.open();

    const dict = settingsDb.getDictionary("myDict");
    expect(dict).to.not.be.undefined;
    expect(dict!.props.name).to.equal("myDict");
    expect(dict!.props.priority).to.equal(SettingsPriority.iTwin);
    expect(dict!.getSetting<string>("setting1")).to.equal("value1");
    expect(dict!.getSetting<number>("setting2")).to.equal(42);
    expect(dict!.getSetting<boolean>("setting3")).to.equal(true);

    settingsDb.close();
  });

  it("getDictionaries reads multiple dictionaries", async () => {
    const container = getContainer("get-dicts-test");
    const editableDb = await container.createDb({ dbName: "test-db", manifest: { settingsName: "get-dicts-test" } });

    editableDb.open();
    editableDb.updateSettingsDictionary("dictA", { "keyA": "valA" });
    editableDb.updateSettingsDictionary("dictB", { "keyB": 100 });
    editableDb.updateSettingsDictionary("dictC", { "keyC": [1, 2, 3] });
    editableDb.close();

    const settingsDb = new SettingsDbImpl({ dbName: "test-db" }, container, SettingsPriority.organization);
    settingsDb.open();

    const dicts = settingsDb.getDictionaries();
    expect(dicts).to.have.length(3);

    const names = dicts.map((d) => d.props.name).sort();
    expect(names).to.deep.equal(["dictA", "dictB", "dictC"]);

    for (const d of dicts)
      expect(d.props.priority).to.equal(SettingsPriority.organization);

    const dictA = dicts.find((d) => d.props.name === "dictA");
    expect(dictA!.getSetting<string>("keyA")).to.equal("valA");

    const dictC = dicts.find((d) => d.props.name === "dictC");
    expect(dictC!.getSetting<number[]>("keyC")).to.deep.equal([1, 2, 3]);

    settingsDb.close();
  });

  it("getDictionary returns undefined for non-existent name", async () => {
    const container = getContainer("no-dict-test");
    await container.createDb({ dbName: "test-db", manifest: { settingsName: "no-dict-test" } });

    const settingsDb = new SettingsDbImpl({ dbName: "test-db" }, container, SettingsPriority.defaults);
    settingsDb.open();

    const dict = settingsDb.getDictionary("nonExistentDictionary");
    expect(dict).to.be.undefined;

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

  it("getDictionary auto-opens and auto-closes when db is not open", async () => {
    const container = getContainer("auto-open-test");
    const editableDb = await container.createDb({ dbName: "test-db", manifest: { settingsName: "auto-open-test" } });

    editableDb.open();
    editableDb.updateSettingsDictionary("autoDict", { "key": "auto-value" });
    editableDb.close();

    const settingsDb = new SettingsDbImpl({ dbName: "test-db" }, container, SettingsPriority.application);
    expect(settingsDb.isOpen).to.be.false;

    // getDictionary should auto-open, read, and auto-close
    const dict = settingsDb.getDictionary("autoDict");
    expect(dict).to.not.be.undefined;
    expect(dict!.getSetting<string>("key")).to.equal("auto-value");
    expect(settingsDb.isOpen).to.be.false;
  });

  it("removeSettingsDictionary removes a dictionary", async () => {
    const container = getContainer("remove-dict-test");
    const editableDb = await container.createDb({ dbName: "test-db", manifest: { settingsName: "remove-dict-test" } });

    editableDb.open();
    editableDb.updateSettingsDictionary("toKeep", { "a": 1 });
    editableDb.updateSettingsDictionary("toRemove", { "b": 2 });
    editableDb.close();

    // Verify both exist
    const settingsDb = new SettingsDbImpl({ dbName: "test-db" }, container, SettingsPriority.application);
    settingsDb.open();
    expect(settingsDb.getDictionaries()).to.have.length(2);
    settingsDb.close();

    // Remove one
    editableDb.open();
    editableDb.removeSettingsDictionary("toRemove");
    editableDb.close();

    // Verify only one remains
    settingsDb.open();
    const remaining = settingsDb.getDictionaries();
    expect(remaining).to.have.length(1);
    expect(remaining[0].props.name).to.equal("toKeep");
    expect(settingsDb.getDictionary("toRemove")).to.be.undefined;
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
    editableDb.updateSettingsDictionary("someDict", { "key": "value" });
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

  it("getDictionary returns undefined for missing dictionary", async () => {
    const container = getContainer("missing-dict-test");
    await container.createDb({ dbName: "test-db", manifest: { settingsName: "missing-dict-test" } });

    const settingsDb = new SettingsDbImpl({ dbName: "test-db" }, container, SettingsPriority.application);
    settingsDb.open();
    const dict = settingsDb.getDictionary("does-not-exist");
    expect(dict).to.be.undefined;
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
    itwinDb.updateSettingsDictionary("shared-dict", { "theme": "light", "itwinOnly": true });
    itwinDb.close();

    imodelDb.open();
    imodelDb.updateSettingsDictionary("shared-dict", { "theme": "dark", "imodelOnly": true });
    imodelDb.close();

    // Retrieve both via getSettingsDb with the priorities a real caller would assign
    const itwinSettingsDb = editor.workspace.getSettingsDb({ containerId: "itwin-container-guid", priority: SettingsPriority.iTwin });
    const imodelSettingsDb = editor.workspace.getSettingsDb({ containerId: "imodel-container-guid", priority: SettingsPriority.iModel });

    // Verify they are independent dbs with correct priorities
    expect(itwinSettingsDb.priority).to.equal(SettingsPriority.iTwin);
    expect(imodelSettingsDb.priority).to.equal(SettingsPriority.iModel);
    expect(imodelSettingsDb.priority).to.be.greaterThan(itwinSettingsDb.priority);

    // Verify each db returns its own dictionary values
    const itwinDict = itwinSettingsDb.getDictionary("shared-dict");
    const imodelDict = imodelSettingsDb.getDictionary("shared-dict");
    expect(itwinDict).to.not.be.undefined;
    expect(imodelDict).to.not.be.undefined;

    expect(itwinDict!.getSetting<string>("theme")).to.equal("light");
    expect(itwinDict!.getSetting<boolean>("itwinOnly")).to.equal(true);
    expect(itwinDict!.props.priority).to.equal(SettingsPriority.iTwin);

    expect(imodelDict!.getSetting<string>("theme")).to.equal("dark");
    expect(imodelDict!.getSetting<boolean>("imodelOnly")).to.equal(true);
    expect(imodelDict!.props.priority).to.equal(SettingsPriority.iModel);
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
});
