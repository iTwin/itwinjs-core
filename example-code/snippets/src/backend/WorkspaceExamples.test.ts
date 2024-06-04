/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { IModelHost, SettingsContainer, StandaloneDb, SettingsPriority } from "@itwin/core-backend";
import { IModelTestUtils } from "./IModelTestUtils";
import { SettingGroupSchema } from "@itwin/core-backend";
import { SettingsDictionaryProps } from "@itwin/core-backend";

/** Example code organized as tests to make sure that it builds and runs successfully. */
describe("Workspace Examples", () => {
  let iModel: StandaloneDb;

  before(async () => {
    iModel = IModelTestUtils.openIModelForWrite("test.bim");
  });

  after(() => {
    iModel.close();
  });

  it("Settings", async () => {
    // __PUBLISH_EXTRACT_START__ Settings.addDictionaryDefine
    interface TemplateRsc {
      template: {
        name: string;
        loadByDefault?: boolean;
      };
    }

    const templates: TemplateRsc[] = [
      {
        template: {
          name: "vertical 1",
          loadByDefault: false,
        },
      },
      {
        template: {
          name: "horizontal 4",
        },
      },
    ];

    const defaultsDict: SettingsContainer = {};
    defaultsDict["itwin/core/default-tool"] = "select";
    defaultsDict["itwin/samples/start/leftPane"] = true;
    defaultsDict["myApp/tree/label"] = "distribution of work";
    defaultsDict["myApp/tree/indent"] = 4;
    defaultsDict["myApp/categories"] = ["category1", "lowest", "upper"];
    defaultsDict["myApp/list/clickMode"] = "doubleClick";
    defaultsDict["myApp/templateResources"] = templates;

    // __PUBLISH_EXTRACT_END__

    // __PUBLISH_EXTRACT_START__ Settings.addDictionary
    let workspace = IModelHost.appWorkspace;
    let settings = workspace.settings;
    settings.addDictionary({ name: "initial values", priority: SettingsPriority.defaults }, defaultsDict);
    let defaultTool = settings.getString("itwin/core/default-tool"); // returns "select"
    const leftPane = settings.getBoolean("itwin/samples/start/leftPane"); // returns true
    const categories = settings.getArray<string>("myApp/categories"); // returns ["category1", "lowest", "upper"]
    const t1 = settings.getArray<TemplateRsc>("myApp/templateResources"); // returns copy of `templates`
    // __PUBLISH_EXTRACT_END__

    expect(defaultTool).eq(defaultsDict["itwin/core/default-tool"]);
    expect(leftPane).eq(defaultsDict["itwin/samples/start/leftPane"]);
    expect(categories).deep.equal(defaultsDict["myApp/categories"]);
    expect(t1).deep.equal(templates);

    // __PUBLISH_EXTRACT_START__ Settings.addITwinDictionary
    const iTwin555: SettingsContainer = {};
    iTwin555["itwin/core/default-tool"] = "measure";
    iTwin555["app5/markerName"] = "arrows";
    iTwin555["app5/markerIcon"] = "arrows.ico";

    workspace = iModel.workspace;
    settings = workspace.settings;
    settings.addDictionary({ name: "for iTwin 555", priority: SettingsPriority.iTwin }, iTwin555);
    defaultTool = settings.getString("itwin/core/default-tool"); // returns "measure"
    // __PUBLISH_EXTRACT_END__
    expect(defaultTool).eq(iTwin555["itwin/core/default-tool"]);

    // __PUBLISH_EXTRACT_START__ Settings.dropITwinDictionary
    workspace = iModel.workspace;
    settings = workspace.settings;
    settings.dropDictionary({ name: "for iTwin 555" });
    defaultTool = settings.getString("itwin/core/default-tool"); // returns "select" again
    // __PUBLISH_EXTRACT_END__
    expect(defaultTool).eq(defaultsDict["itwin/core/default-tool"]);
  });

  describe("LandscapePro", () => {
    it("SettingGroupSchema", () => {
      // __PUBLISH_EXTRACT_START__ WorkspaceExamples.SettingGroupSchema
      const schema: SettingGroupSchema = {
        schemaPrefix: "landscapePro",
        description: "LandscapePro configuration settings",
        settingDefs: {
          "flora/shrubDbs": {
            type: "string",
            description: "The name of a setting that specifies the WorkspaceDbs from which to load shrub definitions",
          },
          "flora/treeDbs": {
            type: "array",
            extends: "itwin/core/workspace/workspaceDbList",
            combineArray: false,
          },
          "ui/defaultTool": {
            type: "string",
            description: "Id of the tool that is active when the application starts",
          },
          "ui/availableTools": {
            type: "array",
            description: "Ids of tools that should be shown to the user",
            items: {
              type: "string",
            },
            combineArray: true,
          },
          hardinessRange: {
            type: "object",
            description: "Specifies the upper and lower limits on the hardiness zone for flora that can survive in a region",
            properties: {
              minimum: {
                type: "integer",
                extends: "landscapePro/hardinessZone",
                description: "The lower limit on hardiness zone for flora that can survive in a region",
              },
              maximum: {
                type: "integer",
                extends: "landscapePro/hardinessZone",
                description: "The upper limit on hardiness zone for flora that can survive in a region",
              },
            },
          },
        },
        typeDefs: {
          hardinessZone: {
            type: "integer",
            description: "A USDA hardiness zone used to describe the surivability of plants in a geographical region",
            minimum: 0,
            maximum: 13,
          }
        }
      };
      // __PUBLISH_EXTRACT_END__

      // __PUBLISH_EXTRACT_START__ WorkspaceExamples.RegisterSchema
      IModelHost.settingsSchemas.addGroup(schema);
      // __PUBLISH_SECTION_END__
      
      expect(IModelHost.settingsSchemas.typeDefs.has("landscapePro/hardinessZone")).to.be.true;
      for (const settingName of Object.keys(schema.settingDefs!)) {
        expect(IModelHost.settingsSchemas.settingDefs.has(`landscapePro/${settingName}`)).to.be.true;
      }

      expect(() => IModelHost.settingsSchemas.validateSetting("just a string", "landscapePro/flora/shrubDbs")).not.to.throw;
      expect(() => IModelHost.settingsSchemas.validateSetting(123, "landscapePro/flora/shrubDbs")).to.throw("wrong type");

      // __PUBLISH_SECTION_START__ WorkspaceExamples.AddDictionary
      const values: SettingsContainer = {
        "landscapePro/ui/defaultTool": "place-shrub",
        "landscapePro/ui/availableTools": [ "place-shrub", "place-koi-pond", "apply-mulch" ],
      };

      const props: SettingsDictionaryProps = {
        // A unique name for this dictionary.
        name: "LandscapeProDefaults",
        // This dictionary's priority relative to other dictionaries.
        priority: SettingsPriority.defaults,
      };

      IModelHost.appWorkspace.settings.addDictionary(props, values);
      // __PUBLISH_SECTION_END__

      // __PUBLISH_SECTION_START__ WorkspaceExamples.GetSettings
      let defaultTool = IModelHost.appWorkspace.settings.getString("landscapePro/ui/defaultTool"); // "place-shrub"
      let availableTools = IModelHost.appWorkspace.settings.getArray<string>("landscapePro/ui/availableTools"); // ["place-shrub", "place-koi-pond", "apply-mulch"]
      let shrubDbs = IModelHost.appWorkspace.settings.getString("landscapePro/flora/shrubDbs"); // undefined
      const shrubDbsOrDefault = IModelHost.appWorkspace.settings.getString("landscapePro/flora/shrubDbs", "defaultShrubs"); // "defaultShrubs"
      // __PUBLISH_SECTION_END__

      expect(defaultTool).to.equal("place-shrub");
      expect(availableTools).to.deep.equal(["place-shrub", "place-koi-pond", "apply-mulch"]);
      expect(shrubDbs).to.be.undefined;
      expect(shrubDbsOrDefault).to.equal("defaultShrubs");

      // __PUBLISH_SECTION_START__ WorkspaceExamples.AddSecondDictionary
      IModelHost.appWorkspace.settings.addDictionary({
        name: "LandscapeProOverrides",
        priority: SettingsPriority.application,
      }, {
        "landscapePro/flora/shrubDbs": "coniferousShrubs",
        "landscapePro/ui/defaultTool": "place-koi-pond",
        "landscapePro/ui/availableTools": ["place-gazebo", "apply-mulch"],
      });
      // __PUBLISH_SECTION_END__

      // __PUBLISH_SECTION_START__ WorkspaceExamples.GetMergedSettings
      defaultTool = IModelHost.appWorkspace.settings.getString("landscapePro/ui/defaultTool"); // "place-koi-pond"
      availableTools = IModelHost.appWorkspace.settings.getArray<string>("landscapePro/ui/availableTools"); // ["place-gazebo", "apply-mulch", "place-shrub", "place-koi-pond"]
      shrubDbs = IModelHost.appWorkspace.settings.getString("landscapePro/flora/shrubDbs"); // "coniferousShrubs"
      // __PUBLISH_SECTION_END__

      expect(defaultTool).to.equal("place-koi-pond");
      expect(availableTools).to.deep.equal(["place-gazebo", "apply-mulch", "place-shrub", "place-koi-pond"]);
      expect(shrubDbs).to.equal("coniferousShrubs");
    });
  });
});
