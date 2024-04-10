/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Mutable, OpenMode } from "@itwin/core-bentley";
import { SnapshotDb, StandaloneDb } from "../../IModelDb";
import { IModelHost } from "../../IModelHost";
import { SettingDictionary, SettingsPriority } from "../../workspace/Settings";
import { SettingSchema, SettingSchemaGroup, SettingsSchemas } from "../../workspace/SettingsSchemas";
import { IModelTestUtils } from "../IModelTestUtils";

/// cspell:ignore devstoreaccount1

describe.only("Settings", () => {
  let iModel: SnapshotDb;

  before(() => {
    SettingsSchemas.addFile(IModelTestUtils.resolveAssetFile("TestSettings.schema.json"));
    const seedFileName = IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim");
    const testFileName = IModelTestUtils.prepareOutputFile("SettingsTest", "SettingsTest.bim");
    iModel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
  });

  after(() => {
    iModel.close();
  });

  const app1: SettingSchemaGroup = {
    groupName: "app1",
    settingDefs: {
      sub1: {
        type: "string",
        enum: ["va1", "alt1"],
        enumDescriptions: [
          "descr1",
          "descr2",
        ],
        default: "val1",
        description: "the first value",
      },
      sub2: {
        type: "array",
        description: "an array",
        items: {
          type: "string",
        },
      },
      boolVal: {
        type: "boolean",
        default: true,
        description: "boolean defaults to true",
      },
      strVal: {
        type: "string",
        default: "default string val",
      },
      intVal: {
        type: "integer",
        default: 22,
      },
      obj: {
        type: "object",
        properties: {
          out: {
            type: "object",
            properties: {
              o1: {
                type: "object",
                required: ["m1", "m2"],
                properties: {
                  m1: {
                    type: "string",
                  },
                  m2: {
                    type: "number",
                  },
                },
              },
            },
          },
        },

      },
      databases: {
        type: "array",
        items: {
          type: "object",
          required: ["name", "dbName", "containerName"],
          properties: {
            name: {
              type: "string",
            },
            dbName: {
              type: "string",
            },
            containerName: {
              type: "string",
            },
            b2: {
              type: "object",
              properties: {
                o1: {
                  type: "object",
                  required: ["m1"],
                  properties: {
                    m1: {
                      type: "string",
                    },
                    m2: {
                      type: "number",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  const app1Settings = {
    "app1/sub1": "app1 value",
    "app1/sub2": {
      arr: ["app1", "app2"],
    },
    "app1/setting2": 1002,
    "app1/setting3": "app setting 3 val",
    "app1/setting5": "app setting 5 val",
  };

  const imodel1Settings = {
    "app1/sub1": "imodel1 value",
    "app1/sub2": {
      arr: ["a1", "a2"],
    },
    "app1/setting2": 2,
    "app1/setting3": "setting 3 val",
  };

  const imodel2Settings = {
    "app1/sub1": "imodel2 value",
    "app1/sub2": {
      arr: ["a21", "a22"],
    },
    "testApp/fontList": { list: 1 },
  };

  const iTwinSettings = {
    "app1/sub1": "val3",
    "app1/sub2": {
      arr: ["a31", "a32", "a33"],
    },
    "app2/setting6": "val 6",
    "app3/obj": {
      member1: "test2",
      member2: "test3",
      member3: {
        part1: "p1",
        part2: [
          { m1: 0 },
          { m1: 2 },
        ],
      },
    },
  };

  it("settings priorities", () => {

    const settings = iModel.workspace.settings;
    SettingsSchemas.addGroup(app1);
    IModelHost.appWorkspace.settings.addDictionary("app1", SettingsPriority.application, app1Settings);

    let settingsChanged = 0;
    settings.onSettingsChanged.addListener(() => settingsChanged++);

    settings.addDictionary("iModel1.setting.json", SettingsPriority.iModel, imodel1Settings);
    expect(settingsChanged).eq(1);
    settings.addDictionary("iModel2.setting.json", SettingsPriority.iModel, imodel2Settings);
    expect(settingsChanged).eq(2);
    settings.addDictionary("iTwin.setting.json", SettingsPriority.iTwin, iTwinSettings);
    expect(settingsChanged).eq(3);

    expect(() => IModelHost.appWorkspace.settings.addDictionary("iModel", SettingsPriority.iModel, imodel1Settings)).to.throw("Use IModelSettings");

    expect(settings.getString("app1/sub1")).equals(imodel2Settings["app1/sub1"]);
    expect(settings.getString("app2/setting6")).equals(iTwinSettings["app2/setting6"]);
    expect(settings.getString("app1/setting5")).equals(app1Settings["app1/setting5"]); // comes from app settings
    expect(settings.getSetting<any>("app1/sub2").arr).deep.equals(imodel2Settings["app1/sub2"].arr);

    const app3obj = settings.getSetting<any>("app3/obj");
    expect(app3obj).deep.equals(iTwinSettings["app3/obj"]);
    app3obj.member3.part2[0].m1 = "bad"; // should modify a copy
    expect(iTwinSettings["app3/obj"].member3.part2[0].m1).equal(0);

    expect(settings.getObject("app3/obj")).deep.equals(iTwinSettings["app3/obj"]); // should be original value
    expect(settings.getBoolean("app1/boolVal")).equals(true);
    expect(settings.getBoolean("app1/not there", true)).equals(true);
    expect(settings.getBoolean("app1/not there", false)).equals(false);
    expect(settings.getString("app1/strVal")).equals(app1.settingDefs.strVal.default);
    expect(settings.getNumber("app1/intVal")).equals(22);
    expect(settings.getObject("app1/intVal")).equals(undefined); // wrong type
    expect(settings.getArray("app1/intVal")).equals(undefined); // wrong type
    expect(settings.getString("app1/intVal", "oops")).equals("oops"); // wrong type
    expect(settings.getBoolean("app1/intVal", true)).equals(true); // wrong type
    expect(settings.getNumber("app1/not there", 33)).equals(33);
    expect(settings.getSetting("app1/not there")).is.undefined;
    expect(settings.getString("app2/not there", "fallback")).equals("fallback");

    iTwinSettings["app2/setting6"] = "new value for 6";
    settings.addDictionary("iTwin.setting.json", SettingsPriority.iTwin, iTwinSettings);
    expect(settings.getString("app2/setting6")).equals(iTwinSettings["app2/setting6"]);
    expect(settingsChanged).eq(4);

    (app1.settingDefs.strVal as Mutable<SettingSchema>).default = "new default";
    SettingsSchemas.addGroup(app1);

    // after re-registering, the new default should be updated
    expect(settings.getString("app1/strVal")).equals(app1.settingDefs.strVal.default);

    const inspect = settings.inspectSetting("app1/sub1");
    expect(inspect.length).equals(5);
    expect(inspect[0]).to.deep.equal({ value: "imodel2 value", dictionary: "iModel2.setting.json", priority: 500 });
    expect(inspect[1]).to.deep.equal({ value: "imodel1 value", dictionary: "iModel1.setting.json", priority: 500 });
    expect(inspect[2]).to.deep.equal({ value: "val3", dictionary: "iTwin.setting.json", priority: 400 });
    expect(inspect[3]).to.deep.equal({ value: "app1 value", dictionary: "app1", priority: 200 });
    expect(inspect[4]).to.deep.equal({ value: "val1", dictionary: "_default_", priority: 0 });

    settings.dropDictionary("iTwin.setting.json");
    expect(settingsChanged).eq(5);
    expect(settings.getString("app2/setting6")).is.undefined;

    // test validation of values vs. setting schemas
    const workspace: any = {
      dbName: "abc",
      containerId: "123",
      baseUri: "aab.com",
    };
    const fontListVal: any = [{ workspace, fontName: "arial" }, { workspace, fontName: "helvetica", fontType: 3 }];
    expect(() => SettingsSchemas.validateSetting(fontListVal, "testApp/fontList")).throws("required value for \"workspaceLimit\" is missing");
    workspace.workspaceLimit = 4;
    expect(() => SettingsSchemas.validateSetting(fontListVal, "testApp/fontList")).throws("value for testApp/fontList[1].fontType");
    fontListVal[1].fontType = "ttf";
    expect(SettingsSchemas.validateSetting(fontListVal, "testApp/fontList")).equal(fontListVal);
  });

  it("read settings file", () => {
    const appSettings = IModelHost.appWorkspace.settings;
    const iModelSettings = iModel.workspace.settings;
    const settingFileName = IModelTestUtils.resolveAssetFile("test.setting.json5");
    appSettings.addFile(settingFileName, SettingsPriority.application);
    expect(() => iModelSettings.addFile(settingFileName, SettingsPriority.application)).to.throw("Use IModelHost.appSettings");
    expect(appSettings.getString("app1/colorTheme")).equals("Light Theme");
    expect(iModelSettings.getString("app1/colorTheme")).equals("Light Theme");
    const token = appSettings.getSetting<any>("editor/tokenColorCustomizations")!;
    expect(token["Visual Studio Light"].textMateRules[0].settings.foreground).equals("#d16c6c");
    expect(token["Default High Contrast"].comments).equals("#FF0000");
    expect(appSettings.getArray<string>("editor/enableFiletypes")!.length).equals(17);
    appSettings.dropDictionary(settingFileName);
  });

  it("IModel persistent settings ", () => {
    const iModelName = IModelTestUtils.prepareOutputFile("IModelSetting", "test.bim");
    const iModel2 = IModelTestUtils.createSnapshotFromSeed(iModelName, IModelTestUtils.resolveAssetFile("test.bim"));

    const setting1: SettingDictionary = {
      "imodel/setting1": "this is from setting1",
    };
    const setting1changed: SettingDictionary = {
      "imodel/setting1": "this is changed setting1",
    };
    const gcsDbDict: SettingDictionary = {
      "gcs/databases": ["gcs/Usa", "gcs/Canada"],
    };
    iModel2.saveSettingDictionary("gcs-dbs", gcsDbDict);
    iModel2.saveSettingDictionary("test1", setting1);
    iModel2.close();

    let iModel3 = StandaloneDb.openFile(iModelName, OpenMode.ReadWrite);
    expect(iModel3.workspace.settings.getObject("gcs/databases")).to.deep.equal(gcsDbDict["gcs/databases"]);
    expect(iModel3.workspace.settings.getString("imodel/setting1")).equal(setting1["imodel/setting1"]);

    iModel3.saveSettingDictionary("test1", setting1changed);
    iModel3.close();
    iModel3 = StandaloneDb.openFile(iModelName);
    expect(iModel3.workspace.settings.getObject("gcs/databases")).to.deep.equal(gcsDbDict["gcs/databases"]);
    expect(iModel3.workspace.settings.getString("imodel/setting1")).equal(setting1changed["imodel/setting1"]);
    iModel3.deleteSettingDictionary("test1");
    iModel3.close();

    iModel3 = StandaloneDb.openFile(iModelName);
    expect(iModel3.workspace.settings.getObject("gcs/databases")).to.deep.equal(gcsDbDict["gcs/databases"]);
    expect(iModel3.workspace.settings.getString("imodel/setting1")).to.be.undefined;
    iModel3.close();
  });

});
