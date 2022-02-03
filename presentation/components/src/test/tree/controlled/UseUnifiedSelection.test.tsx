/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { from } from "rxjs/internal/observable/from";
import { finalize } from "rxjs/internal/operators/finalize";
import type { ObservableInput } from "rxjs/internal/types";
import sinon from "sinon";
import * as moq from "typemoq";
import { BeUiEvent } from "@itwin/core-bentley";
import type { IModelConnection } from "@itwin/core-frontend";
import type { Keys, NodeKey } from "@itwin/presentation-common";
import { KeySet } from "@itwin/presentation-common";
import { createRandomECInstancesNodeKey, createRandomGroupingNodeKey, ResolvablePromise } from "@itwin/presentation-common/lib/cjs/test";
import type {
  ISelectionProvider, SelectionChangeEventArgs, SelectionHandler, SelectionManager} from "@itwin/presentation-frontend";
import { Presentation, SelectionChangeType, SelectionHelper,
} from "@itwin/presentation-frontend";
import type {
  AbstractTreeNodeLoaderWithProvider, MutableTreeModelNode, TreeModel, TreeModelChanges, TreeModelSource, TreeNodeItem,
  TreeSelectionModificationEventArgs, TreeSelectionReplacementEventArgs,
} from "@itwin/components-react";
import { CheckBoxState } from "@itwin/core-react";
import { renderHook } from "@testing-library/react-hooks";
import type {
  IPresentationTreeDataProvider} from "../../../presentation-components";
import { UnifiedSelectionTreeEventHandler, useUnifiedSelectionTreeEventHandler,
} from "../../../presentation-components";
import type { UnifiedSelectionTreeEventHandlerParams } from "../../../presentation-components/tree/controlled/UseUnifiedSelection";
import { PRESENTATION_TREE_NODE_KEY } from "../../../presentation-components/tree/Utils";
import { createRandomTreeNodeItem } from "../../_helpers/UiComponents";

const awaitableObservable = <T extends unknown>(input: ObservableInput<T>) => {
  const promise = new ResolvablePromise<void>();
  const observable = from(input).pipe(finalize(async () => promise.resolve()));
  return { observable, waitForCompletion: async () => promise };
};

describe("UnifiedSelectionEventHandler", () => {
  let unifiedEventHandler: UnifiedSelectionTreeEventHandler;
  const treeModelSourceMock = moq.Mock.ofType<TreeModelSource>();
  const nodeLoaderMock = moq.Mock.ofType<AbstractTreeNodeLoaderWithProvider<IPresentationTreeDataProvider>>();
  const selectionHandlerMock = moq.Mock.ofType<SelectionHandler>();
  const treeModelMock = moq.Mock.ofType<TreeModel>();
  const dataProviderMock = moq.Mock.ofType<IPresentationTreeDataProvider>();
  dataProviderMock.setup((x) => x.getNodeKey(moq.It.isAny())).returns((n: TreeNodeItem) => {
    return (n as any)[PRESENTATION_TREE_NODE_KEY];
  });

  let onModelChangeEvent: BeUiEvent<[TreeModel, TreeModelChanges]>;

  beforeEach(() => {
    treeModelMock.reset();
    treeModelSourceMock.reset();
    selectionHandlerMock.reset();
    nodeLoaderMock.reset();

    onModelChangeEvent = new BeUiEvent<[TreeModel, TreeModelChanges]>();
    treeModelSourceMock.setup((x) => x.onModelChanged).returns(() => onModelChangeEvent);
    nodeLoaderMock.setup((x) => x.dataProvider).returns(() => dataProviderMock.object);
    nodeLoaderMock.setup((x) => x.modelSource).returns(() => treeModelSourceMock.object);

    selectionHandlerMock.setup((x) => x.getSelection()).returns(() => new KeySet([]));
    unifiedEventHandler = new UnifiedSelectionTreeEventHandler({
      nodeLoader: nodeLoaderMock.object,
      name: "Tree_Test",
      selectionHandler: selectionHandlerMock.object,
    });
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

  describe("modelSource", () => {

    it("returns modelSource", () => {
      expect(unifiedEventHandler.modelSource).to.be.eq(treeModelSourceMock.object);
    });

  });

  describe("onSelectionModified", () => {

    it("adds nodes to selection", async () => {
      const node1: MutableTreeModelNode = createNode();
      const node2: MutableTreeModelNode = createNode(createRandomGroupingNodeKey);
      const selectionKeys = SelectionHelper.getKeysForSelection([
        dataProviderMock.target.getNodeKey(node1.item),
        dataProviderMock.target.getNodeKey(node2.item),
      ]);

      treeModelSourceMock.setup((x) => x.getModel()).returns(() => treeModelMock.object);
      treeModelMock.setup((x) => x.getNode(node1.item.id)).returns(() => node1);
      treeModelMock.setup((x) => x.getNode(node2.item.id)).returns(() => node2);

      const { observable, waitForCompletion } = awaitableObservable([{ selectedNodeItems: [node1.item, node2.item], deselectedNodeItems: [] }]);
      const event: TreeSelectionModificationEventArgs = {
        modifications: observable,
      };
      unifiedEventHandler.onSelectionModified(event);
      await waitForCompletion();

      selectionHandlerMock
        .verify((x) => x.addToSelection(selectionKeys), moq.Times.once());
    });

    it("removes nodes from selection", async () => {
      const node1: MutableTreeModelNode = createNode();
      const node2: MutableTreeModelNode = createNode(createRandomGroupingNodeKey);
      const selectionKeys = SelectionHelper.getKeysForSelection([
        dataProviderMock.target.getNodeKey(node1.item),
        dataProviderMock.target.getNodeKey(node2.item),
      ]);

      treeModelSourceMock.setup((x) => x.getModel()).returns(() => treeModelMock.object);
      treeModelMock.setup((x) => x.getNode(node1.item.id)).returns(() => node1);
      treeModelMock.setup((x) => x.getNode(node2.item.id)).returns(() => node2);

      const { observable, waitForCompletion } = awaitableObservable([{ selectedNodeItems: [], deselectedNodeItems: [node1.item, node2.item] }]);
      const event: TreeSelectionModificationEventArgs = {
        modifications: observable,
      };
      unifiedEventHandler.onSelectionModified(event);
      await waitForCompletion();

      selectionHandlerMock
        .verify((x) => x.removeFromSelection(selectionKeys), moq.Times.once());
    });

    it("applies unified selection after event is handled", async () => {
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

      const { observable, waitForCompletion } = awaitableObservable([{ selectedNodeItems: [nodes[0].item], deselectedNodeItems: [] }]);
      const event: TreeSelectionModificationEventArgs = {
        modifications: observable,
      };
      unifiedEventHandler.onSelectionModified(event);
      await waitForCompletion();

      expect(nodes[0].isSelected).to.be.true;
      expect(nodes[1].isSelected).to.be.true;
    });

  });

  describe("onSelectionReplaced", () => {

    it("collects affected node items", async () => {
      const node1: MutableTreeModelNode = createNode();
      const node2: MutableTreeModelNode = createNode(createRandomGroupingNodeKey);
      const selectionKeys = SelectionHelper.getKeysForSelection([
        dataProviderMock.target.getNodeKey(node1.item),
        dataProviderMock.target.getNodeKey(node2.item),
      ]);

      treeModelSourceMock.setup((x) => x.getModel()).returns(() => treeModelMock.object);
      treeModelMock.setup((x) => x.getNode(node1.item.id)).returns(() => node1);
      treeModelMock.setup((x) => x.getNode(node2.item.id)).returns(() => node2);

      const { observable, waitForCompletion } = awaitableObservable([{ selectedNodeItems: [node1.item, node2.item] }]);
      const event: TreeSelectionReplacementEventArgs = {
        replacements: observable,
      };
      unifiedEventHandler.onSelectionReplaced(event);
      await waitForCompletion();

      selectionHandlerMock.verify((x) => x.replaceSelection(selectionKeys), moq.Times.once());
    });

    it("adds to selection loaded nodes", async () => {
      const node1: MutableTreeModelNode = createNode();
      const node2: MutableTreeModelNode = createNode();

      treeModelSourceMock.setup((x) => x.getModel()).returns(() => treeModelMock.object);
      treeModelMock.setup((x) => x.getNode(node1.item.id)).returns(() => node1);
      treeModelMock.setup((x) => x.getNode(node2.item.id)).returns(() => node2);

      const { observable, waitForCompletion } = awaitableObservable([{ selectedNodeItems: [node1.item] }, { selectedNodeItems: [node2.item] }]);
      const event: TreeSelectionReplacementEventArgs = {
        replacements: observable,
      };
      unifiedEventHandler.onSelectionReplaced(event);
      await waitForCompletion();

      selectionHandlerMock.verify((x) => x.replaceSelection(SelectionHelper.getKeysForSelection([dataProviderMock.target.getNodeKey(node1.item)])), moq.Times.once());
      selectionHandlerMock.verify((x) => x.addToSelection(SelectionHelper.getKeysForSelection([dataProviderMock.target.getNodeKey(node2.item)])), moq.Times.once());
    });

    it("does not replace selection if event does not have nodes", async () => {
      treeModelSourceMock.setup((x) => x.getModel()).returns(() => treeModelMock.object);

      const { observable, waitForCompletion } = awaitableObservable([{ selectedNodeItems: [] }]);
      const event: TreeSelectionReplacementEventArgs = {
        replacements: observable,
      };
      unifiedEventHandler.onSelectionReplaced(event);
      await waitForCompletion();

      selectionHandlerMock.verify((x) => x.replaceSelection(moq.It.isAny()), moq.Times.never());
    });

    it("applies unified selection after event is handled", async () => {
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

      const { observable, waitForCompletion } = awaitableObservable([{ selectedNodeItems: [nodes[0].item] }]);
      const event: TreeSelectionReplacementEventArgs = {
        replacements: observable,
      };
      unifiedEventHandler.onSelectionReplaced(event);
      await waitForCompletion();

      expect(nodes[0].isSelected).to.be.true;
      expect(nodes[1].isSelected).to.be.true;
    });

  });

  describe("model change handling", () => {

    it("applies unified selection for added nodes", () => {
      const node = createNode();
      selectionHandlerMock.setup((x) => x.getSelection()).returns(() => new KeySet([dataProviderMock.target.getNodeKey(node.item)]));
      treeModelSourceMock.setup((x) => x.modifyModel(moq.It.isAny())).callback((action) => action(treeModelMock.object));
      treeModelMock.setup((x) => x.getNode(node.id)).returns(() => node);

      onModelChangeEvent.emit([treeModelMock.object, { addedNodeIds: [node.id], modifiedNodeIds: [], removedNodeIds: [] }]);
      expect(node.isSelected).to.be.true;
    });

    it("applies unified selection for modified nodes", () => {
      const node = createNode();
      selectionHandlerMock.setup((x) => x.getSelection()).returns(() => new KeySet([dataProviderMock.target.getNodeKey(node.item)]));
      treeModelSourceMock.setup((x) => x.modifyModel(moq.It.isAny())).callback((action) => action(treeModelMock.object));
      treeModelMock.setup((x) => x.getNode(node.id)).returns(() => node);

      onModelChangeEvent.emit([treeModelMock.object, { addedNodeIds: [], modifiedNodeIds: [node.id], removedNodeIds: [] }]);
      expect(node.isSelected).to.be.true;
    });

    it("deselects added node without key", () => {
      const node = createNode();
      node.isSelected = true;
      const keySet = new KeySet([dataProviderMock.target.getNodeKey(node.item)]);
      selectionHandlerMock.setup((x) => x.getSelection()).returns(() => keySet);
      treeModelSourceMock.setup((x) => x.modifyModel(moq.It.isAny())).callback((action) => action(treeModelMock.object));
      (node.item as any)[PRESENTATION_TREE_NODE_KEY] = undefined;

      treeModelMock.setup((x) => x.getNode(node.id)).returns(() => node);

      onModelChangeEvent.emit([treeModelMock.object, { addedNodeIds: [node.id], modifiedNodeIds: [], removedNodeIds: [] }]);
      expect(node.isSelected).to.be.false;
    });

    it("skips onModelChange event if it is currently selecting nodes", () => {
      treeModelSourceMock.reset();
      treeModelSourceMock.setup((x) => x.modifyModel(moq.It.isAny())).verifiable(moq.Times.never());

      (unifiedEventHandler as any)._inSelection = true;

      onModelChangeEvent.emit([treeModelMock.object, { addedNodeIds: [], modifiedNodeIds: [], removedNodeIds: [] }]);
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
        createNode(createRandomECInstancesNodeKey),
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
      const spy = sinon.spy((unifiedEventHandler as any)._cancelled, "next");
      selectionEvent.changeType = SelectionChangeType.Replace;

      selectionHandlerMock.target.onSelect!(selectionEvent, selectionProviderMock.object);
      expect(spy).to.be.called;
    });

  });

});

describe("useUnifiedSelectionTreeEventHandler", () => {
  const modelSourceMock = moq.Mock.ofType<TreeModelSource>();
  const nodeLoaderMock = moq.Mock.ofType<AbstractTreeNodeLoaderWithProvider<IPresentationTreeDataProvider>>();
  const dataProviderMock = moq.Mock.ofType<IPresentationTreeDataProvider>();

  beforeEach(() => {
    sinon.stub(Presentation, "selection").get(() => moq.Mock.ofType<SelectionManager>().object);
    modelSourceMock.reset();
    nodeLoaderMock.reset();
    dataProviderMock.reset();
    modelSourceMock.setup((x) => x.onModelChanged).returns(() => new BeUiEvent<[TreeModel, TreeModelChanges]>());
    nodeLoaderMock.setup((x) => x.dataProvider).returns(() => dataProviderMock.object);
    nodeLoaderMock.setup((x) => x.modelSource).returns(() => modelSourceMock.object);
  });

  afterEach(() => {
    sinon.restore();
  });

  it("creates and disposes UnifiedSelectionTreeEventHandler", () => {
    const selectionHandlerMock = moq.Mock.ofType<SelectionHandler>();

    const { result, unmount } = renderHook(
      (props: UnifiedSelectionTreeEventHandlerParams) => useUnifiedSelectionTreeEventHandler(props),
      { initialProps: { nodeLoader: nodeLoaderMock.object, selectionHandler: selectionHandlerMock.object } },
    );

    expect(result.current).to.not.be.undefined;
    const spy = sinon.spy(result.current, "dispose");
    unmount();
    expect(spy).to.be.called;
  });

});
