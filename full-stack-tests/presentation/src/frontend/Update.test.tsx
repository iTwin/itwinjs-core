/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as faker from "faker";
import { enablePatches } from "immer";
import * as sinon from "sinon";
import { IModelConnection, SnapshotConnection } from "@bentley/imodeljs-frontend";
import { ChildNodeSpecificationTypes, PartialHierarchyModification, RuleTypes, StandardNodeTypes } from "@bentley/presentation-common";
import { IPresentationTreeDataProvider, PresentationTreeNodeLoaderProps, usePresentationTreeNodeLoader } from "@bentley/presentation-components";
import { Presentation } from "@bentley/presentation-frontend";
import { PrimitiveValue } from "@bentley/ui-abstract";
import {
  AbstractTreeNodeLoader, DelayLoadedTreeNodeItem, MutableTreeModelNode, PagedTreeNodeLoader, Subscription, TreeModelNode, TreeModelRootNode,
  TreeModelSource,
} from "@bentley/ui-components";
import { renderHook } from "@testing-library/react-hooks";
import { initialize, terminate } from "../IntegrationTests";
import { SinonSpy } from "../Utils";

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

  afterEach(() => {
    sinon.restore();
  });

  describe("detection", () => {
    let hierarchyCompareSpy: SinonSpy<typeof Presentation.presentation.compareHierarchies>;
    let defaultProps: Omit<PresentationTreeNodeLoaderProps, "ruleset">;

    beforeEach(() => {
      hierarchyCompareSpy = sinon.spy(Presentation.presentation, "compareHierarchies");
      defaultProps = {
        imodel,
        pagingSize: 100,
        enableHierarchyAutoUpdate: true,
      };
    });

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
        const hierarchy = await verifyHierarchy({ ...defaultProps, ruleset: initialRuleset }, ["test-1"]);

        await Presentation.presentation.rulesets().modify(
          initialRuleset,
          {
            rules: [{
              ruleType: RuleTypes.RootNodes,
              specifications: [{
                specType: ChildNodeSpecificationTypes.CustomNode,
                type: "T_NODE",
                label: "test-2",
              }],
            }],
          },
        );
        await hierarchy.verifyChange(
          [{
            type: "Update",
            target: { type: "T_NODE" },
            changes: {
              key: {},
              label: { displayValue: "test-2" },
            },
          }],
          ["test-2"],
        );
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
        const hierarchy = await verifyHierarchy(
          { ...defaultProps, ruleset: initialRuleset },
          ["Physical Object [0-38]", "Physical Object [0-39]"],
        );

        await Presentation.presentation.rulesets().modify(initialRuleset, {
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
        await hierarchy.verifyChange(
          [
            {
              type: "Delete",
              target: { instanceKeys: [{ className: "Generic:PhysicalObject", id: "0x74" }] },
            },
            {
              type: "Update",
              target: { instanceKeys: [{ className: "Generic:PhysicalObject", id: "0x75" }] },
              changes: { key: {} },
            }],
          ["Physical Object [0-39]"],
        );
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
        const hierarchy = await verifyHierarchy(
          { ...defaultProps, ruleset: initialRuleset },
          [{ ["Physical Object"]: ["Physical Object [0-38]"] }],
        );

        hierarchy.getModelSource().modifyModel((model) => {
          const node = model.getNode(undefined, 0);
          (node as MutableTreeModelNode).isExpanded = true;
        });
        await Presentation.presentation.rulesets().modify(initialRuleset, {
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
        await hierarchy.verifyChange(
          [
            {
              type: "Update",
              target: { type: StandardNodeTypes.ECClassGroupingNode },
            },
            {
              type: "Insert",
              position: 0,
              node: {
                key: {
                  type: StandardNodeTypes.ECInstancesNode,
                  instanceKeys: [{ className: "Generic:PhysicalObject", id: "0x75" }],
                },
              },
            },
          ],
          [{ ["Physical Object"]: ["Physical Object [0-39]"] }],
        );
      });
    });

    describe("on ruleset variables' modification", () => {
      it("detects a change in rule condition", async () => {
        const ruleset = await Presentation.presentation.rulesets().add({
          id: faker.random.uuid(),
          rules: [{
            ruleType: RuleTypes.RootNodes,
            subConditions: [
              {
                condition: `GetVariableBoolValue("use_first")`,
                specifications: [{
                  specType: ChildNodeSpecificationTypes.CustomNode,
                  type: "T_NODE_1",
                  label: "test-1",
                }],
              },
              {
                condition: `GetVariableBoolValue("use_second")`,
                specifications: [{
                  specType: ChildNodeSpecificationTypes.CustomNode,
                  type: "T_NODE_2",
                  label: "test-2",
                }],
              },
            ],
          }],
        });
        await Presentation.presentation.vars(ruleset.id).setBool("use_first", false);
        await Presentation.presentation.vars(ruleset.id).setBool("use_second", false);
        const hierarchy = await verifyHierarchy({ ...defaultProps, ruleset }, []);

        await Presentation.presentation.vars(ruleset.id).setBool("use_first", true);
        await hierarchy.verifyChange(
          [{
            type: "Insert",
            position: 0,
            node: { key: { type: "T_NODE_1" }, label: { displayValue: "test-1" } },
          }],
          ["test-1"],
        );

        await Presentation.presentation.vars(ruleset.id).setBool("use_second", true);
        await hierarchy.verifyChange(
          [{
            type: "Insert",
            position: 1,
            node: { key: { type: "T_NODE_2" }, label: { displayValue: "test-2" } },
          }],
          ["test-1", "test-2"],
        );

        await Presentation.presentation.vars(ruleset.id).setBool("use_first", false);
        await hierarchy.verifyChange(
          [{
            type: "Delete",
            target: { type: "T_NODE_1" },
          }],
          ["test-2"],
        );
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
        await Presentation.presentation.vars(ruleset.id).setBool("show_nodes", false);
        const hierarchy = await verifyHierarchy({ ...defaultProps, ruleset }, []);

        await Presentation.presentation.vars(ruleset.id).setBool("show_nodes", true);
        await hierarchy.verifyChange(
          [
            {
              type: "Insert",
              position: 0,
              node: {
                key: { type: StandardNodeTypes.ECInstancesNode, instanceKeys: [{ id: "0x74" }] },
                label: { displayValue: "Physical Object [0-38]" },
              },
            },
            {
              type: "Insert",
              position: 1,
              node: {
                key: { type: StandardNodeTypes.ECInstancesNode, instanceKeys: [{ id: "0x75" }] },
                label: { displayValue: "Physical Object [0-39]" },
              },
            },
          ],
          ["Physical Object [0-38]", "Physical Object [0-39]"],
        );

        await Presentation.presentation.vars(ruleset.id).setBool("show_nodes", false);
        await hierarchy.verifyChange(
          [
            {
              type: "Delete",
              target: { type: StandardNodeTypes.ECInstancesNode, instanceKeys: [{ id: "0x74" }] },
            },
            {
              type: "Delete",
              target: { type: StandardNodeTypes.ECInstancesNode, instanceKeys: [{ id: "0x75" }] },
            },
          ],
          [],
        );
      });

      it("detects a change in customization rule's condition", async () => {
        const ruleset = await Presentation.presentation.rulesets().add({
          id: faker.random.uuid(),
          rules: [
            {
              ruleType: RuleTypes.RootNodes,
              specifications: [{
                specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
                classes: { schemaName: "Generic", classNames: ["PhysicalObject"] },
                groupByClass: false,
                groupByLabel: false,
              }],
            },
            {
              ruleType: RuleTypes.StyleOverride,
              condition: `GetVariableBoolValue("should_customize")`,
              foreColor: `"Red"`,
            },
          ],
        });
        const hierarchy = await verifyHierarchy(
          { ...defaultProps, ruleset },
          ["Physical Object [0-38]", "Physical Object [0-39]"],
        );

        await Presentation.presentation.vars(ruleset.id).setBool("should_customize", true);
        await hierarchy.verifyChange(
          [
            {
              type: "Update",
              target: { type: StandardNodeTypes.ECInstancesNode, instanceKeys: [{ id: "0x74" }] },
              changes: { foreColor: "Red" },
            },
            {
              type: "Update",
              target: { type: StandardNodeTypes.ECInstancesNode, instanceKeys: [{ id: "0x75" }] },
              changes: { foreColor: "Red" },
            },
          ],
          [
            { label: "Physical Object [0-38]", color: 0xFF0000FF },
            { label: "Physical Object [0-39]", color: 0xFF0000FF },
          ],
        );
      });

      it("detects a change in customization rule's value", async () => {
        const ruleset = await Presentation.presentation.rulesets().add({
          id: faker.random.uuid(),
          rules: [
            {
              ruleType: RuleTypes.RootNodes,
              specifications: [{
                specType: ChildNodeSpecificationTypes.InstanceNodesOfSpecificClasses,
                classes: { schemaName: "Generic", classNames: ["PhysicalObject"] },
                groupByClass: false,
                groupByLabel: false,
              }],
            },
            {
              ruleType: RuleTypes.StyleOverride,
              condition: `ThisNode.IsOfClass("PhysicalObject", "Generic")`,
              foreColor: `GetVariableStringValue("custom_color")`,
            },
          ],
        });
        const hierarchy = await verifyHierarchy(
          { ...defaultProps, ruleset },
          ["Physical Object [0-38]", "Physical Object [0-39]"],
        );

        await Presentation.presentation.vars(ruleset.id).setString("custom_color", "Red");
        await hierarchy.verifyChange(
          [
            {
              type: "Update",
              target: { type: StandardNodeTypes.ECInstancesNode, instanceKeys: [{ id: "0x74" }] },
              changes: { foreColor: "Red" },
            },
            {
              type: "Update",
              target: { type: StandardNodeTypes.ECInstancesNode, instanceKeys: [{ id: "0x75" }] },
              changes: { foreColor: "Red" },
            },
          ],
          [
            { label: "Physical Object [0-38]", color: 0xFF0000FF },
            { label: "Physical Object [0-39]", color: 0xFF0000FF },
          ],
        );

        await Presentation.presentation.vars(ruleset.id).setString("custom_color", "Blue");
        await hierarchy.verifyChange(
          [
            {
              type: "Update",
              target: { type: StandardNodeTypes.ECInstancesNode, instanceKeys: [{ id: "0x74" }] },
              changes: { foreColor: "Blue" },
            },
            {
              type: "Update",
              target: { type: StandardNodeTypes.ECInstancesNode, instanceKeys: [{ id: "0x75" }] },
              changes: { foreColor: "Blue" },
            },
          ],
          [
            { label: "Physical Object [0-38]", color: 0x0000FFFF },
            { label: "Physical Object [0-39]", color: 0x0000FFFF },
          ],
        );
      });

      it("detects changes of root and expanded nodes", async () => {
        const ruleset = await Presentation.presentation.rulesets().add({
          id: faker.random.uuid(),
          rules: [
            {
              ruleType: RuleTypes.RootNodes,
              specifications: [
                {
                  specType: ChildNodeSpecificationTypes.CustomNode,
                  type: "T_ROOT_1",
                  label: "root-1",
                  hasChildren: "Unknown",
                },
                {
                  specType: ChildNodeSpecificationTypes.CustomNode,
                  type: "T_ROOT_2",
                  label: "root-2",
                  hasChildren: "Unknown",
                },
              ],
            },
            {
              ruleType: RuleTypes.ChildNodes,
              condition: `ParentNode.Type = "T_ROOT_1" ANDALSO GetVariableBoolValue("show_children")`,
              specifications: [{
                specType: ChildNodeSpecificationTypes.CustomNode,
                type: "T_CHILD_1",
                label: "child-1",
              }],
            },
            {
              ruleType: RuleTypes.ChildNodes,
              condition: `ParentNode.Type = "T_ROOT_2" ANDALSO GetVariableBoolValue("show_children")`,
              specifications: [{
                specType: ChildNodeSpecificationTypes.CustomNode,
                type: "T_CHILD_2",
                label: "child-2",
              }],
            },
          ],
        });
        await Presentation.presentation.vars(ruleset.id).setBool("show_children", true);
        const hierarchy = await verifyHierarchy(
          { ...defaultProps, ruleset },
          [{ ["root-1"]: ["child-1"] }, { ["root-2"]: ["child-2"] }],
        );

        hierarchy.getModelSource().modifyModel((model) => {
          // expand only the `root-1` node
          (model.getNode(undefined, 0) as MutableTreeModelNode).isExpanded = true;
        });
        await Presentation.presentation.vars(ruleset.id).setBool("show_children", false);
        await hierarchy.verifyChange(
          [
            {
              type: "Update",
              target: { type: "T_ROOT_1" },
              changes: { hasChildren: false },
            },
            {
              type: "Update",
              target: { type: "T_ROOT_2" },
              changes: { hasChildren: false },
            },
            {
              type: "Delete",
              target: { type: "T_CHILD_1" },
            },
          ],
          ["root-1", "root-2"],
        );
      });
    });

    describe("partial update", () => {
      it("handles node insertion", async () => {
        const ruleset = await Presentation.presentation.rulesets().add({
          id: faker.random.uuid(),
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{ specType: ChildNodeSpecificationTypes.CustomNode, type: "T_NODE", label: "test-1" }],
          }],
        });
        const hierarchy = await verifyHierarchy({ ...defaultProps, ruleset }, ["test-1"]);

        await Presentation.presentation.rulesets().modify(
          ruleset,
          {
            rules: [{
              ruleType: RuleTypes.RootNodes,
              specifications: [
                { specType: ChildNodeSpecificationTypes.CustomNode, type: "T_NODE", label: "test-1" },
                { specType: ChildNodeSpecificationTypes.CustomNode, type: "T_NODE", label: "test-2" },
              ],
            }],
          },
        );
        await hierarchy.verifyChange(
          [{
            type: "Insert",
            parent: undefined,
            position: 1,
            node: {
              key: { type: "T_NODE" },
              label: { displayValue: "test-2" },
            },
          }],
          ["test-1", "test-2"],
        );
      });

      it("handles node update", async () => {
        const ruleset = await Presentation.presentation.rulesets().add({
          id: faker.random.uuid(),
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{ specType: ChildNodeSpecificationTypes.CustomNode, type: "T_NODE", label: "test-1" }],
          }],
        });
        const hierarchy = await verifyHierarchy({ ...defaultProps, ruleset }, ["test-1"]);

        await Presentation.presentation.rulesets().modify(
          ruleset,
          {
            rules: [{
              ruleType: RuleTypes.RootNodes,
              specifications: [
                { specType: ChildNodeSpecificationTypes.CustomNode, type: "T_NODE", label: "test-updated" },
              ],
            }],
          },
        );
        await hierarchy.verifyChange(
          [{
            type: "Update",
            target: { type: "T_NODE" },
            changes: {
              label: { displayValue: "test-updated" },
            },
          }],
          ["test-updated"],
        );
      });

      it("handles node removal", async () => {
        const ruleset = await Presentation.presentation.rulesets().add({
          id: faker.random.uuid(),
          rules: [{
            ruleType: RuleTypes.RootNodes,
            specifications: [{ specType: ChildNodeSpecificationTypes.CustomNode, type: "T_NODE", label: "test-1" }],
          }],
        });
        const hierarchy = await verifyHierarchy({ ...defaultProps, ruleset }, ["test-1"]);

        await Presentation.presentation.rulesets().modify(
          ruleset,
          {
            rules: [{
              ruleType: RuleTypes.RootNodes,
              specifications: [],
            }],
          },
        );
        await hierarchy.verifyChange([{ type: "Delete", target: { type: "T_NODE" } }], []);
      });
    });

    interface VerifiedHierarchy {
      getModelSource(): TreeModelSource;

      verifyChange: (
        expectedModifications: DeepPartial<PartialHierarchyModification[]>,
        expectedTree: TreeHierarchy[],
      ) => Promise<void>;
    }

    type DeepPartial<T> = { [K in keyof T]?: DeepPartial<T[K]> };

    type TreeHierarchy = string | {
      [label: string]: TreeHierarchy[];
    } | {
      label: string;
      children?: TreeHierarchy[];
      expanded?: true;
      color?: number;
    };

    async function verifyHierarchy(
      props: PresentationTreeNodeLoaderProps,
      expectedTree: TreeHierarchy[],
    ): Promise<VerifiedHierarchy> {
      const { result, waitForNextUpdate } = renderHook(
        (hookProps: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(hookProps),
        { initialProps: props },
      );
      await expectTree(result.current, expectedTree);

      return new class implements VerifiedHierarchy {
        private _numSpyCalls = 0;

        public getModelSource(): TreeModelSource {
          return result.current.modelSource;
        }

        public async verifyChange(
          expectedModifications: DeepPartial<PartialHierarchyModification[]>,
          expectedUpdatedTree: TreeHierarchy[],
        ): Promise<void> {
          await waitForNextUpdate();
          this._numSpyCalls += 1;
          expect(hierarchyCompareSpy.callCount).to.be.equal(this._numSpyCalls);
          expect(await hierarchyCompareSpy.lastCall.returnValue).to.containSubset(expectedModifications);
          await expectTree(result.current, expectedUpdatedTree);
        }
      }();
    }

    async function expectTree(
      nodeLoader: PagedTreeNodeLoader<IPresentationTreeDataProvider>,
      expectedHierarchy: TreeHierarchy[],
    ): Promise<void> {
      await loadHierarchy(nodeLoader);

      const model = nodeLoader.modelSource.getModel();
      const actualHierarchy = buildActualHierarchy(undefined);
      expect(actualHierarchy).to.deep.equal(expectedHierarchy);

      function buildActualHierarchy(parentId: string | undefined): TreeHierarchy[] {
        const result: TreeHierarchy[] = [];
        for (const childId of model.getChildren(parentId) ?? []) {
          const node = model.getNode(childId) as TreeModelNode;
          const label = (node.label.value as PrimitiveValue).displayValue!;
          const children = buildActualHierarchy(childId);
          const additionalProperties: Partial<TreeHierarchy> = {};
          if (node.isExpanded) {
            additionalProperties.expanded = true;
          }

          if (node.item.style?.colorOverrides?.color !== undefined) {
            additionalProperties.color = node.item.style.colorOverrides.color;
          }

          if (Object.keys(additionalProperties).length > 0) {
            result.push({ label, ...additionalProperties, ...(children.length > 0 && { children }) });
          } else if (children.length > 0) {
            result.push({ [label]: children });
          } else {
            result.push(label);
          }
        }

        return result;
      }
    }

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
        expect(changes).to.containSubset([
          {
            type: "Insert",
            node: { key: { type: "T_ROOT-0" } },
            position: 0,
          },
          {
            type: "Insert",
            node: { key: { type: "T_ROOT-2" } },
            position: 2,
          },
        ]);
        expect(rpcSpy).to.be.calledTwice;
      });
    });

    async function loadHierarchy(loader: AbstractTreeNodeLoader): Promise<void> {
      await loadChildren(loader.modelSource.getModel().getRootNode());

      async function loadChildren(parent: TreeModelNode | TreeModelRootNode): Promise<void> {
        const numChildren = await getChildrenCount(parent);
        for (let i = 0; i < numChildren; ++i) {
          await waitForCompletion(loader.loadNode(parent, i).subscribe());
        }

        const children = loader.modelSource.getModel().getChildren(parent.id);
        if (children === undefined) {
          return;
        }

        for (const sparseValue of children.iterateValues()) {
          const child = loader.modelSource.getModel().getNode(sparseValue[0]);
          if (child && (child.item as DelayLoadedTreeNodeItem).hasChildren) {
            await loadChildren(child);
          }
        }
      }

      async function getChildrenCount(parent: TreeModelNode | TreeModelRootNode): Promise<number> {
        await waitForCompletion(loader.loadNode(parent, 0).subscribe());
        const treeModel = loader.modelSource.getModel();
        const node = parent.id ? treeModel.getNode(parent.id) : treeModel.getRootNode();
        return node!.numChildren!;
      }

      async function waitForCompletion(subscription: Subscription): Promise<void> {
        return new Promise((resolve) => subscription.add(resolve));
      }
    }
  });
});
