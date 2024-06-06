/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { IModelHost, SettingsContainer, StandaloneDb, SettingsPriority, WorkspaceEditor } from "@itwin/core-backend";
import { IModelTestUtils } from "./IModelTestUtils";
import { SettingGroupSchema } from "@itwin/core-backend";
import { SettingsDictionaryProps } from "@itwin/core-backend";
import { Guid, OpenMode } from "@itwin/core-bentley";
import { AzuriteTest } from "./AzuriteTest";
import { EditableWorkspaceContainer } from "@itwin/core-backend";
import { EditableWorkspaceDb } from "@itwin/core-backend";

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
    it("SettingGroupSchema", async () => {
      // __PUBLISH_EXTRACT_START__ WorkspaceExamples.SettingGroupSchema
      const schema: SettingGroupSchema = {
        schemaPrefix: "landscapePro",
        description: "LandscapePro configuration settings",
        settingDefs: {
          "flora/preferredStyle": {
            type: "string",
            description: "The name of one of a set of predefined 'styles' of foliage that might be used to select appropriate flora",
          },
          "flora/treeDbs": {
            type: "array",
            extends: "itwin/core/workspace/workspaceDbList",
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

      expect(() => IModelHost.settingsSchemas.validateSetting("just a string", "landscapePro/flora/preferredStyle")).not.to.throw;
      expect(() => IModelHost.settingsSchemas.validateSetting(123, "landscapePro/flora/preferredStyle")).to.throw("wrong type");

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
      let preferredStyle = IModelHost.appWorkspace.settings.getString("landscapePro/flora/preferredStyle"); // undefined
      const preferredStyleOrDefault = IModelHost.appWorkspace.settings.getString("landscapePro/flora/preferredStyle", "default"); // "default"
      // __PUBLISH_SECTION_END__

      expect(defaultTool).to.equal("place-shrub");
      expect(availableTools).to.deep.equal(["place-shrub", "place-koi-pond", "apply-mulch"]);
      expect(preferredStyle).to.be.undefined;
      expect(preferredStyleOrDefault).to.equal("default");

      // __PUBLISH_SECTION_START__ WorkspaceExamples.AddSecondDictionary
      IModelHost.appWorkspace.settings.addDictionary({
        name: "LandscapeProOverrides",
        priority: SettingsPriority.application,
      }, {
        "landscapePro/flora/preferredStyle": "coniferous",
        "landscapePro/ui/defaultTool": "place-koi-pond",
        "landscapePro/ui/availableTools": ["place-gazebo", "apply-mulch"],
      });
      // __PUBLISH_SECTION_END__

      // __PUBLISH_SECTION_START__ WorkspaceExamples.GetMergedSettings
      defaultTool = IModelHost.appWorkspace.settings.getString("landscapePro/ui/defaultTool"); // "place-koi-pond"
      availableTools = IModelHost.appWorkspace.settings.getArray<string>("landscapePro/ui/availableTools"); // ["place-gazebo", "apply-mulch", "place-shrub", "place-koi-pond"]
      preferredStyle = IModelHost.appWorkspace.settings.getString("landscapePro/flora/preferredStyle"); // "coniferous"
      // __PUBLISH_SECTION_END__

      expect(defaultTool).to.equal("place-koi-pond");
      expect(availableTools).to.deep.equal(["place-gazebo", "apply-mulch", "place-shrub", "place-koi-pond"]);
      expect(preferredStyle).to.equal("coniferous");

      // __PUBLISH_SECTION_START__ WorkspaceExamples.saveSettingDictionary
      interface HardinessRange {
        minimum: number;
        maximum: number;
      }

      const range: HardinessRange = { minimum: 8, maximum: 10 };
      await iModel.acquireSchemaLock();
      iModel.saveSettingDictionary("landscapePro/iModelSettings", {
        "landscapePro/hardinessRange": range,
      });
      // __PUBLISH_SECTION_END__
      const iModelName = iModel.pathName;
      iModel.close();
      iModel = StandaloneDb.openFile(iModelName, OpenMode.ReadWrite);
      
      // __PUBLISH_SECTION_START__ WorkspaceExamples.QuerySettingDictionary
      const hardinessRange = iModel.workspace.settings.getObject<HardinessRange>("landscapePro/hardinessRange");
      // returns { minimum: 8, maximum: 10 }
      defaultTool = iModel.workspace.settings.getString("landscapePro/ui/defaultTool");
      // returns "place-koi-pond" as specified by IModelHost.appWorkspace.settings.
      // __PUBLISH_SECTION_END__
      expect(hardinessRange).to.deep.equal(range);
      expect(defaultTool).to.equal("place-koi-pond");

      IModelHost.authorizationClient = new AzuriteTest.AuthorizationClient();
      AzuriteTest.userToken = AzuriteTest.service.userToken.admin;

      const iTwinId = Guid.createValue();

      // __PUBLISH_SECTION_START__ WorkspaceExamples.CreateWorkspaceDb
      const editor = WorkspaceEditor.construct();
      const container: EditableWorkspaceContainer = await editor.createNewCloudContainer({
        // A description of the new WorkspaceContainer.
        metadata: {
          label: "trees",
          description: "trees organized by genus",
        },
        // Ownership, access control, and datacenter location are defined by the iTwin.
        scope: { iTwinId },
        // The name of the default WorkspaceDb to be created inside the new container.
        dbName: "cornus",
        // The manifest to be embedded inside the default WorkspaceDb.
        manifest: {
          // A user-facing name for the WorkspaceDb.
          workspaceName: "Trees: cornus",
          // A description of the WorkspaceDb's contents and purpose.
          description: "Trees belonging to the genus cornus",
          // The name of someone (typically an administrator) who can provide help and information
          // about this WorkspaceDb.
          contactName: "Sylvia Wood",
        },
      });
      // __PUBLISH_SECTION_END__
      
      expect(container.cloudProps).not.to.be.undefined;

      // __PUBLISH_SECTION_START__ WorkspaceExamples.AddTrees
      interface TreeResource {
        commonName: string;
        hardiness: HardinessRange;
        light: "full" | "shade" | "partial";
      }

      function addTree(treeDb: EditableWorkspaceDb, species: string, tree: TreeResource): void {
        treeDb.addString(species, JSON.stringify(tree));
      }

      const cornusDb = container.getEditableDb({ dbName: "cornus" });

      addTree(cornusDb, "alternifolia", {
        commonName: "Pagoda Dogwood",
        hardiness: { minimum: 4, maximum: 8 },
        light: "full",
      });

      addTree(cornusDb, "asperifolia", {
        commonName: "Roughleaf Dogwood",
        hardiness: { minimum: 9, maximum: 9 },
        light: "full",
      });
      // __PUBLISH_SECTION_END__
      
      expect(cornusDb.getString("alternifolia")).not.to.be.undefined;
      
      AzuriteTest.userToken = AzuriteTest.service.userToken.readWrite;
    });
  });
});
