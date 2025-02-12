/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Id64 } from "@itwin/core-bentley";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import { ChildNodeSpecificationTypes, InstanceKey, RelationshipDirection, Ruleset, RuleTypes } from "@itwin/presentation-common";
import { Presentation } from "@itwin/presentation-frontend";
import { initialize, terminate } from "../../IntegrationTests";

describe("Hierarchies", () => {
  before(async () => {
    await initialize();
  });

  after(async () => {
    await terminate();
  });

  describe("Getting node paths", () => {
    let imodel: IModelConnection;

    before(async () => {
      const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
      imodel = await SnapshotConnection.openFile(testIModelName);
    });

    after(async () => {
      await imodel.close();
    });

    it("gets filtered node paths", async () => {
      const ruleset: Ruleset = {
        id: "getFilteredNodePaths",
        rules: [
          {
            ruleType: RuleTypes.RootNodes,
            specifications: [
              {
                specType: ChildNodeSpecificationTypes.CustomNode,
                type: "nodeType1",
                label: "filter r1",
                nestedRules: [
                  {
                    ruleType: RuleTypes.ChildNodes,
                    specifications: [
                      {
                        specType: ChildNodeSpecificationTypes.CustomNode,
                        type: "nodeType11",
                        label: "filter ch1",
                      },
                      {
                        specType: ChildNodeSpecificationTypes.CustomNode,
                        type: "nodeType12",
                        label: "other ch2",
                      },
                      {
                        specType: ChildNodeSpecificationTypes.CustomNode,
                        type: "nodeType13",
                        label: "other ch3",
                        nestedRules: [
                          {
                            ruleType: RuleTypes.ChildNodes,
                            specifications: [
                              {
                                specType: ChildNodeSpecificationTypes.CustomNode,
                                type: "nodeType131",
                                label: "filter ch4",
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
              {
                specType: ChildNodeSpecificationTypes.CustomNode,
                type: "nodeType2",
                label: "other r2",
              },
              {
                specType: ChildNodeSpecificationTypes.CustomNode,
                type: "nodeType3",
                label: "other r3",
                nestedRules: [
                  {
                    ruleType: RuleTypes.ChildNodes,
                    specifications: [
                      {
                        specType: ChildNodeSpecificationTypes.CustomNode,
                        type: "nodeType31",
                        label: "other ch5",
                      },
                      {
                        specType: ChildNodeSpecificationTypes.CustomNode,
                        type: "nodeType32",
                        label: "filter ch6",
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };
      const result = await Presentation.presentation.getFilteredNodePaths({ imodel, rulesetOrId: ruleset, filterText: "filter" });
      expect(result).to.matchSnapshot();
    });

    it("gets node paths based on instance key paths", async () => {
      const ruleset: Ruleset = {
        id: "getNodePaths",
        rules: [
          {
            ruleType: RuleTypes.RootNodes,
            specifications: [
              {
                specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
                classes: [
                  {
                    schemaName: "BisCore",
                    classNames: ["RepositoryModel"],
                  },
                ],
                groupByClass: false,
                nestedRules: [
                  {
                    ruleType: RuleTypes.ChildNodes,
                    specifications: [
                      {
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
                        nestedRules: [
                          {
                            ruleType: RuleTypes.ChildNodes,
                            specifications: [
                              {
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
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
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
      const keys: InstanceKey[][] = [
        [key1, key2, key3],
        [key1, key2, key4],
      ];
      const result = await Presentation.presentation.getNodePaths({ imodel, rulesetOrId: ruleset, instancePaths: keys, markedIndex: 1 });
      expect(result).to.matchSnapshot();
    });
  });
});
