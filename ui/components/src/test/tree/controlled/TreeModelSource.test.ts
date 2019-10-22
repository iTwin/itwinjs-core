/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "typemoq";
import sinon from "sinon";
import * as faker from "faker";
import { Observable as RxjsObservable } from "rxjs/internal/Observable";
import { from as rxjsFrom } from "rxjs/internal/observable/from";
import { BeEvent } from "@bentley/bentleyjs-core";
import { TreeModelSource, TreeDataSource } from "../../../ui-components/tree/controlled/TreeModelSource";
import { ITreeDataProvider, TreeDataChangesListener, TreeNodeItem, TreeDataProviderRaw, TreeDataProvider } from "../../../ui-components/tree/TreeDataProvider";
import { MutableTreeModel, VisibleTreeNodes } from "../../../ui-components";
import { extractSequence } from "../ObservableTestHelpers";
import { TreeModelNodeInput, MutableTreeModelNode, TreeNodeItemData } from "../../../ui-components/tree/controlled/TreeModel";
import { createRandomMutableTreeModelNode, createRandomTreeNodeItems, createRandomTreeNodeItem } from "./RandomTreeNodesHelpers";

describe("TreeModelSource", () => {

  let modelSource: TreeModelSource<TreeDataProvider>;
  const dataProviderMock = moq.Mock.ofType<ITreeDataProvider>();
  const mutableTreeModelMock = moq.Mock.ofType<MutableTreeModel>();
  const visibleNodesMock = moq.Mock.ofType<VisibleTreeNodes>();

  const pageSize = 4;

  let onTreeNodeChanged: BeEvent<TreeDataChangesListener>;

  beforeEach(() => {
    dataProviderMock.reset();
    mutableTreeModelMock.reset();

    onTreeNodeChanged = new BeEvent<TreeDataChangesListener>();
    dataProviderMock.setup((x) => x.onTreeNodeChanged).returns(() => onTreeNodeChanged);
    modelSource = new TreeModelSource(dataProviderMock.object, pageSize);
  });

  describe("constructor", () => {

    it("listens for onModelChanged events", () => {
      (modelSource as any)._model = mutableTreeModelMock.object;
      mutableTreeModelMock.setup((x) => x.computeVisibleNodes()).returns(() => visibleNodesMock.object).verifiable(moq.Times.exactly(2));
      modelSource.getVisibleNodes();
      modelSource.onModelChanged.emit(mutableTreeModelMock.object);
      modelSource.getVisibleNodes();
      mutableTreeModelMock.verifyAll();
    });

  });

  describe("getDataProvider", () => {

    it("returns data provider", () => {
      const dataProvider = modelSource.getDataProvider();
      expect(dataProvider).to.be.deep.eq(dataProviderMock.object);
    });

  });

  describe("modifyModel", () => {

    it("does not emit onModelChanged event if model did not change", () => {
      const spy = sinon.spy(modelSource.onModelChanged, "emit");
      modelSource.modifyModel(() => { });
      expect(spy).to.not.be.called;
    });

    it("emits onModelChanged event if model has changed", () => {
      const input: TreeModelNodeInput = {
        id: faker.random.uuid(),
        isExpanded: faker.random.boolean(),
        item: { id: faker.random.uuid(), label: faker.random.word() },
        label: faker.random.word(),
        isLoading: faker.random.boolean(),
        isSelected: faker.random.boolean(),
      };
      const spy = sinon.spy(modelSource.onModelChanged, "emit");
      modelSource.modifyModel((model) => { model.setChildren(undefined, [input], 0); });
      expect(spy).to.be.called;
    });

  });

  describe("getModel", () => {

    it("returns model", () => {
      (modelSource as any)._model = mutableTreeModelMock.object;
      const model = modelSource.getModel();
      expect(model).to.be.eq(mutableTreeModelMock.object);
    });

  });

  describe("getVisibleNodes", () => {

    beforeEach(() => {
      (modelSource as any)._model = mutableTreeModelMock.object;
    });

    it("computes visible nodes", () => {
      mutableTreeModelMock.setup((x) => x.computeVisibleNodes()).returns(() => visibleNodesMock.object).verifiable(moq.Times.once());
      modelSource.getVisibleNodes();
      mutableTreeModelMock.verifyAll();
    });

    it("does not compute visible nodes second time", () => {
      mutableTreeModelMock.setup((x) => x.computeVisibleNodes()).returns(() => visibleNodesMock.object).verifiable(moq.Times.once());
      modelSource.getVisibleNodes();
      modelSource.getVisibleNodes();
      mutableTreeModelMock.verifyAll();
    });

  });

  describe("loadNode", () => {

    let rootWithChildren: MutableTreeModelNode;

    let rootNodeItems: TreeNodeItemData[];
    let firstRootPage: TreeNodeItemData[];
    let secondRootPage: TreeNodeItemData[];

    let childItems: TreeNodeItemData[];

    beforeEach(() => {
      dataProviderMock.reset();
      (modelSource as any)._model = mutableTreeModelMock.object;

      mutableTreeModelMock.setup((x) => x.getRootNode()).returns(() => ({ id: undefined, numChildren: undefined, depth: -1, parentId: undefined }));

      rootWithChildren = createRandomMutableTreeModelNode();
      rootWithChildren.item.autoExpand = false;

      rootNodeItems = [rootWithChildren.item, ...createRandomTreeNodeItems(pageSize * 2 - 1)];
      firstRootPage = rootNodeItems.slice(0, pageSize);
      secondRootPage = rootNodeItems.slice(pageSize, pageSize);

      // disable children autoExpand to avoid mocking grandchildren load
      childItems = createRandomTreeNodeItems(pageSize);
      childItems.forEach((item) => item.autoExpand = false);

      // mock tree hierarchy
      dataProviderMock.setup((x) => x.getNodesCount(undefined)).returns(async () => rootNodeItems.length);
      dataProviderMock.setup((x) => x.getNodesCount(rootWithChildren.item)).returns(async () => childItems.length);

      for (let i = 1; i < rootNodeItems.length; i++) {
        // disable autoExpand to avoid mocking children load
        rootNodeItems[i].autoExpand = false;
        const childCount = rootNodeItems[i].children ? rootNodeItems[i].children!.length : 0;
        dataProviderMock.setup((x) => x.getNodesCount(rootNodeItems[i])).returns(async () => childCount);
      }

      for (const item of childItems)
        dataProviderMock.setup((x) => x.getNodesCount(item)).returns(async () => 0);

      dataProviderMock.setup((x) => x.getNodes(undefined, { start: 0, size: pageSize })).returns(async () => firstRootPage);
      dataProviderMock.setup((x) => x.getNodes(undefined, { start: pageSize, size: pageSize })).returns(async () => secondRootPage);
    });

    const itemIds = (items: TreeNodeItem[]) => items.map((item) => item.id);

    it("loads root nodes page when asking for first node", async () => {
      const loadResultObs = modelSource.loadNode(undefined, 0);
      const result = await extractSequence(rxjsFrom(loadResultObs));
      expect(result[0].loadedNodes).to.be.deep.eq(itemIds(firstRootPage));
    });

    it("loads child nodes page when asking for first child", async () => {
      rootWithChildren.isLoading = false;

      mutableTreeModelMock.setup((x) => x.getNode(rootWithChildren.id)).returns(() => rootWithChildren);
      dataProviderMock.setup((x) => x.getNodes(rootWithChildren.item, moq.It.isAny())).returns(async () => childItems);

      const loadResultObs = modelSource.loadNode(rootWithChildren.id, 0);
      const result = await extractSequence(rxjsFrom(loadResultObs));
      expect(result[0].loadedNodes).to.be.deep.eq(itemIds(childItems));
    });

    it("loads children of auto expanded node", async () => {
      rootWithChildren.item.autoExpand = true;

      dataProviderMock.setup((x) => x.getNodes(rootWithChildren.item, moq.It.isAny())).returns(async () => childItems);

      const loadResultObs = modelSource.loadNode(undefined, 0);
      const result = await extractSequence(rxjsFrom(loadResultObs));
      const expectedNodeIds = [rootWithChildren.id, ...itemIds(childItems), ...itemIds(firstRootPage.slice(1))];
      expect(result[0].loadedNodes).to.be.deep.eq(expectedNodeIds);
    });

    it("does one request when loading 2 nodes from same page", async () => {
      const loadResultObs = modelSource.loadNode(undefined, 0);
      const loadResultObs2 = modelSource.loadNode(undefined, 1);
      const result = await extractSequence(rxjsFrom(loadResultObs));
      const result2 = await extractSequence(rxjsFrom(loadResultObs2));
      expect(result.length).to.be.eq(1);
      expect(result[0].loadedNodes).to.be.deep.eq(itemIds(firstRootPage));
      expect(result2).to.be.empty;
    });

    it("loads two pages of root nodes", async () => {
      const pageOne = modelSource.loadNode(undefined, 0);
      const pageTwo = modelSource.loadNode(undefined, pageSize);
      const resultPageOne = await extractSequence(rxjsFrom(pageOne));
      const resultPageTwo = await extractSequence(rxjsFrom(pageTwo));
      expect(resultPageOne[0].loadedNodes).to.be.deep.eq(itemIds(firstRootPage));
      expect(resultPageTwo[0].loadedNodes).to.be.deep.eq(itemIds(secondRootPage));
    });

    it("changes parent load status when loads children", async () => {
      rootWithChildren.isLoading = true;

      mutableTreeModelMock.setup((x) => x.getNode(rootWithChildren.id)).returns(() => rootWithChildren);
      dataProviderMock.setup((x) => x.getNodes(rootWithChildren.item, moq.It.isAny())).returns(async () => childItems);

      const request = modelSource.loadNode(rootWithChildren.id, 0);
      const result = await extractSequence(rxjsFrom(request));
      expect(result[0].loadedNodes).to.be.deep.eq(itemIds(childItems));
      expect(rootWithChildren.isLoading).to.be.false;
    });

    it("does not update children if parent node was removed", async () => {
      rootWithChildren.isLoading = true;

      // mock parent node still in model during request creation
      mutableTreeModelMock.setup((x) => x.getNode(rootWithChildren.id)).returns(() => rootWithChildren);
      dataProviderMock.setup((x) => x.getNodes(rootWithChildren.item, moq.It.isAny())).returns(async () => childItems);

      const request = modelSource.loadNode(rootWithChildren.id, 0);
      // mock parent node removed from model
      mutableTreeModelMock.reset();

      const result = await extractSequence(rxjsFrom(request));
      expect(result[0].loadedNodes).to.be.deep.eq(itemIds(childItems));
      expect(rootWithChildren.isLoading).to.be.true;
    });

    it("does load children if parent node is disposed", async () => {
      // mock parent node disposed
      mutableTreeModelMock.setup((x) => x.getNode(rootWithChildren.id)).returns(() => undefined);
      dataProviderMock.setup((x) => x.getNodes(rootWithChildren.item, moq.It.isAny())).verifiable(moq.Times.never());

      const request = modelSource.loadNode(rootWithChildren.id, 0);
      const result = await extractSequence(rxjsFrom(request));
      dataProviderMock.verifyAll();

      expect(result).to.be.empty;
    });

  });

});

describe("TreeDataSource", () => {

  describe("constructor", () => {

    it("handles dataProvider onTreeNodeChanged event", () => {
      const onTreeNodeChangedEvent = new BeEvent<TreeDataChangesListener>();
      const dataProviderMock = moq.Mock.ofType<ITreeDataProvider>();
      dataProviderMock.setup((x) => x.onTreeNodeChanged).returns(() => onTreeNodeChangedEvent);

      const treeDataSource = new TreeDataSource(dataProviderMock.object);
      const spy = sinon.spy(treeDataSource.onItemsChanged, "raiseEvent");
      onTreeNodeChangedEvent.raiseEvent();
      expect(spy).to.be.called;
    });

  });

  describe("requestItems", () => {

    describe("using TreeDataProviderRaw", () => {

      it("loads node", async () => {
        const rawProvider = [{
          id: faker.random.uuid(),
          label: faker.random.uuid(),
          children: [{ id: faker.random.uuid(), label: faker.random.word() }],
        }];
        const dataSource = new TreeDataSource(rawProvider);

        const request = dataSource.requestItems(undefined, 0, 5, false);
        const result = await extractSequence(rxjsFrom(request));
        expect(result[0].loadedItems).to.be.deep.eq(rawProvider);
      });

    });

    describe("using TreeDataProviderMethod", () => {

      it("loads node", async () => {
        const nodeItem = createRandomTreeNodeItem();
        const methodProvider = async () => [nodeItem];
        const dataSource = new TreeDataSource(methodProvider);

        const request = dataSource.requestItems(undefined, 0, 5, false);
        const result = await extractSequence(rxjsFrom(request));
        expect(result[0].loadedItems).to.be.deep.eq([nodeItem]);
      });

    });

    describe("using TreeDataProviderPromise", () => {

      it("loads node", async () => {
        const rawProvider = [{
          id: faker.random.uuid(),
          label: faker.random.uuid(),
          children: [{ id: faker.random.uuid(), label: faker.random.word() }],
        }];
        const promiseProvider = new Promise<TreeDataProviderRaw>((resolve) => resolve(rawProvider));
        const dataSource = new TreeDataSource(promiseProvider);

        const request = dataSource.requestItems(undefined, 0, 5, false);
        const result = await extractSequence(rxjsFrom(request));
        expect(result[0].loadedItems).to.be.deep.eq(rawProvider);
      });

    });

    describe("using Unknown tree data provider", () => {

      const waitForCompleteOrError = async <T extends {}>(observable: RxjsObservable<T>) => {
        return new Promise<void>((resolve, reject) => {
          observable.subscribe({
            error: (err) => reject(err),
            complete: () => resolve(),
          });
        });
      };

      it("throws error", async () => {
        // @ts-ignore
        const dataSource = new TreeDataSource({});

        const request = dataSource.requestItems(undefined, 0, 5, false);
        await expect(waitForCompleteOrError(request)).to.eventually.be.rejected;
      });

    });

  });

});
