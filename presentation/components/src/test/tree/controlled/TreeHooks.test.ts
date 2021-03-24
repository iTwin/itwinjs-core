/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { it } from "mocha";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { BeEvent, IDisposable } from "@bentley/bentleyjs-core";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import {
  LabelDefinition, LabelGroupingNodeKey, Node, PartialHierarchyModification, RegisteredRuleset, StandardNodeTypes, VariableValueTypes,
} from "@bentley/presentation-common";
import { Presentation, PresentationManager, RulesetManager, RulesetVariablesManager } from "@bentley/presentation-frontend";
import { PrimitiveValue, PropertyRecord } from "@bentley/ui-abstract";
import {
  from, MutableTreeModel, PagedTreeNodeLoader, TreeDataChangesListener, TreeModel, TreeModelNode, TreeModelNodeEditingInfo, TreeModelNodeInput,
  TreeNodeItem,
} from "@bentley/ui-components";
import { act, cleanup, renderHook } from "@testing-library/react-hooks";
import { IPresentationTreeDataProvider } from "../../../presentation-components";
import {
  PresentationTreeNodeLoaderProps, updateTreeModel, usePresentationTreeNodeLoader,
} from "../../../presentation-components/tree/controlled/TreeHooks";
import { createTreeNodeItem } from "../../../presentation-components/tree/Utils";
import { createRandomTreeNodeItem, mockPresentationManager } from "../../_helpers/UiComponents";

describe("usePresentationNodeLoader", () => {
  let onIModelHierarchyChanged: PresentationManager["onIModelHierarchyChanged"];
  let onRulesetModified: RulesetManager["onRulesetModified"];
  let onRulesetVariableChanged: RulesetVariablesManager["onVariableChanged"];
  let presentationManagerMock: moq.IMock<PresentationManager>;
  let rulesetVariablesManagerMock: moq.IMock<RulesetVariablesManager>;
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const rulesetId = "test-ruleset-id";
  const imodelKey = "test-imodel-key";
  const initialProps: PresentationTreeNodeLoaderProps = {
    imodel: imodelMock.object,
    ruleset: rulesetId,
    pagingSize: 5,
  };

  beforeEach(() => {
    imodelMock.reset();
    imodelMock.setup((x) => x.key).returns(() => imodelKey);
    const mocks = mockPresentationManager();
    presentationManagerMock = mocks.presentationManager;
    rulesetVariablesManagerMock = mocks.rulesetVariablesManager;
    onIModelHierarchyChanged = mocks.presentationManager.object.onIModelHierarchyChanged;
    onRulesetModified = mocks.rulesetsManager.object.onRulesetModified;
    onRulesetVariableChanged = mocks.rulesetVariablesManager.object.onVariableChanged;
    mocks.presentationManager.setup((x) => x.stateTracker).returns(() => undefined);
    Presentation.setPresentationManager(mocks.presentationManager.object);
  });

  afterEach(async () => {
    await cleanup();
    Presentation.terminate();
  });

  it("creates node loader", () => {
    const { result } = renderHook(
      (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
      { initialProps },
    );

    expect(result.current).to.not.be.undefined;
  });

  it("creates new nodeLoader when imodel changes", () => {
    const { result, rerender } = renderHook(
      (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
      { initialProps },
    );
    const oldNodeLoader = result.current;

    const newImodelMock = moq.Mock.ofType<IModelConnection>();
    rerender({ ...initialProps, imodel: newImodelMock.object });

    expect(result.current).to.not.eq(oldNodeLoader);
  });

  it("creates new nodeLoader when rulesetId changes", () => {
    const { result, rerender } = renderHook(
      (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
      { initialProps },
    );
    const oldNodeLoader = result.current;

    rerender({ ...initialProps, ruleset: "changed" });

    expect(result.current).to.not.eq(oldNodeLoader);
  });

  it("creates new nodeLoader when pagingSize changes", () => {
    const { result, rerender } = renderHook(
      (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
      { initialProps },
    );
    const oldNodeLoader = result.current;

    rerender({ ...initialProps, pagingSize: 20 });

    expect(result.current).to.not.eq(oldNodeLoader);
  });

  describe("auto-updating model source", () => {
    const hierarchyChange: PartialHierarchyModification = {
      type: "Insert",
      node: { key: { type: "", pathFromRoot: [] }, label: LabelDefinition.fromLabelString("") },
      position: 0,
    };

    beforeEach(() => {
      initialProps.enableHierarchyAutoUpdate = true;
    });

    it("doesn't create a new nodeLoader when `PresentationManager` raises `onIModelHierarchyChanged` event with unrelated ruleset", () => {
      const { result } = renderHook(
        (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
        { initialProps },
      );
      const oldNodeLoader = result.current;

      onIModelHierarchyChanged.raiseEvent({ rulesetId: "unrelated", updateInfo: "FULL", imodelKey });

      expect(result.current).to.eq(oldNodeLoader);
    });

    it("doesn't create a new nodeLoader when `PresentationManager` raises `onIModelHierarchyChanged` event with unrelated imodel", () => {
      const { result } = renderHook(
        (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
        { initialProps },
      );
      const oldNodeLoader = result.current;

      onIModelHierarchyChanged.raiseEvent({ rulesetId, updateInfo: "FULL", imodelKey: "unrelated" });

      expect(result.current).to.eq(oldNodeLoader);
    });

    it("creates a new nodeLoader when `PresentationManager` raises a related `onIModelHierarchyChanged` event with FULL hierarchy update", () => {
      const { result } = renderHook(
        (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
        { initialProps: { ...initialProps, ruleset: rulesetId } },
      );
      const oldNodeLoader = result.current;

      onIModelHierarchyChanged.raiseEvent({ rulesetId, updateInfo: "FULL", imodelKey });

      expect(result.current).to.not.eq(oldNodeLoader);
    });

    it("creates a new nodeLoader when `PresentationManager` raises a related `onIModelHierarchyChanged` event with partial hierarchy updates", () => {
      const { result } = renderHook(
        (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
        { initialProps: { ...initialProps, ruleset: rulesetId } },
      );
      const oldNodeLoader = result.current;

      onIModelHierarchyChanged.raiseEvent({ rulesetId, updateInfo: [hierarchyChange], imodelKey });

      expect(result.current).to.not.eq(oldNodeLoader);
    });

    it("doesn't create a new nodeLoader when `RulesetsManager` raises an unrelated `onRulesetModified` event", () => {
      const { result } = renderHook(
        (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
        { initialProps },
      );
      const oldNodeLoader = result.current;

      const currRuleset = new RegisteredRuleset({ id: "unrelated", rules: [] }, "", () => { });
      onRulesetModified.raiseEvent(currRuleset, { ...currRuleset.toJSON() });

      expect(result.current).to.eq(oldNodeLoader);
    });

    it("creates a new nodeLoader when `RulesetsManager` raises a related `onRulesetModified` event", async () => {
      const { result, waitForNextUpdate } = renderHook(
        (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
        { initialProps },
      );
      const oldNodeLoader = result.current;

      const currRuleset = new RegisteredRuleset({ id: rulesetId, rules: [] }, "", () => { });
      presentationManagerMock
        .setup(async (x) => x.compareHierarchies({
          imodel: imodelMock.object,
          prev: {
            rulesetOrId: currRuleset.toJSON(),
          },
          rulesetOrId: currRuleset.toJSON(),
          expandedNodeKeys: [],
        }))
        .returns(async () => [hierarchyChange])
        .verifiable();

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      act(() => { onRulesetModified.raiseEvent(currRuleset, currRuleset.toJSON()); });
      await waitForNextUpdate();

      expect(result.current).to.not.eq(oldNodeLoader);
      presentationManagerMock.verifyAll();
    });

    it("creates a new nodeLoader when `RulesetVariablesManager` raises an `onRulesetVariableChanged` event", async () => {
      const { result, waitForNextUpdate } = renderHook(
        (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
        { initialProps },
      );
      const oldNodeLoader = result.current;

      const variables = [{ id: "var-id", type: VariableValueTypes.String, value: "curr" }, { id: "other-var", type: VariableValueTypes.Int, value: 123 }];

      presentationManagerMock
        .setup(async (x) => x.compareHierarchies({
          imodel: imodelMock.object,
          prev: {
            rulesetVariables: [
              { ...variables[0], value: "prev" },
              variables[1],
            ],
          },
          rulesetOrId: rulesetId,
          expandedNodeKeys: [],
        }))
        .returns(async () => [hierarchyChange])
        .verifiable();
      rulesetVariablesManagerMock.setup(async (x) => x.getAllVariables()).returns(async () => variables);

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      act(() => { onRulesetVariableChanged.raiseEvent("var-id", "prev", "curr"); });
      await waitForNextUpdate();

      expect(result.current).to.not.eq(oldNodeLoader);
      presentationManagerMock.verifyAll();
    });

    it("does not create a new nodeLoader when there are no changes", () => {
      const { result } = renderHook(
        (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
        { initialProps },
      );
      const oldNodeLoader = result.current;

      onIModelHierarchyChanged.raiseEvent({ rulesetId, updateInfo: [], imodelKey });

      expect(result.current).to.eq(oldNodeLoader);
    });

    it("sends visible expanded nodes when comparing hierarchies due to ruleset modification", async () => {
      const { result, waitForNextUpdate } = renderHook(
        (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
        { initialProps },
      );

      const createTreeModelNodeInput = (id: string, isExpanded: boolean): TreeModelNodeInput => ({
        id,
        label: PropertyRecord.fromString(id),
        item: createRandomTreeNodeItem(),
        isExpanded,
        isLoading: false,
        numChildren: 1,
        isSelected: false,
      });
      const a = createTreeModelNodeInput("a", true);
      const b = createTreeModelNodeInput("b", true);
      const c = createTreeModelNodeInput("c", false);
      const d = createTreeModelNodeInput("d", true);
      result.current.modelSource.modifyModel((model) => {
        model.setChildren(undefined, [a], 0);
        model.setChildren(a.id, [b, c], 0);
        model.setChildren(c.id, [d], 0);
      });

      const currRuleset = new RegisteredRuleset({ id: rulesetId, rules: [] }, "", () => { });
      presentationManagerMock
        .setup(async (x) => x.compareHierarchies({
          imodel: imodelMock.object,
          prev: {
            rulesetOrId: currRuleset.toJSON(),
          },
          rulesetOrId: currRuleset.toJSON(),
          expandedNodeKeys: [
            result.current.dataProvider.getNodeKey(a.item),
            result.current.dataProvider.getNodeKey(b.item),
          ],
        }))
        .returns(async () => [hierarchyChange])
        .verifiable();

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      act(() => { onRulesetModified.raiseEvent(currRuleset, currRuleset.toJSON()); });

      await waitForNextUpdate();
      presentationManagerMock.verifyAll();
    });
  });

  it("uses supplied dataProvider", () => {
    // dispatch function from useState hook does not work with mocked object because it is function
    const dataProvider: IPresentationTreeDataProvider = {
      imodel: imodelMock.object,
      rulesetId: "",
      onTreeNodeChanged: new BeEvent<TreeDataChangesListener>(),
      dispose: () => { },
      getFilteredNodePaths: async () => [],
      getNodeKey: (node: TreeNodeItem) => (node as any).__key,
      getNodesCount: async () => 0,
      getNodes: async () => [],
      loadHierarchy: async () => { },
    };
    const { result } = renderHook(
      (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
      { initialProps: { ...initialProps, dataProvider } },
    );
    expect(result.current.dataProvider).to.be.eq(dataProvider);
  });

  it("uses supplied disposable dataProvider and disposes it on unmount", () => {
    // dispatch function from useState hook does not work with mocked object because it is function
    const dataProvider: IPresentationTreeDataProvider & IDisposable = {
      imodel: imodelMock.object,
      rulesetId: "",
      onTreeNodeChanged: new BeEvent<TreeDataChangesListener>(),
      getFilteredNodePaths: async () => [],
      getNodeKey: (node: TreeNodeItem) => (node as any).__key,
      getNodesCount: async () => 0,
      getNodes: async () => [],
      loadHierarchy: async () => { },
      dispose: sinon.spy(),
    };
    const { result, unmount } = renderHook(
      (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
      { initialProps: { ...initialProps, dataProvider } },
    );
    expect(result.current.dataProvider).to.be.eq(dataProvider);
    expect(dataProvider.dispose).to.not.be.called;
    unmount();
    expect(dataProvider.dispose).to.be.calledOnce;
  });

  function createNode(label: string): Node {
    return Node.fromJSON({
      key: { type: StandardNodeTypes.ECInstancesNode, instanceKeys: [], pathFromRoot: [label] },
      labelDefinition: { displayValue: label, rawValue: label, typeName: "string" },
    });
  }

  function createNodeInput(label: string): TreeModelNodeInput {
    const node = createNode(label);
    const item = createTreeNodeItem(node, undefined);
    return {
      id: label,
      item,
      label: item.label,
      isExpanded: false,
      isLoading: false,
      isSelected: false,
    };
  }

  it("reinitiates node loading on hierarchy change", async () => {
    const { result } = renderHook(
      (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
      { initialProps: { ...initialProps, enableHierarchyAutoUpdate: true } },
    );
    result.current.modelSource.modifyModel((model) => {
      model.setChildren(undefined, [createNodeInput("loading_node1"), createNodeInput("loading_node2")], 0);
      model.getNode("loading_node1")!.isLoading = true;
      model.getNode("loading_node2")!.isLoading = true;
    });

    const spyLoadNode = sinon.stub(PagedTreeNodeLoader.prototype, "loadNode").returns(from([]));

    void act(() => {
      onIModelHierarchyChanged.raiseEvent({
        imodelKey,
        rulesetId,
        updateInfo: [{ type: "Insert", parent: undefined, position: 2, node: createNode("inserted_node") }],
      });
    });

    expect(spyLoadNode).to.have.been.called.calledTwice;
  });

  describe("updateTreeModel", () => {
    type TreeHierarchy = string | {
      [label: string]: TreeHierarchy[];
    } | {
      label: string;
      selected?: true;
      expanded?: true;
      loading?: true;
      editingInfo?: TreeModelNodeEditingInfo;
      children?: TreeHierarchy[];
    };

    function expectTree(model: TreeModel, expectedHierarchy: TreeHierarchy[]): void {
      const actualHierarchy = buildActualHierarchy(undefined);
      expect(actualHierarchy).to.deep.equal(expectedHierarchy);

      function buildActualHierarchy(parentId: string | undefined): TreeHierarchy[] {
        const result: TreeHierarchy[] = [];
        for (const childId of model.getChildren(parentId) ?? []) {
          const node = model.getNode(childId) as TreeModelNode;
          const label = (node.label.value as PrimitiveValue).displayValue!;
          const children = buildActualHierarchy(childId);
          const additionalProperties: Partial<TreeHierarchy> = {};
          if (node.isSelected) {
            additionalProperties.selected = true;
          }

          if (node.isExpanded) {
            additionalProperties.expanded = true;
          }

          if (node.isLoading) {
            additionalProperties.loading = true;
          }

          if (node.editingInfo) {
            additionalProperties.editingInfo = node.editingInfo;
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

    function createTreeModel(hierarchy: TreeHierarchy[]): MutableTreeModel {
      const treeModel = new MutableTreeModel();
      insertNodes(undefined, hierarchy);
      expectTree(treeModel, hierarchy);
      return treeModel;

      function insertNodes(parentId: string | undefined, childNodes: TreeHierarchy[]): void {
        for (let i = 0; i < childNodes.length; ++i) {
          const node = childNodes[i];
          if (typeof node === "string") {
            treeModel.insertChild(parentId, createNodeInput(node), i);
          } else if (typeof node.label === "string") {
            treeModel.insertChild(parentId, createNodeInput(node.label), i);
            const insertedNode = treeModel.getNode(node.label)!;
            if (node.selected) {
              insertedNode.isSelected = true;
            }

            if (node.expanded) {
              insertedNode.isExpanded = true;
            }

            if (node.loading) {
              insertedNode.isLoading = true;
            }

            if (node.editingInfo) {
              insertedNode.editingInfo = node.editingInfo as TreeModelNodeEditingInfo;
            }

            insertNodes(node.label, node.children ?? []);
          } else {
            const nodeLabel = Object.keys(node)[0];
            treeModel.insertChild(parentId, createNodeInput(nodeLabel), i);
            insertNodes(nodeLabel, (node as any)[nodeLabel] as TreeHierarchy[]);
          }
        }
      }
    }

    it("returns `undefined` on failure", () => {
      const initialTree = createTreeModel(["root1", "root2"]);
      const updatedTree = updateTreeModel(
        initialTree,
        [{
          type: "Update",
          target: createNode("root1").key,
          changes: { key: createNode("root2").key, label: LabelDefinition.fromLabelString("root2") },
        }],
        {},
      );
      expect(updatedTree).to.be.undefined;
    });

    it("keeps nodes selected", () => {
      const initialTree = createTreeModel(
        [{ label: "root1", selected: true }, { label: "root2", selected: true }, "root3"],
      );
      const updatedTree = updateTreeModel(
        initialTree,
        [{
          type: "Update",
          target: createNode("root1").key,
          changes: { description: "updated description" },
        }],
        {}
      );
      expect(updatedTree).to.be.not.equal(initialTree);
      expectTree(updatedTree!, [{ label: "root1", selected: true }, { label: "root2", selected: true }, "root3"]);
    });

    it("keeps nodes expanded", () => {
      const initialTree = createTreeModel(
        [{ label: "root1", expanded: true }, { label: "root2", expanded: true }, "root3"],
      );
      const updatedTree = updateTreeModel(
        initialTree,
        [{
          type: "Update",
          target: createNode("root1").key,
          changes: { description: "updated description" },
        }],
        {}
      );
      expect(updatedTree).to.be.not.equal(initialTree);
      expectTree(updatedTree!, [{ label: "root1", expanded: true }, { label: "root2", expanded: true }, "root3"]);
    });

    describe("node insertion", () => {
      it("inserts root node", () => {
        const initialTree = createTreeModel(["root1", "root2"]);
        const updatedTree = updateTreeModel(
          initialTree,
          [{ type: "Insert", position: 1, node: createNode("inserted_node") }],
          { appendChildrenCountForGroupingNodes: false },
        );
        expectTree(updatedTree!, ["root1", "inserted_node", "root2"]);
      });

      it("inserts child node wihout children", () => {
        const initialTree = createTreeModel([{ ["root1"]: ["child1"] }]);
        const updatedTree = updateTreeModel(
          initialTree,
          [{ type: "Insert", parent: createNode("root1").key, position: 0, node: createNode("inserted_node") }],
          {},
        );
        expectTree(updatedTree!, [{ ["root1"]: ["inserted_node", "child1"] }]);
        expect(updatedTree!.getNode("root1")!.numChildren).to.be.equal(2);
        expect(updatedTree!.getNode("inserted_node")!.numChildren).to.be.equal(0);
      });

      it("inserts child node with children", () => {
        const initialTree = createTreeModel([{ ["root1"]: ["child1"] }]);
        const node = createNode("inserted_node");
        node.hasChildren = true;
        const updatedTree = updateTreeModel(
          initialTree,
          [{ type: "Insert", parent: createNode("root1").key, position: 0, node }],
          {},
        );
        expectTree(updatedTree!, [{ ["root1"]: ["inserted_node", "child1"] }]);
        expect(updatedTree!.getNode("root1")!.numChildren).to.be.equal(2);
        expect(updatedTree!.getNode("inserted_node")!.numChildren).to.be.equal(undefined);
      });

      it("creates new hierarchy level", () => {
        const initialTree = createTreeModel([{ ["root1"]: ["child1"] }]);
        const updatedTree = updateTreeModel(
          initialTree,
          [{ type: "Insert", parent: createNode("child1").key, position: 0, node: createNode("inserted_node") }],
          {},
        );
        expectTree(updatedTree!, [{ ["root1"]: [{ ["child1"]: ["inserted_node"] }] }]);
        expect(updatedTree!.getNode("child1")!.numChildren).to.be.equal(1);
      });
    });

    describe("node update", () => {
      it("ignores nodes that do not exist", () => {
        const initialTree = createTreeModel(["root1", "root2"]);
        const updatedTree = updateTreeModel(
          initialTree,
          [{
            type: "Update",
            target: createNode("root3").key,
            changes: { description: "new description" },
          }],
          {},
        );
        expect(initialTree).to.be.equal(updatedTree);
      });

      it("updates existing node", () => {
        const initialTree = createTreeModel(["root1", "root2", "root3"]);
        const updatedTree = updateTreeModel(
          initialTree,
          [{
            type: "Update",
            target: createNode("root2").key,
            changes: {
              key: createNode("root2").key,
              label: LabelDefinition.fromLabelString("updated_node"),
              description: "updated description",
            },
          }],
          {},
        );
        expectTree(updatedTree!, ["root1", "updated_node", "root3"]);
        expect(updatedTree!.getNode("root2")?.description).to.be.equal("updated description");
      });

      it("removes children if node no longer has them", () => {
        const initialTree = createTreeModel([{ ["root1"]: ["child1"] }, "root2"]);
        const updatedTree = updateTreeModel(
          initialTree,
          [{
            type: "Update",
            target: createNode("root1").key,
            changes: { hasChildren: false },
          }],
          {},
        );
        expectTree(updatedTree!, ["root1", "root2"]);
        expect(updatedTree!.getNode("root1")!.numChildren).to.be.equal(0);
      });

      it("makes node expandable if it has children after update", () => {
        const initialTree = createTreeModel(["root1", "root2"]);
        const updatedTree = updateTreeModel(
          initialTree,
          [{
            type: "Update",
            target: createNode("root1").key,
            changes: { hasChildren: true },
          }],
          {},
        );
        expectTree(updatedTree!, ["root1", "root2"]);
        expect(updatedTree!.getNode("root1")!.numChildren).to.be.undefined;
      });

      it("updates node key", () => {
        const initialTree = createTreeModel(["root1", "root2"]);
        const updatedTree = updateTreeModel(
          initialTree,
          [{
            type: "Update",
            target: createNode("root1").key,
            changes: { key: createNode("updated_node").key, label: LabelDefinition.fromLabelString("updated_node") },
          }],
          {},
        );
        expectTree(updatedTree!, ["updated_node", "root2"]);
        expect(updatedTree!.getNode("updated_node")).not.to.be.undefined;
      });

      it("appends child count for grouping nodes", () => {
        const initialTree = createTreeModel(["root1", "root2"]);
        const updatedKey: LabelGroupingNodeKey = {
          groupedInstancesCount: 10,
          pathFromRoot: [],
          type: StandardNodeTypes.DisplayLabelGroupingNode,
          label: "",
        };
        const updatedTree = updateTreeModel(
          initialTree,
          [{
            type: "Update",
            target: createNode("root1").key,
            changes: { key: updatedKey, label: LabelDefinition.fromLabelString("updated_node") },
          }],
          { appendChildrenCountForGroupingNodes: true },
        );
        expectTree(updatedTree!, ["updated_node (10)", "root2"]);
      });

      it("exits edit state on modified nodes", () => {
        const editingInfo: TreeModelNodeEditingInfo = { onCommit: () => { }, onCancel: () => { } };
        const initialTree = createTreeModel([{ label: "root1", editingInfo }, { label: "root2", editingInfo }]);
        const updatedTree = updateTreeModel(
          initialTree,
          [{
            type: "Update",
            target: createNode("root1").key,
            changes: { key: createNode("root1").key, label: LabelDefinition.fromLabelString("updated_node") },
          }],
          {}
        );
        expectTree(updatedTree!, ["updated_node", { label: "root2", editingInfo }]);
      });

      it("collapses nodes that no longer have children", () => {
        const initialTree = createTreeModel([
          { label: "root1", expanded: true, loading: true, children: ["child1"] },
          { label: "root2", expanded: true, loading: true, children: ["child2"] },
        ]);
        const updatedTree = updateTreeModel(
          initialTree,
          [{
            type: "Update",
            target: createNode("root1").key,
            changes: { hasChildren: false },
          }],
          {},
        );
        expectTree(
          updatedTree!,
          ["root1", { label: "root2", expanded: true, loading: true, children: ["child2"] }],
        );
      });

      it("deselects nodes that have changed keys", () => {
        const initialTree = createTreeModel([{ label: "root1", selected: true }, { label: "root2", selected: true }]);
        const updatedTree = updateTreeModel(
          initialTree,
          [{
            type: "Update",
            target: createNode("root1").key,
            changes: { key: createNode("updated_key").key, label: LabelDefinition.fromLabelString("updated_node") },
          }],
          {}
        );
        expectTree(updatedTree!, ["updated_node", { label: "root2", selected: true }]);
      });
    });

    describe("node removal", () => {
      it("removes root node", () => {
        const initialTree = createTreeModel(["root1", "root2", "root3"]);
        const updatedTree = updateTreeModel(initialTree, [{ type: "Delete", target: createNode("root2").key }], {});
        expectTree(updatedTree!, ["root1", "root3"]);
      });

      it("removes child node", () => {
        const initialTree = createTreeModel([{ ["root1"]: ["child1", "child2"] }, "root2"]);
        const updatedTree = updateTreeModel(initialTree, [{ type: "Delete", target: createNode("child1").key }], {});
        expectTree(updatedTree!, [{ ["root1"]: ["child2"] }, "root2"]);
      });

      it("removes children along with removed node", () => {
        const initialTree = createTreeModel([{ ["root1"]: ["child1", "child2"] }, "root2"]);
        const updatedTree = updateTreeModel(initialTree, [{ type: "Delete", target: createNode("root1").key }], {});
        expectTree(updatedTree!, ["root2"]);
      });

      it("ignores deletion of node that does not exist", () => {
        const initialTree = createTreeModel(["root1", "root2"]);
        const updatedTree = updateTreeModel(initialTree, [{ type: "Delete", target: createNode("root3").key }], {});
        expect(updatedTree).to.be.equal(initialTree);
        expectTree(updatedTree!, ["root1", "root2"]);
      });
    });
  });
});
