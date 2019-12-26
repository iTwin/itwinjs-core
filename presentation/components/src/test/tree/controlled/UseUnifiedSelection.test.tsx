/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/* tslint:disable:no-direct-imports */
import * as moq from "typemoq";
import sinon from "sinon";
import { expect } from "chai";
import { renderHook } from "@testing-library/react-hooks";
import { createRandomGroupingNodeKey, createRandomECInstancesNodeKey, createRandomECInstanceNodeKey } from "@bentley/presentation-common/lib/test/_helpers/random";
import { BeUiEvent } from "@bentley/bentleyjs-core";
import { CheckBoxState } from "@bentley/ui-core";
import {
  TreeModelSource, TreeEvents, TreeModel, from, TreeCheckboxStateChangeEvent, CheckboxStateChange, Observable,
  TreeSelectionModificationEvent, MutableTreeModelNode, TreeNodeItem, TreeSelectionReplacementEvent, MutableTreeModel,
} from "@bentley/ui-components";
import { KeySet, NodeKey, Keys } from "@bentley/presentation-common";
import {
  SelectionManager, Presentation, SelectionChangeEvent, SelectionHandler,
  SelectionChangeEventArgs, SelectionChangeType, ISelectionProvider, SelectionHelper,
} from "@bentley/presentation-frontend";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { UnifiedSelectionTreeEventHandler } from "../../../tree/controlled/UseUnifiedSelection";
import { useControlledTreeUnifiedSelection, IPresentationTreeDataProvider } from "../../../presentation-components";
import { createRandomTreeNodeItem } from "../../_helpers/UiComponents";
import { PRESENTATION_TREE_NODE_KEY } from "../../../tree/Utils";

describe("useUnifiedSelection", () => {
  interface HookProps {
    modelSource: TreeModelSource;
    dataProvider: IPresentationTreeDataProvider;
    treeEvents: TreeEvents;
  }

  const modelSourceMock = moq.Mock.ofType<TreeModelSource>();
  const treeEventsMock = moq.Mock.ofType<TreeEvents>();
  const dataProviderMock = moq.Mock.ofType<IPresentationTreeDataProvider>();
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const selectionManagerMock = moq.Mock.ofType<SelectionManager>();
  const initialProps: HookProps = {
    modelSource: modelSourceMock.object,
    dataProvider: dataProviderMock.object,
    treeEvents: treeEventsMock.object,
  };

  beforeEach(() => {
    modelSourceMock.reset();
    treeEventsMock.reset();
    dataProviderMock.reset();
    imodelMock.reset();
    selectionManagerMock.reset();

    modelSourceMock.setup((x) => x.onModelChanged).returns(() => new BeUiEvent<TreeModel>());
    selectionManagerMock.setup((x) => x.selectionChange).returns(() => new SelectionChangeEvent());
    Presentation.selection = selectionManagerMock.object;
    dataProviderMock.setup((x) => x.imodel).returns(() => imodelMock.object);
    dataProviderMock.setup((x) => x.rulesetId).returns(() => "TestRuleset");
  });

  it("returns wrapped event handler", () => {

    const hook = renderHook(
      (props: HookProps) => useControlledTreeUnifiedSelection(props.modelSource, props.treeEvents, props.dataProvider),
      { initialProps },
    );
    expect(hook.result.current).to.not.be.undefined;
  });

  it("disposes previous event handler", () => {
    const hook = renderHook(
      (props: HookProps) => useControlledTreeUnifiedSelection(props.modelSource, props.treeEvents, props.dataProvider),
      { initialProps },
    );

    const eventHandler = hook.result.current as UnifiedSelectionTreeEventHandler;
    const disposeSpy = sinon.spy(eventHandler!, "dispose");

    const newTreeEventsMock = moq.Mock.ofType<TreeEvents>();
    hook.rerender({ ...initialProps, treeEvents: newTreeEventsMock.object });

    expect(disposeSpy).to.be.calledOnce;
  });

  it("disposes selectionHandler on unmount", () => {
    const hook = renderHook(
      (props: HookProps) => useControlledTreeUnifiedSelection(props.modelSource, props.treeEvents, props.dataProvider),
      { initialProps },
    );

    const selectionHandler = (hook.result.current as any)._selectionHandler;
    const disposeSpy = sinon.spy(selectionHandler, "dispose");

    hook.unmount();

    expect(disposeSpy).to.be.calledOnce;
  });

});

describe("UnifiedSelectionEventHandler", () => {
  let unifiedEventHandler: UnifiedSelectionTreeEventHandler;
  const treeEventsMock = moq.Mock.ofType<TreeEvents>();
  const treeModelSourceMock = moq.Mock.ofType<TreeModelSource>();
  const selectionHandlerMock = moq.Mock.ofType<SelectionHandler>();
  const treeModelMock = moq.Mock.ofType<TreeModel>();
  const dataProviderMock = moq.Mock.ofType<IPresentationTreeDataProvider>();

  let onModelChangeEvent: BeUiEvent<TreeModel>;

  beforeEach(() => {
    treeModelSourceMock.reset();
    treeEventsMock.reset();
    selectionHandlerMock.reset();

    onModelChangeEvent = new BeUiEvent<TreeModel>();
    treeModelSourceMock.setup((x) => x.onModelChanged).returns(() => onModelChangeEvent);
    dataProviderMock.setup((x) => x.getNodeKey(moq.It.isAny())).returns((n: TreeNodeItem) => (n as any)[PRESENTATION_TREE_NODE_KEY]);
    unifiedEventHandler = new UnifiedSelectionTreeEventHandler(treeEventsMock.object, treeModelSourceMock.object, selectionHandlerMock.object, dataProviderMock.object);
  });

  const createNode = (nodeKeyGenerator: () => NodeKey = createRandomECInstancesNodeKey) => {
    const nodeItem = createRandomTreeNodeItem(nodeKeyGenerator());
    const node: MutableTreeModelNode = {
      id: nodeItem.id,
      label: nodeItem.label,
      isLoading: false,
      isSelected: false,
      depth: 0,
      description: "",
      item: nodeItem,
      isExpanded: false,
      numChildren: 0,
      checkbox: {
        isDisabled: true,
        isVisible: false,
        state: CheckBoxState.Off,
        tooltip: "",
      },
      parentId: undefined,
    };
    return node;
  };

  describe("onNodeExpanded", () => {

    it("passes event to wrapped handler", () => {
      const event = { nodeId: "TestId" };
      treeEventsMock.setup((x) => x.onNodeExpanded!(event)).verifiable(moq.Times.once());
      unifiedEventHandler.onNodeExpanded(event);
      treeEventsMock.verifyAll();
    });

  });

  describe("onNodeCollapsed", () => {

    it("passes event to wrapped handler", () => {
      const event = { nodeId: "TestId" };
      treeEventsMock.setup((x) => x.onNodeCollapsed!(event)).verifiable(moq.Times.once());
      unifiedEventHandler.onNodeCollapsed(event);
      treeEventsMock.verifyAll();
    });

  });

  describe("onCheckboxStateChanged", () => {

    it("passes event to wrapped handler", () => {
      const stateChanges: CheckboxStateChange[] = [{
        nodeItem: { id: "TestId", label: "TestLabel" },
        newState: CheckBoxState.On,
      }];
      const event: TreeCheckboxStateChangeEvent = { stateChanges: from([stateChanges]) };
      treeEventsMock.setup((x) => x.onCheckboxStateChanged!(event)).verifiable(moq.Times.once());
      unifiedEventHandler.onCheckboxStateChanged(event);
      treeEventsMock.verifyAll();
    });

  });

  describe("onDelayedNodeClick", () => {

    it("passes event to wrapped handler", () => {
      const event = { nodeId: "TestId" };
      treeEventsMock.setup((x) => x.onDelayedNodeClick!(event)).verifiable(moq.Times.once());
      unifiedEventHandler.onDelayedNodeClick(event);
      treeEventsMock.verifyAll();
    });

  });

  describe("getModel", () => {

    it("returns tree model", () => {
      const treeModel = new MutableTreeModel();
      treeModelSourceMock.setup((x) => x.getModel()).returns(() => treeModel);
      const returnedModel = (unifiedEventHandler as any).getModel();
      expect(returnedModel).to.be.deep.eq(treeModel);
    });

  });

  describe("onSelectionModified", () => {

    it("passes event to wrapped handler", () => {
      const event: TreeSelectionModificationEvent = {
        modifications: from([{ selectedNodeItems: [], deselectedNodeItems: [] }]),
      };
      treeEventsMock.setup((x) => x.onSelectionModified!(moq.It.is((e) => e !== undefined))).verifiable(moq.Times.once());
      unifiedEventHandler.onSelectionModified(event);
      treeEventsMock.verifyAll();
    });

    it("collects affected node items", () => {
      const node1: MutableTreeModelNode = createNode();
      const node2: MutableTreeModelNode = createNode(createRandomGroupingNodeKey);
      const selectionKeys = SelectionHelper.getKeysForSelection([
        dataProviderMock.target.getNodeKey(node1.item),
        dataProviderMock.target.getNodeKey(node2.item),
      ]);

      treeModelSourceMock.setup((x) => x.getModel()).returns(() => treeModelMock.object);
      treeModelMock.setup((x) => x.getNode(node1.item.id)).returns(() => node1);
      treeModelMock.setup((x) => x.getNode(node2.item.id)).returns(() => node2);

      const event: TreeSelectionModificationEvent = {
        modifications: from([{ selectedNodeItems: [node1.item, node2.item], deselectedNodeItems: [] }]),
      };
      treeEventsMock.setup((x) => x.onSelectionModified).returns(() => undefined);
      unifiedEventHandler.onSelectionModified(event);

      selectionHandlerMock
        .verify((x) => x.addToSelection(selectionKeys), moq.Times.once());
    });

    it("applies unified selection after event is handled", () => {
      const nodeKey = createRandomECInstancesNodeKey();
      const nodes: MutableTreeModelNode[] = [createNode(() => nodeKey), createNode(() => nodeKey)];
      nodes[0].isSelected = false;
      nodes[1].isSelected = false;

      treeModelSourceMock.setup((x) => x.modifyModel(moq.It.isAny())).callback((action) => action(treeModelMock.object));
      treeModelMock.setup((x) => x.getNode(nodes[0].item.id)).returns(() => nodes[0]);
      treeModelMock.setup((x) => x.getNode(nodes[1].item.id)).returns(() => nodes[1]);
      treeModelMock.setup((x) => x.iterateTreeModelNodes()).returns(() => nodes[Symbol.iterator]());

      selectionHandlerMock.setup((x) => x.addToSelection(moq.It.isAny(), moq.It.isAny()))
        .callback((keys: Keys) => {
          selectionHandlerMock.setup((x) => x.getSelection()).returns(() => new KeySet(keys));
        });

      const event: TreeSelectionModificationEvent = {
        modifications: from([{ selectedNodeItems: [nodes[0].item], deselectedNodeItems: [] }]),
      };
      unifiedEventHandler.onSelectionModified(event);

      expect(nodes[0].isSelected).to.be.true;
      expect(nodes[1].isSelected).to.be.true;
    });

  });

  describe("onSelectionReplaced", () => {

    it("passes event to wrapped handler", () => {
      const event: TreeSelectionReplacementEvent = {
        replacements: from([{ selectedNodeItems: [] }]),
      };
      treeEventsMock.setup((x) => x.onSelectionReplaced!(moq.It.is((e) => e !== undefined))).verifiable(moq.Times.once());
      unifiedEventHandler.onSelectionReplaced(event);
      treeEventsMock.verifyAll();
    });

    it("collects affected node items", () => {
      const node1: MutableTreeModelNode = createNode();
      const node2: MutableTreeModelNode = createNode(createRandomGroupingNodeKey);
      const selectionKeys = SelectionHelper.getKeysForSelection([
        dataProviderMock.target.getNodeKey(node1.item),
        dataProviderMock.target.getNodeKey(node2.item),
      ]);

      treeModelSourceMock.setup((x) => x.getModel()).returns(() => treeModelMock.object);
      treeModelMock.setup((x) => x.getNode(node1.item.id)).returns(() => node1);
      treeModelMock.setup((x) => x.getNode(node2.item.id)).returns(() => node2);

      const event: TreeSelectionReplacementEvent = {
        replacements: from([{ selectedNodeItems: [node1.item, node2.item] }]),
      };
      treeEventsMock.setup((x) => x.onSelectionReplaced).returns(() => undefined);
      unifiedEventHandler.onSelectionReplaced(event);

      selectionHandlerMock.verify((x) => x.replaceSelection(selectionKeys), moq.Times.once());
    });

    it("adds to selection loaded nodes", () => {
      const node1: MutableTreeModelNode = createNode();
      const node2: MutableTreeModelNode = createNode();

      treeModelSourceMock.setup((x) => x.getModel()).returns(() => treeModelMock.object);
      treeModelMock.setup((x) => x.getNode(node1.item.id)).returns(() => node1);
      treeModelMock.setup((x) => x.getNode(node2.item.id)).returns(() => node2);

      const event: TreeSelectionReplacementEvent = {
        replacements: from([{ selectedNodeItems: [node1.item] }, { selectedNodeItems: [node2.item] }]),
      };
      treeEventsMock.setup((x) => x.onSelectionReplaced).returns(() => undefined);
      unifiedEventHandler.onSelectionReplaced(event);

      selectionHandlerMock.verify((x) => x.replaceSelection(SelectionHelper.getKeysForSelection([dataProviderMock.target.getNodeKey(node1.item)])), moq.Times.once());
      selectionHandlerMock.verify((x) => x.addToSelection(SelectionHelper.getKeysForSelection([dataProviderMock.target.getNodeKey(node2.item)])), moq.Times.once());
    });

    it("adds wrapped handler's subscription to its subscription so it could be canceled", () => {
      const observableMock = moq.Mock.ofType<Observable<{ selectedNodeItems: TreeNodeItem[] }>>();
      const spy = sinon.spy();
      const outerSubscription = {
        closed: false,
        unsubscribe: () => { },
        add: spy,
      };
      const innerSubscription = {
        closed: false,
        unsubscribe: () => { },
        add: () => { },
      };
      observableMock.setup((x) => x.subscribe(moq.It.isAny())).returns(() => outerSubscription);
      treeEventsMock.setup((x) => x.onSelectionReplaced!(moq.It.isAny())).returns(() => innerSubscription);
      unifiedEventHandler.onSelectionReplaced({ replacements: observableMock.object });
      expect(spy).to.be.called;
    });

    it("unsubscribes from previous selection", () => {
      const spy = sinon.spy();
      const previousSubscription = {
        closed: false,
        unsubscribe: spy,
        add: () => { },
      };

      (unifiedEventHandler as any)._ongoingSubscriptions.add(previousSubscription);
      unifiedEventHandler.onSelectionReplaced({ replacements: from([{ selectedNodeItems: [] }]) });
      expect(spy).to.be.called;
    });

    it("applies unified selection after event is handled", () => {
      const nodeKey = createRandomECInstancesNodeKey();
      const nodes: MutableTreeModelNode[] = [createNode(() => nodeKey), createNode(() => nodeKey)];
      nodes[0].isSelected = false;
      nodes[1].isSelected = false;

      treeModelSourceMock.setup((x) => x.modifyModel(moq.It.isAny())).callback((action) => action(treeModelMock.object));
      treeModelMock.setup((x) => x.getNode(nodes[0].item.id)).returns(() => nodes[0]);
      treeModelMock.setup((x) => x.getNode(nodes[1].item.id)).returns(() => nodes[1]);
      treeModelMock.setup((x) => x.iterateTreeModelNodes()).returns(() => nodes[Symbol.iterator]());

      selectionHandlerMock.setup((x) => x.replaceSelection(moq.It.isAny(), moq.It.isAny()))
        .callback((keys: Keys) => {
          selectionHandlerMock.setup((x) => x.getSelection()).returns(() => new KeySet(keys));
        });

      const event: TreeSelectionReplacementEvent = {
        replacements: from([{ selectedNodeItems: [nodes[0].item] }]),
      };
      unifiedEventHandler.onSelectionReplaced(event);

      expect(nodes[0].isSelected).to.be.true;
      expect(nodes[1].isSelected).to.be.true;
    });

  });

  describe("model change handling", () => {

    it("applies unified selection when model changes", () => {
      const node = createNode();
      selectionHandlerMock.setup((x) => x.getSelection()).returns(() => new KeySet([dataProviderMock.target.getNodeKey(node.item)]));
      treeModelSourceMock.setup((x) => x.modifyModel(moq.It.isAny())).callback((action) => action(treeModelMock.object));
      treeModelMock.setup((x) => x.iterateTreeModelNodes()).returns(() => [node][Symbol.iterator]());

      onModelChangeEvent.emit(treeModelMock.object);
      expect(node.isSelected).to.be.true;
    });

    it("deselects node without key", () => {
      const node = createNode();
      node.isSelected = true;
      const keySet = new KeySet([dataProviderMock.target.getNodeKey(node.item)]);
      selectionHandlerMock.setup((x) => x.getSelection()).returns(() => keySet);
      treeModelSourceMock.setup((x) => x.modifyModel(moq.It.isAny())).callback((action) => action(treeModelMock.object));
      (node.item as any)[PRESENTATION_TREE_NODE_KEY] = undefined;

      treeModelMock.setup((x) => x.iterateTreeModelNodes()).returns(() => [node][Symbol.iterator]());

      onModelChangeEvent.emit(treeModelMock.object);
      expect(node.isSelected).to.be.false;
    });

    it("skips onModelChange event if it is currently selecting nodes", () => {
      treeModelSourceMock.reset();
      treeModelSourceMock.setup((x) => x.modifyModel(moq.It.isAny())).verifiable(moq.Times.never());

      (unifiedEventHandler as any)._selecting = true;

      onModelChangeEvent.emit(treeModelMock.object);
      treeModelSourceMock.verifyAll();
    });

  });

  describe("unified selection handling", () => {
    const imodelMock = moq.Mock.ofType<IModelConnection>();
    const selectionProviderMock = moq.Mock.ofType<ISelectionProvider>();
    const selectionEvent: SelectionChangeEventArgs = {
      changeType: SelectionChangeType.Add,
      imodel: imodelMock.object,
      keys: new KeySet(),
      level: 0,
      source: "Test",
      timestamp: new Date(),
    };

    beforeEach(() => {
      treeModelSourceMock.setup((x) => x.modifyModel(moq.It.isAny())).callback((action) => action(treeModelMock.object));
    });

    it("selects nodes according unified selection", () => {
      const nodes: MutableTreeModelNode[] = [
        createNode(createRandomECInstanceNodeKey),
        createNode(createRandomECInstancesNodeKey),
        createNode(createRandomGroupingNodeKey),
      ];
      nodes[1].isSelected = true;
      const selectionKeys = SelectionHelper.getKeysForSelection(nodes.map((n) => dataProviderMock.target.getNodeKey(n.item)));

      selectionHandlerMock.setup((x) => x.getSelection()).returns(() => new KeySet(selectionKeys));
      treeModelMock.setup((x) => x.iterateTreeModelNodes()).returns(() => nodes[Symbol.iterator]());

      selectionHandlerMock.target.onSelect!(selectionEvent, selectionProviderMock.object);
      expect(nodes[0].isSelected).to.be.true;
      expect(nodes[1].isSelected).to.be.true;
      expect(nodes[2].isSelected).to.be.true;
    });

    it("deselects nodes according unified selection", () => {
      const nodes: MutableTreeModelNode[] = [createNode(), createNode(createRandomGroupingNodeKey)];
      nodes[0].isSelected = true;
      nodes[1].isSelected = false;

      selectionHandlerMock.setup((x) => x.getSelection()).returns(() => new KeySet());
      treeModelMock.setup((x) => x.iterateTreeModelNodes()).returns(() => nodes[Symbol.iterator]());

      selectionHandlerMock.target.onSelect!(selectionEvent, selectionProviderMock.object);
      expect(nodes[0].isSelected).to.be.false;
      expect(nodes[1].isSelected).to.be.false;
    });

    it("skips unified selection change if it is change event source", () => {
      treeModelSourceMock.reset();
      treeModelSourceMock.setup((x) => x.modifyModel(moq.It.isAny())).verifiable(moq.Times.never());
      selectionHandlerMock.setup((x) => x.name).returns(() => selectionEvent.source);

      selectionHandlerMock.target.onSelect!(selectionEvent, selectionProviderMock.object);
      treeModelSourceMock.verifyAll();
    });

    it("cancels ongoing subscriptions on selection replace event", () => {
      treeModelSourceMock.reset();
      const spy = sinon.spy();
      const previousSubscription = {
        closed: false,
        unsubscribe: spy,
      };
      (unifiedEventHandler as any)._ongoingSubscriptions.add(previousSubscription);
      selectionEvent.changeType = SelectionChangeType.Replace;

      selectionHandlerMock.target.onSelect!(selectionEvent, selectionProviderMock.object);
      expect(spy).to.be.called;
    });

  });

});
