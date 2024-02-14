/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import deepEqual from "deep-equal";
import { sort } from "fast-sort";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { InstanceKey, NodeKey, Ruleset } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { initialize, terminate } from "../../../IntegrationTests";
import { printRuleset } from "../../Utils";

describe("Learning Snippets", () => {
  let imodel: IModelConnection;

  before(async () => {
    await initialize();
    imodel = await SnapshotConnection.openFile("assets/datasets/Properties_60InstancesWithUrl2.ibim");
  });

  after(async () => {
    await imodel.close();
    await terminate();
  });

  describe("Hierarchy Grouping", () => {
    describe("SameLabelInstanceGroup", () => {
      it("uses `applicationStage = Query` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.Grouping.SameLabelInstanceGroup.ApplicationStage.Query.Ruleset
        // The ruleset contains a root nodes rule for `bis.SubCategory` instances. The grouping rule
        // tells the rules engine to group them by label by creating a single ECInstances node for grouped instances.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "RootNodes",
              specifications: [
                {
                  specType: "InstanceNodesOfSpecificClasses",
                  classes: { schemaName: "BisCore", classNames: ["SubCategory"] },
                  groupByClass: false,
                },
              ],
              customizationRules: [
                {
                  ruleType: "Grouping",
                  class: { schemaName: "BisCore", className: "SubCategory" },
                  groups: [
                    {
                      specType: "SameLabelInstance",
                      applicationStage: "Query",
                    },
                  ],
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Confirm that at least some nodes are merged from multiple elements
        const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(nodes).to.satisfy(
          () =>
            nodes.length > 0 &&
            nodes.some((node) => {
              return (
                NodeKey.isInstancesNodeKey(node.key) &&
                // confirm the node is merged from more than 1 instance
                node.key.instanceKeys.length > 1 &&
                // confirm all instances are of SubCategory class
                node.key.instanceKeys.every((key) => key.className === "BisCore:SubCategory")
              );
            }),
        );
      });

      it("uses `applicationStage = PostProcess` attribute", async () => {
        // __PUBLISH_EXTRACT_START__ Presentation.Hierarchies.Grouping.SameLabelInstanceGroup.ApplicationStage.PostProcess.Ruleset
        // The ruleset contains a root nodes rule for `bis.InformationPartitionElement` and `bis.Model` instances. The grouping rules
        // tells the rules engine to group them by label. `bis.InformationPartitionElement` and `bis.Model` classes have no common base class,
        // so two different grouping rules are required to define this kind of grouping and that also means that `Query` type
        // of grouping is not possible - grouping at `PostProcessing` step is required.
        const ruleset: Ruleset = {
          id: "example",
          rules: [
            {
              ruleType: "RootNodes",
              specifications: [
                {
                  specType: "InstanceNodesOfSpecificClasses",
                  classes: {
                    schemaName: "BisCore",
                    classNames: ["InformationPartitionElement", "Model"],
                    arePolymorphic: true,
                  },
                  groupByClass: false,
                  groupByLabel: false,
                },
              ],
              customizationRules: [
                {
                  ruleType: "Grouping",
                  class: { schemaName: "BisCore", className: "InformationPartitionElement" },
                  groups: [
                    {
                      specType: "SameLabelInstance",
                      applicationStage: "PostProcess",
                    },
                  ],
                },
                {
                  ruleType: "Grouping",
                  class: { schemaName: "BisCore", className: "Model" },
                  groups: [
                    {
                      specType: "SameLabelInstance",
                      applicationStage: "PostProcess",
                    },
                  ],
                },
              ],
            },
          ],
        };
        // __PUBLISH_EXTRACT_END__
        printRuleset(ruleset);

        // Confirm that at least some nodes are merged from multiple elements
        const nodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset });
        expect(nodes)
          .to.have.lengthOf(8)
          .and.to.containSubset([
            {
              key: {
                instanceKeys: (actual: InstanceKey[]) =>
                  deepEqual(sort(actual.map((ik) => ik.className)).asc(), ["BisCore:DefinitionPartition", "BisCore:DictionaryModel"]),
              },
              label: { displayValue: "BisCore.DictionaryModel" },
            },
            {
              key: {
                instanceKeys: (actual: InstanceKey[]) =>
                  deepEqual(sort(actual.map((ik) => ik.className)).asc(), ["BisCore:LinkModel", "BisCore:LinkPartition"]),
              },
              label: { displayValue: "BisCore.RealityDataSources" },
            },
            {
              key: {
                instanceKeys: (actual: InstanceKey[]) =>
                  deepEqual(sort(actual.map((ik) => ik.className)).asc(), ["BisCore:DocumentListModel", "BisCore:DocumentPartition"]),
              },
              label: { displayValue: "Converted Drawings" },
            },
            {
              key: {
                instanceKeys: (actual: InstanceKey[]) =>
                  deepEqual(sort(actual.map((ik) => ik.className)).asc(), ["BisCore:GroupInformationPartition", "Generic:GroupModel"]),
              },
              label: { displayValue: "Converted Groups" },
            },
            {
              key: {
                instanceKeys: (actual: InstanceKey[]) =>
                  deepEqual(sort(actual.map((ik) => ik.className)).asc(), ["BisCore:DocumentListModel", "BisCore:DocumentPartition"]),
              },
              label: { displayValue: "Converted Sheets" },
            },
            {
              key: {
                instanceKeys: (actual: InstanceKey[]) =>
                  deepEqual(sort(actual.map((ik) => ik.className)).asc(), ["BisCore:DefinitionModel", "BisCore:DefinitionPartition"]),
              },
              label: { displayValue: "Definition Model For DgnV8Bridge:D:\\Temp\\Properties_60InstancesWithUrl2.dgn, Default" },
            },
            {
              key: {
                instanceKeys: (actual: InstanceKey[]) =>
                  deepEqual(sort(actual.map((ik) => ik.className)).asc(), ["BisCore:PhysicalModel", "BisCore:PhysicalPartition"]),
              },
              label: { displayValue: "Properties_60InstancesWithUrl2" },
            },
            {
              key: { instanceKeys: (actual: InstanceKey[]) => deepEqual(sort(actual.map((ik) => ik.className)).asc(), ["BisCore:RepositoryModel"]) },
            },
          ]);
      });
    });
  });
});
