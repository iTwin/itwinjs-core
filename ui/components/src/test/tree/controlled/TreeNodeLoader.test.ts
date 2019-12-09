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
import { ITreeDataProvider, TreeNodeItem, TreeDataProviderRaw, TreeDataChangesListener } from "../../../ui-components/tree/TreeDataProvider";
import { PagedTreeNodeLoader, TreeDataSource, TreeNodeLoader, LoadedNodeHierarchyItem, LoadedNodeHierarchy } from "../../../ui-components/tree/controlled/TreeNodeLoader";
import { MutableTreeModelNode, TreeNodeItemData, TreeModelRootNode } from "../../../ui-components/tree/controlled/TreeModel";
import { createRandomMutableTreeModelNode, createRandomTreeNodeItems } from "./RandomTreeNodesHelpers";
import { extractSequence } from "../ObservableTestHelpers";
import { Observable } from "../../../ui-components/tree/controlled/Observable";

const mockDataProvider = (dataProviderMock: moq.IMock<ITreeDataProvider>, pageSize: number) => {
  const rootWithChildren = createRandomMutableTreeModelNode();
  rootWithChildren.item.autoExpand = false;

  const rootNodeItems: TreeNodeItemData[] = [rootWithChildren.item, ...createRandomTreeNodeItems(pageSize * 2 - 1)];
  const firstRootPage = rootNodeItems.slice(0, pageSize);
  const secondRootPage = rootNodeItems.slice(pageSize, pageSize);

  // disable children autoExpand to avoid mocking grandchildren load
  const childItems = createRandomTreeNodeItems(pageSize);
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

  dataProviderMock.setup((x) => x.getNodes(undefined, undefined)).returns(async () => rootNodeItems);
  dataProviderMock.setup((x) => x.getNodes(undefined, { start: 0, size: pageSize })).returns(async () => firstRootPage);
  dataProviderMock.setup((x) => x.getNodes(undefined, { start: pageSize, size: pageSize })).returns(async () => secondRootPage);

  return {
    rootWithChildren,
    rootNodeItems,
    firstRootPage,
    secondRootPage,
    childItems,
  };
};

const collectIdsFromHierarchy = (hierarchyItems: LoadedNodeHierarchyItem[], result: string[] = []) => {
  for (const hierarchyItem of hierarchyItems) {
    result.push(hierarchyItem.item.id);
    if (hierarchyItem.children)
      collectIdsFromHierarchy(hierarchyItem.children, result);
  }
  return result;
};

const extractLoadedNodeIds = async (obs: Observable<LoadedNodeHierarchy>) => {
  const loadedHierarchy = await extractSequence(rxjsFrom(obs));
  if (loadedHierarchy.length === 0)
    return [];
  return collectIdsFromHierarchy(loadedHierarchy[0].hierarchyItems);
};

const itemIds = (items: TreeNodeItem[]) => items.map((item) => item.id);

describe("TreeNodeLoader", () => {
  const dataProviderMock = moq.Mock.ofType<ITreeDataProvider>();
  let treeNodeLoader: TreeNodeLoader<ITreeDataProvider>;

  beforeEach(() => {
    dataProviderMock.reset();

    dataProviderMock.setup((x) => x.onTreeNodeChanged).returns(() => undefined);
    treeNodeLoader = new TreeNodeLoader(dataProviderMock.object);
  });

  describe("getDataProvider", () => {

    it("returns data provider", () => {
      expect(treeNodeLoader.getDataProvider()).to.be.eq(dataProviderMock.object);
    });

  });

  describe("loadNode", () => {
    const treeRootNode: TreeModelRootNode = { depth: -1, id: undefined, numChildren: undefined };
    let rootNodes: TreeNodeItemData[];
    let rootWithChildren: MutableTreeModelNode;
    let childNodes: TreeNodeItemData[];

    beforeEach(() => {
      const mockedItems = mockDataProvider(dataProviderMock, 2);
      rootNodes = mockedItems.rootNodeItems;
      rootWithChildren = mockedItems.rootWithChildren;
      childNodes = mockedItems.childItems;
    });

    it("emits onNodeLoaded event", async () => {
      const spy = sinon.spy();
      treeNodeLoader.onNodeLoaded.addListener(spy);
      await extractLoadedNodeIds(treeNodeLoader.loadNode(treeRootNode));
      expect(spy).to.be.calledOnce;
    });

    it("loads all root nodes", async () => {
      const loadResultObs = treeNodeLoader.loadNode(treeRootNode);
      const loadedIds = await extractLoadedNodeIds(loadResultObs);
      expect(loadedIds).to.be.deep.eq(itemIds(rootNodes));
    });

    it("loads all children for node", async () => {
      rootWithChildren.isLoading = false;

      dataProviderMock.setup((x) => x.getNodes(rootWithChildren.item, moq.It.isAny())).returns(async () => childNodes);

      const loadResultObs = treeNodeLoader.loadNode(rootWithChildren);
      const loadedIds = await extractLoadedNodeIds(loadResultObs);
      expect(loadedIds).to.be.deep.eq(itemIds(childNodes));
    });

    it("makes only one request to load nodes", async () => {
      const loadResultObs = treeNodeLoader.loadNode(treeRootNode);
      const loadResultObs2 = treeNodeLoader.loadNode(treeRootNode);
      const loadedIds = await extractLoadedNodeIds(loadResultObs);
      const loadedIds2 = await extractLoadedNodeIds(loadResultObs2);
      expect(loadedIds).to.be.deep.eq(itemIds(rootNodes));
      expect(loadedIds2).to.be.empty;
    });

  });

});

describe("PagedTreeNodeLoader", () => {
  const dataProviderMock = moq.Mock.ofType<ITreeDataProvider>();

  let pagedTreeNodeLoader: PagedTreeNodeLoader<ITreeDataProvider>;

  const pageSize = 2;

  beforeEach(() => {
    dataProviderMock.reset();

    dataProviderMock.setup((x) => x.onTreeNodeChanged).returns(() => undefined);

    pagedTreeNodeLoader = new PagedTreeNodeLoader(dataProviderMock.object, pageSize);
  });

  describe("getPageSize", () => {

    it("returns page size", () => {
      expect(pagedTreeNodeLoader.getPageSize()).to.be.eq(pageSize);
    });

  });

  describe("getDataProvider", () => {

    it("return data provider", () => {
      expect(pagedTreeNodeLoader.getDataProvider()).to.be.eq(dataProviderMock.object);
    });

  });

  describe("loadNode", () => {
    const treeRootNode: TreeModelRootNode = { depth: -1, id: undefined, numChildren: undefined };

    let rootWithChildren: MutableTreeModelNode;

    let firstRootPage: TreeNodeItemData[];
    let secondRootPage: TreeNodeItemData[];

    let childItems: TreeNodeItemData[];

    beforeEach(() => {
      const mockedItems = mockDataProvider(dataProviderMock, pageSize);
      rootWithChildren = mockedItems.rootWithChildren;
      firstRootPage = mockedItems.firstRootPage;
      secondRootPage = mockedItems.secondRootPage;
      childItems = mockedItems.childItems;
    });

    it("emits onNodeLoaded event", async () => {
      const spy = sinon.spy();
      pagedTreeNodeLoader.onNodeLoaded.addListener(spy);
      await extractLoadedNodeIds(pagedTreeNodeLoader.loadNode(treeRootNode, 0));
      expect(spy).to.be.calledOnce;
    });

    it("loads root nodes page when asking for first node", async () => {
      const loadResultObs = pagedTreeNodeLoader.loadNode(treeRootNode, 0);
      const loadedIds = await extractLoadedNodeIds(loadResultObs);
      expect(loadedIds).to.be.deep.eq(itemIds(firstRootPage));
    });

    it("loads child nodes page when asking for first child", async () => {
      rootWithChildren.isLoading = false;

      dataProviderMock.setup((x) => x.getNodes(rootWithChildren.item, moq.It.isAny())).returns(async () => childItems);

      const loadResultObs = pagedTreeNodeLoader.loadNode(rootWithChildren, 0);
      const loadedIds = await extractLoadedNodeIds(loadResultObs);
      expect(loadedIds).to.be.deep.eq(itemIds(childItems));
    });

    it("loads children of auto expanded node", async () => {
      rootWithChildren.item.autoExpand = true;

      dataProviderMock.setup((x) => x.getNodes(rootWithChildren.item, moq.It.isAny())).returns(async () => childItems);

      const loadResultObs = pagedTreeNodeLoader.loadNode(treeRootNode, 0);
      const loadedIds = await extractLoadedNodeIds(loadResultObs);
      const expectedNodeIds = [rootWithChildren.id, ...itemIds(childItems), ...itemIds(firstRootPage.slice(1))];
      expect(loadedIds).to.be.deep.eq(expectedNodeIds);
    });

    it("does one request when loading 2 nodes from same page", async () => {
      const loadResultObs = pagedTreeNodeLoader.loadNode(treeRootNode, 0);
      const loadResultObs2 = pagedTreeNodeLoader.loadNode(treeRootNode, 1);
      const loadedIds = await extractLoadedNodeIds(loadResultObs);
      const loadedIds2 = await extractLoadedNodeIds(loadResultObs2);
      expect(loadedIds).to.be.deep.eq(itemIds(firstRootPage));
      expect(loadedIds2).to.be.empty;
    });

    it("loads two pages of root nodes", async () => {
      const pageOne = pagedTreeNodeLoader.loadNode(treeRootNode, 0);
      const pageTwo = pagedTreeNodeLoader.loadNode(treeRootNode, pageSize);

      const pageOneLoadedIds = await extractLoadedNodeIds(pageOne);
      const pageTwoLoadedIds = await extractLoadedNodeIds(pageTwo);
      expect(pageOneLoadedIds).to.be.deep.eq(itemIds(firstRootPage));
      expect(pageTwoLoadedIds).to.be.deep.eq(itemIds(secondRootPage));
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
      const rawProvider = [{
        id: faker.random.uuid(),
        label: faker.random.uuid(),
        children: [{ id: faker.random.uuid(), label: faker.random.word() }],
      }, {
        id: faker.random.uuid(),
        label: faker.random.uuid(),
        children: [{ id: faker.random.uuid(), label: faker.random.word() }],
      }];

      it("loads one node", async () => {
        const dataSource = new TreeDataSource(rawProvider);

        const request = dataSource.requestItems(undefined, 0, 1, false);
        const result = await extractSequence(rxjsFrom(request));
        expect(result[0].loadedItems).to.be.deep.eq(rawProvider.slice(0, 1));
      });

      it("loads all nodes", async () => {
        const dataSource = new TreeDataSource(rawProvider);

        const request = dataSource.requestItems(undefined, 0, 0, false);
        const result = await extractSequence(rxjsFrom(request));
        expect(result[0].loadedItems).to.be.deep.eq(rawProvider);
      });

    });

    describe("using TreeDataProviderMethod", () => {
      const nodeItems = createRandomTreeNodeItems(2);
      const methodProvider = async () => nodeItems;

      it("loads one node", async () => {
        const dataSource = new TreeDataSource(methodProvider);

        const request = dataSource.requestItems(undefined, 0, 1, false);
        const result = await extractSequence(rxjsFrom(request));
        expect(result[0].loadedItems).to.be.deep.eq(nodeItems.slice(0, 1));
      });

      it("loads all nodes", async () => {
        const dataSource = new TreeDataSource(methodProvider);

        const request = dataSource.requestItems(undefined, 0, 0, false);
        const result = await extractSequence(rxjsFrom(request));
        expect(result[0].loadedItems).to.be.deep.eq(nodeItems);
      });

    });

    describe("using TreeDataProviderPromise", () => {
      const rawProvider = [{
        id: faker.random.uuid(),
        label: faker.random.uuid(),
        children: [{ id: faker.random.uuid(), label: faker.random.word() }],
      }, {
        id: faker.random.uuid(),
        label: faker.random.uuid(),
        children: [{ id: faker.random.uuid(), label: faker.random.word() }],
      }];
      const promiseProvider = new Promise<TreeDataProviderRaw>((resolve) => resolve(rawProvider));

      it("loads one node", async () => {
        const dataSource = new TreeDataSource(promiseProvider);

        const request = dataSource.requestItems(undefined, 0, 1, false);
        const result = await extractSequence(rxjsFrom(request));
        expect(result[0].loadedItems).to.be.deep.eq(rawProvider.slice(0, 1));
      });

      it("loads all nodes", async () => {
        const dataSource = new TreeDataSource(promiseProvider);

        const request = dataSource.requestItems(undefined, 0, 0, false);
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
