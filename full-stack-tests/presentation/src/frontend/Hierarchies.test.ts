/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import * as faker from "faker";
import { Guid, Id64, using } from "@itwin/core-bentley";
import { BisCodeSpec, IModel } from "@itwin/core-common";
import { IModelConnection, SnapshotConnection } from "@itwin/core-frontend";
import {
  ChildNodeSpecificationTypes, ECInstancesNodeKey, getInstancesCount, GroupingSpecificationTypes, HierarchyRequestOptions, InstanceKey, KeySet, Node,
  NodeKey, RegisteredRuleset, RelationshipDirection, Ruleset, RulesetVariable, RuleTypes,
} from "@itwin/presentation-common";
import { Presentation, PresentationManager } from "@itwin/presentation-frontend";
import { initialize, resetBackend, terminate } from "../IntegrationTests";
import { buildTestIModel, IModelBuilder } from "../Utils";

describe("Hierarchies", () => {

  before(async () => {
    await initialize();
  });

  after(async () => {
    await terminate();
  });

  describe("Filtering hierarchy levels", () => {

    function insertDocumentPartition(builder: IModelBuilder, code: string, label?: string) {
      const id = builder.insertElement({
        classFullName: "BisCore:DocumentPartition",
        model: IModel.repositoryModelId,
        parent: { relClassName: "BisCore:SubjectOwnsPartitionElements", id: IModel.rootSubjectId },
        code: builder.createCode(IModel.rootSubjectId, BisCodeSpec.informationPartitionElement, code),
        userLabel: label,
      });
      return { className: "BisCore:DocumentPartition", id };
    }

    it("filters root instance nodes hierarchy level", async () => {
      // set up imodel with 2 DocumentPartition elements "a" and "b"
      const imodelElementKeys: InstanceKey[] = [];
      const imodel = await buildTestIModel("root-hierarchy-level-filtering", (builder) => {
        imodelElementKeys.push(
          insertDocumentPartition(builder, "a"),
          insertDocumentPartition(builder, "b"),
        );
      });

      // set up ruleset
      const ruleset: Ruleset = {
        id: Guid.createValue(),
        rules: [{
          ruleType: RuleTypes.RootNodes,
          specifications: [{
            specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
            classes: [{
              schemaName: "BisCore",
              classNames: ["DocumentPartition"],
              arePolymorphic: true,
            }],
            groupByClass: false,
            groupByLabel: false,
          }],
        }],
      };

      // validate nodes without any filter
      await validateHierarchy({
        requestParams: { imodel, rulesetOrId: ruleset },
        expectedHierarchy: [
          NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[0]], label: "a" }),
          NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[1]], label: "b" }),
        ],
      });

      // validate nodes with partially matching filter
      await validateHierarchy({
        requestParams: { imodel, rulesetOrId: ruleset, instanceFilter: `this.CodeValue = "b"` },
        expectedHierarchy: [
          NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[1]], label: "b" }),
        ],
      });

      // validate nodes with fully matching filter
      await validateHierarchy({
        requestParams: { imodel, rulesetOrId: ruleset, instanceFilter: `this.Model.Id = ${IModel.repositoryModelId}` },
        expectedHierarchy: [
          NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[0]], label: "a" }),
          NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[1]], label: "b" }),
        ],
      });

      // validate nodes with non-matching filter
      await validateHierarchy({
        requestParams: { imodel, rulesetOrId: ruleset, instanceFilter: `this.CodeValue = "x"` },
        expectedHierarchy: [],
      });
    });

    it("filters child instance nodes hierarchy level", async () => {
      // set up imodel with 2 DocumentPartition elements "a" and "b"
      const imodelElementKeys: InstanceKey[] = [];
      const imodel = await buildTestIModel("child-hierarchy-level-filtering", (builder) => {
        imodelElementKeys.push(
          insertDocumentPartition(builder, "a"),
          insertDocumentPartition(builder, "b"),
        );
      });

      // set up ruleset
      const ruleset: Ruleset = {
        id: Guid.createValue(),
        rules: [{
          ruleType: RuleTypes.RootNodes,
          specifications: [{
            specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
            classes: [{
              schemaName: "BisCore",
              classNames: ["Subject"],
            }],
            groupByClass: false,
            groupByLabel: false,
          }],
        }, {
          ruleType: RuleTypes.ChildNodes,
          specifications: [{
            specType: ChildNodeSpecificationTypes.RelatedInstanceNodes,
            relationshipPaths: [{
              relationship: { schemaName: "BisCore", className: "SubjectOwnsPartitionElements" },
              direction: RelationshipDirection.Forward,
              targetClass: { schemaName: "BisCore", className: "DocumentPartition" },
            }],
            groupByClass: false,
            groupByLabel: false,
          }],
        }],
      };

      // validate nodes without any filter
      await validateHierarchy({
        requestParams: { imodel, rulesetOrId: ruleset },
        expectedHierarchy: [
          NodeValidators.createForInstanceNode({
            instanceKeys: [{ className: "BisCore:Subject", id: IModel.rootSubjectId }],
            children: [
              NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[0]], label: "a" }),
              NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[1]], label: "b" }),
            ],
          }),
        ],
      });

      // validate nodes with partially matching filter
      await validateHierarchy({
        requestParams: { imodel, rulesetOrId: ruleset },
        configureParams: (params) => {
          if (params.parentKey && NodeKey.isInstancesNodeKey(params.parentKey) && params.parentKey.instanceKeys.some((k) => k.className === "BisCore:Subject"))
            params.instanceFilter = `this.CodeValue = "b"`;
        },
        expectedHierarchy: [
          NodeValidators.createForInstanceNode({
            instanceKeys: [{ className: "BisCore:Subject", id: IModel.rootSubjectId }],
            children: [
              NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[1]], label: "b" }),
            ],
          }),
        ],
      });

      // validate nodes with fully matching filter
      await validateHierarchy({
        requestParams: { imodel, rulesetOrId: ruleset },
        configureParams: (params) => {
          if (params.parentKey && NodeKey.isInstancesNodeKey(params.parentKey) && params.parentKey.instanceKeys.some((k) => k.className === "BisCore:Subject"))
            params.instanceFilter = `this.Model.Id = ${IModel.repositoryModelId}`;
        },
        expectedHierarchy: [
          NodeValidators.createForInstanceNode({
            instanceKeys: [{ className: "BisCore:Subject", id: IModel.rootSubjectId }],
            children: [
              NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[0]], label: "a" }),
              NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[1]], label: "b" }),
            ],
          }),
        ],
      });

      // validate nodes with non-matching filter
      await validateHierarchy({
        requestParams: { imodel, rulesetOrId: ruleset },
        configureParams: (params) => {
          if (params.parentKey && NodeKey.isInstancesNodeKey(params.parentKey) && params.parentKey.instanceKeys.some((k) => k.className === "BisCore:Subject"))
            params.instanceFilter = `this.CodeValue = "x"`;
        },
        expectedHierarchy: [
          NodeValidators.createForInstanceNode({
            instanceKeys: [{ className: "BisCore:Subject", id: IModel.rootSubjectId }],
            expectChildren: true,
            children: [],
          }),
        ],
      });
    });

    it("filters grouped hierarchy levels", async () => {
      // set up imodel with 3 DocumentPartition elements: "a", "a" and "b"
      const imodelElementKeys: InstanceKey[] = [];
      const imodel = await buildTestIModel("grouped-hierarchy-level-filtering", (builder) => {
        imodelElementKeys.push(
          insertDocumentPartition(builder, "a1", "a"),
          insertDocumentPartition(builder, "a2", "a"),
          insertDocumentPartition(builder, "b"),
        );
      });

      // set up ruleset for a hierarchy that looks like this:
      // - Document Partition (DocumentPartition class grouping node)
      //   - grouped-hierarchy-level-filtering (Model property grouping node)
      //    - a (label grouping node)
      //      - a (instance node #1)
      //      - a (instance node #2)
      //    - b (label grouping node)
      const ruleset: Ruleset = {
        id: Guid.createValue(),
        rules: [{
          ruleType: RuleTypes.RootNodes,
          specifications: [{
            specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
            classes: [{
              schemaName: "BisCore",
              classNames: ["DocumentPartition"],
              arePolymorphic: true,
            }],
            groupByClass: true,
            groupByLabel: true,
          }],
        }, {
          ruleType: RuleTypes.Grouping,
          class: { schemaName: "BisCore", className: "DocumentPartition" },
          groups: [{
            specType: GroupingSpecificationTypes.Property,
            propertyName: "Model",
            createGroupForSingleItem: true,
          }],
        }],
      };

      // validate nodes without any filter
      await validateHierarchy({
        requestParams: { imodel, rulesetOrId: ruleset },
        expectedHierarchy: [
          NodeValidators.createForClassGroupingNode({
            className: "BisCore:DocumentPartition",
            children: [
              NodeValidators.createForPropertyGroupingNode({
                className: "BisCore:DocumentPartition",
                propertyName: "Model",
                children: [
                  NodeValidators.createForLabelGroupingNode({
                    label: "a",
                    children: [
                      NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[0]], label: "a" }),
                      NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[1]], label: "a" }),
                    ],
                  }),
                  NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[2]], label: "b" }),
                ],
              }),
            ],
          }),
        ],
      });

      // validate nodes with partially matching filter
      await validateHierarchy({
        requestParams: { imodel, rulesetOrId: ruleset, instanceFilter: `this.UserLabel = "a"` },
        expectedHierarchy: [
          NodeValidators.createForClassGroupingNode({
            className: "BisCore:DocumentPartition",
            children: [
              NodeValidators.createForPropertyGroupingNode({
                className: "BisCore:DocumentPartition",
                propertyName: "Model",
                children: [
                  NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[0]], label: "a" }),
                  NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[1]], label: "a" }),
                ],
              }),
            ],
          }),
        ],
      });

      // validate nodes with fully matching filter
      await validateHierarchy({
        requestParams: { imodel, rulesetOrId: ruleset, instanceFilter: `this.Model.Id = ${IModel.repositoryModelId}` },
        expectedHierarchy: [
          NodeValidators.createForClassGroupingNode({
            className: "BisCore:DocumentPartition",
            children: [
              NodeValidators.createForPropertyGroupingNode({
                className: "BisCore:DocumentPartition",
                propertyName: "Model",
                children: [
                  NodeValidators.createForLabelGroupingNode({
                    label: "a",
                    children: [
                      NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[0]], label: "a" }),
                      NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[1]], label: "a" }),
                    ],
                  }),
                  NodeValidators.createForInstanceNode({ instanceKeys: [imodelElementKeys[2]], label: "b" }),
                ],
              }),
            ],
          }),
        ],
      });

      // validate nodes with non-matching filter
      await validateHierarchy({
        requestParams: { imodel, rulesetOrId: ruleset, instanceFilter: `this.CodeValue = "x"` },
        expectedHierarchy: [],
      });
    });

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
            specifications: [{
              specType: ChildNodeSpecificationTypes.CustomNode,
              type: "nodeType1",
              label: "filter r1",
              nestedRules: [{
                ruleType: RuleTypes.ChildNodes,
                specifications: [{
                  specType: ChildNodeSpecificationTypes.CustomNode,
                  type: "nodeType11",
                  label: "filter ch1",
                }, {
                  specType: ChildNodeSpecificationTypes.CustomNode,
                  type: "nodeType12",
                  label: "other ch2",
                }, {
                  specType: ChildNodeSpecificationTypes.CustomNode,
                  type: "nodeType13",
                  label: "other ch3",
                  nestedRules: [{
                    ruleType: RuleTypes.ChildNodes,
                    specifications: [{
                      specType: ChildNodeSpecificationTypes.CustomNode,
                      type: "nodeType131",
                      label: "filter ch4",
                    }],
                  }],
                }],
              }],
            }, {
              specType: ChildNodeSpecificationTypes.CustomNode,
              type: "nodeType2",
              label: "other r2",
            }, {
              specType: ChildNodeSpecificationTypes.CustomNode,
              type: "nodeType3",
              label: "other r3",
              nestedRules: [{
                ruleType: RuleTypes.ChildNodes,
                specifications: [{
                  specType: ChildNodeSpecificationTypes.CustomNode,
                  type: "nodeType31",
                  label: "other ch5",
                }, {
                  specType: ChildNodeSpecificationTypes.CustomNode,
                  type: "nodeType32",
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

    let imodel: IModelConnection;

    before(async () => {
      const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
      imodel = await SnapshotConnection.openFile(testIModelName);
    });

    after(async () => {
      await imodel.close();
    });

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

    let imodel: IModelConnection;
    let frontend: PresentationManager;

    before(async () => {
      const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
      imodel = await SnapshotConnection.openFile(testIModelName);
    });

    after(async () => {
      await imodel.close();
    });

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

interface HierarchyDef<TNode> {
  node: TNode;
  children?: Array<HierarchyDef<TNode>>;
}
type ExpectedHierarchyDef = HierarchyDef<(node: Node) => void>;
namespace NodeValidators {
  function validateBaseNodeAttributes(node: Node, expectations: {
    label?: string;
    hasChildren?: boolean;
  }) {
    if (expectations.label && node.label.displayValue !== expectations.label) {
      throw new Error(`Expected node label to be "${expectations.label}", got "${node.label.displayValue}"`);
    }
    if ((node.hasChildren ?? false) !== (expectations.hasChildren ?? false)) {
      throw new Error(`Expected node's \`hasChildren\` flag to be ${expectations.hasChildren ? "TRUE" : "FALSE"}, got ${node.hasChildren ? "TRUE" : "FALSE"}`);
    }
  }
  export function createForInstanceNode(props: {
    instanceKeys: InstanceKey[];
    label?: string;
    expectChildren?: boolean;
    children?: ExpectedHierarchyDef[];
  }): ExpectedHierarchyDef {
    return {
      node: (node) => {
        if (!NodeKey.isInstancesNodeKey(node.key)) {
          throw new Error(`Expected an instance node, got "${node.key.type}"`);
        }
        if (node.key.instanceKeys.length !== props.instanceKeys.length || !node.key.instanceKeys.every((nk) => props.instanceKeys.some((ek) => 0 === InstanceKey.compare(nk, ek)))) {
          throw new Error(`Expected node to represent instance keys ${JSON.stringify(props.instanceKeys)}, got ${JSON.stringify(node.key.instanceKeys)}`);
        }
        validateBaseNodeAttributes(node, {
          label: props.label,
          hasChildren: props.expectChildren ?? (props.children && props.children.length > 0),
        });
      },
      children: props.children,
    };
  }
  export function createForClassGroupingNode(props: {
    className: string;
    label?: string;
    expectChildren?: boolean;
    children?: ExpectedHierarchyDef[];
  }): ExpectedHierarchyDef {
    return {
      node: (node) => {
        if (!NodeKey.isClassGroupingNodeKey(node.key)) {
          throw new Error(`Expected a class grouping node, got "${node.key.type}"`);
        }
        if (node.key.className !== props.className) {
          throw new Error(`Expected node to represent class "${props.className}", got "${node.key.className}"`);
        }
        validateBaseNodeAttributes(node, {
          label: props.label,
          hasChildren: props.expectChildren ?? (props.children && props.children.length > 0),
        });
      },
      children: props.children,
    };
  }
  export function createForPropertyGroupingNode(props: {
    className: string;
    propertyName: string;
    groupingValues?: any[];
    label?: string;
    expectChildren?: boolean;
    children?: ExpectedHierarchyDef[];
  }): ExpectedHierarchyDef {
    return {
      node: (node) => {
        if (!NodeKey.isPropertyGroupingNodeKey(node.key)) {
          throw new Error(`Expected a property grouping node, got "${node.key.type}"`);
        }
        if (node.key.className !== props.className) {
          throw new Error(`Expected node to represent a property from class "${props.className}", got "${node.key.className}"`);
        }
        if (node.key.propertyName !== props.propertyName) {
          throw new Error(`Expected node to represent a property "${props.propertyName}", got "${node.key.propertyName}"`);
        }
        if (props.groupingValues && (node.key.groupingValues.length !== props.groupingValues.length || !node.key.groupingValues.every((v) => props.groupingValues!.includes(v)))) {
          throw new Error(`Expected node to group values ${JSON.stringify(props.groupingValues)}, got ${JSON.stringify(node.key.groupingValues)}`);
        }
        validateBaseNodeAttributes(node, {
          label: props.label,
          hasChildren: props.expectChildren ?? (props.children && props.children.length > 0),
        });
      },
      children: props.children,
    };
  }
  export function createForLabelGroupingNode(props: {
    label: string;
    expectChildren?: boolean;
    children?: ExpectedHierarchyDef[];
  }): ExpectedHierarchyDef {
    return {
      node: (node) => {
        if (!NodeKey.isLabelGroupingNodeKey(node.key)) {
          throw new Error(`Expected a label grouping node, got "${node.key.type}"`);
        }
        validateBaseNodeAttributes(node, {
          label: props.label,
          hasChildren: props.expectChildren ?? (props.children && props.children.length > 0),
        });
      },
      children: props.children,
    };
  }
}

async function validateHierarchy(props: {
  manager?: PresentationManager;
  requestParams: HierarchyRequestOptions<IModelConnection, NodeKey, RulesetVariable>;
  configureParams?: (params: HierarchyRequestOptions<IModelConnection, NodeKey, RulesetVariable>) => void;
  expectedHierarchy: ExpectedHierarchyDef[];
}) {
  const manager = props.manager ?? Presentation.presentation;

  const requestParams = { ...props.requestParams };
  if (props.configureParams)
    props.configureParams(requestParams);

  const nodes = await manager.getNodes(requestParams);

  if (nodes.length !== props.expectedHierarchy.length) {
    throw new Error(`Expected ${props.expectedHierarchy.length} nodes, got ${nodes.length}`);
  }

  const resultHierarchy = new Array<HierarchyDef<NodeKey>>();

  for (let i = 0; i < nodes.length; ++i) {
    const actualNode = nodes[i];
    resultHierarchy.push({ node: actualNode.key });

    const expectation = props.expectedHierarchy[i];
    expectation.node(actualNode);

    const childrenParams = { ...requestParams, parentKey: actualNode.key };
    if (!NodeKey.isGroupingNodeKey(actualNode.key))
      delete childrenParams.instanceFilter;

    resultHierarchy[resultHierarchy.length - 1].children = await validateHierarchy({
      ...props,
      requestParams: childrenParams,
      expectedHierarchy: expectation.children ?? [],
    });
  }

  return resultHierarchy;
}
