/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { IModelTestUtils } from "./IModelTestUtils";
import {
  BlobContainer,
  EditableWorkspaceContainer, EditableWorkspaceDb,
  IModelHost, SettingGroupSchema, SettingsContainer, SettingsDictionaryProps,
  SettingsPriority, StandaloneDb, withEditTxn, Workspace, WorkspaceDb, WorkspaceDbSettingsProps, WorkspaceEditor,
} from "@itwin/core-backend";
import { assert, Guid, OpenMode } from "@itwin/core-bentley";
import { AzuriteTest } from "./AzuriteTest";

/** Example code organized as tests to make sure that it builds and runs successfully. */
describe("Workspace Examples", () => {
  let iModel: StandaloneDb;

  before(async () => {
    iModel = IModelTestUtils.openIModelForWrite("test.bim", { copyFilename: "WorkspaceExamples.bim" });
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
      await withEditTxn(iModel, async (txn) => txn.saveSettingDictionary("landscapePro/iModelSettings", {
        "landscapePro/hardinessRange": range,
      }));
      // __PUBLISH_EXTRACT_END__
      const iModelName = iModel.pathName;
      iModel.close();
      iModel = StandaloneDb.openFile(iModelName, OpenMode.ReadWrite);

      // __PUBLISH_EXTRACT_START__ WorkspaceExamples.QuerySettingDictionary
      const hardinessRange = iModel.workspace.settings.getObject<HardinessRange>("landscapePro/hardinessRange");
      // returns { minimum: 6, maximum: 8 }
      defaultTool = iModel.workspace.settings.getString("landscapePro/ui/defaultTool");
      // returns "place-koi-pond" as specified by IModelHost.appWorkspace.settings.
      // __PUBLISH_EXTRACT_END__
      expect(hardinessRange).to.deep.equal(range);
      expect(defaultTool).to.equal("place-koi-pond");

      IModelHost.authorizationClient = new AzuriteTest.AuthorizationClient();
      AzuriteTest.userToken = AzuriteTest.service.userToken.admin;

      const iTwinId = Guid.createValue();

      // __PUBLISH_EXTRACT_START__ WorkspaceExamples.SaveITwinSettings
      IModelHost.settingsSchemas.addGroup({
        schemaPrefix: "myApp",
        description: "MyApp settings",
        settingDefs: {
          defaultView: { type: "string" },
          maxDisplayedItems: { type: "integer" },
        },
      });

      await IModelHost.saveSettingDictionary(iTwinId, "myApp/settings", {
        "myApp/defaultView": "plan",
        "myApp/maxDisplayedItems": 100,
      });
      // __PUBLISH_EXTRACT_END__

      // __PUBLISH_EXTRACT_START__ WorkspaceExamples.GetITwinWorkspace
      const iTwinWorkspace = await IModelHost.getITwinWorkspace(iTwinId);
      const defaultView = iTwinWorkspace.settings.getString("myApp/defaultView");
      iTwinWorkspace.close();
      // __PUBLISH_EXTRACT_END__
      expect(defaultView).to.equal("plan");

      // __PUBLISH_EXTRACT_START__ WorkspaceExamples.ReadITwinSettings
      const workspace = await IModelHost.getITwinWorkspace(iTwinId);
      const defaultViewFromRead = workspace.settings.getString("myApp/defaultView");
      const maxItems = workspace.settings.getNumber("myApp/maxDisplayedItems");
      workspace.close();
      // __PUBLISH_EXTRACT_END__
      expect(defaultViewFromRead).to.equal("plan");
      expect(maxItems).to.equal(100);

      // __PUBLISH_EXTRACT_START__ WorkspaceExamples.DeleteITwinSetting
      await IModelHost.deleteSettingDictionary(iTwinId, "myApp/settings");
      // __PUBLISH_EXTRACT_END__
      const workspaceAfterDelete = await IModelHost.getITwinWorkspace(iTwinId);
      expect(workspaceAfterDelete.settings.getString("myApp/defaultView")).to.be.undefined;
      workspaceAfterDelete.close();

      // __PUBLISH_EXTRACT_START__ WorkspaceExamples.SaveLandscapeProToITwin
      await IModelHost.saveSettingDictionary(iTwinId, "landscapePro/iTwinDefaults", {
        "landscapePro/flora/preferredStyle": "naturalistic",
        "landscapePro/ui/defaultTool": "place-shrub",
        "landscapePro/ui/availableTools": ["place-shrub", "place-koi-pond", "apply-mulch"],
        "landscapePro/hardinessRange": { minimum: 6, maximum: 8 },
      });
      // __PUBLISH_EXTRACT_END__

      // __PUBLISH_EXTRACT_START__ WorkspaceExamples.ReadLandscapeProFromITwin
      const lpWorkspace = await IModelHost.getITwinWorkspace(iTwinId);
      const lpStyle = lpWorkspace.settings.getString("landscapePro/flora/preferredStyle"); // "naturalistic"
      const lpTool = lpWorkspace.settings.getString("landscapePro/ui/defaultTool"); // "place-shrub"
      lpWorkspace.close();
      // __PUBLISH_EXTRACT_END__
      expect(lpStyle).to.equal("naturalistic");
      expect(lpTool).to.equal("place-shrub");

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

      const svc = BlobContainer.service!;
      expect(svc).not.to.be.undefined;
      const metadata = await svc.queryMetadata({
        baseUri: cornusDb.container.fromProps.baseUri,
        containerId: cornusDb.container.fromProps.containerId,
        userToken: AzuriteTest.service.userToken.admin,
      });
      expect(metadata.containerType).to.equal("workspace");

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

      // __PUBLISH_EXTRACT_START__ WorkspaceExamples.SaveTreeDbsToITwin
      assert(undefined !== cornusDb.cloudProps);
      assert(undefined !== abiesDb.cloudProps);

      await IModelHost.saveSettingDictionary(iTwinId, "landscapePro/flora", {
        "landscapePro/flora/treeDbs": [
          { ...cornusDb.cloudProps },
          { ...abiesDb.cloudProps },
        ],
      });

      const workspaceForTreeDbs = await IModelHost.getITwinWorkspace(iTwinId);
      const workspaceTreeDbs = await workspaceForTreeDbs.getWorkspaceDbs({ settingName: "landscapePro/flora/treeDbs" });
      workspaceForTreeDbs.close();
      // __PUBLISH_EXTRACT_END__
      expect(workspaceTreeDbs.length).to.equal(2);

      // __PUBLISH_EXTRACT_START__ WorkspaceExamples.UpdateTreeDbVersionAtITwin
      await IModelHost.saveSettingDictionary(iTwinId, "landscapePro/flora", {
        "landscapePro/flora/treeDbs": [
          { ...cornusDb.cloudProps, version: "1.1.1" },
          { ...abiesDb.cloudProps },
        ],
      });
      // __PUBLISH_EXTRACT_END__

      // restore to current latest for any subsequent use
      await IModelHost.saveSettingDictionary(iTwinId, "landscapePro/flora", {
        "landscapePro/flora/treeDbs": [
          { ...cornusDb.cloudProps },
          { ...abiesDb.cloudProps },
        ],
      });

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

      // __PUBLISH_EXTRACT_START__ WorkspaceExamples.SaveITwinSettingsReferenceInIModel
      // Save a floating reference — no `version` field means the iModel
      // always loads the latest available version of the iTwin settings.
      const iTwinWorkspaceForModelRef = await IModelHost.getITwinWorkspace(iTwinId);
      const settingsSourcesForModelRef = iTwinWorkspaceForModelRef.settingsSources;
      assert(undefined !== settingsSourcesForModelRef);

      await withEditTxn(iModel, async (txn) => txn.saveSettingDictionary("landscapePro/iModelSettings", {
        "landscapePro/itwinSettingsRef": settingsSourcesForModelRef,
      }));
      iTwinWorkspaceForModelRef.close();
      // __PUBLISH_EXTRACT_END__

      // __PUBLISH_EXTRACT_START__ WorkspaceExamples.OverrideITwinSettingAtIModelLevel
      // The iTwin setting says "naturalistic", but this iModel is a formal garden.
      await withEditTxn(iModel, async (txn) => txn.saveSettingDictionary("landscapePro/iModelOverrides", {
        "landscapePro/flora/preferredStyle": "formal",
      }));
      // __PUBLISH_EXTRACT_END__

      // Reload the iModel so workspace setting dictionaries saved to disk are re-resolved.
      iModel.close();
      iModel = StandaloneDb.openFile(iModelName, OpenMode.ReadWrite);

      // verify the iModel-level override wins
      const style = iModel.workspace.settings.getString("landscapePro/flora/preferredStyle");
      expect(style).to.equal("formal");

      // __PUBLISH_EXTRACT_START__ WorkspaceExamples.LoadITwinSettingsFromIModel
      const settingsRef = iModel.workspace.settings.getSetting<WorkspaceDbSettingsProps>("landscapePro/itwinSettingsRef");
      if (settingsRef !== undefined) {
        const iTwinWs = await IModelHost.getITwinWorkspace(settingsRef);
        // iTwinWs.settings now contains the iTwin-level settings.
        // ... use the settings, then close when finished:
        iTwinWs.close();
      }
      // __PUBLISH_EXTRACT_END__

      // __PUBLISH_EXTRACT_START__ WorkspaceExamples.VersionAndPinITwinSettings
      // Pin the iModel to the exact settings version currently in use.
      // Unlike the floating reference above, adding a `version` field locks
      // the iModel to a specific snapshot — configuration won't change when
      // the iTwin's settings are updated later.
      const iTwinWorkspaceToPin = await IModelHost.getITwinWorkspace(iTwinId);
      const floatingRefs = iTwinWorkspaceToPin.settingsSources;
      assert(undefined !== floatingRefs);

      // Add an explicit version to each settings source reference.
      const sources = Array.isArray(floatingRefs) ? floatingRefs : [floatingRefs];
      const pinnedRefs = sources.map((source) => ({ ...source, version: "1.0.0" }));

      await withEditTxn(iModel, async (txn) => txn.saveSettingDictionary("landscapePro/iModelSettings", {
        "landscapePro/itwinSettingsRef": pinnedRefs,
      }));
      iTwinWorkspaceToPin.close();
      // __PUBLISH_EXTRACT_END__

      // __PUBLISH_EXTRACT_START__ WorkspaceExamples.DeleteIModelSettingDictionary
      await withEditTxn(iModel, async (txn) => txn.deleteSettingDictionary("landscapePro/iModelSettings"));
      // __PUBLISH_EXTRACT_END__
    });

    it("SettingsDb discover, find, create, update, and read", async () => {
      IModelHost.authorizationClient = new AzuriteTest.AuthorizationClient();
      AzuriteTest.userToken = AzuriteTest.service.userToken.admin;
      const iTwinId = Guid.createValue();

      // __PUBLISH_EXTRACT_START__ SettingsContainer.discoverContainers
      // Query the BlobContainer service for settings containers associated with an iTwin.
      const containerMetadata = await WorkspaceEditor.queryContainers({ iTwinId, containerType: "settings" });
      // Each entry includes a containerId and label that can be displayed in an admin UI.
      for (const entry of containerMetadata) {
        console.log(`Container: ${entry.containerId}, label: ${entry.label}`); // eslint-disable-line no-console
      }
      // __PUBLISH_EXTRACT_END__
      expect(containerMetadata).to.be.an("array");

      // __PUBLISH_EXTRACT_START__ SettingsContainer.findContainers
      // Find and open settings containers for a given iTwin in a single call.
      // This queries the BlobContainer service for settings containers matching the iTwinId,
      // requests write access tokens, and opens each matching container.
      const settingsEditor = WorkspaceEditor.construct();
      const settingsContainers = await settingsEditor.findContainers({ iTwinId, containerType: "settings" });
      expect(settingsContainers).to.not.be.undefined;
      // __PUBLISH_EXTRACT_END__
      settingsEditor.close();

      // __PUBLISH_EXTRACT_START__ SettingsContainer.createLocal
      // Advanced/admin workflow:
      // create a settings container explicitly and manage it by container identity.
      // Do not create an additional `containerType: "settings"` container for an iTwin
      // that already relies on `IModelHost.saveSettingDictionary` +
      // `IModelHost.getITwinWorkspace(iTwinId)`, because those convenience APIs
      // auto-select only a single settings container per iTwin.
      const editor = WorkspaceEditor.construct();
      const container: EditableWorkspaceContainer = await editor.createNewCloudContainer({
        metadata: { label: "Project Settings", description: "Settings for this iTwin" },
        scope: { iTwinId },
        containerType: "settings",
        manifest: { workspaceName: "settings", description: "iTwin settings container" },
      });

      // Write settings using withEditableDb — it acquires the lock, opens the db,
      // runs your callback, then closes the db and publishes.
      const settings: SettingsContainer = {
        "myApp/theme": "dark",
        "myApp/maxItems": 50,
      };
      await container.withEditableDb("admin", (settingsDb) => {
        settingsDb.updateSettingsResource(settings);
      });
      editor.close();
      // __PUBLISH_EXTRACT_END__

      // __PUBLISH_EXTRACT_START__ SettingsContainer.updateSetting
      // Update a single setting without affecting others.
      // Re-open the container, acquire the write lock, read existing settings, change one entry, and publish.
      const updateEditor = WorkspaceEditor.construct();
      const updateContainers = await updateEditor.findContainers({ iTwinId, containerType: "settings" });
      const updateContainer = updateContainers[0];
      await updateContainer.withEditableDb("admin", (db) => {
        const current = JSON.parse(db.getString("settingsDictionary") ?? "{}") as SettingsContainer;
        current["myApp/maxItems"] = 100;
        db.updateSettingsResource(current);
      });
      updateEditor.close();
      // __PUBLISH_EXTRACT_END__

      // __PUBLISH_EXTRACT_START__ SettingsContainer.getSettings
      // Read all settings stored in a settings container.
      let allSettings: SettingsContainer = {};
      const readEditor = WorkspaceEditor.construct();
      const readContainers = await readEditor.findContainers({ iTwinId, containerType: "settings" });
      const readContainer = readContainers[0];
      await readContainer.withEditableDb("admin", (readDb) => {
        const raw = readDb.getString("settingsDictionary");
        allSettings = raw ? JSON.parse(raw) as SettingsContainer : {};
      });
      readEditor.close();
      // __PUBLISH_EXTRACT_END__
      expect(allSettings["myApp/maxItems"]).to.equal(100);
      expect(allSettings["myApp/theme"]).to.equal("dark");
    });

    it("Find and open a workspace container by iTwinId", async () => {
      IModelHost.authorizationClient = new AzuriteTest.AuthorizationClient();
      AzuriteTest.userToken = AzuriteTest.service.userToken.admin;
      const iTwinId = Guid.createValue();

      // Create a workspace container so there's something to find.
      const setupEditor = WorkspaceEditor.construct();
      await setupEditor.createNewCloudContainer({
        metadata: { label: "Findable Workspace", description: "Workspace found via findContainers" },
        scope: { iTwinId },
        manifest: { workspaceName: "FindMe", description: "findContainers example" },
      });
      setupEditor.close();

      // __PUBLISH_EXTRACT_START__ WorkspaceExamples.findContainers
      // Find and open workspace containers for a given iTwin in a single call.
      // This queries the BlobContainer service for workspace containers matching the iTwinId,
      // requests write access tokens, and opens each matching container.
      const editor = WorkspaceEditor.construct();
      const containers = await editor.findContainers({ iTwinId });

      // Use the first container — it is ready for reading or editing its WorkspaceDbs.
      const container = containers[0];
      const workspaceDb = container.getEditableDb({});
      expect(workspaceDb).to.not.be.undefined;
      editor.close();
      // __PUBLISH_EXTRACT_END__
    });
  });
});
