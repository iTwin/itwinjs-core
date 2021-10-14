/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { it } from "mocha";
import * as moq from "typemoq";
import { IModelConnection } from "@itwin/core-frontend";
import { ITwinLocalization } from "@itwin/core-i18n";
import { Node, RegisteredRuleset, RulesetVariable, StandardNodeTypes, VariableValueTypes } from "@itwin/presentation-common";
import { Presentation, PresentationManager, RulesetManager, RulesetVariablesManager } from "@itwin/presentation-frontend";
import { PrimitiveValue } from "@itwin/appui-abstract";
import {
  computeVisibleNodes, MutableTreeModel, TreeModel, TreeModelNode, TreeModelNodeEditingInfo, TreeModelNodeInput, UiComponents,
} from "@itwin/components-react";
import { act, cleanup, renderHook } from "@testing-library/react-hooks";
import { IPresentationTreeDataProvider } from "../../../presentation-components";
import {
  applyHierarchyChanges, PresentationTreeNodeLoaderProps, reloadVisibleHierarchyParts, usePresentationTreeNodeLoader,
} from "../../../presentation-components/tree/controlled/TreeHooks";
import { createTreeNodeItem } from "../../../presentation-components/tree/Utils";
import { mockPresentationManager } from "../../_helpers/UiComponents";

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

  before(async () => {
    await UiComponents.initialize(new ITwinLocalization());
  });

  after(() => {
    UiComponents.terminate();
  });

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
    mocks.presentationManager
      .setup(async (x) => x.getNodesAndCount(moq.It.isAny()))
      .returns(async () => ({ count: 0, nodes: [] }));
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

    expect(result.current.nodeLoader).to.not.be.undefined;
  });

  it("creates new nodeLoader when imodel changes", () => {
    const { result, rerender } = renderHook(
      (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
      { initialProps },
    );
    const oldNodeLoader = result.current.nodeLoader;

    const newImodelMock = moq.Mock.ofType<IModelConnection>();
    rerender({ ...initialProps, imodel: newImodelMock.object });

    expect(result.current.nodeLoader).to.not.eq(oldNodeLoader);
  });

  it("creates new nodeLoader when ruleset changes", () => {
    const { result, rerender } = renderHook(
      (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
      { initialProps },
    );
    const oldNodeLoader = result.current.nodeLoader;

    rerender({ ...initialProps, ruleset: "changed" });

    expect(result.current.nodeLoader).to.not.eq(oldNodeLoader);
  });

  it("creates new nodeLoader when pagingSize changes", () => {
    const { result, rerender } = renderHook(
      (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
      { initialProps },
    );
    const oldNodeLoader = result.current.nodeLoader;

    rerender({ ...initialProps, pagingSize: 20 });

    expect(result.current.nodeLoader).to.not.eq(oldNodeLoader);
  });

  describe("auto-updating model source", () => {
    beforeEach(() => {
      initialProps.enableHierarchyAutoUpdate = true;
    });

    it("doesn't create a new nodeLoader when `PresentationManager` raises `onIModelHierarchyChanged` event with unrelated ruleset", () => {
      const { result } = renderHook(
        (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
        { initialProps },
      );
      const oldNodeLoader = result.current.nodeLoader;

      onIModelHierarchyChanged.raiseEvent({ rulesetId: "unrelated", updateInfo: "FULL", imodelKey });

      expect(result.current.nodeLoader).to.eq(oldNodeLoader);
    });

    it("doesn't create a new nodeLoader when `PresentationManager` raises `onIModelHierarchyChanged` event with unrelated imodel", () => {
      const { result } = renderHook(
        (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
        { initialProps },
      );
      const oldNodeLoader = result.current.nodeLoader;

      onIModelHierarchyChanged.raiseEvent({ rulesetId, updateInfo: "FULL", imodelKey: "unrelated" });

      expect(result.current.nodeLoader).to.eq(oldNodeLoader);
    });

    it("creates a new nodeLoader when `PresentationManager` raises a related `onIModelHierarchyChanged` event with FULL hierarchy update", async () => {
      const { result, waitForNextUpdate } = renderHook(
        (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
        { initialProps: { ...initialProps, ruleset: rulesetId } },
      );
      const oldNodeLoader = result.current.nodeLoader;

      onIModelHierarchyChanged.raiseEvent({ rulesetId, updateInfo: "FULL", imodelKey });

      await waitForNextUpdate();
      expect(result.current.nodeLoader).to.not.eq(oldNodeLoader);
    });

    it("creates a new nodeLoader when `PresentationManager` raises a related `onIModelHierarchyChanged` event with partial hierarchy updates", async () => {
      const { result, waitForNextUpdate } = renderHook(
        (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
        { initialProps },
      );
      const oldNodeLoader = result.current.nodeLoader;

      onIModelHierarchyChanged.raiseEvent({ rulesetId, updateInfo: [{ parent: undefined, nodesCount: 2 }], imodelKey });

      await waitForNextUpdate();
      expect(result.current.nodeLoader).to.not.eq(oldNodeLoader);
    });

    it("doesn't create a new nodeLoader when `RulesetsManager` raises an unrelated `onRulesetModified` event", () => {
      const { result } = renderHook(
        (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
        { initialProps },
      );
      const oldNodeLoader = result.current.nodeLoader;

      const currRuleset = new RegisteredRuleset({ id: "unrelated", rules: [] }, "", () => { });
      onRulesetModified.raiseEvent(currRuleset, { ...currRuleset.toJSON() });

      expect(result.current.nodeLoader).to.eq(oldNodeLoader);
    });

    it("creates a new nodeLoader when `RulesetsManager` raises a related `onRulesetModified` event", async () => {
      const { result, waitForNextUpdate } = renderHook(
        (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
        { initialProps },
      );
      const oldNodeLoader = result.current.nodeLoader;

      const currRuleset = new RegisteredRuleset({ id: rulesetId, rules: [] }, "", () => { });
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      act(() => { onRulesetModified.raiseEvent(currRuleset, currRuleset.toJSON()); });
      await waitForNextUpdate();

      expect(result.current.nodeLoader).to.not.eq(oldNodeLoader);
    });

    it("creates a new nodeLoader when `RulesetVariablesManager` raises an `onRulesetVariableChanged` event with a new value", async () => {
      const { result, waitForNextUpdate } = renderHook(
        (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
        { initialProps },
      );
      const oldNodeLoader = result.current.nodeLoader;

      const variables: RulesetVariable[] = [{
        id: "var-id",
        type: VariableValueTypes.String,
        value: "curr",
      }, {
        id: "other-var",
        type: VariableValueTypes.Int,
        value: 123,
      }];

      rulesetVariablesManagerMock.setup((x) => x.getAllVariables()).returns(() => variables);

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      act(() => { onRulesetVariableChanged.raiseEvent("var-id", undefined, "curr"); });
      await waitForNextUpdate();

      expect(result.current.nodeLoader).to.not.eq(oldNodeLoader);
    });

    it("creates a new nodeLoader when `RulesetVariablesManager` raises an `onRulesetVariableChanged` event with a changed value", async () => {
      const { result, waitForNextUpdate } = renderHook(
        (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
        { initialProps },
      );
      const oldNodeLoader = result.current.nodeLoader;

      const variables: RulesetVariable[] = [{
        id: "var-id",
        type: VariableValueTypes.String,
        value: "curr",
      }, {
        id: "other-var",
        type: VariableValueTypes.Int,
        value: 123,
      }];

      rulesetVariablesManagerMock.setup((x) => x.getAllVariables()).returns(() => variables);

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      act(() => { onRulesetVariableChanged.raiseEvent("var-id", "prev", "curr"); });
      await waitForNextUpdate();

      expect(result.current.nodeLoader).to.not.eq(oldNodeLoader);
    });

    it("creates a new nodeLoader when `RulesetVariablesManager` raises an `onRulesetVariableChanged` event with a removed value", async () => {
      const { result, waitForNextUpdate } = renderHook(
        (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
        { initialProps },
      );
      const oldNodeLoader = result.current.nodeLoader;

      const variables: RulesetVariable[] = [{
        id: "other-var",
        type: VariableValueTypes.Int,
        value: 123,
      }];

      rulesetVariablesManagerMock.setup((x) => x.getAllVariables()).returns(() => variables);

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      act(() => { onRulesetVariableChanged.raiseEvent("var-id", "prev", undefined); });
      await waitForNextUpdate();

      expect(result.current.nodeLoader).to.not.eq(oldNodeLoader);
    });

    it("does not create a new nodeLoader when `onRulesetModified` event is raised but there are no changes", () => {
      const { result } = renderHook(
        (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
        { initialProps },
      );
      const oldNodeLoader = result.current.nodeLoader;

      const currRuleset = new RegisteredRuleset({ id: rulesetId, rules: [] }, "", () => { });
      onRulesetModified.raiseEvent(currRuleset, currRuleset.toJSON());

      expect(result.current.nodeLoader).to.eq(oldNodeLoader);
    });

    it("does not create a new nodeLoader when 'onIModelHierarchyChanged' event is raised but there are no changes", () => {
      const { result } = renderHook(
        (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
        { initialProps },
      );
      const oldNodeLoader = result.current.nodeLoader;

      onIModelHierarchyChanged.raiseEvent({ rulesetId, updateInfo: [], imodelKey });

      expect(result.current.nodeLoader).to.eq(oldNodeLoader);
    });

    it("creates a fresh `TreeModelSource` when nodeLoader changes", async () => {
      const { result, rerender, waitForNextUpdate } = renderHook(
        (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
        { initialProps: { ...initialProps, ruleset: "initial" } },
      );
      const initialModelSource = result.current.nodeLoader.modelSource;
      expectTree(initialModelSource.getModel(), []);
      initialModelSource.modifyModel((treeModel) => treeModel.insertChild(undefined, createNodeInput("test"), 0));

      // Update tree so that `info.treeModel` is not undefined
      onRulesetModified.raiseEvent(
        new RegisteredRuleset({ id: "initial", rules: [] }, "", () => { }),
        { id: "initial", rules: [] },
      );
      await waitForNextUpdate();

      rerender({ ...initialProps, ruleset: "updated" });
      const newModelSource = result.current.nodeLoader.modelSource;
      expectTree(newModelSource.getModel(), []);
    });

    it("reloads nodes and creates a new nodeLoader when 'onIModelHierarchyChanged' event is raised", async () => {
      const { result, waitForNextUpdate } = renderHook(
        (props: PresentationTreeNodeLoaderProps) => usePresentationTreeNodeLoader(props),
        { initialProps },
      );
      const oldNodeLoader = result.current.nodeLoader;
      result.current.onItemsRendered({ overscanStartIndex: 0, overscanStopIndex: 1, visibleStartIndex: 0, visibleStopIndex: 1 });

      presentationManagerMock.setup(async (x) => x.getNodesAndCount(
        moq.It.is(({ paging, parentKey }) => paging?.start === 0 && paging.size === 1 && !parentKey))
      )
        .returns(async () => ({ count: 1, nodes: [createNode("root1")] }))
        .verifiable(moq.Times.once());

      void act(() => { onIModelHierarchyChanged.raiseEvent({ rulesetId, updateInfo: [{ parent: undefined, nodesCount: 1 }], imodelKey }); });
      await waitForNextUpdate();

      expect(result.current.nodeLoader).to.not.eq(oldNodeLoader);
      presentationManagerMock.verifyAll();
    });
  });
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
      if (!node)
        continue;
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

describe("applyHierarchyUpdateRecords", () => {
  it("returns same model if node was not present in model", () => {
    const nonExistingNode = createNode("non-existing");
    const initialTree = createTreeModel(["root1", "root2"]);
    const updatedTree = applyHierarchyChanges(
      initialTree,
      [{
        parent: nonExistingNode.key,
        nodesCount: 2,
      }],
      [],
      {}
    );
    expect(updatedTree).to.be.eq(initialTree);
  });

  it("updates children count of updated root node", () => {
    const initialTree = createTreeModel(["root1", "root2"]);
    const updatedTree = applyHierarchyChanges(
      initialTree,
      [{
        parent: createNode("root1").key,
        nodesCount: 2,
      }],
      [],
      {}
    );
    expectTree(updatedTree, ["root1", "root2"]);
    expect(updatedTree.getNode("root1")?.numChildren).to.be.eq(2);
  });

  it("updates expanded root node and removes siblings", () => {
    const initialTree = createTreeModel(["root1", "root2"]);
    const updatedTree = applyHierarchyChanges(
      initialTree,
      [{
        parent: undefined,
        nodesCount: 1,
        expandedNodes: [{
          node: { ...createNode("root1"), description: "updated-description" },
          position: 0,
        }],
      }],
      [],
      {}
    );
    expectTree(updatedTree, ["root1"]);
    expect(updatedTree.getNode("root1")?.description).to.be.eq("updated-description");
  });

  it("replaces root node with new", () => {
    const initialTree = createTreeModel(["root1", "root2"]);
    const updatedTree = applyHierarchyChanges(
      initialTree,
      [{
        parent: undefined,
        nodesCount: 1,
        expandedNodes: [{
          node: createNode("updated-root"),
          position: 0,
        }],
      }],
      [],
      {}
    );
    expectTree(updatedTree, ["updated-root"]);
  });

  it("replaces child nodes with new if parent is expanded", () => {
    const initialTree = createTreeModel([{ label: "root1", expanded: true, children: ["child1", "child2"] }, "root2"]);
    const updatedTree = applyHierarchyChanges(
      initialTree,
      [{
        parent: createNode("root1").key,
        nodesCount: 1,
        expandedNodes: [{
          node: createNode("updated-child"),
          position: 0,
        }],
      }],
      [],
      {}
    );
    expectTree(updatedTree, [{ label: "root1", expanded: true, children: ["updated-child"] }, "root2"]);
  });

  it("removes child nodes if parent is not expanded", () => {
    const initialTree = createTreeModel([{ ["root1"]: ["child1", "child2"] }, "root2"]);
    const updatedTree = applyHierarchyChanges(
      initialTree,
      [{
        parent: createNode("root1").key,
        nodesCount: 1,
        expandedNodes: [{
          node: createNode("updated-child"),
          position: 0,
        }],
      }],
      [],
      {}
    );
    expectTree(updatedTree, ["root1", "root2"]);
    expect(updatedTree.getNode("root1")?.numChildren).to.be.eq(1);
  });

  it("updates parent node and persists it's subtree", () => {
    const initialTree = createTreeModel([
      {
        label: "root1",
        expanded: true,
        children: [
          "child1",
          {
            label: "child2",
            expanded: true,
            children: ["grandChild1"],
          },
        ],
      },
      "root2",
    ]);

    const updatedTree = applyHierarchyChanges(
      initialTree,
      [{
        parent: undefined,
        nodesCount: 2,
        expandedNodes: [{
          node: { ...createNode("root1"), description: "updated-description" },
          position: 0,
        }],
      }],
      [],
      {}
    );

    expectTree(updatedTree, [
      {
        label: "root1",
        expanded: true,
        children: [
          "child1",
          {
            label: "child2",
            expanded: true,
            children: ["grandChild1"],
          },
        ],
      },
    ]);
    expect(updatedTree.getNode("root1")?.description).to.be.eq("updated-description");
  });

  it("updates root node and adds reloaded siblings", () => {
    const initialTree = createTreeModel(["root1", "root2", "root3"]);

    const updatedTree = applyHierarchyChanges(
      initialTree,
      [{
        parent: undefined,
        nodesCount: 3,
        expandedNodes: [{
          node: { ...createNode("root2"), description: "updated-description" },
          position: 1,
        }],
      }],
      [{
        parentId: undefined,
        nodeItems: [createTreeNodeItem(createNode("root1")), createTreeNodeItem(createNode("root2")), createTreeNodeItem(createNode("root3"))],
        offset: 0,
      }],
      {}
    );

    expectTree(updatedTree, ["root1", "root2", "root3"]);
    expect(updatedTree.getNode("root2")?.description).to.be.eq("updated-description");
  });
});

describe("reloadVisibleHierarchyParts", () => {
  interface HierarchyItem {
    label: string;
    position: number;
    children?: HierarchyItem[];
    childCount?: number;
  }

  function addNodes(model: MutableTreeModel, parentId: string | undefined, items?: HierarchyItem[], itemsCount?: number) {
    model.setNumChildren(parentId, itemsCount ?? items?.length);
    for (const item of items ?? []) {
      model.setChildren(parentId, [{ ...createNodeInput(item.label), isExpanded: true }], item.position);
      addNodes(model, item.label, item.children, item.childCount);
    }
  }

  function createVisibleNodes(rootNodesCount: number, hierarchy: HierarchyItem[],) {
    const model = new MutableTreeModel();
    addNodes(model, undefined, hierarchy, rootNodesCount);
    return computeVisibleNodes(model);
  }

  const dataProviderMock = moq.Mock.ofType<IPresentationTreeDataProvider>();

  beforeEach(() => {
    dataProviderMock.reset();
  });

  it("does not load nodes if they are already loaded", async () => {
    const visibleNodes = createVisibleNodes(2, [{ label: "root1", position: 0 }, { label: "root2", position: 1 }]);
    await reloadVisibleHierarchyParts(visibleNodes, { overscanStartIndex: 0, overscanStopIndex: 1, visibleStartIndex: 0, visibleStopIndex: 1 }, dataProviderMock.object);
    dataProviderMock.verify(async (x) => x.getNodes(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
  });

  it("does not load nodes if there are no visible nodes", async () => {
    const visibleNodes = createVisibleNodes(0, []);
    await reloadVisibleHierarchyParts(visibleNodes, { overscanStartIndex: 0, overscanStopIndex: 4, visibleStartIndex: 0, visibleStopIndex: 4 }, dataProviderMock.object);
    dataProviderMock.verify(async (x) => x.getNodes(moq.It.isAny(), moq.It.isAny()), moq.Times.never());
  });

  it("reloads visible root nodes", async () => {
    const visibleNodes = createVisibleNodes(4, [{ label: "root2", position: 1 }, { label: "root3", position: 2 }]);
    dataProviderMock.setup(async (x) => x.getNodes(undefined, moq.It.isObjectWith({ start: 0, size: 4 })))
      .returns(async () => [])
      .verifiable(moq.Times.once());
    await reloadVisibleHierarchyParts(visibleNodes, { overscanStartIndex: 0, overscanStopIndex: 3, visibleStartIndex: 0, visibleStopIndex: 3 }, dataProviderMock.object);
    dataProviderMock.verifyAll();
  });

  it("reloads visible child nodes", async () => {
    const visibleNodes = createVisibleNodes(2, [{ label: "root1", position: 0 }, { label: "root2", position: 1, childCount: 3 }]);
    dataProviderMock.setup(async (x) => x.getNodes(moq.It.is((item) => item !== undefined && item.id === "root2"), moq.It.isObjectWith({ start: 0, size: 3 })))
      .returns(async () => [])
      .verifiable(moq.Times.once());
    await reloadVisibleHierarchyParts(visibleNodes, { overscanStartIndex: 0, overscanStopIndex: 5, visibleStartIndex: 0, visibleStopIndex: 5 }, dataProviderMock.object);
    dataProviderMock.verifyAll();
  });

  it("reloads with correct page size if there are less visible nodes", async () => {
    const visibleNodes = createVisibleNodes(1, []);
    dataProviderMock.setup(async (x) => x.getNodes(undefined, moq.It.isObjectWith({ start: 0, size: 1 })))
      .returns(async () => [])
      .verifiable(moq.Times.once());
    await reloadVisibleHierarchyParts(visibleNodes, { overscanStartIndex: 0, overscanStopIndex: 4, visibleStartIndex: 0, visibleStopIndex: 4 }, dataProviderMock.object);
    dataProviderMock.verifyAll();
  });

  it("reloads with correct page start if there are less visible nodes", async () => {
    const visibleNodes = createVisibleNodes(3, []);
    dataProviderMock.setup(async (x) => x.getNodes(undefined, moq.It.isObjectWith({ start: 0, size: 3 })))
      .returns(async () => [])
      .verifiable(moq.Times.once());
    await reloadVisibleHierarchyParts(visibleNodes, { overscanStartIndex: 1, overscanStopIndex: 3, visibleStartIndex: 1, visibleStopIndex: 3 }, dataProviderMock.object);
    dataProviderMock.verifyAll();
  });
});
