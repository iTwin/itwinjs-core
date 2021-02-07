/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import { enablePatches } from "immer";
import Sinon, * as sinon from "sinon";
import { IModelConnection, SnapshotConnection } from "@bentley/imodeljs-frontend";
import {
  ChildNodeSpecificationTypes, ECInstancesNodeKey, InstanceKey, NodeKey, PartialHierarchyModification, PresentationDataCompareOptions, RuleTypes,
  StandardNodeTypes,
} from "@bentley/presentation-common";
import { PresentationTreeNodeLoaderProps, usePresentationTreeNodeLoader } from "@bentley/presentation-components";
import { PRESENTATION_TREE_NODE_KEY } from "@bentley/presentation-components/lib/presentation-components/tree/Utils";
import { Presentation } from "@bentley/presentation-frontend";
import { AbstractTreeNodeLoader, DelayLoadedTreeNodeItem, from, Subscription, TreeModelNode, TreeModelRootNode } from "@bentley/ui-components";
import { renderHook } from "@testing-library/react-hooks";
import { initialize, terminate } from "../IntegrationTests";

describe("Update", () => {

  let imodel: IModelConnection;

  before(async () => {
    enablePatches();
    await initialize();
    const testIModelName: string = "assets/datasets/Properties_60InstancesWithUrl2.ibim";
    imodel = await SnapshotConnection.openFile(testIModelName);
    expect(imodel).is.not.null;
  });

  after(async () => {
    await imodel.close();
    await terminate();
  });

  describe("hierarchy", () => {

    let hierarchyCompareSpy: Sinon.SinonSpy<[PresentationDataCompareOptions<IModelConnection, NodeKey>], Promise<PartialHierarchyModification[]>>;

    beforeEach(() => {
      hierarchyCompareSpy = sinon.spy(Presentation.presentation, "compareHierarchies");
    });

    afterEach(() => {
      hierarchyCompareSpy.restore();
    });

    async function loadHierarchy(loader: AbstractTreeNodeLoader) {
      const getChildrenCount = async (parent: TreeModelNode | TreeModelRootNode): Promise<number> => {
        return new Promise<number>((resolve) => {
          loader.loadNode(parent, 0).subscribe({
            complete: () => {
              const node = parent.id ? loader.modelSource.getModel().getNode(parent.id) : loader.modelSource.getModel().getRootNode();
              const { numChildren } = (node as { numChildren: number });
              resolve(numChildren);
            },
          });
        });
      };
      const loadChildren = async (parent: TreeModelNode | TreeModelRootNode): Promise<void> => {
        const numChildren = await getChildrenCount(parent);
        const nodeSubscriptions = new Array<Subscription>();
        for (let i = 0; i < numChildren; ++i)
          nodeSubscriptions.push(loader.loadNode(parent, i).subscribe());
        await new Promise<string[]>((resolve) => {
          from(nodeSubscriptions).subscribe({
            complete: resolve,
          });
        });
        const children = loader.modelSource.getModel().getChildren(parent.id);
        if (children) {
          for (const sparseValue of children.iterateValues()) {
            const child = loader.modelSource.getModel().getNode(sparseValue[0]);
            if (child && (child.item as DelayLoadedTreeNodeItem).hasChildren)
              await loadChildren(child);
          }
        }
      };
      await loadChildren(loader.modelSource.getModel().getRootNode());
    }

    describe("on ruleset modification", () => {

      it("detects custom node change", async () => {
        const initialRuleset = await Presentation.presentation.rulesets().add({
          id: faker.random.uuid(),
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.CustomNode,
              type: "T_NODE",
              label: "test-1",
            }],
          }],
        });
        expect(initialRuleset).to.not.be.undefined;
        const { result, waitForValueToChange } = renderHook(
          (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
          { initialProps: { imodel, ruleset: initialRuleset.id, pagingSize: 100, enableHierarchyAutoUpdate: true } },
        );
        const initialDataProvider = result.current.dataProvider;
        await loadHierarchy(result.current);
        const nodesBefore = [...result.current.modelSource.getModel().iterateTreeModelNodes()];
        expect(nodesBefore.length).to.eq(1);
        expect(nodesBefore).to.containSubset([{
          label: { value: { displayValue: "test-1" } },
        }]);

        const modifiedRuleset = await Presentation.presentation.rulesets().modify(initialRuleset, {
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.CustomNode,
              type: "T_NODE",
              label: "test-2",
            }],
          }],
        });
        expect(modifiedRuleset).to.not.be.undefined;
        await waitForValueToChange(() => result.current.dataProvider !== initialDataProvider);
        await loadHierarchy(result.current);
        const nodesAfter = [...result.current.modelSource.getModel().iterateTreeModelNodes()];
        expect(nodesAfter.length).to.eq(1);
        expect(nodesAfter).to.containSubset([{
          label: { value: { displayValue: "test-2" } },
        }]);
        expect(hierarchyCompareSpy).to.be.calledOnce;
        expect(await hierarchyCompareSpy.firstCall.returnValue).to.containSubset([{
          type: "Update",
          node: { key: { type: "T_NODE" }, label: { displayValue: "test-2" } },
          changes: [{
            name: "Key",
          }, {
            name: "LabelDefinition",
            old: { displayValue: "test-1" },
            new: { displayValue: "test-2" },
          }],
        }]);
      });

      it("detects ECInstance node change", async () => {
        const initialRuleset = await Presentation.presentation.rulesets().add({
          id: faker.random.uuid(),
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "Generic", classNames: ["PhysicalObject"] },
              groupByClass: false,
              groupByLabel: false,
            }],
          }],
        });
        expect(initialRuleset).to.not.be.undefined;
        const { result, waitForValueToChange } = renderHook(
          (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
          { initialProps: { imodel, ruleset: initialRuleset.id, pagingSize: 100, enableHierarchyAutoUpdate: true } },
        );
        const initialDataProvider = result.current.dataProvider;
        await loadHierarchy(result.current);
        const nodesBefore = [...result.current.modelSource.getModel().iterateTreeModelNodes()];
        expect(nodesBefore.length).to.eq(2);
        expect(nodesBefore).to.containSubset([{
          label: { value: { displayValue: "Physical Object [0-38]" } },
        }, {
          label: { value: { displayValue: "Physical Object [0-39]" } },
        }]);

        const modifiedRuleset = await Presentation.presentation.rulesets().modify(initialRuleset, {
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "Generic", classNames: ["PhysicalObject"] },
              instanceFilter: `this.ECInstanceId = ${parseInt("0x75", 16)}`,
              groupByClass: false,
              groupByLabel: false,
            }],
          }],
        });
        expect(modifiedRuleset).to.not.be.undefined;
        await waitForValueToChange(() => result.current.dataProvider !== initialDataProvider);
        await loadHierarchy(result.current);
        const nodesAfter = [...result.current.modelSource.getModel().iterateTreeModelNodes()];
        expect(nodesAfter.length).to.eq(1);
        expect(nodesAfter).to.containSubset([{
          label: { value: { displayValue: "Physical Object [0-39]" } },
        }]);
        expect(hierarchyCompareSpy).to.be.calledOnce;
        expect(await hierarchyCompareSpy.firstCall.returnValue).to.containSubset([{
          type: "Delete",
          node: { key: { instanceKeys: (initialDataProvider.getNodeKey(nodesBefore[0].item) as ECInstancesNodeKey).instanceKeys } },
        }, {
          type: "Update",
          node: { key: { instanceKeys: (initialDataProvider.getNodeKey(nodesBefore[1].item) as ECInstancesNodeKey).instanceKeys } },
          changes: [{
            name: "Key",
          }],
        }]);
      });

      it("detects ECClass grouping node change", async () => {
        const initialRuleset = await Presentation.presentation.rulesets().add({
          id: faker.random.uuid(),
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "Generic", classNames: ["PhysicalObject"] },
              instanceFilter: `this.ECInstanceId = ${parseInt("0x74", 16)}`,
              groupByClass: true,
              groupByLabel: false,
            }],
          }],
        });
        expect(initialRuleset).to.not.be.undefined;
        const { result, waitForValueToChange } = renderHook(
          (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
          { initialProps: { imodel, ruleset: initialRuleset.id, pagingSize: 100, enableHierarchyAutoUpdate: true } },
        );
        const initialDataProvider = result.current.dataProvider;
        await loadHierarchy(result.current);
        const nodesBefore = [...result.current.modelSource.getModel().iterateTreeModelNodes()];
        expect(nodesBefore.length).to.eq(2);
        expect(nodesBefore).to.containSubset([{
          item: { [PRESENTATION_TREE_NODE_KEY]: { type: StandardNodeTypes.ECClassGroupingNode } },
          label: { value: { displayValue: "Physical Object" } },
        }]);
        result.current.modelSource.modifyModel((model) => {
          model.getNode(nodesBefore[0].id)!.isExpanded = true;
        });

        const modifiedRuleset = await Presentation.presentation.rulesets().modify(initialRuleset, {
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "Generic", classNames: ["PhysicalObject"] },
              instanceFilter: `this.ECInstanceId = ${parseInt("0x75", 16)}`,
              groupByClass: true,
              groupByLabel: false,
            }],
          }],
        });
        expect(modifiedRuleset).to.not.be.undefined;
        await waitForValueToChange(() => result.current.dataProvider !== initialDataProvider);
        await loadHierarchy(result.current);
        const nodesAfter = [...result.current.modelSource.getModel().iterateTreeModelNodes()];
        expect(nodesAfter.length).to.eq(2);
        expect(nodesAfter).to.containSubset([{
          label: { value: { displayValue: "Physical Object" } },
        }, {
          label: { value: { displayValue: "Physical Object [0-39]" } },
          parentId: (parentId?: string) => !!parentId,
        }]);
        expect(hierarchyCompareSpy).to.be.calledOnce;
        expect(await hierarchyCompareSpy.firstCall.returnValue).to.containSubset([{
          type: "Update",
          node: { key: { type: StandardNodeTypes.ECClassGroupingNode } },
        }, {
          type: "Insert",
          position: 0,
          node: { key: { type: StandardNodeTypes.ECInstancesNode, instanceKeys: (instanceKeys: InstanceKey[]) => instanceKeys.some((k) => k.id === "0x75") } },
        }]);
      });

    });

    describe("on ruleset variables' modification", () => {

      it("detects a change in rule condition", async () => {
        const ruleset = await Presentation.presentation.rulesets().add({
          id: faker.random.uuid(),
          rules: [{
            ruleType: RuleTypes.RootNodes,
            subConditions: [{
              condition: `GetVariableBoolValue("use_first")`,
              specifications: [{
                specType: ChildNodeSpecificationTypes.CustomNode,
                type: "T_NODE_1",
                label: "test-1",
              }],
            }, {
              condition: `GetVariableBoolValue("use_second")`,
              specifications: [{
                specType: ChildNodeSpecificationTypes.CustomNode,
                type: "T_NODE_2",
                label: "test-2",
              }],
            }],
          }],
        });
        expect(ruleset).to.not.be.undefined;
        await Presentation.presentation.vars(ruleset.id).setBool("use_first", false);
        await Presentation.presentation.vars(ruleset.id).setBool("use_second", false);

        const { result, waitForValueToChange } = renderHook(
          (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
          { initialProps: { imodel, ruleset, pagingSize: 100, enableHierarchyAutoUpdate: true } },
        );
        let dataProvider = result.current.dataProvider;
        await loadHierarchy(result.current);
        const nodesBefore = [...result.current.modelSource.getModel().iterateTreeModelNodes()];
        expect(nodesBefore.length).to.eq(0);

        await Presentation.presentation.vars(ruleset.id).setBool("use_first", true);
        await waitForValueToChange(() => result.current.dataProvider !== dataProvider);
        await loadHierarchy(result.current);
        const nodesAfter1 = [...result.current.modelSource.getModel().iterateTreeModelNodes()];
        expect(nodesAfter1.length).to.eq(1);
        expect(nodesAfter1).to.containSubset([{
          label: { value: { displayValue: "test-1" } },
        }]);
        expect(hierarchyCompareSpy).to.be.calledOnce;
        expect(await hierarchyCompareSpy.firstCall.returnValue).to.containSubset([{
          type: "Insert",
          position: 0,
          node: { key: { type: "T_NODE_1" }, label: { displayValue: "test-1" } },
        }]);
        dataProvider = result.current.dataProvider;

        await Presentation.presentation.vars(ruleset.id).setBool("use_second", true);
        await waitForValueToChange(() => result.current.dataProvider !== dataProvider);
        await loadHierarchy(result.current);
        const nodesAfter2 = [...result.current.modelSource.getModel().iterateTreeModelNodes()];
        expect(nodesAfter2.length).to.eq(2);
        expect(nodesAfter2).to.containSubset([{
          label: { value: { displayValue: "test-1" } },
        }, {
          label: { value: { displayValue: "test-2" } },
        }]);
        expect(hierarchyCompareSpy).to.be.calledTwice;
        expect(await hierarchyCompareSpy.secondCall.returnValue).to.containSubset([{
          type: "Insert",
          position: 1,
          node: { key: { type: "T_NODE_2" }, label: { displayValue: "test-2" } },
        }]);
        dataProvider = result.current.dataProvider;

        await Presentation.presentation.vars(ruleset.id).setBool("use_first", false);
        await waitForValueToChange(() => result.current.dataProvider !== dataProvider);
        await loadHierarchy(result.current);
        const nodesAfter3 = [...result.current.modelSource.getModel().iterateTreeModelNodes()];
        expect(nodesAfter3.length).to.eq(1);
        expect(nodesAfter3).to.containSubset([{
          label: { value: { displayValue: "test-2" } },
        }]);
        expect(hierarchyCompareSpy).to.be.calledThrice;
        expect(await hierarchyCompareSpy.thirdCall.returnValue).to.containSubset([{
          type: "Delete",
          node: { key: { type: "T_NODE_1" }, label: { displayValue: "test-1" } },
        }]);
      });

      it("detects a change in instance filter", async () => {
        const ruleset = await Presentation.presentation.rulesets().add({
          id: faker.random.uuid(),
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "Generic", classNames: ["PhysicalObject"] },
              instanceFilter: `GetVariableBoolValue("show_nodes")`,
              groupByClass: false,
              groupByLabel: false,
            }],
          }],
        });
        expect(ruleset).to.not.be.undefined;
        await Presentation.presentation.vars(ruleset.id).setBool("show_nodes", false);

        const { result, waitForValueToChange } = renderHook(
          (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
          { initialProps: { imodel, ruleset, pagingSize: 100, enableHierarchyAutoUpdate: true } },
        );
        let dataProvider = result.current.dataProvider;
        await loadHierarchy(result.current);
        const nodesBefore = [...result.current.modelSource.getModel().iterateTreeModelNodes()];
        expect(nodesBefore.length).to.eq(0);

        await Presentation.presentation.vars(ruleset.id).setBool("show_nodes", true);
        await waitForValueToChange(() => result.current.dataProvider !== dataProvider);
        await loadHierarchy(result.current);
        const nodesAfter1 = [...result.current.modelSource.getModel().iterateTreeModelNodes()];
        expect(nodesAfter1.length).to.eq(2);
        expect(nodesAfter1).to.containSubset([{
          label: { value: { displayValue: "Physical Object [0-38]" } },
        }, {
          label: { value: { displayValue: "Physical Object [0-39]" } },
        }]);
        expect(hierarchyCompareSpy).to.be.calledOnce;
        expect(await hierarchyCompareSpy.firstCall.returnValue).to.containSubset([{
          type: "Insert",
          position: 0,
          node: { key: { type: StandardNodeTypes.ECInstancesNode, instanceKeys: [{ id: "0x74" }] }, label: { displayValue: "Physical Object [0-38]" } },
        }, {
          type: "Insert",
          position: 1,
          node: { key: { type: StandardNodeTypes.ECInstancesNode, instanceKeys: [{ id: "0x75" }] }, label: { displayValue: "Physical Object [0-39]" } },
        }]);
        dataProvider = result.current.dataProvider;

        await Presentation.presentation.vars(ruleset.id).setBool("show_nodes", false);
        await waitForValueToChange(() => result.current.dataProvider !== dataProvider);
        await loadHierarchy(result.current);
        const nodesAfter2 = [...result.current.modelSource.getModel().iterateTreeModelNodes()];
        expect(nodesAfter2.length).to.eq(0);
        expect(hierarchyCompareSpy).to.be.calledTwice;
        expect(await hierarchyCompareSpy.secondCall.returnValue).to.containSubset([{
          type: "Delete",
          node: { key: { type: StandardNodeTypes.ECInstancesNode, instanceKeys: [{ id: "0x74" }] } },
        }, {
          type: "Delete",
          node: { key: { type: StandardNodeTypes.ECInstancesNode, instanceKeys: [{ id: "0x75" }] } },
        }]);
      });

      it("detects a change in customization rule's condition", async () => {
        const ruleset = await Presentation.presentation.rulesets().add({
          id: faker.random.uuid(),
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "Generic", classNames: ["PhysicalObject"] },
              groupByClass: false,
              groupByLabel: false,
            }],
          }, {
            ruleType: RuleTypes.StyleOverride,
            condition: `GetVariableBoolValue("should_customize")`,
            foreColor: `"Red"`,
          }],
        });
        expect(ruleset).to.not.be.undefined;

        const { result, waitForValueToChange } = renderHook(
          (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
          { initialProps: { imodel, ruleset, pagingSize: 100, enableHierarchyAutoUpdate: true } },
        );
        const dataProvider = result.current.dataProvider;
        await loadHierarchy(result.current);
        const nodesBefore = [...result.current.modelSource.getModel().iterateTreeModelNodes()];
        expect(nodesBefore.length).to.eq(2);
        nodesBefore.forEach((n) => expect(n.item.style?.colorOverrides?.color).to.be.undefined);

        await Presentation.presentation.vars(ruleset.id).setBool("should_customize", true);
        await waitForValueToChange(() => result.current.dataProvider !== dataProvider);
        await loadHierarchy(result.current);
        const nodesAfter1 = [...result.current.modelSource.getModel().iterateTreeModelNodes()];
        expect(nodesAfter1.length).to.eq(2);
        nodesAfter1.forEach((n) => expect(n.item.style?.colorOverrides?.color).to.eq(0xFF0000FF));
        expect(hierarchyCompareSpy).to.be.calledOnce;
        expect(await hierarchyCompareSpy.firstCall.returnValue).to.containSubset([{
          type: "Update",
          node: { key: { type: StandardNodeTypes.ECInstancesNode, instanceKeys: [{ id: "0x74" }] } },
          changes: [{
            name: "ForeColor",
            old: "",
            new: "Red",
          }],
        }, {
          type: "Update",
          node: { key: { type: StandardNodeTypes.ECInstancesNode, instanceKeys: [{ id: "0x75" }] } },
          changes: [{
            name: "ForeColor",
            old: "",
            new: "Red",
          }],
        }]);
      });

      it("detects a change in customization rule's value", async () => {
        const ruleset = await Presentation.presentation.rulesets().add({
          id: faker.random.uuid(),
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
              classes: { schemaName: "Generic", classNames: ["PhysicalObject"] },
              groupByClass: false,
              groupByLabel: false,
            }],
          }, {
            ruleType: RuleTypes.StyleOverride,
            condition: `ThisNode.IsOfClass("PhysicalObject", "Generic")`,
            foreColor: `GetVariableStringValue("custom_color")`,
          }],
        });
        expect(ruleset).to.not.be.undefined;

        const { result, waitForValueToChange } = renderHook(
          (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
          { initialProps: { imodel, ruleset, pagingSize: 100, enableHierarchyAutoUpdate: true } },
        );
        let dataProvider = result.current.dataProvider;
        await loadHierarchy(result.current);
        const nodesBefore = [...result.current.modelSource.getModel().iterateTreeModelNodes()];
        expect(nodesBefore.length).to.eq(2);
        nodesBefore.forEach((n) => expect(n.item.style?.colorOverrides?.color).to.be.undefined);

        await Presentation.presentation.vars(ruleset.id).setString("custom_color", "Red");
        await waitForValueToChange(() => result.current.dataProvider !== dataProvider);
        await loadHierarchy(result.current);
        const nodesAfter1 = [...result.current.modelSource.getModel().iterateTreeModelNodes()];
        expect(nodesAfter1.length).to.eq(2);
        nodesAfter1.forEach((n) => expect(n.item.style?.colorOverrides?.color).to.eq(0xFF0000FF));
        expect(hierarchyCompareSpy).to.be.calledOnce;
        expect(await hierarchyCompareSpy.firstCall.returnValue).to.containSubset([{
          type: "Update",
          node: { key: { type: StandardNodeTypes.ECInstancesNode, instanceKeys: [{ id: "0x74" }] } },
          changes: [{
            name: "ForeColor",
            old: "",
            new: "Red",
          }],
        }, {
          type: "Update",
          node: { key: { type: StandardNodeTypes.ECInstancesNode, instanceKeys: [{ id: "0x75" }] } },
          changes: [{
            name: "ForeColor",
            old: "",
            new: "Red",
          }],
        }]);
        dataProvider = result.current.dataProvider;

        await Presentation.presentation.vars(ruleset.id).setString("custom_color", "Blue");
        await waitForValueToChange(() => result.current.dataProvider !== dataProvider);
        await loadHierarchy(result.current);
        const nodesAfter2 = [...result.current.modelSource.getModel().iterateTreeModelNodes()];
        expect(nodesAfter2.length).to.eq(2);
        nodesAfter2.forEach((n) => expect(n.item.style?.colorOverrides?.color).to.eq(0x0000FFFF));
        expect(hierarchyCompareSpy).to.be.calledTwice;
        expect(await hierarchyCompareSpy.secondCall.returnValue).to.containSubset([{
          type: "Update",
          node: { key: { type: StandardNodeTypes.ECInstancesNode, instanceKeys: [{ id: "0x74" }] } },
          changes: [{
            name: "ForeColor",
            old: "Red",
            new: "Blue",
          }],
        }, {
          type: "Update",
          node: { key: { type: StandardNodeTypes.ECInstancesNode, instanceKeys: [{ id: "0x75" }] } },
          changes: [{
            name: "ForeColor",
            old: "Red",
            new: "Blue",
          }],
        }]);
      });

      it("detects changes of root and expanded nodes", async () => {
        const ruleset = await Presentation.presentation.rulesets().add({
          id: faker.random.uuid(),
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.CustomNode,
              type: "T_ROOT_1",
              label: "root-1",
              hasChildren: "Unknown",
            }, {
              specType: ChildNodeSpecificationTypes.CustomNode,
              type: "T_ROOT_2",
              label: "root-2",
              hasChildren: "Unknown",
            }],
          }, {
            ruleType: RuleTypes.ChildNodes,
            condition: `ParentNode.Type = "T_ROOT_1" ANDALSO GetVariableBoolValue("show_children")`,
            specifications: [{
              specType: ChildNodeSpecificationTypes.CustomNode,
              type: "T_CHILD_1",
              label: "child-1",
            }],
          }, {
            ruleType: RuleTypes.ChildNodes,
            condition: `ParentNode.Type = "T_ROOT_2" ANDALSO GetVariableBoolValue("show_children")`,
            specifications: [{
              specType: ChildNodeSpecificationTypes.CustomNode,
              type: "T_CHILD_2",
              label: "child-2",
            }],
          }],
        });
        expect(ruleset).to.not.be.undefined;
        await Presentation.presentation.vars(ruleset.id).setBool("show_children", true);

        const { result, waitForValueToChange } = renderHook(
          (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
          { initialProps: { imodel, ruleset, pagingSize: 100, enableHierarchyAutoUpdate: true } },
        );
        const dataProvider = result.current.dataProvider;
        await loadHierarchy(result.current);
        const nodesBefore = [...result.current.modelSource.getModel().iterateTreeModelNodes()];
        expect(nodesBefore.length).to.eq(4);
        expect(nodesBefore).to.containSubset([{
          label: { value: { displayValue: "root-1" } },
          item: { hasChildren: true },
        }, {
          label: { value: { displayValue: "child-1" } },
        }, {
          label: { value: { displayValue: "root-2" } },
          item: { hasChildren: true },
        }, {
          label: { value: { displayValue: "child-2" } },
        }]);
        result.current.modelSource.modifyModel((model) => {
          // expand only the `root-1` node
          model.getNode(nodesBefore[0].id)!.isExpanded = true;
        });

        await Presentation.presentation.vars(ruleset.id).setBool("show_children", false);
        await waitForValueToChange(() => result.current.dataProvider !== dataProvider);
        await loadHierarchy(result.current);
        const nodesAfter = [...result.current.modelSource.getModel().iterateTreeModelNodes()];
        expect(nodesAfter.length).to.eq(2);
        expect(nodesAfter).to.containSubset([{
          label: { value: { displayValue: "root-1" } },
        }, {
          label: { value: { displayValue: "root-2" } },
        }]);
        expect(hierarchyCompareSpy).to.be.calledOnce;
        expect(await hierarchyCompareSpy.firstCall.returnValue).to.containSubset([{
          type: "Update",
          node: { key: { type: "T_ROOT_1" } },
          changes: [{
            name: "HasChildren",
            old: true,
            new: false,
          }],
        }, {
          type: "Update",
          node: { key: { type: "T_ROOT_2" } },
          changes: [{
            name: "HasChildren",
            old: true,
            new: false,
          }],
        }, {
          type: "Delete",
          node: { key: { type: "T_CHILD_1" } },
        }]);
      });

    });

    describe("paging", () => {

      it("collects results from multiple pages", async () => {
        const ruleset = await Presentation.presentation.rulesets().add({
          id: faker.random.uuid(),
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{
              specType: ChildNodeSpecificationTypes.CustomNode,
              type: "T_ROOT-1",
              label: "root-1",
            }],
          }],
        });
        expect(ruleset).to.not.be.undefined;

        const { result, unmount } = renderHook(
          (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
          { initialProps: { imodel, ruleset, pagingSize: 100, enableHierarchyAutoUpdate: true } },
        );
        await loadHierarchy(result.current);
        unmount();

        const modifiedRuleset = await Presentation.presentation.rulesets().modify(ruleset, {
          rules: [
            {
              ruleType: RuleTypes.RootNodes,
              specifications: [{
                specType: ChildNodeSpecificationTypes.CustomNode,
                type: "T_ROOT-0",
                label: "root-0",
              }],
            },
            ...ruleset.rules,
            {
              ruleType: RuleTypes.RootNodes,
              specifications: [{
                specType: ChildNodeSpecificationTypes.CustomNode,
                type: "T_ROOT-2",
                label: "root-2",
              }],
            },
          ],
        });
        expect(modifiedRuleset).to.not.be.undefined;

        const rpcSpy = sinon.spy(Presentation.presentation.rpcRequestsHandler, "compareHierarchiesPaged");
        const changes = await Presentation.presentation.compareHierarchies({
          imodel,
          prev: {
            rulesetOrId: ruleset,
            rulesetVariables: [],
          },
          rulesetOrId: modifiedRuleset,
          rulesetVariables: [],
          resultSetSize: 1,
        });
        expect(changes).to.containSubset([{
          type: "Insert",
          node: { key: { type: "T_ROOT-0" } },
          position: 0,
        }, {
          type: "Insert",
          node: { key: { type: "T_ROOT-2" } },
          position: 2,
        }]);
        expect(rpcSpy).to.be.calledTwice;
      });

    });

  });

});
