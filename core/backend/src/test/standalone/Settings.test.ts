/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { assert, Mutable, OpenMode } from "@itwin/core-bentley";
import { SnapshotDb, StandaloneDb } from "../../IModelDb";
import { IModelHost } from "../../IModelHost";
import { SettingObject, Settings } from "../../workspace/Settings";
import { SettingSchema, SettingSchemaGroup, SettingsSchemas } from "../../workspace/SettingsSchemas";
import { IModelTestUtils } from "../IModelTestUtils";
import { GcsDbProps, GeoCoordConfig } from "../../GeoCoordConfig";

describe("Settings", () => {
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
    schemaPrefix: "app1",
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
    IModelHost.appWorkspace.settings.addDictionary({ name: "app1", priority: Settings.Priority.application }, app1Settings);

    let settingsChanged = 0;
    settings.onSettingsChanged.addListener(() => settingsChanged++);

    settings.addDictionary({ name: "iModel1.setting.json", priority: Settings.Priority.iModel }, imodel1Settings);
    expect(settingsChanged).eq(1);
    settings.addDictionary({ name: "iModel2.setting.json", priority: Settings.Priority.iModel }, imodel2Settings);
    expect(settingsChanged).eq(2);
    settings.addDictionary({ name: "iTwin.setting.json", priority: Settings.Priority.iTwin }, iTwinSettings);
    expect(settingsChanged).eq(3);

    expect(() => IModelHost.appWorkspace.settings.addDictionary({ name: "iModel", priority: Settings.Priority.iModel }, imodel1Settings)).to.throw("Use IModelSettings");

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
    expect(() => settings.getObject("app1/intVal")).throws("app1/intVal");
    expect(() => settings.getArray("app1/intVal")).throws("app1/intVal");
    expect(() => settings.getString("app1/intVal", "oops")).throws("app1/intVal");
    expect(() => settings.getBoolean("app1/intVal", true)).throws("app1/intVal");
    expect(settings.getNumber("app1/not there", 33)).equals(33);
    expect(settings.getSetting("app1/not there")).is.undefined;
    expect(settings.getString("app2/not there", "fallback")).equals("fallback");

    // list of default Gcs databases is in the backend.setting.json5 file loaded on startup
    const defaultGcs = settings.getArray<GcsDbProps>(GeoCoordConfig.settingName.defaultDatabases);
    assert(undefined !== defaultGcs);
    expect(defaultGcs.length).equals(2);
    expect(defaultGcs[0].baseUri).equal("https://geocoord-workspace.itwinjs.org");
    expect(defaultGcs[1].baseUri).equal(defaultGcs[1].baseUri);
    expect(defaultGcs[0].dbName).equal("base");
    expect(defaultGcs[1].dbName).equal("allEarth");
    expect(defaultGcs[0].priority).equals(10000);
    expect(defaultGcs[1].priority).equals(100);
    expect(defaultGcs[0].prefetch).true;
    expect(defaultGcs[1].prefetch).undefined;
    expect(defaultGcs[1].storageType).equals("azure");

    iTwinSettings["app2/setting6"] = "new value for 6";
    settings.addDictionary({ name: "iTwin.setting.json", priority: Settings.Priority.iTwin }, iTwinSettings);
    expect(settings.getString("app2/setting6")).equals(iTwinSettings["app2/setting6"]);
    expect(settingsChanged).eq(4);

    (app1.settingDefs.strVal as Mutable<SettingSchema>).default = "new default";
    SettingsSchemas.addGroup(app1);

    // after re-registering, the new default should be updated
    expect(settings.getString("app1/strVal")).equals(app1.settingDefs.strVal.default);

    expect(settings.dictionaries.length).eq(3);

    const inspect = settings.inspectSetting("app1/sub1");
    expect(inspect.length).equals(5);
    expect(inspect[0].dictionary.props).to.deep.equal({ name: "iModel2.setting.json", priority: 500 });
    expect(inspect[0].value).equal("imodel2 value");
    expect(inspect[1].dictionary.props).to.deep.equal({ name: "iModel1.setting.json", priority: 500 });
    expect(inspect[1].value).equal("imodel1 value");
    expect(inspect[2].dictionary.props).to.deep.equal({ name: "iTwin.setting.json", priority: 400 });
    expect(inspect[2].value).equal("val3");
    expect(inspect[3].dictionary.props).to.deep.equal({ name: "app1", priority: 200 });
    expect(inspect[3].value).equal("app1 value");
    expect(inspect[4].dictionary.props).to.deep.equal({ name: "_default_", priority: 0 });
    expect(inspect[4].value).equal("val1");

    settings.dropDictionary({ name: "iTwin.setting.json" });
    expect(settingsChanged).eq(5);
    expect(settings.getString("app2/setting6")).is.undefined;

    // test validation of values vs. setting schemas
    const workspace: any = { dbName: "abc", containerId: "123", baseUri: "aab.com" };
    const fontListVal: any = [{ workspace, fontName: "arial" }, { workspace, fontName: "helvetica", fontType: 3 }];
    expect(() => SettingsSchemas.validateSetting(fontListVal, "testApp/fontList")).throws("required value for \"workspaceLimit\" is missing");
    workspace.workspaceLimit = 4; // add missing value
    expect(() => SettingsSchemas.validateSetting(fontListVal, "testApp/fontList")).throws("value for testApp/fontList[1].fontType");
    fontListVal[1].fontType = "ttf"; // correct font type to string
    expect(SettingsSchemas.validateSetting(fontListVal, "testApp/fontList")).equal(fontListVal); // should now pass
  });

  it("read settings file", () => {
    const appSettings = IModelHost.appWorkspace.settings;
    const iModelSettings = iModel.workspace.settings;
    const settingFileName = IModelTestUtils.resolveAssetFile("test.setting.json5");
    expect(() => appSettings.addFile(settingFileName, Settings.Priority.iTwin)).throws("Use IModelSettings");
    appSettings.addFile(settingFileName, Settings.Priority.application);
    expect(() => iModelSettings.addFile(settingFileName, Settings.Priority.application)).to.throw("Use IModelHost.appSettings");
    expect(appSettings.getString("app1/colorTheme")).equals("Light Theme");
    expect(iModelSettings.getString("app1/colorTheme")).equals("Light Theme");
    const token = appSettings.getSetting<any>("editor/tokenColorCustomizations")!;
    expect(token["Visual Studio Light"].textMateRules[0].settings.foreground).equals("#d16c6c");
    expect(token["Default High Contrast"].comments).equals("#FF0000");
    expect(appSettings.getArray<string>("editor/enableFiletypes")!.length).equals(17);
    appSettings.dropDictionary({ name: settingFileName });
  });

  it("IModel persistent settings ", () => {
    const iModelName = IModelTestUtils.prepareOutputFile("IModelSetting", "test.bim");
    const iModel2 = IModelTestUtils.createSnapshotFromSeed(iModelName, IModelTestUtils.resolveAssetFile("test.bim"));

    const setting1: SettingObject = {
      "imodel/setting1": "this is from setting1",
    };
    const setting1changed: SettingObject = {
      "imodel/setting1": "this is changed setting1",
    };
    const gcsDbDict: SettingObject = {
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
