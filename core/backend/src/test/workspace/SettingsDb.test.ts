/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { IModelHost } from "../../IModelHost";
import { SettingsPriority } from "../../workspace/Settings";
import { EditableSettingsContainer, SettingsEditor } from "../../workspace/SettingsEditor";
import { SettingsDbImpl } from "../../internal/workspace/SettingsDbImpl";

describe("SettingsDb", () => {
  let editor: SettingsEditor;

  before(async () => {
    await IModelHost.startup();
    editor = SettingsEditor.construct();
  });

  after(() => {
    editor.close();
  });

  function getContainer(containerId: string): EditableSettingsContainer {
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
    expect(settingsDb.version).to.equal("1.0.0");
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
});
