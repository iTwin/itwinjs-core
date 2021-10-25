/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { IModelTestUtils } from "../IModelTestUtils";
import { ITwinSettings, Settings, SettingsPriority } from "../../workspace/Settings";
import { SettingsGroupSpec, SettingSpec, SettingsSpecRegistry } from "../../workspace/SettingsSpecRegistry";
import { Mutable } from "@itwin/core-bentley";
import { IModelHost } from "../../IModelHost";

describe.only("Settings", () => {

  const app1: SettingsGroupSpec = {
    groupName: "app1",
    title: "group 1 settings",
    properties: {
      "app1/sub1": {
        type: "string",
        enum: ["va1", "alt1"],
        enumDescriptions: [
          "descr1",
          "descr2",
        ],
        default: "val1",
        description: "the first value",
      },
      "app1/sub2": {
        type: "array",
        description: "an array",
      },
      "app1/boolVal": {
        type: "boolean",
        default: true,
        description: "boolean defaults to true",
      },
      "app1/strVal": {
        type: "string",
        default: "default string val",
      },
      "app1/intVal": {
        type: "integer",
        default: 22,
      },
    },
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
    const settings = IModelHost.settings;
    SettingsSpecRegistry.addGroup(app1);
    settings.addDictionary("iModel1.setting.json", SettingsPriority.iModel, imodel1Settings);
    settings.addDictionary("iModel2.setting.json", SettingsPriority.iModel, imodel2Settings);
    settings.addDictionary("iTwin.setting.json", SettingsPriority.iTwin, iTwinSettings);

    expect(settings.getSetting<string>("app1/sub1")).equals(imodel2Settings["app1/sub1"]);
    expect(settings.getSetting<string>("app2/setting6")).equals(iTwinSettings["app2/setting6"]);
    expect(settings.getSetting<any>("app1/sub2").arr).deep.equals(imodel2Settings["app1/sub2"].arr);

    const app3obj = settings.getSetting<any>("app3/obj");
    expect(app3obj).deep.equals(iTwinSettings["app3/obj"]);
    app3obj.member3.part2[0].m1 = "bad"; // should modify a copy
    expect(iTwinSettings["app3/obj"].member3.part2[0].m1).equal(0);

    expect(settings.getSetting<any>("app3/obj")).deep.equals(iTwinSettings["app3/obj"]); // should be original value
    expect(settings.getSetting<boolean>("app1/boolVal")).equals(true);
    expect(settings.getSetting<string>("app1/strVal")).equals(app1.properties["app1/strVal"].default);
    expect(settings.getSetting<number>("app1/intVal")).equals(22);
    expect(settings.getSetting("app1/not there")).is.undefined;
    expect(settings.getSetting("app2/not there", "fallback")).equals("fallback");

    iTwinSettings["app2/setting6"] = "new value for 6";
    settings.addDictionary("iTwin.setting.json", SettingsPriority.iTwin, iTwinSettings);
    expect(settings.getSetting<string>("app2/setting6")).equals(iTwinSettings["app2/setting6"]);

    (app1.properties["app1/strVal"] as Mutable<SettingSpec>).default = "new default";
    SettingsSpecRegistry.addGroup(app1);
    // after re-registering, the new default should be updated
    expect(settings.getSetting<string>("app1/strVal")).equals(app1.properties["app1/strVal"].default);

    settings.dropDictionary("iTwin.setting.json");
    expect(settings.getSetting<string>("app2/setting6")).is.undefined;
  });

  it("read settings file", () => {
    const settings = IModelHost.settings;
    settings.addFile(IModelTestUtils.resolveAssetFile("test.setting.json5"), SettingsPriority.application);
    expect(settings.getSetting<string>("workbench/colorTheme")).equals("Visual Studio Light");
    const token = settings.getSetting<any>("editor/tokenColorCustomizations");
    expect(token["Visual Studio Light"].textMateRules[0].settings.foreground).equals("#d16c6c");
    expect(token["Default High Contrast"].comments).equals("#FF0000");
    expect(settings.getSetting<string[]>("cSpell/enableFiletypes")!.length).equals(17);
  });
});
