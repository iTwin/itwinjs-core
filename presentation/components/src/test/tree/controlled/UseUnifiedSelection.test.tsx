/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as moq from "typemoq";
import sinon from "sinon";
import { expect } from "chai";
import { mount } from "enzyme";
import {
  TreeModelSource, TreeEvents, TreeModel, from, TreeCheckboxStateChangeEvent, CheckboxStateChange, Observable,
  TreeSelectionModificationEvent, MutableTreeModelNode, TreeNodeItem, TreeSelectionReplacementEvent
} from "@bentley/ui-components";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { SelectionManager, Presentation, SelectionChangeEvent, SelectionHandler, SelectionChangeEventArgs, SelectionChangeType, ISelectionProvider } from "@bentley/presentation-frontend";
import { BeUiEvent } from "@bentley/bentleyjs-core";

import { UnifiedSelectionTreeEventHandler } from "../../../tree/controlled/UseUnifiedSelection";
import { useControlledTreeUnifiedSelection, IPresentationTreeDataProvider } from "../../../presentation-components";
import { CheckBoxState } from "@bentley/ui-core";
import { createRandomTreeNodeItem } from "../../_helpers/UiComponents";
import { PRESENTATION_TREE_NODE_KEY } from "../../../tree/Utils";
import { ECInstanceNodeKey, KeySet, NodeKey, StandardNodeTypes } from "@bentley/presentation-common";

interface TestHookProps {
  callback: () => void;
}

// tslint:disable-next-line: variable-name naming-convention
const TestHook: React.FC<TestHookProps> = (props: TestHookProps) => {
  props.callback();
  return null;
};

describe("useUnifiedSelection", () => {
  const modelSourceMock = moq.Mock.ofType<TreeModelSource<IPresentationTreeDataProvider>>();
  const treeEventsMock = moq.Mock.ofType<TreeEvents>();
  const dataProviderMock = moq.Mock.ofType<IPresentationTreeDataProvider>();
  const imodelMock = moq.Mock.ofType<IModelConnection>();
  const selectionManagerMock = moq.Mock.ofType<SelectionManager>();

  beforeEach(() => {
    modelSourceMock.reset();
    treeEventsMock.reset();
    dataProviderMock.reset();
    imodelMock.reset();
    selectionManagerMock.reset();

    modelSourceMock.setup((x) => x.onModelChanged).returns(() => new BeUiEvent<TreeModel>());
    selectionManagerMock.setup((x) => x.selectionChange).returns(() => new SelectionChangeEvent());
    Presentation.selection = selectionManagerMock.object;
    modelSourceMock.setup((x) => x.getDataProvider()).returns(() => dataProviderMock.object);
    dataProviderMock.setup((x) => x.imodel).returns(() => imodelMock.object);
    dataProviderMock.setup((x) => x.rulesetId).returns(() => "TestRuleset");
  });

  it("returns wrapped event handler", () => {
    let eventHandler: TreeEvents;
    mount(
      <TestHook callback={() => { eventHandler = useControlledTreeUnifiedSelection(modelSourceMock.object, treeEventsMock.object); }} />,
    );

    expect(eventHandler!).to.not.be.undefined;
  });

  it("disposes previous event handler", () => {
    let eventHandler: UnifiedSelectionTreeEventHandler;
    const wrapper = mount(
      <TestHook callback={() => { eventHandler = useControlledTreeUnifiedSelection(modelSourceMock.object, treeEventsMock.object) as UnifiedSelectionTreeEventHandler; }} />,
    );

    const disposeSpy = sinon.spy(eventHandler!, "dispose");

    const newTreeEventsMock = moq.Mock.ofType<TreeEvents>();
    wrapper.setProps({ callback: () => useControlledTreeUnifiedSelection(modelSourceMock.object, newTreeEventsMock.object) });

    expect(disposeSpy).to.be.calledOnce;
  });

  it("disposes selectionHandler on unmount", () => {
    let eventHandler: UnifiedSelectionTreeEventHandler;
    const wrapper = mount(
      <TestHook callback={() => { eventHandler = useControlledTreeUnifiedSelection(modelSourceMock.object, treeEventsMock.object) as UnifiedSelectionTreeEventHandler; }} />,
    );
    const selectionHandler = (eventHandler! as any)._selectionHandler;
    const disposeSpy = sinon.spy(selectionHandler, "dispose");

    wrapper.unmount();

    expect(disposeSpy).to.be.calledOnce;
  });

});

describe("UnifiedSelectionEventHandler", () => {
  let unifiedEventHandler: UnifiedSelectionTreeEventHandler;
  const treeEventsMock = moq.Mock.ofType<TreeEvents>();
  const treeModelSourceMock = moq.Mock.ofType<TreeModelSource<IPresentationTreeDataProvider>>();
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
    treeModelSourceMock.setup((x) => x.getDataProvider()).returns(() => dataProviderMock.object);
    dataProviderMock.setup((x) => x.getNodeKey(moq.It.isAny())).returns((n: TreeNodeItem) => (n as any)[PRESENTATION_TREE_NODE_KEY]);
    unifiedEventHandler = new UnifiedSelectionTreeEventHandler(treeEventsMock.object, treeModelSourceMock.object, selectionHandlerMock.object);
  });

  const createNode = (nodeKey?: NodeKey) => {
    const nodeItem = createRandomTreeNodeItem(nodeKey);
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
        nodeId: "TestId",
        newState: CheckBoxState.On,
      }];
      const event: TreeCheckboxStateChangeEvent = { stateChanges: from([stateChanges]) };
      treeEventsMock.setup((x) => x.onCheckboxStateChanged!(event)).verifiable(moq.Times.once());
      unifiedEventHandler.onCheckboxStateChanged(event);
      treeEventsMock.verifyAll();
    });

  });

  describe("onSelectionModified", () => {

    it("passes event to wrapped handler", () => {
      const event: TreeSelectionModificationEvent = {
        modifications: from([{ selectedNodeIds: [], deselectedNodeIds: [] }]),
      };
      treeEventsMock.setup((x) => x.onSelectionModified!(moq.It.is((e) => e !== undefined))).verifiable(moq.Times.once());
      unifiedEventHandler.onSelectionModified(event);
      treeEventsMock.verifyAll();
    });

    it("collects affected node items", () => {
      const node1: MutableTreeModelNode = createNode();
      const node2: MutableTreeModelNode = createNode({ type: StandardNodeTypes.ECClassGroupingNode, className: "test", groupedInstancesCount: 0, pathFromRoot: [] });

      const nodeKeys = [(dataProviderMock.target.getNodeKey(node1.item) as ECInstanceNodeKey).instanceKey, dataProviderMock.target.getNodeKey(node2.item)];

      treeModelSourceMock.setup((x) => x.getModel()).returns(() => treeModelMock.object);
      treeModelMock.setup((x) => x.getNode(node1.id)).returns(() => node1);
      treeModelMock.setup((x) => x.getNode(node2.id)).returns(() => node2);

      const event: TreeSelectionModificationEvent = {
        modifications: from([{ selectedNodeIds: [node1.id, node2.id], deselectedNodeIds: [] }]),
      };
      treeEventsMock.setup((x) => x.onSelectionModified).returns(() => undefined);
      unifiedEventHandler.onSelectionModified(event);

      selectionHandlerMock
        .verify((x) => x.addToSelection(nodeKeys), moq.Times.once());
    });

  });

  describe("onSelectionReplaced", () => {

    it("passes event to wrapped handler", () => {
      const event: TreeSelectionReplacementEvent = {
        replacements: from([{ selectedNodeIds: [] }]),
      };
      treeEventsMock.setup((x) => x.onSelectionReplaced!(moq.It.is((e) => e !== undefined))).verifiable(moq.Times.once());
      unifiedEventHandler.onSelectionReplaced(event);
      treeEventsMock.verifyAll();
    });

    it("collects affected node items", () => {
      const node1: MutableTreeModelNode = createNode();
      const node2: MutableTreeModelNode = createNode({ type: StandardNodeTypes.ECClassGroupingNode, className: "test", groupedInstancesCount: 0, pathFromRoot: [] });

      const nodeKeys = [(dataProviderMock.target.getNodeKey(node1.item) as ECInstanceNodeKey).instanceKey, dataProviderMock.target.getNodeKey(node2.item)];

      treeModelSourceMock.setup((x) => x.getModel()).returns(() => treeModelMock.object);
      treeModelMock.setup((x) => x.getNode(node1.id)).returns(() => node1);
      treeModelMock.setup((x) => x.getNode(node2.id)).returns(() => node2);

      const event: TreeSelectionReplacementEvent = {
        replacements: from([{ selectedNodeIds: [node1.id, node2.id] }]),
      };
      treeEventsMock.setup((x) => x.onSelectionReplaced).returns(() => undefined);
      unifiedEventHandler.onSelectionReplaced(event);

      selectionHandlerMock.verify((x) => x.replaceSelection(nodeKeys), moq.Times.once());
    });

    it("adds to selection loaded nodes", () => {
      const node1: MutableTreeModelNode = createNode();
      const node2: MutableTreeModelNode = createNode();

      treeModelSourceMock.setup((x) => x.getModel()).returns(() => treeModelMock.object);
      treeModelMock.setup((x) => x.getNode(node1.id)).returns(() => node1);
      treeModelMock.setup((x) => x.getNode(node2.id)).returns(() => node2);

      const event: TreeSelectionReplacementEvent = {
        replacements: from([{ selectedNodeIds: [node1.id] }, { selectedNodeIds: [node2.id] }]),
      };
      treeEventsMock.setup((x) => x.onSelectionReplaced).returns(() => undefined);
      unifiedEventHandler.onSelectionReplaced(event);

      selectionHandlerMock.verify((x) => x.replaceSelection([(dataProviderMock.target.getNodeKey(node1.item) as ECInstanceNodeKey).instanceKey]), moq.Times.once());
      selectionHandlerMock.verify((x) => x.addToSelection([(dataProviderMock.target.getNodeKey(node2.item) as ECInstanceNodeKey).instanceKey]), moq.Times.once());
    });

    it("adds wrapped handler's subscription to its subscription so it could be canceled", () => {
      const observableMock = moq.Mock.ofType<Observable<{ selectedNodeIds: string[] }>>();
      const spy = sinon.spy();
      const outerSubscription = {
        closed: false,
        unsubscribe: () => { },
        add: spy,
      }
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
        add: () => { }
      };

      (unifiedEventHandler as any)._ongoingSubscriptions.add(previousSubscription);
      unifiedEventHandler.onSelectionReplaced({ replacements: from([{ selectedNodeIds: [] }]) });
      expect(spy).to.be.called;
    });

  });

  describe("model change handling", () => {

    it("applies unified selection when model changes", () => {
      const node = createNode();
      selectionHandlerMock.setup((x) => x.getSelection()).returns(() => new KeySet([dataProviderMock.target.getNodeKey(node.item)]))
      treeModelSourceMock.setup((x) => x.modifyModel(moq.It.isAny())).callback((action) => action(treeModelMock.object));
      treeModelMock.setup((x) => x.iterateTreeModelNodes()).returns(() => [node][Symbol.iterator]());

      onModelChangeEvent.emit(treeModelMock.object);
      expect(node.isSelected).to.be.true;
    });

    it("skips onModelChange event if it is currently selecting node", () => {
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
      const nodes: MutableTreeModelNode[] = [createNode(), createNode()];
      nodes[1].isSelected = true;

      const keys = [dataProviderMock.target.getNodeKey(nodes[0].item), (dataProviderMock.target.getNodeKey(nodes[1].item) as ECInstanceNodeKey).instanceKey];

      selectionHandlerMock.setup((x) => x.getSelection()).returns(() => new KeySet(keys));
      treeModelMock.setup((x) => x.iterateTreeModelNodes()).returns(() => nodes[Symbol.iterator]());

      selectionHandlerMock.target.onSelect!(selectionEvent, selectionProviderMock.object);
      expect(nodes[0].isSelected).to.be.true;
      expect(nodes[1].isSelected).to.be.true;
    });

    it("deselects nodes according unified selection", () => {
      const nodes: MutableTreeModelNode[] = [createNode(), createNode({ type: StandardNodeTypes.ECClassGroupingNode, className: "test", groupedInstancesCount: 0, pathFromRoot: [] })];
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
