/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { IModelTestUtils } from "./IModelTestUtils";
import {
  EditableWorkspaceContainer, EditableWorkspaceDb, IModelHost, SettingGroupSchema, SettingsContainer,
  SettingsDictionaryProps, SettingsPriority, StandaloneDb, Workspace, WorkspaceDb, WorkspaceEditor,
} from "@itwin/core-backend";
import { assert, Guid, OpenMode } from "@itwin/core-bentley";
import { AzuriteTest } from "./AzuriteTest";

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
          "hardinessRange": {
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
          },
        },
      };
      // __PUBLISH_EXTRACT_END__

      // __PUBLISH_EXTRACT_START__ WorkspaceExamples.RegisterSchema
      IModelHost.settingsSchemas.addGroup(schema);
      // __PUBLISH_EXTRACT_END__

      expect(IModelHost.settingsSchemas.typeDefs.has("landscapePro/hardinessZone")).to.be.true;
      for (const settingName of Object.keys(schema.settingDefs!)) {
        expect(IModelHost.settingsSchemas.settingDefs.has(`landscapePro/${settingName}`)).to.be.true;
      }

      expect(() => IModelHost.settingsSchemas.validateSetting("just a string", "landscapePro/flora/preferredStyle")).not.to.throw;
      expect(() => IModelHost.settingsSchemas.validateSetting(123, "landscapePro/flora/preferredStyle")).to.throw("wrong type");

      // __PUBLISH_EXTRACT_START__ WorkspaceExamples.AddDictionary
      const values: SettingsContainer = {
        "landscapePro/ui/defaultTool": "place-shrub",
        "landscapePro/ui/availableTools": ["place-shrub", "place-koi-pond", "apply-mulch"],
      };

      const props: SettingsDictionaryProps = {
        // A unique name for this dictionary.
        name: "LandscapeProDefaults",
        // This dictionary's priority relative to other dictionaries.
        priority: SettingsPriority.defaults,
      };

      IModelHost.appWorkspace.settings.addDictionary(props, values);
      // __PUBLISH_EXTRACT_END__

      // __PUBLISH_EXTRACT_START__ WorkspaceExamples.GetSettings
      let defaultTool = IModelHost.appWorkspace.settings.getString("landscapePro/ui/defaultTool"); // "place-shrub"
      let availableTools = IModelHost.appWorkspace.settings.getArray<string>("landscapePro/ui/availableTools"); // ["place-shrub", "place-koi-pond", "apply-mulch"]
      let preferredStyle = IModelHost.appWorkspace.settings.getString("landscapePro/flora/preferredStyle"); // undefined
      const preferredStyleOrDefault = IModelHost.appWorkspace.settings.getString("landscapePro/flora/preferredStyle", "default"); // "default"
      // __PUBLISH_EXTRACT_END__

      expect(defaultTool).to.equal("place-shrub");
      expect(availableTools).to.deep.equal(["place-shrub", "place-koi-pond", "apply-mulch"]);
      expect(preferredStyle).to.be.undefined;
      expect(preferredStyleOrDefault).to.equal("default");

      // __PUBLISH_EXTRACT_START__ WorkspaceExamples.AddSecondDictionary
      IModelHost.appWorkspace.settings.addDictionary({
        name: "LandscapeProOverrides",
        priority: SettingsPriority.application,
      }, {
        "landscapePro/flora/preferredStyle": "coniferous",
        "landscapePro/ui/defaultTool": "place-koi-pond",
        "landscapePro/ui/availableTools": ["place-gazebo", "apply-mulch"],
      });
      // __PUBLISH_EXTRACT_END__

      // __PUBLISH_EXTRACT_START__ WorkspaceExamples.GetMergedSettings
      defaultTool = IModelHost.appWorkspace.settings.getString("landscapePro/ui/defaultTool"); // "place-koi-pond"
      availableTools = IModelHost.appWorkspace.settings.getArray<string>("landscapePro/ui/availableTools"); // ["place-gazebo", "apply-mulch", "place-shrub", "place-koi-pond"]
      preferredStyle = IModelHost.appWorkspace.settings.getString("landscapePro/flora/preferredStyle"); // "coniferous"
      // __PUBLISH_EXTRACT_END__

      expect(defaultTool).to.equal("place-koi-pond");
      expect(availableTools).to.deep.equal(["place-gazebo", "apply-mulch", "place-shrub", "place-koi-pond"]);
      expect(preferredStyle).to.equal("coniferous");

      // __PUBLISH_EXTRACT_START__ WorkspaceExamples.saveSettingDictionary
      interface HardinessRange {
        minimum: number;
        maximum: number;
      }

      const range: HardinessRange = { minimum: 6, maximum: 8 };
      await iModel.acquireSchemaLock();
      iModel.saveSettingDictionary("landscapePro/iModelSettings", {
        "landscapePro/hardinessRange": range,
      });
      // __PUBLISH_EXTRACT_END__
      const iModelName = iModel.pathName;
      iModel.close();
      iModel = StandaloneDb.openFile(iModelName, OpenMode.ReadWrite);

      // __PUBLISH_EXTRACT_START__ WorkspaceExamples.QuerySettingDictionary
      const hardinessRange = iModel.workspace.settings.getObject<HardinessRange>("landscapePro/hardinessRange");
      // returns { minimum: 8, maximum: 10 }
      defaultTool = iModel.workspace.settings.getString("landscapePro/ui/defaultTool");
      // returns "place-koi-pond" as specified by IModelHost.appWorkspace.settings.
      // __PUBLISH_EXTRACT_END__
      expect(hardinessRange).to.deep.equal(range);
      expect(defaultTool).to.equal("place-koi-pond");

      IModelHost.authorizationClient = new AzuriteTest.AuthorizationClient();
      AzuriteTest.userToken = AzuriteTest.service.userToken.admin;

      const iTwinId = Guid.createValue();

      // __PUBLISH_EXTRACT_START__ WorkspaceExamples.CreateWorkspaceDb
      const editor = WorkspaceEditor.construct();

      async function createTreeDb(genus: string): Promise<EditableWorkspaceDb> {
        const label = `Trees ${genus}`;
        const description = `Trees of the genus ${genus}`;
        const container: EditableWorkspaceContainer = await editor.createNewCloudContainer({
          // A description of the new `CloudSQLite.Container` for use as a `Workspace` container.
          metadata: {
            label: `Workspace for {label}`,
            description,
          },
          // Ownership and datacenter are defined by the iTwin. Access rights are granted by RBAC administrators of the iTwin.
          scope: { iTwinId },
          // The manifest to be embedded inside the default WorkspaceDb.
          manifest: {
            // A user-facing name for the WorkspaceDb.
            workspaceName: label,
            // A description of the WorkspaceDb's contents and purpose.
            description,
            // The name of someone (typically an administrator) who can provide help and information
            // about this WorkspaceDb.
            contactName: "Lief E. Greene",
          },
        });

        container.acquireWriteLock("Lief E. Greene");

        return container.getEditableDb({});
      }
      // __PUBLISH_EXTRACT_END__

      // __PUBLISH_EXTRACT_START__ WorkspaceExamples.AddTrees
      interface TreeResource {
        commonName: string;
        hardiness: HardinessRange;
        light: "full" | "shade" | "partial";
      }

      function addTree(treeDb: EditableWorkspaceDb, species: string, tree: TreeResource): void {
        // We use a prefix to distinguish trees from other kinds of resources that might be present in the same WorkspaceDb.
        const resourceName = `landscapePro/tree/${species}`;
        treeDb.addString(resourceName, JSON.stringify(tree));
      }

      let cornusDb = await createTreeDb("cornus");
      cornusDb.open();

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

      // Close the db and release the write lock, which publishes the changes to the cloud and makes
      // them visible to other users.
      cornusDb.close();
      cornusDb.container.releaseWriteLock();

      // We have just created and populated a prerelease version (0.0.0) of the cornusDb.
      // Let's mint version 1.0.0.
      // As before, the write lock must be acquired and released, and the db must be opened and closed
      // to publish the changes to the cloud.
      cornusDb.container.acquireWriteLock("Lief E. Greene");
      const cornusMajorProps = (await cornusDb.container.createNewWorkspaceDbVersion({
        versionType: "major",
      })).newDb;
      cornusDb = cornusDb.container.getEditableDb(cornusMajorProps);
      cornusDb.open();
      cornusDb.close();
      cornusDb.container.releaseWriteLock();

      // __PUBLISH_EXTRACT_END__
      expect(cornusDb.cloudProps).not.to.be.undefined;
      expect(cornusDb.cloudProps!.version).to.equal("1.0.0");

      // __PUBLISH_EXTRACT_START__ WorkspaceExamples.CreatePatch
      cornusDb.container.acquireWriteLock("Lief E. Greene");
      const cornusPatchProps = (await cornusDb.container.createNewWorkspaceDbVersion({
        versionType: "patch",
      })).newDb;

      cornusDb = cornusDb.container.getEditableDb(cornusPatchProps);
      cornusDb.open();
      addTree(cornusDb, "racemosa", {
        commonName: "Northern Swamp Dogwood",
        hardiness: { minimum: 4, maximum: 9 },
        light: "full",
      });
      cornusDb.close();
      cornusDb.container.releaseWriteLock();

      let abiesDb = await createTreeDb("abies");
      abiesDb.open();
      addTree(abiesDb, "amabilis", {
        commonName: "Pacific Silver Fir",
        hardiness: { minimum: 5, maximum: 5 },
        light: "full",
      });
      addTree(abiesDb, "balsamea", {
        commonName: "Balsam Fir",
        hardiness: { minimum: 3, maximum: 6 },
        light: "full",
      });
      abiesDb.close();
      abiesDb.container.releaseWriteLock();

      // Mint 1.0.0 of abiesDb
      abiesDb.container.acquireWriteLock("Lief E. Greene");
      const abiesMajorProps = (await abiesDb.container.createNewWorkspaceDbVersion({
        versionType: "major",
      })).newDb;
      abiesDb = abiesDb.container.getEditableDb(abiesMajorProps);
      abiesDb.open();
      abiesDb.close();
      abiesDb.container.releaseWriteLock();

      // __PUBLISH_EXTRACT_END__
      expect(cornusDb.cloudProps!.version).to.equal("1.0.1");
      expect(abiesDb.cloudProps!.version).to.equal("1.0.0");

      AzuriteTest.userToken = AzuriteTest.service.userToken.readWrite;

      // __PUBLISH_EXTRACT_START__ WorkspaceExamples.getAvailableTrees
      async function getAvailableTrees(hardiness: HardinessRange): Promise<TreeResource[]> {
        // Resolve the list of WorkspaceDbs from the setting.
        const dbs = await iModel.workspace.getWorkspaceDbs({ settingName: "landscapePro/flora/treeDbs" });

        // Query for all the trees in all the WorkspaceDbs and collect a list of those that match the hardiness criterion.
        const trees: TreeResource[] = [];
        Workspace.queryResources({
          dbs,
          // Include only tree resources, as indicated by their name prefix.
          namePattern: "landscapePro/tree/%",
          nameCompare: "LIKE",
          callback: (resources: Iterable<{ name: string, db: WorkspaceDb }>) => {
            for (const resource of resources) {
              // Look up the tree as stringified JSON in the current WorkspaceDb.
              const str = resource.db.getString(resource.name);
              assert(undefined !== str);
              const tree = JSON.parse(str) as TreeResource;
              if (tree.hardiness.minimum <= hardiness.maximum && hardiness.minimum <= tree.hardiness.maximum) {
                trees.push(tree);
              }
            }
          },
        });

        return trees;
      }
      // __PUBLISH_EXTRACT_END__

      // __PUBLISH_EXTRACT_START__ WorkspaceExamples.QueryResources
      assert(undefined !== cornusDb.cloudProps);

      // Point the setting at the cornus WorkspaceDb.
      iModel.workspace.settings.addDictionary({
        name: "LandscapePro Trees",
        priority: SettingsPriority.iModel,
      }, {
        "landscapePro/flora/treeDbs": [
          { ...cornusDb.cloudProps },
          { ...abiesDb.cloudProps },
        ],
      });

      const anyHardiness: HardinessRange = { minimum: 0, maximum: 13 };

      let allTrees = await getAvailableTrees(anyHardiness);

      // Roughleaf Dogwood excluded because its hardiness range (9, 9) is outside of the iModel's range (6, 8).
      const iModelTrees = await getAvailableTrees(iModel.workspace.settings.getObject<HardinessRange>("landscapePro/hardinessRange", anyHardiness));
      // __PUBLISH_EXTRACT_END__

      expect(allTrees.map((x) => x.commonName)).to.deep.equal([
        "Pagoda Dogwood", "Roughleaf Dogwood", "Northern Swamp Dogwood", "Pacific Silver Fir", "Balsam Fir",
      ]);
      expect(iModelTrees.map((x) => x.commonName)).to.deep.equal(["Pagoda Dogwood", "Northern Swamp Dogwood", "Balsam Fir"]);

      // __PUBLISH_EXTRACT_START__ WorkspaceExamples.QuerySpecificVersion
      iModel.workspace.settings.addDictionary({
        name: "LandscapePro Trees",
        priority: SettingsPriority.iModel,
      }, {
        "landscapePro/flora/treeDbs": [
          {
            ...cornusDb.cloudProps,
            version: "1.0.0",
          },
          { ...abiesDb.cloudProps },
        ],
      });

      allTrees = await getAvailableTrees(anyHardiness);
      // __PUBLISH_EXTRACT_END__

      expect(allTrees.map((x) => x.commonName)).to.deep.equal(["Pagoda Dogwood", "Roughleaf Dogwood", "Pacific Silver Fir", "Balsam Fir"]);
    });
  });
});
