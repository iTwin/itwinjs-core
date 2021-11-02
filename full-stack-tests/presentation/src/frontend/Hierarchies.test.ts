/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import { Id64, using } from "@itwin/core-bentley";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import {
  ChildNodeSpecificationTypes, ECInstancesNodeKey, getInstancesCount, InstanceKey, KeySet, RegisteredRuleset, RelationshipDirection, Ruleset,
  RuleTypes,
} from "@itwin/presentation-common";
import { Presentation, PresentationManager } from "@itwin/presentation-frontend";
import { initialize, resetBackend, terminate } from "../IntegrationTests";

describe("Hierarchies", () => {

  let imodel: IModelConnection;

  before(async () => {
    await initialize();
    const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
    imodel = await SnapshotConnection.openFile(testIModelName);
    expect(imodel).is.not.null;
  });

  after(async () => {
    await imodel.close();
    await terminate();
  });

  describe("Getting node paths", () => {

    it("gets filtered node paths", async () => {
      const ruleset: Ruleset = {
        id: "getFilteredNodePaths",
        rules: [
          {
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.CustomNode,
              type: "nodeType",
              label: "filter r1",
              nestedRules: [{
                ruleType: RuleTypes.ChildNodes,
                specifications: [{
                  specType: ChildNodeSpecificationTypes.CustomNode,
                  type: "nodeType",
                  label: "filter ch1",
                }, {
                  specType: ChildNodeSpecificationTypes.CustomNode,
                  type: "nodeType",
                  label: "other ch2",
                }, {
                  specType: ChildNodeSpecificationTypes.CustomNode,
                  type: "nodeType",
                  label: "other ch3",
                  nestedRules: [{
                    ruleType: RuleTypes.ChildNodes,
                    specifications: [{
                      specType: ChildNodeSpecificationTypes.CustomNode,
                      type: "nodeType",
                      label: "filter ch4",
                    }],
                  }],
                }],
              }],
            }, {
              specType: ChildNodeSpecificationTypes.CustomNode,
              type: "nodeType",
              label: "other r2",
            }, {
              specType: ChildNodeSpecificationTypes.CustomNode,
              type: "nodeType",
              label: "other r3",
              nestedRules: [{
                ruleType: RuleTypes.ChildNodes,
                specifications: [{
                  specType: ChildNodeSpecificationTypes.CustomNode,
                  type: "nodeType",
                  label: "other ch5",
                }, {
                  specType: ChildNodeSpecificationTypes.CustomNode,
                  type: "nodeType",
                  label: "filter ch6",
                }],
              }],
            }],
          }],
      };
      const result = await Presentation.presentation.getFilteredNodePaths({ imodel, rulesetOrId: ruleset, filterText: "filter" });
      expect(result).to.matchSnapshot();
    });

    it("gets node paths based on instance key paths", async () => {
      const ruleset: Ruleset = {
        id: "getNodePaths",
        rules: [{
          ruleType: RuleTypes.RootNodes,
          specifications: [{
            specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
            classes: [{
              schemaName: "BisCore",
              classNames: ["RepositoryModel"],
            }],
            groupByClass: false,
            nestedRules: [{
              ruleType: RuleTypes.ChildNodes,
              specifications: [{
                specType: ChildNodeSpecificationTypes.RelatedInstanceNodes,
                relationshipPaths: [
                  {
                    relationship: {
                      schemaName: "BisCore",
                      className: "ModelContainsElements",
                    },
                    targetClass: {
                      schemaName: "BisCore",
                      className: "Subject",
                    },
                    direction: RelationshipDirection.Forward,
                  },
                ],
                groupByClass: false,
                groupByLabel: false,
                nestedRules: [{
                  ruleType: RuleTypes.ChildNodes,
                  specifications: [{
                    specType: ChildNodeSpecificationTypes.RelatedInstanceNodes,
                    relationshipPaths: [
                      {
                        relationship: {
                          schemaName: "BisCore",
                          className: "ElementOwnsChildElements",
                        },
                        direction: RelationshipDirection.Forward,
                      },
                    ],
                    groupByClass: true,
                    groupByLabel: false,
                  }],
                }],
              }],
            }],
          }],
        }],
      };
      /*
      [BisCore:RepositoryModel] 0x1
        [BisCore:Subject] 0x1
          [BisCore:DefinitionPartition] ECClassGroupingNode
            [BisCore:DefinitionPartition] 0x10
          [BisCore:LinkPartition] ECClassGroupingNode
            [BisCore:LinkPartition] 0xe
      */
      const key1: InstanceKey = { id: Id64.fromString("0x1"), className: "BisCore:RepositoryModel" };
      const key2: InstanceKey = { id: Id64.fromString("0x1"), className: "BisCore:Subject" };
      const key3: InstanceKey = { id: Id64.fromString("0x10"), className: "BisCore:DefinitionPartition" };
      const key4: InstanceKey = { id: Id64.fromString("0xe"), className: "BisCore:LinkPartition" };
      const keys: InstanceKey[][] = [[key1, key2, key3], [key1, key2, key4]];
      const result = await Presentation.presentation.getNodePaths({ imodel, rulesetOrId: ruleset, instancePaths: keys, markedIndex: 1 });
      expect(result).to.matchSnapshot();
    });

  });

  describe("Counting instances of selected nodes", () => {

    it("correctly counts instances when key set contains grouping node keys", async () => {
      const ruleset: Ruleset = {
        id: faker.random.word(),
        rules: [{
          ruleType: RuleTypes.RootNodes,
          specifications: [{
            specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
            classes: { schemaName: "BisCore", classNames: ["Model"] },
            arePolymorphic: true,
            groupByClass: true,
            groupByLabel: false,
          }],
        }],
      };
      await using<RegisteredRuleset, Promise<void>>(await Presentation.presentation.rulesets().add(ruleset), async () => {
        const rootNodes = await Presentation.presentation.getNodes({ imodel, rulesetOrId: ruleset.id });
        expect(rootNodes).to.matchSnapshot();
        /*
        The result should look like this (all grouping nodes):
          Label                 Grouped Instances Count
          Definition Model      1
          Dictionary Model      1
          Document List         2
          Group Model           1
          Link Model            1
          Physical Model        1
          Repository Model      1

        we're going to count instances for:
          - one of the definition model node keys
          - dictionary model's instance key
          - document list grouping node key
        the result should be 1 + 1 + 2 = 4
        */

        const definitionModelNodes = await Presentation.presentation.getNodes({
          imodel,
          rulesetOrId: ruleset.id,
          parentKey: rootNodes[0].key,
        });
        const dictionaryModelNodes = await Presentation.presentation.getNodes({
          imodel,
          rulesetOrId: ruleset.id,
          parentKey: rootNodes[1].key,
        });

        const keys = new KeySet([
          definitionModelNodes[0].key,
          ...(dictionaryModelNodes[0].key as ECInstancesNodeKey).instanceKeys,
          rootNodes[2].key,
        ]);
        const instancesCount = getInstancesCount(keys);
        expect(instancesCount).to.eq(4);
      });
    });

  });

  describe("Multiple backends for one frontend", async () => {

    let frontend: PresentationManager;

    beforeEach(async () => {
      frontend = PresentationManager.create();
    });

    afterEach(async () => {
      frontend.dispose();
    });

    it("gets child nodes after backend is reset", async () => {
      const ruleset: Ruleset = {
        id: "localization test",
        rules: [{
          ruleType: RuleTypes.RootNodes,
          specifications: [{
            specType: ChildNodeSpecificationTypes.CustomNode,
            type: "root",
            label: "root",
          }],
        }, {
          ruleType: RuleTypes.ChildNodes,
          condition: "ParentNode.Type = \"root\"",
          specifications: [{
            specType: ChildNodeSpecificationTypes.CustomNode,
            type: "child",
            label: "child",
          }],
        }],
      };
      const props = { imodel, rulesetOrId: ruleset };

      const rootNodes = await frontend.getNodes(props);
      expect(rootNodes.length).to.eq(1);
      expect(rootNodes[0].key.type).to.eq("root");

      resetBackend();

      const childNodes = await frontend.getNodes({
        ...props,
        parentKey: rootNodes[0].key,
      });
      expect(childNodes.length).to.eq(1);
      expect(childNodes[0].key.type).to.eq("child");
    });

  });

});
