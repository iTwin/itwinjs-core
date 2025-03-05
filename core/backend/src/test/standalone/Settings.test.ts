/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { assert, Mutable, OpenMode } from "@itwin/core-bentley";
import { SnapshotDb, StandaloneDb } from "../../IModelDb";
import { IModelHost } from "../../IModelHost";
import { Setting, SettingsContainer, SettingsPriority } from "../../workspace/Settings";
import { SettingGroupSchema, SettingSchema } from "../../workspace/SettingsSchemas";
import { IModelTestUtils } from "../IModelTestUtils";
import { GcsDbProps, GeoCoordConfig } from "../../GeoCoordConfig";

describe("Settings", () => {
  let iModel: SnapshotDb;

  before(() => {
    IModelHost.settingsSchemas.addFile(IModelTestUtils.resolveAssetFile("TestSettings.schema.json"));
    const seedFileName = IModelTestUtils.resolveAssetFile("CompatibilityTestSeed.bim");
    const testFileName = IModelTestUtils.prepareOutputFile("SettingsTest", "SettingsTest.bim");
    iModel = IModelTestUtils.createSnapshotFromSeed(testFileName, seedFileName);
  });

  after(() => {
    iModel.close();
  });

  const app1: SettingGroupSchema = {
    description: "",
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
    IModelHost.settingsSchemas.addGroup(app1);
    IModelHost.appWorkspace.settings.addDictionary({ name: "app1", priority: SettingsPriority.application }, app1Settings);

    let settingsChanged = 0;
    settings.onSettingsChanged.addListener(() => settingsChanged++);

    settings.addDictionary({ name: "iModel1.setting.json", priority: SettingsPriority.iModel }, imodel1Settings);
    expect(settingsChanged).eq(1);
    settings.addDictionary({ name: "iModel2.setting.json", priority: SettingsPriority.iModel }, imodel2Settings);
    expect(settingsChanged).eq(2);
    settings.addDictionary({ name: "iTwin.setting.json", priority: SettingsPriority.iTwin }, iTwinSettings);
    expect(settingsChanged).eq(3);

    expect(() => IModelHost.appWorkspace.settings.addDictionary({ name: "iModel", priority: SettingsPriority.iModel }, imodel1Settings)).to.throw("Use IModelSettings");

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
    expect(settings.getString("app1/strVal")).equals(app1.settingDefs!.strVal!.default);
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
    settings.addDictionary({ name: "iTwin.setting.json", priority: SettingsPriority.iTwin }, iTwinSettings);
    expect(settings.getString("app2/setting6")).equals(iTwinSettings["app2/setting6"]);
    expect(settingsChanged).eq(4);

    (app1.settingDefs!.strVal as Mutable<SettingSchema>).default = "new default";
    IModelHost.settingsSchemas.addGroup(app1);

    // after re-registering, the new default should be updated
    expect(settings.getString("app1/strVal")).equals(app1.settingDefs!.strVal!.default);

    expect(settings.dictionaries.length).eq(3);

    const inspect = Array.from(settings.getSettingEntries("app1/sub1"));
    expect(inspect.length).equals(5);
    expect(inspect[0].dictionary.props).to.deep.equal({ name: "iModel2.setting.json", priority: SettingsPriority.iModel });
    expect(inspect[0].value).equal("imodel2 value");
    expect(inspect[1].dictionary.props).to.deep.equal({ name: "iModel1.setting.json", priority: SettingsPriority.iModel });
    expect(inspect[1].value).equal("imodel1 value");
    expect(inspect[2].dictionary.props).to.deep.equal({ name: "iTwin.setting.json", priority: SettingsPriority.iTwin });
    expect(inspect[2].value).equal("val3");
    expect(inspect[3].dictionary.props).to.deep.equal({ name: "app1", priority: SettingsPriority.application });
    expect(inspect[3].value).equal("app1 value");
    expect(inspect[4].dictionary.props).to.deep.equal({ name: "_default_", priority: 0 });
    expect(inspect[4].value).equal("val1");

    settings.dropDictionary({ name: "iTwin.setting.json" });
    expect(settingsChanged).eq(5);
    expect(settings.getString("app2/setting6")).is.undefined;

    // test validation of values vs. setting schemas
    const workspace: any = { dbName: "abc", containerId: "123", baseUri: "aab.com" };
    const fontListVal: any = [{ workspace, fontName: "arial" }, { workspace, fontName: "helvetica", fontType: 3 }];
    expect(() => IModelHost.settingsSchemas.validateSetting(fontListVal, "testApp/fontList")).throws("required value for \"workspaceLimit\" is missing");
    workspace.workspaceLimit = 4; // add missing value
    expect(() => IModelHost.settingsSchemas.validateSetting(fontListVal, "testApp/fontList")).throws("value for testApp/fontList[1].fontType");
    fontListVal[1].fontType = "ttf"; // correct font type to string
    expect(IModelHost.settingsSchemas.validateSetting(fontListVal, "testApp/fontList")).equal(fontListVal); // should now pass
  });

  it("read settings file", () => {
    const appSettings = IModelHost.appWorkspace.settings;
    const iModelSettings = iModel.workspace.settings;
    const settingFileName = IModelTestUtils.resolveAssetFile("test.setting.json5");
    expect(() => appSettings.addFile(settingFileName, SettingsPriority.iTwin)).throws("Use IModelSettings");
    appSettings.addFile(settingFileName, SettingsPriority.application);
    expect(() => iModelSettings.addFile(settingFileName, SettingsPriority.application)).to.throw("Use IModelHost.appSettings");
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

    const setting1: SettingsContainer = {
      "imodel/setting1": "this is from setting1",
    };
    const setting1changed: SettingsContainer = {
      "imodel/setting1": "this is changed setting1",
    };
    const gcsDbDict: SettingsContainer = {
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

  describe("combineArray", () => {
    function addGroup(schemaPrefix: string, type: "number" | "object", combineArray: boolean | undefined): void {
      const group: SettingGroupSchema = {
        description: "",
        schemaPrefix,
        settingDefs: {
          array: {
            type: "array",
            items: { type },
            combineArray,
          },
        },
      };

      IModelHost.settingsSchemas.addGroup(group);
    }

    function addArray(schemaPrefix: string, name: string, value: Setting[], priority: SettingsPriority | number): void {
      const settings: SettingsContainer = { };
      settings[`${schemaPrefix}/array`] = value;

      IModelHost.appWorkspace.settings.addDictionary({
        name,
        priority,
      }, settings);
    }

    it("combines arrays only if the combineArray flag is explicitly set to true", () => {
      addGroup("false", "number", false);
      addGroup("true", "number", true);
      addGroup("default", "number", undefined);

      let dictNum = 0;
      const prefixes = ["false", "true", "default"];
      for (const schemaPrefix of prefixes) {
        addArray(schemaPrefix, `app${dictNum++}`, [1, 2], SettingsPriority.application);
        addArray(schemaPrefix, `def${dictNum++}`, [3, 4], SettingsPriority.defaults);
      }

      for (const prefix of prefixes) {
        const settingName = `${prefix}/array`;
        expect(IModelHost.appWorkspace.settings.getSetting<number[]>(settingName)).to.deep.equal([1, 2]);

        const expected = ("true" === prefix ? [1, 2, 3, 4] : [1, 2]);
        expect(IModelHost.appWorkspace.settings.getArray<number>(settingName)).to.deep.equal(expected);
      }
    });

    it("orders elements by priority", () => {
      addGroup("combine", "number", true);
      function addDictionary(priority: number) {
        addArray("combine", priority.toString(), [priority], priority);
      }

      addDictionary(100);
      addDictionary(120);
      addDictionary(80);
      addDictionary(150);
      addDictionary(30);

      expect(IModelHost.appWorkspace.settings.getArray<number>("combine/array")).to.deep.equal([150, 120, 100, 80, 30]);
    });

    it("ignores duplicates with lower priority", () => {
      addGroup("numbers", "number", true);

      addArray("numbers", "a", [4, 8], 101);
      addArray("numbers", "c", [3, 6, 9, 12], 99);
      addArray("numbers", "b", [2, 4, 6, 8, 10, 12], 100);

      expect(IModelHost.appWorkspace.settings.getArray<number>("numbers/array")).to.deep.equal([4, 8, 2, 6, 10, 12, 3, 9]);

      interface Point { x: number, y: number };
      addGroup("points", "object", true);

      addArray("points", "a", [{ x: 1, y: 1 }, { x: 1, y: 2 }], 101);
      addArray("points", "b", [{ x: 2, y: 1 }, { x: 1, y: 2 }], 100);
      addArray("points", "c", [{ y: 1, x: 1 }, { y: 2, x: 1 }, { x: 3, y: 3 }], 99);

      expect(IModelHost.appWorkspace.settings.getArray<Point>("points/array")).to.deep.equal([{ x: 1, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 1 }, { x: 3, y: 3 }]);
    });
  });
});
